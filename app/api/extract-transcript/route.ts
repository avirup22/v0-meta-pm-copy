import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"

export async function POST(req: NextRequest) {
  const { itemId, token } = await req.json()

  if (!itemId || !token) {
    return NextResponse.json({ error: "Missing itemId or token" }, { status: 400 })
  }

  // Step 1 – get the OneDrive download URL for this item
  const metaUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?$select=id,name,@microsoft.graph.downloadUrl`
  console.log("[v0] extract-transcript: fetching download URL →", metaUrl)

  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log("[v0] extract-transcript: meta status:", metaRes.status)

  if (!metaRes.ok) {
    const body = await metaRes.json().catch(() => ({}))
    const msg = body?.error?.message ?? `HTTP ${metaRes.status}`
    console.error("[v0] extract-transcript: failed to get download URL:", msg)
    return NextResponse.json({ error: msg }, { status: metaRes.status })
  }

  const meta = await metaRes.json()
  const downloadUrl: string | undefined = meta["@microsoft.graph.downloadUrl"]

  if (!downloadUrl) {
    console.error("[v0] extract-transcript: no @microsoft.graph.downloadUrl in response")
    return NextResponse.json({ error: "No download URL returned by Graph API." }, { status: 502 })
  }
  console.log("[v0] extract-transcript: download URL obtained for item:", meta.name)

  // Step 2 – stream the MP4 from OneDrive
  console.log("[v0] extract-transcript: starting MP4 stream from OneDrive")
  const videoRes = await fetch(downloadUrl)
  console.log("[v0] extract-transcript: video stream status:", videoRes.status)

  if (!videoRes.ok || !videoRes.body) {
    console.error("[v0] extract-transcript: failed to stream video")
    return NextResponse.json({ error: `Failed to stream video: HTTP ${videoRes.status}` }, { status: 502 })
  }

  // Step 3 – pipe through ffmpeg to extract the first subtitle stream as WebVTT
  // ffmpeg reads from stdin (pipe:0) and writes WebVTT to stdout (pipe:1)
  console.log("[v0] extract-transcript: spawning ffmpeg to extract subtitle track")

  return new Promise<NextResponse>((resolve) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",          // read MP4 from stdin
      "-map", "0:s:0",         // select first subtitle stream
      "-f", "webvtt",          // output format WebVTT
      "pipe:1",                // write to stdout
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    })

    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk)
    })

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      errChunks.push(chunk)
    })

    ffmpeg.on("close", (code) => {
      const stderrLog = Buffer.concat(errChunks).toString()
      console.log("[v0] extract-transcript: ffmpeg exited with code:", code)
      if (code !== 0) {
        console.error("[v0] extract-transcript: ffmpeg stderr:", stderrLog.slice(-800))
        // Parse what subtitle streams were available for a better error message
        const streamHint = stderrLog.includes("Subtitle")
          ? "A subtitle stream was detected but could not be extracted."
          : "No embedded subtitle/transcript stream found in this recording."
        resolve(NextResponse.json({ error: streamHint, ffmpegLog: stderrLog.slice(-800) }, { status: 422 }))
        return
      }

      const vttText = Buffer.concat(chunks).toString("utf-8")
      console.log("[v0] extract-transcript: extracted VTT length:", vttText.length, "chars")

      // Parse the VTT into structured lines
      const lines = parseVTT(vttText)
      console.log("[v0] extract-transcript: parsed", lines.length, "transcript lines")
      resolve(NextResponse.json({ lines }))
    })

    ffmpeg.on("error", (err) => {
      console.error("[v0] extract-transcript: ffmpeg spawn error:", err.message)
      resolve(NextResponse.json({ error: `ffmpeg error: ${err.message}` }, { status: 500 }))
    })

    // Pipe the OneDrive video stream into ffmpeg stdin
    const reader = videoRes.body!.getReader()
    async function pump() {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            ffmpeg.stdin.end()
            break
          }
          const canContinue = ffmpeg.stdin.write(value)
          if (!canContinue) {
            await new Promise<void>((res) => ffmpeg.stdin.once("drain", res))
          }
        }
      } catch (err) {
        console.error("[v0] extract-transcript: stream pump error:", err)
        ffmpeg.stdin.destroy()
      }
    }
    pump()
  })
}

interface TranscriptLine {
  timestamp: string
  speaker: string
  text: string
}

function parseVTT(vttContent: string): TranscriptLine[] {
  const lines: TranscriptLine[] = []
  const blocks = vttContent.split(/\n\n+/)

  for (const block of blocks) {
    const blockLines = block.trim().split("\n")
    const tsIdx = blockLines.findIndex((l) => l.includes(" --> "))
    if (tsIdx === -1) continue

    const startTime = blockLines[tsIdx].split(" --> ")[0].trim()
    // Keep HH:MM:SS only, drop milliseconds
    const timestamp = startTime.replace(/\.\d{3}$/, "")

    const rawText = blockLines.slice(tsIdx + 1).join(" ").trim()

    // Extract <v SpeakerName> tag
    const speakerMatch = rawText.match(/^<v ([^>]+)>/)
    const speaker = speakerMatch ? speakerMatch[1] : ""
    const text = rawText
      .replace(/<v [^>]+>/g, "")
      .replace(/<\/v>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim()

    if (text) lines.push({ timestamp, speaker, text })
  }

  return lines
}

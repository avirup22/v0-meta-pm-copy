import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import ffmpegPath from "ffmpeg-static"

// ─── VTT parser ────────────────────────────────────────────────────────────────

interface TranscriptLine {
  timestamp: string
  speaker: string
  text: string
}

function parseVTT(vttContent: string): TranscriptLine[] {
  const lines: TranscriptLine[] = []
  const blocks = vttContent.split(/\n\n+/)
  console.log("[v0] parseVTT: total blocks to parse:", blocks.length)

  for (const block of blocks) {
    const blockLines = block.trim().split("\n")
    const tsIdx = blockLines.findIndex((l) => l.includes(" --> "))
    if (tsIdx === -1) continue

    const startTime = blockLines[tsIdx].split(" --> ")[0].trim()
    // HH:MM:SS only, drop milliseconds
    const timestamp = startTime.replace(/\.\d{3}$/, "")

    const rawText = blockLines.slice(tsIdx + 1).join(" ").trim()
    const speakerMatch = rawText.match(/^<v ([^>]+)>/)
    const speaker = speakerMatch ? speakerMatch[1] : ""
    const text = rawText
      .replace(/<v [^>]+>/g, "")
      .replace(/<\/v>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim()

    if (text) lines.push({ timestamp, speaker, text })
  }

  console.log("[v0] parseVTT: parsed line count:", lines.length)
  return lines
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log("[v0] extract-transcript: POST received")

  let body: { itemId?: string; token?: string }
  try {
    body = await req.json()
  } catch {
    console.error("[v0] extract-transcript: failed to parse request body")
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { itemId, token } = body

  if (!itemId || !token) {
    console.error("[v0] extract-transcript: missing itemId or token. itemId:", !!itemId, "token:", !!token)
    return NextResponse.json({ error: "Missing itemId or token" }, { status: 400 })
  }

  console.log("[v0] extract-transcript: processing itemId:", itemId)
  console.log("[v0] extract-transcript: ffmpeg binary path:", ffmpegPath)

  if (!ffmpegPath) {
    console.error("[v0] extract-transcript: ffmpeg-static did not resolve a binary path")
    return NextResponse.json({ error: "ffmpeg binary not available on this server." }, { status: 500 })
  }

  // ── Step 1: Get the OneDrive download URL via Graph API ──────────────────────
  const metaUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?$select=id,name,size,@microsoft.graph.downloadUrl`
  console.log("[v0] extract-transcript: fetching item metadata →", metaUrl)

  let metaRes: Response
  try {
    metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (fetchErr) {
    console.error("[v0] extract-transcript: network error fetching metadata:", fetchErr)
    return NextResponse.json({ error: "Network error contacting Graph API." }, { status: 502 })
  }

  console.log("[v0] extract-transcript: metadata HTTP status:", metaRes.status)

  if (!metaRes.ok) {
    const errBody = await metaRes.json().catch(() => ({}))
    const msg = (errBody as { error?: { message?: string } })?.error?.message ?? `HTTP ${metaRes.status}`
    console.error("[v0] extract-transcript: Graph API error:", msg)
    return NextResponse.json({ error: msg }, { status: metaRes.status })
  }

  const meta = await metaRes.json() as { id: string; name: string; size: number; "@microsoft.graph.downloadUrl"?: string }
  console.log("[v0] extract-transcript: item name:", meta.name, "| size (bytes):", meta.size)

  const downloadUrl: string | undefined = meta["@microsoft.graph.downloadUrl"]
  if (!downloadUrl) {
    console.error("[v0] extract-transcript: @microsoft.graph.downloadUrl missing from Graph response")
    return NextResponse.json({ error: "No download URL returned by Graph API." }, { status: 502 })
  }
  console.log("[v0] extract-transcript: download URL obtained (length:", downloadUrl.length, "chars)")

  // ── Step 2: Stream the MP4 from OneDrive ─────────────────────────────────────
  console.log("[v0] extract-transcript: initiating MP4 stream from OneDrive")

  let videoRes: Response
  try {
    videoRes = await fetch(downloadUrl)
  } catch (streamErr) {
    console.error("[v0] extract-transcript: network error opening video stream:", streamErr)
    return NextResponse.json({ error: "Network error streaming video from OneDrive." }, { status: 502 })
  }

  console.log("[v0] extract-transcript: video stream HTTP status:", videoRes.status)
  console.log("[v0] extract-transcript: video content-type:", videoRes.headers.get("content-type"))
  console.log("[v0] extract-transcript: video content-length:", videoRes.headers.get("content-length"))

  if (!videoRes.ok || !videoRes.body) {
    console.error("[v0] extract-transcript: failed to open video stream")
    return NextResponse.json({ error: `Failed to stream video: HTTP ${videoRes.status}` }, { status: 502 })
  }

  // ── Step 3: Pipe into ffmpeg, extract embedded subtitle track ────────────────
  // Command:  ffmpeg -i pipe:0 -map 0:s:0 -f webvtt pipe:1
  // - pipe:0  = stdin (MP4 bytes streamed from OneDrive)
  // - 0:s:0   = first subtitle stream in the container
  // - webvtt  = output as plain WebVTT text
  // - pipe:1  = stdout (captured by us)
  console.log("[v0] extract-transcript: spawning ffmpeg:", ffmpegPath)
  console.log("[v0] extract-transcript: ffmpeg args: -i pipe:0 -map 0:s:0 -f webvtt pipe:1")

  return new Promise<NextResponse>((resolve) => {
    const ffmpeg = spawn(ffmpegPath!, [
      "-i", "pipe:0",
      "-map", "0:s:0",
      "-f", "webvtt",
      "pipe:1",
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let bytesWrittenToFfmpeg = 0

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk)
    })

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk)
      // Print ffmpeg stderr incrementally so we can see progress
      process.stdout.write("[v0][ffmpeg] " + chunk.toString())
    })

    ffmpeg.on("error", (err) => {
      console.error("[v0] extract-transcript: ffmpeg spawn error:", err.message)
      resolve(NextResponse.json({ error: `ffmpeg spawn error: ${err.message}` }, { status: 500 }))
    })

    ffmpeg.on("close", (code, signal) => {
      const stderrFull = Buffer.concat(stderrChunks).toString("utf-8")
      console.log("[v0] extract-transcript: ffmpeg closed — code:", code, "| signal:", signal)
      console.log("[v0] extract-transcript: bytes written to ffmpeg stdin:", bytesWrittenToFfmpeg)
      console.log("[v0] extract-transcript: stdout bytes collected:", stdoutChunks.reduce((s, c) => s + c.length, 0))

      if (code !== 0) {
        // Try to give a helpful hint from the stderr log
        const hasSubtitle = stderrFull.toLowerCase().includes("subtitle")
        const hint = hasSubtitle
          ? "Subtitle track detected but could not be extracted. The track may be an image-based format (MOV_TEXT, DVDSUB) rather than text."
          : "No embedded text subtitle/transcript stream found in this MP4."
        console.error("[v0] extract-transcript: ffmpeg non-zero exit. hint:", hint)
        console.error("[v0] extract-transcript: last 1000 chars of stderr:\n", stderrFull.slice(-1000))
        resolve(
          NextResponse.json({
            error: hint,
            ffmpegLog: stderrFull.slice(-2000),
          }, { status: 422 })
        )
        return
      }

      const vttText = Buffer.concat(stdoutChunks).toString("utf-8")
      console.log("[v0] extract-transcript: VTT output length:", vttText.length, "chars")
      console.log("[v0] extract-transcript: VTT preview (first 300 chars):", vttText.slice(0, 300))

      if (!vttText.trim()) {
        console.warn("[v0] extract-transcript: ffmpeg succeeded but VTT output is empty")
        resolve(NextResponse.json({ error: "Transcript extracted but was empty." }, { status: 422 }))
        return
      }

      const lines = parseVTT(vttText)
      console.log("[v0] extract-transcript: final transcript lines:", lines.length)
      resolve(NextResponse.json({ lines, rawVtt: vttText }))
    })

    // ── Pump OneDrive stream → ffmpeg stdin ───────────────────────────────────
    const reader = videoRes.body!.getReader()

    async function pump() {
      console.log("[v0] extract-transcript: starting stdin pump")
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            console.log("[v0] extract-transcript: stream ended — closing ffmpeg stdin. Total bytes:", bytesWrittenToFfmpeg)
            ffmpeg.stdin.end()
            break
          }
          bytesWrittenToFfmpeg += value.byteLength
          const canContinue = ffmpeg.stdin.write(value)
          if (!canContinue) {
            // Back-pressure: wait for drain before writing more
            await new Promise<void>((res) => ffmpeg.stdin.once("drain", res))
          }
        }
      } catch (pumpErr) {
        console.error("[v0] extract-transcript: pump error:", pumpErr)
        ffmpeg.stdin.destroy()
      }
    }

    pump()
  })
}

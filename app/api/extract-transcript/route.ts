import { NextRequest, NextResponse } from "next/server"

interface TranscriptLine {
  timestamp: string
  speaker: string
  text: string
}

interface GraphTranscript {
  id: string
  createdDateTime?: string
  transcriptContentUrl?: string
}

// ─── VTT parser ────────────────────────────────────────────────────────────────
function parseVTT(vttContent: string): TranscriptLine[] {
  const lines: TranscriptLine[] = []
  const blocks = vttContent.split(/\n\n+/)
  console.log("[v0] parseVTT: total cue blocks:", blocks.length)

  for (const block of blocks) {
    const blockLines = block.trim().split("\n")
    const tsIdx = blockLines.findIndex((l) => l.includes(" --> "))
    if (tsIdx === -1) continue

    const startTime = blockLines[tsIdx].split(" --> ")[0].trim()
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

  console.log("[v0] parseVTT: parsed lines:", lines.length)
  return lines
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  console.log("[v0] extract-transcript: POST received")

  let body: { itemId?: string; token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { itemId, token } = body
  if (!itemId || !token) {
    console.error("[v0] extract-transcript: missing itemId or token")
    return NextResponse.json({ error: "Missing itemId or token" }, { status: 400 })
  }

  console.log("[v0] extract-transcript: itemId:", itemId)

  // ── Step 1: List transcripts for this drive item ───────────────────────────
  // Uses the native SharePoint/Graph transcript API:
  // GET /me/drive/items/{itemId}/media/transcripts
  const transcriptsUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/media/transcripts`
  console.log("[v0] extract-transcript: Step 1 – listing transcripts →", transcriptsUrl)

  const transcriptsRes = await fetch(transcriptsUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })

  console.log("[v0] extract-transcript: transcripts list HTTP status:", transcriptsRes.status)

  if (!transcriptsRes.ok) {
    const errBody = await transcriptsRes.json().catch(() => ({}))
    const msg = (errBody as { error?: { message?: string } })?.error?.message ?? `HTTP ${transcriptsRes.status}`
    console.error("[v0] extract-transcript: transcripts list error:", msg)
    console.error("[v0] extract-transcript: full error body:", JSON.stringify(errBody))
    return NextResponse.json({ error: `Failed to list transcripts: ${msg}` }, { status: transcriptsRes.status })
  }

  const transcriptsData = await transcriptsRes.json() as { value: GraphTranscript[] }
  console.log("[v0] extract-transcript: transcripts found:", transcriptsData.value?.length ?? 0)
  console.log("[v0] extract-transcript: transcripts data:", JSON.stringify(transcriptsData.value))

  if (!transcriptsData.value || transcriptsData.value.length === 0) {
    console.warn("[v0] extract-transcript: no transcripts available for this item")
    return NextResponse.json(
      { error: "No transcript found for this recording. The meeting transcript may not have been generated yet." },
      { status: 404 }
    )
  }

  // Use the first (most recent) transcript
  const transcript = transcriptsData.value[0]
  console.log("[v0] extract-transcript: using transcript id:", transcript.id, "| created:", transcript.createdDateTime)

  // ── Step 2: Stream the transcript content ─────────────────────────────────
  // GET /me/drive/items/{itemId}/media/transcripts/{transcriptId}/streamContent
  const streamUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/media/transcripts/${transcript.id}/streamContent`
  console.log("[v0] extract-transcript: Step 2 – streaming transcript content →", streamUrl)

  const streamRes = await fetch(streamUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  console.log("[v0] extract-transcript: stream HTTP status:", streamRes.status)
  console.log("[v0] extract-transcript: stream content-type:", streamRes.headers.get("content-type"))
  console.log("[v0] extract-transcript: stream content-length:", streamRes.headers.get("content-length"))

  if (!streamRes.ok) {
    const errText = await streamRes.text().catch(() => "")
    console.error("[v0] extract-transcript: stream error body:", errText)
    return NextResponse.json(
      { error: `Failed to stream transcript content: HTTP ${streamRes.status}` },
      { status: streamRes.status }
    )
  }

  const vttText = await streamRes.text()
  console.log("[v0] extract-transcript: VTT content length:", vttText.length, "chars")
  console.log("[v0] extract-transcript: VTT preview (first 400 chars):\n", vttText.slice(0, 400))

  if (!vttText.trim()) {
    console.warn("[v0] extract-transcript: transcript content was empty")
    return NextResponse.json({ error: "Transcript content was empty." }, { status: 422 })
  }

  // ── Step 3: Parse VTT → structured lines ──────────────────────────────────
  const lines = parseVTT(vttText)
  console.log("[v0] extract-transcript: final line count:", lines.length)

  if (lines.length === 0) {
    console.warn("[v0] extract-transcript: VTT parsed but no cue lines found")
    return NextResponse.json(
      { error: "Transcript was found but could not be parsed into lines.", rawVtt: vttText },
      { status: 422 }
    )
  }

  return NextResponse.json({ lines, rawVtt: vttText.slice(0, 1000) })
}

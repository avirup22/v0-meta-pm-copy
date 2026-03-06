import { NextRequest, NextResponse } from "next/server"

interface TranscriptLine {
  timestamp: string
  speaker: string
  text: string
}

interface SharePointTranscript {
  id: string
  displayName?: string
  languageTag?: string
  isDefault?: boolean
  temporaryDownloadUrl?: string
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

  let body: { itemId?: string; driveId?: string; siteUrl?: string; token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { itemId, driveId, siteUrl, token } = body
  if (!itemId || !driveId || !siteUrl || !token) {
    const missing = [!itemId && "itemId", !driveId && "driveId", !siteUrl && "siteUrl", !token && "token"].filter(Boolean)
    console.error("[v0] extract-transcript: missing fields:", missing)
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 })
  }

  console.log("[v0] extract-transcript: itemId:", itemId)
  console.log("[v0] extract-transcript: driveId:", driveId)
  console.log("[v0] extract-transcript: siteUrl:", siteUrl)

  // ── Step 1: List transcripts via SharePoint /_api/v2.1/ ───────────────────
  // Pattern from payload: {siteUrl}/_api/v2.1/drives/{driveId}/items/{itemId}/media/transcripts
  const transcriptsUrl = `${siteUrl}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts`
  console.log("[v0] extract-transcript: Step 1 – listing transcripts →", transcriptsUrl)

  let transcriptsRes: Response
  try {
    transcriptsRes = await fetch(transcriptsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })
  } catch (err) {
    console.error("[v0] extract-transcript: network error on transcripts list:", err)
    return NextResponse.json({ error: "Network error contacting SharePoint." }, { status: 502 })
  }

  console.log("[v0] extract-transcript: transcripts list HTTP status:", transcriptsRes.status)

  if (!transcriptsRes.ok) {
    const errText = await transcriptsRes.text().catch(() => "")
    console.error("[v0] extract-transcript: transcripts list error body:", errText)
    return NextResponse.json(
      { error: `Failed to list transcripts (HTTP ${transcriptsRes.status}): ${errText.slice(0, 200)}` },
      { status: transcriptsRes.status }
    )
  }

  const transcriptsData = await transcriptsRes.json() as { value: SharePointTranscript[] }
  console.log("[v0] extract-transcript: transcripts found:", transcriptsData.value?.length ?? 0)
  console.log("[v0] extract-transcript: transcripts:", JSON.stringify(
    transcriptsData.value?.map((t) => ({ id: t.id, displayName: t.displayName, isDefault: t.isDefault, languageTag: t.languageTag }))
  ))

  if (!transcriptsData.value || transcriptsData.value.length === 0) {
    console.warn("[v0] extract-transcript: no transcripts available for this item")
    return NextResponse.json(
      { error: "No transcript found for this recording. The meeting transcript may not have been generated yet." },
      { status: 404 }
    )
  }

  // Prefer the default transcript, otherwise take the first
  const transcript =
    transcriptsData.value.find((t) => t.isDefault) ?? transcriptsData.value[0]
  console.log("[v0] extract-transcript: selected transcript id:", transcript.id, "| displayName:", transcript.displayName)

  // ── Step 2: Stream transcript VTT content ─────────────────────────────────
  // Pattern from payload: {siteUrl}/_api/v2.1/drives/{driveId}/items/{itemId}/media/transcripts/{transcriptId}/streamContent?is=1&applymediaedits=false
  const streamUrl = `${siteUrl}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts/${transcript.id}/streamContent?is=1&applymediaedits=false`
  console.log("[v0] extract-transcript: Step 2 – streaming transcript →", streamUrl)

  let streamRes: Response
  try {
    streamRes = await fetch(streamUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch (err) {
    console.error("[v0] extract-transcript: network error on stream:", err)
    return NextResponse.json({ error: "Network error streaming transcript." }, { status: 502 })
  }

  console.log("[v0] extract-transcript: stream HTTP status:", streamRes.status)
  console.log("[v0] extract-transcript: stream content-type:", streamRes.headers.get("content-type"))
  console.log("[v0] extract-transcript: stream content-length:", streamRes.headers.get("content-length"))

  if (!streamRes.ok) {
    const errText = await streamRes.text().catch(() => "")
    console.error("[v0] extract-transcript: stream error body:", errText.slice(0, 300))
    return NextResponse.json(
      { error: `Failed to stream transcript (HTTP ${streamRes.status}): ${errText.slice(0, 200)}` },
      { status: streamRes.status }
    )
  }

  const vttText = await streamRes.text()
  console.log("[v0] extract-transcript: VTT content length:", vttText.length, "chars")
  console.log("[v0] extract-transcript: VTT preview (first 500 chars):\n", vttText.slice(0, 500))

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

  console.log("[v0] extract-transcript: success – returning", lines.length, "lines")
  return NextResponse.json({ lines, rawVtt: vttText.slice(0, 1000) })
}

import { NextResponse } from "next/server"

interface TranscriptLine {
  timestamp: string
  speaker: string
  text: string
}

function parseVTT(vtt: string): TranscriptLine[] {
  const lines: TranscriptLine[] = []
  const blocks = vtt.split(/\n\n+/)
  for (const block of blocks) {
    const rows = block.trim().split("\n")
    const tsIdx = rows.findIndex((l) => l.includes(" --> "))
    if (tsIdx === -1) continue
    const timestamp = rows[tsIdx].split(" --> ")[0].trim().replace(/\.\d{3}$/, "")
    const rawText = rows.slice(tsIdx + 1).join(" ").trim()
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

export async function POST(req: Request) {
  const body = await req.json()
  const { siteUrl, driveId, itemId, token } = body as {
    siteUrl: string
    driveId: string
    itemId: string
    token: string
  }

  const logs: { step: number; label: string; url: string; status: number; responsePreview: string }[] = []

  // ── CALL 1: List transcripts ─────────────────────────────────────────────
  const transcriptsUrl = `${siteUrl}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts`

  console.log("=".repeat(60))
  console.log("[v0] CALL 1 →", transcriptsUrl)
  console.log("=".repeat(60))

  const call1Res = await fetch(transcriptsUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })

  const call1Body = await call1Res.text()
  console.log("[v0] CALL 1 status:", call1Res.status)
  console.log("[v0] CALL 1 response:", call1Body.slice(0, 500))

  logs.push({
    step: 1,
    label: "List transcripts",
    url: transcriptsUrl,
    status: call1Res.status,
    responsePreview: call1Body,
  })

  if (!call1Res.ok) {
    return NextResponse.json(
      { error: `HTTP ${call1Res.status}: ${call1Body.slice(0, 200)}`, logs },
      { status: call1Res.status }
    )
  }

  const transcriptsData = JSON.parse(call1Body) as {
    value: { id: string; isDefault?: boolean; temporaryDownloadUrl?: string }[]
  }
  const transcripts = transcriptsData.value ?? []

  if (transcripts.length === 0) {
    return NextResponse.json({ error: "No transcripts found for this recording.", logs }, { status: 404 })
  }

  const transcript = transcripts.find((t) => t.isDefault) ?? transcripts[0]
  console.log("[v0] transcript id:", transcript.id, "| hasTemporaryUrl:", !!transcript.temporaryDownloadUrl)

  // ── CALL 2: Download VTT ─────────────────────────────────────────────────
  let vttText = ""

  if (transcript.temporaryDownloadUrl) {
    const dlUrl = transcript.temporaryDownloadUrl
    console.log("=".repeat(60))
    console.log("[v0] CALL 2 (temporaryDownloadUrl) →", dlUrl.slice(0, 120))
    console.log("=".repeat(60))

    const call2Res = await fetch(dlUrl)
    vttText = await call2Res.text()
    console.log("[v0] CALL 2 status:", call2Res.status, "| length:", vttText.length)
    console.log("[v0] CALL 2 preview:", vttText.slice(0, 300))

    logs.push({
      step: 2,
      label: "Download VTT (temporaryDownloadUrl)",
      url: dlUrl.slice(0, 150) + "...",
      status: call2Res.status,
      responsePreview: vttText.slice(0, 600),
    })
  } else {
    const streamUrl = `${siteUrl}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts/${transcript.id}/streamContent?is=1&applymediaedits=false`
    console.log("=".repeat(60))
    console.log("[v0] CALL 2 (streamContent) →", streamUrl)
    console.log("=".repeat(60))

    const call2Res = await fetch(streamUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
    })
    vttText = await call2Res.text()
    console.log("[v0] CALL 2 status:", call2Res.status, "| length:", vttText.length)
    console.log("[v0] CALL 2 preview:", vttText.slice(0, 300))

    logs.push({
      step: 2,
      label: "Stream transcript content",
      url: streamUrl,
      status: call2Res.status,
      responsePreview: vttText.slice(0, 600),
    })
  }

  const lines = parseVTT(vttText)
  console.log("[v0] parsed lines:", lines.length)

  return NextResponse.json({ lines, logs })
}

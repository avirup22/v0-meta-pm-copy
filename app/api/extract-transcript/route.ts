import { NextRequest, NextResponse } from "next/server"

export interface ApiLog {
  step: number
  label: string
  url: string
  status: number
  responsePreview: string
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
    const timestamp = blockLines[tsIdx].split(" --> ")[0].trim().replace(/\.\d{3}$/, "")
    const rawText = blockLines.slice(tsIdx + 1).join(" ").trim()
    const speakerMatch = rawText.match(/^<v ([^>]+)>/)
    const speaker = speakerMatch ? speakerMatch[1] : ""
    const text = rawText.replace(/<v [^>]+>/g, "").replace(/<\/v>/g, "").replace(/<[^>]+>/g, "").trim()
    if (text) lines.push({ timestamp, speaker, text })
  }
  return lines
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    itemId: string
    driveId: string
    siteUrl: string
    token: string
  }

  const { itemId, driveId, siteUrl, token } = body

  if (!itemId || !driveId || !siteUrl || !token) {
    return NextResponse.json(
      { error: `Missing fields. Got: itemId=${!!itemId} driveId=${!!driveId} siteUrl=${!!siteUrl} token=${!!token}` },
      { status: 400 }
    )
  }

  console.log("[v0] extract-transcript POST")
  console.log("[v0]   itemId  :", itemId)
  console.log("[v0]   driveId :", driveId)
  console.log("[v0]   siteUrl :", siteUrl)

  const logs: ApiLog[] = []

  // ── CALL 1: List transcripts ──────────────────────────────────────────────
  // Exact SharePoint URL format confirmed from browser network tab:
  // {siteUrl}/_api/v2.1/drives/{driveId}/items/{itemId}/media/transcripts
  const transcriptsUrl = `${siteUrl}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts`

  console.log("=".repeat(80))
  console.log("[v0] CALL 1 >>>  GET", transcriptsUrl)
  console.log("=".repeat(80))

  const transcriptsRes = await fetch(transcriptsUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })

  const transcriptsRaw = await transcriptsRes.text()

  console.log("[v0] CALL 1 <<<  STATUS:", transcriptsRes.status)
  console.log("[v0] CALL 1 <<<  BODY  :", transcriptsRaw.slice(0, 800))
  console.log("=".repeat(80))

  logs.push({
    step: 1,
    label: "List Transcripts",
    url: transcriptsUrl,
    status: transcriptsRes.status,
    responsePreview: transcriptsRaw.slice(0, 2000),
  })

  if (!transcriptsRes.ok) {
    return NextResponse.json({
      error: `Call 1 failed (HTTP ${transcriptsRes.status}): ${transcriptsRaw.slice(0, 300)}`,
      logs,
    }, { status: transcriptsRes.status })
  }

  const transcriptsData = JSON.parse(transcriptsRaw) as {
    value: Array<{
      id: string
      displayName?: string
      isDefault?: boolean
      languageTag?: string
      temporaryDownloadUrl?: string
    }>
  }

  if (!transcriptsData.value?.length) {
    return NextResponse.json({ error: "No transcripts found for this recording.", logs }, { status: 404 })
  }

  const transcript = transcriptsData.value.find((t) => t.isDefault) ?? transcriptsData.value[0]
  console.log("[v0] Selected transcript id:", transcript.id)

  // ── CALL 2: Download VTT ──────────────────────────────────────────────────
  // Use temporaryDownloadUrl if present (pre-signed, no auth needed).
  // Otherwise use streamContent with auth.
  let vttText = ""

  if (transcript.temporaryDownloadUrl) {
    const dlUrl = transcript.temporaryDownloadUrl

    console.log("=".repeat(80))
    console.log("[v0] CALL 2 >>>  GET (temporaryDownloadUrl)")
    console.log("[v0]             ", dlUrl.slice(0, 120), "...")
    console.log("=".repeat(80))

    const dlRes = await fetch(dlUrl)
    vttText = await dlRes.text()

    console.log("[v0] CALL 2 <<<  STATUS:", dlRes.status)
    console.log("[v0] CALL 2 <<<  VTT length:", vttText.length, "chars")
    console.log("[v0] CALL 2 <<<  VTT preview:", vttText.slice(0, 300))
    console.log("=".repeat(80))

    logs.push({
      step: 2,
      label: "Download VTT (temporaryDownloadUrl)",
      url: dlUrl.slice(0, 120) + "...",
      status: dlRes.status,
      responsePreview: vttText.slice(0, 1000),
    })

    if (!dlRes.ok) {
      return NextResponse.json({ error: `Call 2 failed (HTTP ${dlRes.status})`, logs }, { status: dlRes.status })
    }
  } else {
    const streamUrl = `${siteUrl}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts/${transcript.id}/streamContent?is=1&applymediaedits=false`

    console.log("=".repeat(80))
    console.log("[v0] CALL 2 >>>  GET (streamContent)")
    console.log("[v0]             ", streamUrl)
    console.log("=".repeat(80))

    const streamRes = await fetch(streamUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    vttText = await streamRes.text()

    console.log("[v0] CALL 2 <<<  STATUS:", streamRes.status)
    console.log("[v0] CALL 2 <<<  VTT length:", vttText.length, "chars")
    console.log("[v0] CALL 2 <<<  VTT preview:", vttText.slice(0, 300))
    console.log("=".repeat(80))

    logs.push({
      step: 2,
      label: "Download VTT (streamContent)",
      url: streamUrl,
      status: streamRes.status,
      responsePreview: vttText.slice(0, 1000),
    })

    if (!streamRes.ok) {
      return NextResponse.json({ error: `Call 2 failed (HTTP ${streamRes.status}): ${vttText.slice(0, 200)}`, logs }, { status: streamRes.status })
    }
  }

  const lines = parseVTT(vttText)
  console.log("[v0] Parsed", lines.length, "transcript lines")

  return NextResponse.json({ lines, logs, rawVtt: vttText.slice(0, 500) })
}

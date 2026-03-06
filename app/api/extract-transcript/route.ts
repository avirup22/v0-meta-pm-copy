import { NextRequest, NextResponse } from "next/server"

function parseVTT(vtt: string) {
  const lines: { timestamp: string; speaker: string; text: string }[] = []
  const blocks = vtt.split(/\n\n+/)
  for (const block of blocks) {
    const rows = block.trim().split("\n")
    const tsIdx = rows.findIndex((l) => l.includes(" --> "))
    if (tsIdx === -1) continue
    const timestamp = rows[tsIdx].split(" --> ")[0].trim().replace(/\.\d{3}$/, "")
    const rawText = rows.slice(tsIdx + 1).join(" ").trim()
    const speakerMatch = rawText.match(/^<v ([^>]+)>/)
    const speaker = speakerMatch ? speakerMatch[1] : ""
    const text = rawText.replace(/<v [^>]+>/g, "").replace(/<\/v>/g, "").replace(/<[^>]+>/g, "").trim()
    if (text) lines.push({ timestamp, speaker, text })
  }
  return lines
}

export async function POST(req: NextRequest) {
  const { siteUrl, driveId, itemId } = await req.json() as {
    siteUrl: string
    driveId: string
    itemId: string
  }

  if (!siteUrl || !driveId || !itemId) {
    return NextResponse.json({ error: "Missing siteUrl, driveId, or itemId" }, { status: 400 })
  }

  // Forward the browser's SharePoint session cookies (FedAuth, rtFa, SIMI)
  // so the request authenticates exactly as when the user opens the URL in their browser.
  // No Bearer token needed — SharePoint session cookie handles auth.
  const cookie = req.headers.get("cookie") ?? ""

  const logs: { step: number; label: string; url: string; status: number; responsePreview: string }[] = []

  // ── CALL 1: List transcripts ──────────────────────────────────────────────
  // Exact URL from browser network tab:
  // {siteUrl}/_api/v2.1/drives/{driveId}/items/{itemId}/media/transcripts
  const transcriptsUrl = `${siteUrl}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts`

  console.log("=".repeat(60))
  console.log("[v0] CALL 1 GET →", transcriptsUrl)
  console.log("[v0] Forwarding cookie header, length:", cookie.length)
  console.log("=".repeat(60))

  const call1Res = await fetch(transcriptsUrl, {
    headers: { Cookie: cookie, Accept: "application/json" },
  })
  const call1Body = await call1Res.text()

  console.log("[v0] CALL 1 STATUS:", call1Res.status)
  console.log("[v0] CALL 1 BODY:", call1Body.slice(0, 600))

  logs.push({ step: 1, label: "List transcripts", url: transcriptsUrl, status: call1Res.status, responsePreview: call1Body })

  if (!call1Res.ok) {
    return NextResponse.json({ error: `HTTP ${call1Res.status}: ${call1Body.slice(0, 200)}`, logs }, { status: call1Res.status })
  }

  const transcriptsData = JSON.parse(call1Body) as { value: { id: string; isDefault?: boolean; temporaryDownloadUrl?: string }[] }
  const transcripts = transcriptsData.value ?? []

  if (transcripts.length === 0) {
    return NextResponse.json({ error: "No transcripts found for this recording.", logs }, { status: 404 })
  }

  const transcript = transcripts.find((t) => t.isDefault) ?? transcripts[0]
  console.log("[v0] Selected transcript id:", transcript.id, "| hasTemporaryDownloadUrl:", !!transcript.temporaryDownloadUrl)

  // ── CALL 2: Download VTT ──────────────────────────────────────────────────
  let vttText = ""

  if (transcript.temporaryDownloadUrl) {
    // Pre-signed URL — no auth needed at all
    const dlUrl = transcript.temporaryDownloadUrl
    console.log("=".repeat(60))
    console.log("[v0] CALL 2 GET (temporaryDownloadUrl) →", dlUrl.slice(0, 150))
    console.log("=".repeat(60))

    const call2Res = await fetch(dlUrl)
    vttText = await call2Res.text()
    console.log("[v0] CALL 2 STATUS:", call2Res.status, "| VTT chars:", vttText.length)
    console.log("[v0] CALL 2 VTT preview:", vttText.slice(0, 300))

    logs.push({ step: 2, label: "Download VTT", url: dlUrl.slice(0, 150) + "...", status: call2Res.status, responsePreview: vttText.slice(0, 600) })
  } else {
    // Construct the streamContent URL and forward cookies
    const streamUrl = `${siteUrl}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts/${transcript.id}/streamContent?is=1&applymediaedits=false`
    console.log("=".repeat(60))
    console.log("[v0] CALL 2 GET (streamContent) →", streamUrl)
    console.log("=".repeat(60))

    const call2Res = await fetch(streamUrl, { headers: { Cookie: cookie, Accept: "*/*" } })
    vttText = await call2Res.text()
    console.log("[v0] CALL 2 STATUS:", call2Res.status, "| VTT chars:", vttText.length)
    console.log("[v0] CALL 2 VTT preview:", vttText.slice(0, 300))

    logs.push({ step: 2, label: "Stream transcript content", url: streamUrl, status: call2Res.status, responsePreview: vttText.slice(0, 600) })
  }

  const lines = parseVTT(vttText)
  console.log("[v0] Parsed transcript lines:", lines.length)

  return NextResponse.json({ lines, logs })
}

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

  const { itemId, token } = body
  if (!itemId || !token) {
    const missing = [!itemId && "itemId", !token && "token"].filter(Boolean)
    console.error("[v0] extract-transcript: missing fields:", missing)
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 })
  }

  console.log("[v0] extract-transcript: itemId:", itemId)

  // ── Step 0: Resolve the SharePoint driveId and siteUrl from Graph item metadata ──
  // Graph item IDs (01HIVVPJ...) are different from SharePoint drive IDs (b!L69g...).
  // We must fetch the item's parentReference to get the correct SharePoint-format driveId
  // and the SharePoint site URL needed for the /_api/v2.1/ transcript endpoints.
  const itemMetaUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?$select=id,name,parentReference`
  console.log("[v0] extract-transcript: Step 0 – fetching item metadata →", itemMetaUrl)

  let spDriveId: string
  let siteUrl: string

  try {
    const metaRes = await fetch(itemMetaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log("[v0] extract-transcript: item metadata HTTP status:", metaRes.status)
    if (!metaRes.ok) {
      const errBody = await metaRes.json().catch(() => ({}))
      const msg = (errBody as { error?: { message?: string } })?.error?.message ?? `HTTP ${metaRes.status}`
      console.error("[v0] extract-transcript: metadata error:", msg)
      return NextResponse.json({ error: `Failed to get item metadata: ${msg}` }, { status: metaRes.status })
    }
    const meta = await metaRes.json() as {
      id: string
      name: string
      parentReference: {
        driveId: string
        siteId?: string
        siteUrl?: string
        sharepointIds?: { siteUrl?: string }
      }
    }
    console.log("[v0] extract-transcript: item name:", meta.name)
    console.log("[v0] extract-transcript: parentReference:", JSON.stringify(meta.parentReference))

    // parentReference.driveId is the SharePoint base64 drive ID (b!...) format
    spDriveId = meta.parentReference.driveId
    // siteUrl may come from parentReference.siteUrl or sharepointIds.siteUrl
    const rawSiteUrl =
      meta.parentReference.siteUrl ??
      meta.parentReference.sharepointIds?.siteUrl

    if (!spDriveId) {
      console.error("[v0] extract-transcript: parentReference.driveId is missing")
      return NextResponse.json({ error: "Could not resolve SharePoint driveId from item metadata." }, { status: 502 })
    }

    if (rawSiteUrl) {
      // rawSiteUrl may be the full personal site URL like
      // https://indegene123-my.sharepoint.com/personal/sarvesh_koyande_indegene_com
      siteUrl = rawSiteUrl.replace(/\/$/, "")
    } else {
      // Fallback: derive from the drive's webUrl via Graph
      const driveUrl = `https://graph.microsoft.com/v1.0/me/drive?$select=webUrl`
      console.log("[v0] extract-transcript: siteUrl missing – fetching drive webUrl →", driveUrl)
      const driveRes = await fetch(driveUrl, { headers: { Authorization: `Bearer ${token}` } })
      const driveData = await driveRes.json() as { webUrl?: string }
      siteUrl = (driveData.webUrl ?? "").replace(/\/Documents.*$/, "").replace(/\/$/, "")
      console.log("[v0] extract-transcript: derived siteUrl from drive webUrl:", siteUrl)
    }

    console.log("[v0] extract-transcript: resolved spDriveId:", spDriveId)
    console.log("[v0] extract-transcript: resolved siteUrl:", siteUrl)
  } catch (err) {
    console.error("[v0] extract-transcript: error fetching item metadata:", err)
    return NextResponse.json({ error: "Network error fetching item metadata." }, { status: 502 })
  }

  // ── Step 1: List transcripts via SharePoint /_api/v2.1/ ───────────────────
  // Pattern confirmed from browser network payload:
  // {siteUrl}/_api/v2.1/drives/{spDriveId}/items/{itemId}/media/transcripts
  const transcriptsUrl = `${siteUrl}/_api/v2.1/drives/${spDriveId}/items/${itemId}/media/transcripts`
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
  const streamUrl = `${siteUrl}/_api/v2.1/drives/${spDriveId}/items/${itemId}/media/transcripts/${transcript.id}/streamContent?is=1&applymediaedits=false`
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

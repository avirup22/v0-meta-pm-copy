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
  source?: string
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
    const missing = [!itemId && "itemId", !token && "token"].filter(Boolean)
    console.error("[v0] extract-transcript: missing fields:", missing)
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 })
  }

  console.log("[v0] extract-transcript: itemId:", itemId)

  // ── Step 0: Fetch full item metadata from Graph (no $select — we need all fields) ──
  // parentReference.driveId from Graph returns the SharePoint base64 drive ID (b!...) format.
  // parentReference.sharepointIds.siteUrl gives the SharePoint site root.
  const itemMetaUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`
  console.log("[v0] extract-transcript: Step 0 – fetching full item metadata →", itemMetaUrl)

  let spDriveId: string
  let siteUrl: string
  let itemWebUrl: string

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
      webUrl?: string
      parentReference: {
        driveId?: string
        siteId?: string
        siteUrl?: string
        sharepointIds?: {
          siteUrl?: string
          siteId?: string
          webUrl?: string
        }
      }
    }

    console.log("[v0] extract-transcript: item name:", meta.name)
    console.log("[v0] extract-transcript: item webUrl:", meta.webUrl)
    console.log("[v0] extract-transcript: parentReference.driveId:", meta.parentReference?.driveId)
    console.log("[v0] extract-transcript: parentReference.siteUrl:", meta.parentReference?.siteUrl)
    console.log("[v0] extract-transcript: parentReference.sharepointIds:", JSON.stringify(meta.parentReference?.sharepointIds))

    // driveId from parentReference is the SharePoint base64 b!... format
    spDriveId = meta.parentReference?.driveId ?? ""
    itemWebUrl = meta.webUrl ?? ""

    // Derive siteUrl: strip from item's webUrl everything from /Documents onwards
    // e.g. https://tenant-my.sharepoint.com/personal/user/Documents/Recordings/file.mp4
    //   → https://tenant-my.sharepoint.com/personal/user
    if (itemWebUrl) {
      const docIdx = itemWebUrl.indexOf("/Documents")
      siteUrl = docIdx !== -1 ? itemWebUrl.slice(0, docIdx) : itemWebUrl
    } else if (meta.parentReference?.siteUrl) {
      siteUrl = meta.parentReference.siteUrl.replace(/\/$/, "")
    } else if (meta.parentReference?.sharepointIds?.siteUrl) {
      siteUrl = meta.parentReference.sharepointIds.siteUrl.replace(/\/$/, "")
    } else {
      siteUrl = ""
    }

    console.log("[v0] extract-transcript: resolved spDriveId:", spDriveId)
    console.log("[v0] extract-transcript: resolved siteUrl:", siteUrl)

    if (!spDriveId || !siteUrl) {
      console.error("[v0] extract-transcript: could not resolve spDriveId or siteUrl")
      return NextResponse.json(
        { error: `Could not resolve SharePoint context. driveId=${spDriveId} siteUrl=${siteUrl}` },
        { status: 502 }
      )
    }
  } catch (err) {
    console.error("[v0] extract-transcript: error in Step 0:", err)
    return NextResponse.json({ error: "Network error fetching item metadata." }, { status: 502 })
  }

  // ── Step 1: List transcripts via SharePoint /_api/v2.1/ ───────────────────
  // Exact URL pattern from browser network tab:
  // {siteUrl}/_api/v2.1/drives/{spDriveId}/items/{itemId}/media/transcripts
  const transcriptsUrl = `${siteUrl}/_api/v2.1/drives/${spDriveId}/items/${itemId}/media/transcripts`
  console.log("[v0] extract-transcript: Step 1 – listing transcripts →", transcriptsUrl)

  let transcriptsData: { value: SharePointTranscript[] }

  try {
    const transcriptsRes = await fetch(transcriptsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })

    console.log("[v0] extract-transcript: transcripts list HTTP status:", transcriptsRes.status)
    const rawBody = await transcriptsRes.text()
    console.log("[v0] extract-transcript: transcripts raw response (first 500):", rawBody.slice(0, 500))

    if (!transcriptsRes.ok) {
      console.error("[v0] extract-transcript: transcripts list error:", rawBody.slice(0, 300))
      return NextResponse.json(
        { error: `Failed to list transcripts (HTTP ${transcriptsRes.status}): ${rawBody.slice(0, 200)}` },
        { status: transcriptsRes.status }
      )
    }

    transcriptsData = JSON.parse(rawBody) as { value: SharePointTranscript[] }
    console.log("[v0] extract-transcript: transcripts count:", transcriptsData.value?.length ?? 0)
    console.log("[v0] extract-transcript: transcript entries:", JSON.stringify(
      transcriptsData.value?.map((t) => ({
        id: t.id,
        displayName: t.displayName,
        isDefault: t.isDefault,
        languageTag: t.languageTag,
        hasTemporaryDownloadUrl: !!t.temporaryDownloadUrl,
      }))
    ))
  } catch (err) {
    console.error("[v0] extract-transcript: network error listing transcripts:", err)
    return NextResponse.json({ error: "Network error contacting SharePoint for transcript list." }, { status: 502 })
  }

  if (!transcriptsData.value || transcriptsData.value.length === 0) {
    console.warn("[v0] extract-transcript: no transcripts available for this recording")
    return NextResponse.json(
      { error: "No transcript found for this recording. Transcription may not have been enabled for this meeting." },
      { status: 404 }
    )
  }

  // Prefer the default transcript, else first one
  const transcript = transcriptsData.value.find((t) => t.isDefault) ?? transcriptsData.value[0]
  console.log("[v0] extract-transcript: selected transcript id:", transcript.id, "displayName:", transcript.displayName)

  // ── Step 2: Download VTT using temporaryDownloadUrl (pre-signed, no auth needed)
  //            OR fall back to constructing the streamContent URL with auth header
  let vttText: string

  if (transcript.temporaryDownloadUrl) {
    // temporaryDownloadUrl is pre-signed — no Authorization header needed
    const dlUrl = transcript.temporaryDownloadUrl
    console.log("[v0] extract-transcript: Step 2 – using temporaryDownloadUrl (pre-signed), length:", dlUrl.length)

    try {
      const dlRes = await fetch(dlUrl)
      console.log("[v0] extract-transcript: temporaryDownloadUrl HTTP status:", dlRes.status)
      console.log("[v0] extract-transcript: content-type:", dlRes.headers.get("content-type"))

      if (!dlRes.ok) {
        const errText = await dlRes.text().catch(() => "")
        console.error("[v0] extract-transcript: temporaryDownloadUrl error:", errText.slice(0, 200))
        return NextResponse.json(
          { error: `Failed to download transcript via temporaryDownloadUrl (HTTP ${dlRes.status})` },
          { status: dlRes.status }
        )
      }

      vttText = await dlRes.text()
      console.log("[v0] extract-transcript: VTT downloaded, length:", vttText.length)
    } catch (err) {
      console.error("[v0] extract-transcript: error downloading via temporaryDownloadUrl:", err)
      return NextResponse.json({ error: "Network error downloading transcript." }, { status: 502 })
    }
  } else {
    // Fallback: construct streamContent URL with auth header
    const streamUrl = `${siteUrl}/_api/v2.1/drives/${spDriveId}/items/${itemId}/media/transcripts/${transcript.id}/streamContent?is=1&applymediaedits=false`
    console.log("[v0] extract-transcript: Step 2 fallback – streaming via streamContent →", streamUrl)

    try {
      const streamRes = await fetch(streamUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
      console.log("[v0] extract-transcript: streamContent HTTP status:", streamRes.status)

      if (!streamRes.ok) {
        const errText = await streamRes.text().catch(() => "")
        console.error("[v0] extract-transcript: streamContent error:", errText.slice(0, 200))
        return NextResponse.json(
          { error: `Failed to stream transcript (HTTP ${streamRes.status}): ${errText.slice(0, 200)}` },
          { status: streamRes.status }
        )
      }

      vttText = await streamRes.text()
      console.log("[v0] extract-transcript: VTT streamed, length:", vttText.length)
    } catch (err) {
      console.error("[v0] extract-transcript: error in streamContent fallback:", err)
      return NextResponse.json({ error: "Network error streaming transcript." }, { status: 502 })
    }
  }

  console.log("[v0] extract-transcript: VTT preview (first 400 chars):\n", vttText.slice(0, 400))

  if (!vttText.trim()) {
    return NextResponse.json({ error: "Transcript content was empty." }, { status: 422 })
  }

  // ── Step 3: Parse VTT → structured lines ──────────────────────────────────
  const lines = parseVTT(vttText)
  console.log("[v0] extract-transcript: final line count:", lines.length)

  if (lines.length === 0) {
    return NextResponse.json(
      { error: "Transcript was found but could not be parsed.", rawVtt: vttText },
      { status: 422 }
    )
  }

  return NextResponse.json({ lines, rawVtt: vttText.slice(0, 1000) })
}

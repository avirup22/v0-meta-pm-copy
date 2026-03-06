const GRAPH_BASE = "https://graph.microsoft.com/v1.0"

export interface DriveItem {
  id: string
  name: string
  /** Original file name before extension stripping (set on recording items) */
  originalName?: string
  folder?: { childCount: number }
  file?: { mimeType: string }
  webUrl?: string
  /** Download URL for the file content */
  "@microsoft.graph.downloadUrl"?: string
}

export interface TranscriptLine {
  timestamp: string
  speaker: string
  text: string
}

/**
 * Parse a WebVTT (.vtt) string into structured transcript lines.
 * Handles the WEBVTT header, cue identifiers, timestamps, and multi-line payloads.
 */
function parseVTT(vttContent: string): TranscriptLine[] {
  const lines: TranscriptLine[] = []
  // Split into blocks separated by blank lines
  const blocks = vttContent.split(/\n\n+/)

  for (const block of blocks) {
    const blockLines = block.trim().split("\n")
    // Find the line that has a timestamp (contains " --> ")
    const tsIdx = blockLines.findIndex((l) => l.includes(" --> "))
    if (tsIdx === -1) continue

    const tsLine = blockLines[tsIdx]
    const startTime = tsLine.split(" --> ")[0].trim()
    // Format timestamp: strip milliseconds for readability
    const timestamp = startTime.replace(/\.\d{3}$/, "")

    // Text lines come after the timestamp
    const textLines = blockLines.slice(tsIdx + 1)
    const rawText = textLines.join(" ").trim()

    // Strip VTT tags like <v Speaker Name> and <c> etc.
    const speakerMatch = rawText.match(/^<v ([^>]+)>/)
    const speaker = speakerMatch ? speakerMatch[1] : ""
    const text = rawText
      .replace(/<v [^>]+>/g, "")
      .replace(/<\/v>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim()

    if (text) {
      lines.push({ timestamp, speaker, text })
    }
  }

  return lines
}

/**
 * Given the item ID of a recording file, look for a sibling .vtt transcript
 * file in the same parent folder, download it, and parse it into lines.
 */
export async function fetchTranscriptForRecording(
  token: string,
  recordingItemId: string,
  recordingOriginalName: string
): Promise<TranscriptLine[]> {
  console.log("[v0] fetchTranscriptForRecording: starting for item", recordingItemId)

  // Step 1 – get the parent folder of the recording
  const itemUrl = `${GRAPH_BASE}/me/drive/items/${recordingItemId}?$select=id,name,parentReference`
  console.log("[v0] fetchTranscriptForRecording: fetching item metadata →", itemUrl)
  const itemRes = await fetch(itemUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log("[v0] fetchTranscriptForRecording: item metadata status:", itemRes.status)
  if (!itemRes.ok) throw new Error(`Failed to get recording metadata: HTTP ${itemRes.status}`)
  const itemData: { id: string; name: string; parentReference: { id: string } } = await itemRes.json()
  const parentId = itemData.parentReference.id
  console.log("[v0] fetchTranscriptForRecording: parent folder id:", parentId)

  // Step 2 – list siblings in the parent folder and find the matching .vtt
  const siblingsUrl = `${GRAPH_BASE}/me/drive/items/${parentId}/children?$select=id,name,file,@microsoft.graph.downloadUrl&$top=200`
  console.log("[v0] fetchTranscriptForRecording: listing siblings →", siblingsUrl)
  const siblingsRes = await fetch(siblingsUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log("[v0] fetchTranscriptForRecording: siblings status:", siblingsRes.status)
  if (!siblingsRes.ok) throw new Error(`Failed to list siblings: HTTP ${siblingsRes.status}`)
  const siblingsData: { value: DriveItem[] } = await siblingsRes.json()
  console.log("[v0] fetchTranscriptForRecording: siblings found:", siblingsData.value.map((s) => s.name))

  // Match the VTT file: same base name OR any .vtt in the folder
  const baseName = recordingOriginalName.replace(/\.[^/.]+$/, "").toLowerCase()
  let vttItem = siblingsData.value.find(
    (item) =>
      item.name.toLowerCase().endsWith(".vtt") &&
      item.name.toLowerCase().includes(baseName)
  )
  // Fallback: pick any .vtt in the folder
  if (!vttItem) {
    vttItem = siblingsData.value.find((item) => item.name.toLowerCase().endsWith(".vtt"))
  }

  if (!vttItem) {
    console.warn("[v0] fetchTranscriptForRecording: no .vtt file found in Recordings folder")
    throw new Error("No transcript (.vtt) file found alongside this recording.")
  }
  console.log("[v0] fetchTranscriptForRecording: found VTT file:", vttItem.name, "id:", vttItem.id)

  // Step 3 – get a download URL for the VTT file
  const vttMetaUrl = `${GRAPH_BASE}/me/drive/items/${vttItem.id}?$select=id,name,@microsoft.graph.downloadUrl`
  console.log("[v0] fetchTranscriptForRecording: fetching VTT download URL →", vttMetaUrl)
  const vttMetaRes = await fetch(vttMetaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log("[v0] fetchTranscriptForRecording: VTT meta status:", vttMetaRes.status)
  if (!vttMetaRes.ok) throw new Error(`Failed to get VTT metadata: HTTP ${vttMetaRes.status}`)
  const vttMeta: DriveItem = await vttMetaRes.json()
  const downloadUrl = vttMeta["@microsoft.graph.downloadUrl"]
  if (!downloadUrl) throw new Error("No download URL found for transcript file.")
  console.log("[v0] fetchTranscriptForRecording: download URL obtained")

  // Step 4 – download and parse the VTT content
  console.log("[v0] fetchTranscriptForRecording: downloading VTT content")
  const vttRes = await fetch(downloadUrl)
  console.log("[v0] fetchTranscriptForRecording: VTT download status:", vttRes.status)
  if (!vttRes.ok) throw new Error(`Failed to download transcript: HTTP ${vttRes.status}`)
  const vttText = await vttRes.text()
  console.log("[v0] fetchTranscriptForRecording: VTT content length:", vttText.length, "chars")

  const parsed = parseVTT(vttText)
  console.log("[v0] fetchTranscriptForRecording: parsed", parsed.length, "transcript lines")
  return parsed
}

/**
 * Fetch a single Drive item by path under the authenticated user's OneDrive root.
 * e.g. path = "MetaPM"  →  /me/drive/root:/MetaPM
 */
export async function getDriveItemByPath(
  token: string,
  path: string
): Promise<DriveItem> {
  const url = `${GRAPH_BASE}/me/drive/root:/${encodeURIComponent(path)}`
  console.log("[v0] getDriveItemByPath →", url)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  console.log("[v0] getDriveItemByPath status:", res.status, "for path:", path)

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = body?.error?.message ?? `HTTP ${res.status}`
    console.error("[v0] getDriveItemByPath error:", message)
    throw new Error(message)
  }

  const data: DriveItem = await res.json()
  console.log("[v0] getDriveItemByPath result:", { id: data.id, name: data.name })
  return data
}

/**
 * List the direct children of a Drive item by its ID.
 * Returns only items that are folders.
 */
export async function listFolderChildren(
  token: string,
  itemId: string
): Promise<DriveItem[]> {
  const url = `${GRAPH_BASE}/me/drive/items/${itemId}/children?$select=id,name,folder,webUrl&$top=100`
  console.log("[v0] listFolderChildren →", url)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  console.log("[v0] listFolderChildren status:", res.status, "for itemId:", itemId)

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = body?.error?.message ?? `HTTP ${res.status}`
    console.error("[v0] listFolderChildren error:", message)
    throw new Error(message)
  }

  const data: { value: DriveItem[] } = await res.json()
  const folders = data.value.filter((item) => item.folder !== undefined)
  console.log(
    "[v0] listFolderChildren found",
    folders.length,
    "folders:",
    folders.map((f) => f.name)
  )
  return folders
}

/**
 * List all files (any type) inside the root-level "Recordings" folder.
 * Strips the file extension from each name before returning.
 */
export async function fetchRecordingFiles(token: string): Promise<DriveItem[]> {
  console.log("[v0] fetchRecordingFiles: starting")

  // Step 1 – get the Recordings folder at drive root
  const recordingsFolder = await getDriveItemByPath(token, "Recordings")
  console.log("[v0] fetchRecordingFiles – Recordings folder id:", recordingsFolder.id)

  // Step 2 – list all children (files and folders)
  const url = `${GRAPH_BASE}/me/drive/items/${recordingsFolder.id}/children?$select=id,name,file,folder,webUrl&$top=200`
  console.log("[v0] fetchRecordingFiles listing children →", url)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  console.log("[v0] fetchRecordingFiles children status:", res.status)

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = body?.error?.message ?? `HTTP ${res.status}`
    console.error("[v0] fetchRecordingFiles error:", message)
    throw new Error(message)
  }

  const data: { value: DriveItem[] } = await res.json()

  // Keep all items; strip the extension from display name, but preserve originalName for VTT matching
  const files = data.value.map((item) => ({
    ...item,
    originalName: item.name,
    name: item.name.replace(/\.[^/.]+$/, ""),
  }))

  console.log(
    "[v0] fetchRecordingFiles found",
    files.length,
    "files:",
    files.map((f) => f.name)
  )

  return files
}

/**
 * Walk the full path MetaPM → Projects and return the folder items inside Projects.
 */
export async function fetchProjectFolders(token: string): Promise<DriveItem[]> {
  console.log("[v0] fetchProjectFolders: starting folder walk")

  // Step 1 – get MetaPM folder
  const metaPMFolder = await getDriveItemByPath(token, "MetaPM")
  console.log("[v0] Step 1 complete – MetaPM id:", metaPMFolder.id)

  // Step 2 – list children of MetaPM, find Projects
  const metaPMChildren = await listFolderChildren(token, metaPMFolder.id)
  const projectsFolder = metaPMChildren.find(
    (f) => f.name.toLowerCase() === "projects"
  )

  if (!projectsFolder) {
    console.error('[v0] "Projects" folder not found inside MetaPM')
    throw new Error('"Projects" folder not found inside MetaPM')
  }
  console.log("[v0] Step 2 complete – Projects id:", projectsFolder.id)

  // Step 3 – list children of Projects
  const projectFolders = await listFolderChildren(token, projectsFolder.id)
  console.log(
    "[v0] Step 3 complete – project folders:",
    projectFolders.map((f) => f.name)
  )

  return projectFolders
}

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

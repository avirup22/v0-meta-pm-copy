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
 * List all files (any type) inside Documents/Recordings.
 * Teams stores recordings at: OneDrive root → Documents → Recordings
 * Strips the file extension from each name before returning.
 */
export async function fetchRecordingFiles(token: string): Promise<DriveItem[]> {
  console.log("[v0] fetchRecordingFiles: starting – looking for Documents/Recordings")

  // Step 1 – resolve Documents/Recordings by path
  // The SharePoint Stream URL confirms the path is /Documents/Recordings/...
  const recordingsFolder = await getDriveItemByPath(token, "Documents/Recordings")
  console.log("[v0] fetchRecordingFiles – Recordings folder id:", recordingsFolder.id, "name:", recordingsFolder.name)

  // Step 2 – list all children (files and sub-folders)
  const url = `${GRAPH_BASE}/me/drive/items/${recordingsFolder.id}/children?$select=id,name,file,folder,size,webUrl&$top=200&$orderby=name`
  console.log("[v0] fetchRecordingFiles listing children →", url)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  console.log("[v0] fetchRecordingFiles children HTTP status:", res.status)

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = body?.error?.message ?? `HTTP ${res.status}`
    console.error("[v0] fetchRecordingFiles error body:", message)
    throw new Error(message)
  }

  const data: { value: (DriveItem & { size?: number })[] } = await res.json()
  console.log("[v0] fetchRecordingFiles raw item count:", data.value.length)
  console.log("[v0] fetchRecordingFiles raw names:", data.value.map((i) => i.name))

  // Keep only files (not sub-folders); preserve originalName, strip extension for display
  const files = data.value
    .filter((item) => item.file !== undefined)
    .map((item) => ({
      ...item,
      originalName: item.name,
      name: item.name.replace(/\.[^/.]+$/, ""),
    }))

  console.log(
    "[v0] fetchRecordingFiles final file list (",
    files.length,
    "):",
    files.map((f) => `${f.name} [id:${f.id}]`)
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

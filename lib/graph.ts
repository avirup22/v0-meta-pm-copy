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
  /** The OneDrive/SharePoint drive ID — needed for SharePoint /_api/v2.1/ transcript calls */
  driveId?: string
  /** SharePoint site hostname e.g. https://indegene123-my.sharepoint.com/personal/sarvesh_koyande_indegene_com */
  siteUrl?: string
}

export interface RecordingsResult {
  files: DriveItem[]
  driveId: string
  siteUrl: string
}

/**
 * Fetch a single Drive item by path under the authenticated user's OneDrive root.
 * e.g. path = "MetaPM"  →  /me/drive/root:/MetaPM
 */
export async function getDriveItemByPath(
  token: string,
  path: string
): Promise<DriveItem> {
  // Encode each path segment individually so "/" separators are preserved
  const encodedPath = path.split("/").map(encodeURIComponent).join("/")
  const url = `${GRAPH_BASE}/me/drive/root:/${encodedPath}`
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
 * List all files inside the root-level "Recordings" folder.
 * Also fetches the drive metadata to capture driveId and SharePoint siteUrl,
 * which are required to call the SharePoint /_api/v2.1/ transcript endpoints.
 */
export async function fetchRecordingFiles(token: string): Promise<RecordingsResult> {
  console.log("[v0] fetchRecordingFiles: starting – looking for Recordings at drive root")

  // Step 1 – get current user's drive metadata (gives us driveId and webUrl/siteUrl)
  const driveMetaUrl = `${GRAPH_BASE}/me/drive?$select=id,webUrl`
  console.log("[v0] fetchRecordingFiles: fetching drive metadata →", driveMetaUrl)
  const driveMetaRes = await fetch(driveMetaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log("[v0] fetchRecordingFiles: drive meta status:", driveMetaRes.status)
  if (!driveMetaRes.ok) {
    const body = await driveMetaRes.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `HTTP ${driveMetaRes.status}`)
  }
  const driveMeta: { id: string; webUrl: string } = await driveMetaRes.json()
  const driveId = driveMeta.id
  // webUrl looks like: https://indegene123-my.sharepoint.com/personal/sarvesh_koyande_indegene_com/Documents
  // We want just the site root up to the personal path segment
  const siteUrl = driveMeta.webUrl.replace(/\/Documents.*$/, "")
  console.log("[v0] fetchRecordingFiles: driveId:", driveId)
  console.log("[v0] fetchRecordingFiles: siteUrl:", siteUrl)

  // Step 2 – resolve the Recordings folder directly at the drive root
  const recordingsFolder = await getDriveItemByPath(token, "Recordings")
  console.log("[v0] fetchRecordingFiles – Recordings folder id:", recordingsFolder.id, "name:", recordingsFolder.name)

  // Step 3 – list all children
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

  // Keep only files (not sub-folders); stamp driveId+siteUrl on each, strip extension
  const files = data.value
    .filter((item) => item.file !== undefined)
    .map((item) => ({
      ...item,
      originalName: item.name,
      name: item.name.replace(/\.[^/.]+$/, ""),
      driveId,
      siteUrl,
    }))

  console.log(
    "[v0] fetchRecordingFiles final file list (",
    files.length,
    "):",
    files.map((f) => `${f.name} [id:${f.id}] [driveId:${f.driveId}]`)
  )

  return { files, driveId, siteUrl }
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

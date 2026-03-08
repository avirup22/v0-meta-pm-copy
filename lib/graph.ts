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
  /** Customer/organisation folder name this project belongs to (e.g. "Internal", "Pfizer") */
  customerName?: string
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
  const driveMeta: { id: string; webUrl: string; sharepointIds?: { siteId?: string; tenantId?: string } } = await driveMetaRes.json()
  // driveMeta.id is the SharePoint base64 b!... driveId — use this for /_api/v2.1/ calls
  const driveId = driveMeta.id
  const siteUrl = driveMeta.webUrl.replace(/\/Documents.*$/, "").replace(/\/$/, "")
  console.log("[v0] fetchRecordingFiles: driveId (b!... format):", driveId)
  console.log("[v0] fetchRecordingFiles: siteUrl:", siteUrl)

  // Step 2 – resolve the Recordings folder directly at the drive root
  const recordingsFolder = await getDriveItemByPath(token, "Recordings")
  console.log("[v0] fetchRecordingFiles – Recordings folder id:", recordingsFolder.id, "name:", recordingsFolder.name)

  // Step 3 – list all children WITHOUT $select so Graph returns the full object
  // including parentReference.driveId (the SharePoint b!... format) and parentReference.siteUrl
  const url = `${GRAPH_BASE}/me/drive/items/${recordingsFolder.id}/children?$top=200&$orderby=name`
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

  type RawItem = DriveItem & {
    size?: number
    parentReference?: {
      driveId?: string
      siteId?: string
      siteUrl?: string
      sharepointIds?: { siteUrl?: string }
    }
    sharepointIds?: { siteUrl?: string }
  }
  const data: { value: RawItem[] } = await res.json()
  console.log("[v0] fetchRecordingFiles raw item count:", data.value.length)
  console.log("[v0] fetchRecordingFiles raw names:", data.value.map((i) => i.name))

  // Log first item's full parentReference so we can see what driveId format Graph returns
  if (data.value.length > 0) {
    console.log("[v0] fetchRecordingFiles first item parentReference:", JSON.stringify(data.value[0].parentReference))
  }

  // Use drive-level driveId (b!... format from GET /me/drive) — it's the same for all items.
  // Derive siteUrl from each item's webUrl (most reliable).
  const files = data.value
    .filter((item) => item.file !== undefined)
    .map((item) => {
      const itemSiteUrl = item.webUrl
        ? item.webUrl.match(/^(https:\/\/[^/]+\/personal\/[^/]+)/)?.[1] ?? siteUrl
        : siteUrl
      console.log("[v0] fetchRecordingFiles item:", item.name, "| driveId:", driveId, "| siteUrl:", itemSiteUrl)
      return {
        ...item,
        originalName: item.name,
        name: item.name.replace(/\.[^/.]+$/, ""),
        driveId,        // b!... format from GET /me/drive — correct for /_api/v2.1/
        siteUrl: itemSiteUrl,
      }
    })

  console.log(
    "[v0] fetchRecordingFiles final file list (",
    files.length,
    "):",
    files.map((f) => `${f.name} [id:${f.id}] [driveId:${f.driveId}]`)
  )

  return { files, driveId, siteUrl }
}

// ─── Excel / Database types ───────────────────────────────────────────────────

export interface ProjectRow {
  Client_Name: string
  Project_Name: string
  Project_folder_ID: string
  Project_Manager: string
  Start_Date: string
  End_date: string
  Project_status: string
  Project_Type: string
}

export interface TeamMemberRow {
  Project_folder_ID: string
  Name: string
  Email: string
  Designation: string
}

export interface ProjectDatabase {
  project: ProjectRow | null
  internalTeam: TeamMemberRow[]
  clientTeam: TeamMemberRow[]
}

/**
 * Read a worksheet's usedRange from an Excel file via Graph API.
 * Returns an array of objects keyed by the first-row headers.
 */
async function readWorksheet<T extends Record<string, string>>(
  token: string,
  fileId: string,
  sheetName: string
): Promise<T[]> {
  const url = `${GRAPH_BASE}/me/drive/items/${fileId}/workbook/worksheets/${encodeURIComponent(sheetName)}/usedRange`
  console.log("[v0] readWorksheet →", url)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    console.error("[v0] readWorksheet error:", body?.error?.message)
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
  }
  const data: { values: (string | number | boolean)[][] } = await res.json()
  const [headers, ...rows] = data.values
  return rows
    .filter((row) => row.some((cell) => cell !== "" && cell !== null))
    .map((row) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => {
        obj[String(h)] = row[i] !== undefined && row[i] !== null ? String(row[i]) : ""
      })
      return obj as T
    })
}

/**
 * Locate the "database.xlsx" file inside the MetaPM folder.
 */
async function findDatabaseFile(token: string): Promise<string> {
  const metaPM = await getDriveItemByPath(token, "MetaPM")
  const url = `${GRAPH_BASE}/me/drive/items/${metaPM.id}/children?$select=id,name,file&$top=50`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: { value: DriveItem[] } = await res.json()
  const db = data.value.find(
    (f) => f.file && /^database\.xlsx?$/i.test(f.name)
  )
  if (!db) throw new Error("database.xlsx not found in MetaPM folder")
  console.log("[v0] findDatabaseFile: found", db.name, "id:", db.id)
  return db.id
}

/**
 * Fetch all three worksheets (projects, internal_team, client_team) from database.xlsx.
 * Then filter rows that match the given Project_folder_ID.
 */
export async function fetchProjectDatabase(
  token: string,
  projectFolderId: string
): Promise<ProjectDatabase> {
  console.log("[v0] fetchProjectDatabase for folder id:", projectFolderId)
  const fileId = await findDatabaseFile(token)

  const [allProjects, allInternal, allClient] = await Promise.all([
    readWorksheet<ProjectRow>(token, fileId, "projects"),
    readWorksheet<TeamMemberRow>(token, fileId, "internal_team"),
    readWorksheet<TeamMemberRow>(token, fileId, "client_team"),
  ])

  const project = allProjects.find((p) => p.Project_folder_ID === projectFolderId) ?? null
  const internalTeam = allInternal.filter((m) => m.Project_folder_ID === projectFolderId)
  const clientTeam = allClient.filter((m) => m.Project_folder_ID === projectFolderId)

  console.log("[v0] fetchProjectDatabase: project:", project?.Project_Name, "| team:", internalTeam.length, "+ client:", clientTeam.length)
  return { project, internalTeam, clientTeam }
}

export interface CustomerWithProjects {
  customer: DriveItem
  projects: DriveItem[]
}

/**
 * Fetch all customer folders directly under MetaPM.
 * New structure: MetaPM / <Customer> / <Project>
 */
export async function fetchCustomerFolders(token: string): Promise<DriveItem[]> {
  console.log("[v0] fetchCustomerFolders: starting")
  const metaPMFolder = await getDriveItemByPath(token, "MetaPM")
  console.log("[v0] fetchCustomerFolders: MetaPM id:", metaPMFolder.id)
  const customers = await listFolderChildren(token, metaPMFolder.id)
  console.log("[v0] fetchCustomerFolders: found customers:", customers.map((c) => c.name))
  return customers
}

/**
 * Fetch all projects under a specific customer folder.
 * Path: MetaPM / <customerName> / <Project>
 */
export async function fetchProjectsForCustomer(
  token: string,
  customerFolderId: string
): Promise<DriveItem[]> {
  const projects = await listFolderChildren(token, customerFolderId)
  console.log("[v0] fetchProjectsForCustomer: found", projects.length, "projects")
  return projects
}

/**
 * Fetch ALL customers and their projects in one call.
 * Returns an array of { customer, projects[] }.
 */
export async function fetchAllCustomersWithProjects(
  token: string
): Promise<CustomerWithProjects[]> {
  console.log("[v0] fetchAllCustomersWithProjects: starting")
  const customers = await fetchCustomerFolders(token)
  const results = await Promise.all(
    customers.map(async (customer) => {
      const projects = await fetchProjectsForCustomer(token, customer.id)
      return { customer, projects }
    })
  )
  console.log(
    "[v0] fetchAllCustomersWithProjects:",
    results.map((r) => `${r.customer.name}(${r.projects.length} projects)`)
  )
  return results
}

/**
 * Create a new folder inside a parent folder and return its ID.
 */
export async function createFolder(
  token: string,
  parentFolderId: string,
  folderName: string
): Promise<string> {
  const url = `${GRAPH_BASE}/me/drive/items/${parentFolderId}/children`
  const body = {
    name: folderName,
    folder: {},
    "@microsoft.graph.conflictBehavior": "rename",
  }
  console.log("[v0] createFolder:", folderName, "in", parentFolderId)
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  const data: DriveItem = await res.json()
  console.log("[v0] createFolder: created", data.name, "id:", data.id)
  return data.id
}

/**
 * Add a row to the "projects" worksheet in database.xlsx.
 */
export async function insertProjectRow(token: string, row: ProjectRow): Promise<void> {
  const fileId = await findDatabaseFile(token)
  const url = `${GRAPH_BASE}/me/drive/items/${fileId}/workbook/worksheets/projects/tables/projects/rows/add`
  const values = [
    [row.Client_Name, row.Project_Name, row.Project_folder_ID, row.Project_Manager, row.Start_Date, row.End_date, row.Project_status, row.Project_Type],
  ]
  console.log("[v0] insertProjectRow:", row.Project_Name)
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  console.log("[v0] insertProjectRow: success")
}

/**
 * Add rows to the "internal_team" worksheet.
 */
export async function insertTeamRows(token: string, rows: TeamMemberRow[], sheet: "internal_team" | "client_team"): Promise<void> {
  if (rows.length === 0) return
  const fileId = await findDatabaseFile(token)
  const url = `${GRAPH_BASE}/me/drive/items/${fileId}/workbook/worksheets/${sheet}/tables/${sheet}/rows/add`
  const values = rows.map((r) => [r.Project_folder_ID, r.Name, r.Email, r.Designation])
  console.log("[v0] insertTeamRows to", sheet, ":", rows.length, "rows")
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  console.log("[v0] insertTeamRows: success")
}

/**
 * Update a row in the "projects" worksheet by Project_folder_ID.
 * Note: Excel table row updates are limited — we'll need to use the range API to update.
 */
export async function updateExcelRow(token: string, sheet: string, projectFolderId: string, updates: Partial<ProjectRow>): Promise<void> {
  const fileId = await findDatabaseFile(token)
  
  // Get all rows to find the target row
  const allRows = await readWorksheet<ProjectRow>(token, fileId, sheet)
  const rowIndex = allRows.findIndex((r) => r.Project_folder_ID === projectFolderId)
  
  if (rowIndex === -1) {
    throw new Error(`Project with folder ID ${projectFolderId} not found in ${sheet} sheet`)
  }
  
  // Row index in the sheet (1-based, accounting for header)
  const excelRowNum = rowIndex + 2
  
  const url = `${GRAPH_BASE}/me/drive/items/${fileId}/workbook/worksheets/${sheet}/range(address='A${excelRowNum}:H${excelRowNum}')`
  
  const values = [[
    updates.Client_Name ?? "",
    updates.Project_Name ?? "",
    updates.Project_folder_ID ?? projectFolderId,
    updates.Project_Manager ?? "",
    updates.Start_Date ?? "",
    updates.End_date ?? "",
    updates.Project_status ?? "",
    updates.Project_Type ?? "",
  ]]
  
  console.log("[v0] updateExcelRow:", sheet, "row", excelRowNum)
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  })
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  
  console.log("[v0] updateExcelRow: success")
}

/**
 * Replace all team members for a project with new ones.
 * De-duplicates by email to prevent accumulating duplicate rows.
 * Deletes old rows first, then inserts new ones.
 */
export async function replaceTeamRows(
  token: string,
  newMembers: TeamMemberRow[],
  sheet: "internal_team" | "client_team"
): Promise<void> {
  if (!newMembers.length) return

  const fileId = await findDatabaseFile(token)
  const projectFolderId = newMembers[0].Project_folder_ID

  // Get all rows currently in the sheet
  const allRows = await readWorksheet<TeamMemberRow>(token, fileId, sheet)
  
  // Identify rows to delete: all rows with this project ID
  const oldRowsForProject = allRows.filter((r) => r.Project_folder_ID === projectFolderId)
  console.log("[v0] replaceTeamRows: found", oldRowsForProject.length, "existing rows for project", projectFolderId)
  console.log("[v0] replaceTeamRows: incoming", newMembers.length, "new members to save")

  // Clear the sheet entirely and rebuild with deduped data
  // 1. Build list of all rows except those for this project
  const rowsToKeep = allRows.filter((r) => r.Project_folder_ID !== projectFolderId)
  
  // 2. De-duplicate new members by email (keep first occurrence)
  const newMembersByEmail = new Map<string, TeamMemberRow>()
  for (const member of newMembers) {
    if (!newMembersByEmail.has(member.Email)) {
      newMembersByEmail.set(member.Email, member)
    }
  }
  const deduped = Array.from(newMembersByEmail.values())
  console.log("[v0] replaceTeamRows: de-duped to", deduped.length, "unique members")

  // 3. Combine: kept rows + new deduped members
  const allDataToInsert = [...rowsToKeep, ...deduped]
  console.log("[v0] replaceTeamRows: total rows to save:", allDataToInsert.length)

  // 4. Delete entire sheet content (except header)
  if (allRows.length > 0) {
    const startRow = 2 // Excel 1-indexed, row 1 is header
    const endRow = allRows.length + 1
    const deleteUrl = `${GRAPH_BASE}/me/drive/items/${fileId}/workbook/worksheets/${sheet}/range(address='A${startRow}:D${endRow}')`
    
    console.log("[v0] replaceTeamRows: clearing sheet rows", startRow, "-", endRow)
    const deleteRes = await fetch(deleteUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    
    if (!deleteRes.ok) {
      console.warn("[v0] Failed to clear sheet, but continuing with insert")
    }
  }

  // 5. Re-insert all data
  if (allDataToInsert.length > 0) {
    await insertTeamRows(token, allDataToInsert, sheet)
  }

  console.log("[v0] replaceTeamRows: complete")
}

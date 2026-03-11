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
 * Replace team members for a project by de-duplicating by email.
 * Reads all data, keeps non-project rows, adds de-duped new members, rebuilds sheet.
 */
export async function replaceTeamRows(
  token: string,
  newMembers: TeamMemberRow[],
  sheet: "internal_team" | "client_team"
): Promise<void> {
  if (!newMembers.length) return

  const fileId = await findDatabaseFile(token)
  const projectFolderId = newMembers[0].Project_folder_ID

  // 1. Read all existing data
  const allRows = await readWorksheet<TeamMemberRow>(token, fileId, sheet)
  console.log("[v0] replaceTeamRows: read", allRows.length, "total rows from", sheet)

  // 2. Keep rows that are NOT for this project
  const rowsToKeep = allRows.filter((r) => r.Project_folder_ID !== projectFolderId)
  console.log("[v0] replaceTeamRows: keeping", rowsToKeep.length, "rows from other projects")

  // 3. De-duplicate incoming members by Email (keep only first of each email)
  const memberMap = new Map<string, TeamMemberRow>()
  for (const member of newMembers) {
    if (!memberMap.has(member.Email)) {
      memberMap.set(member.Email, member)
    }
  }
  const dedupedNewMembers = Array.from(memberMap.values())
  console.log("[v0] replaceTeamRows: de-duped new members from", newMembers.length, "to", dedupedNewMembers.length)

  // 4. Combine: old rows from other projects + new deduped
  const finalData = [...rowsToKeep, ...dedupedNewMembers]
  console.log("[v0] replaceTeamRows: final data will have", finalData.length, "total rows")

  if (finalData.length === 0) {
    console.log("[v0] replaceTeamRows: no data to save, skipping")
    return
  }

  // 5. Insert all final data using table add API
  const bulkRows = finalData.map((m) => [m.Project_folder_ID, m.Name, m.Email, m.Designation])
  const insertUrl = `${GRAPH_BASE}/me/drive/items/${fileId}/workbook/worksheets/${sheet}/tables/${sheet}/rows/add`

  console.log("[v0] replaceTeamRows: inserting", bulkRows.length, "rows to", sheet)
  const insertRes = await fetch(insertUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: bulkRows }),
  })

  if (!insertRes.ok) {
    const err = await insertRes.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Failed to insert rows: HTTP ${insertRes.status}`)
  }

  console.log("[v0] replaceTeamRows: successfully inserted all rows")
}

// ─── Meeting Database Functions ────────────────────────────────────────────────

export interface MeetingRow {
  Meeting_ID: string
  Project_folder_ID: string
  Meeting_title: string
  Meeting_date: string
  Organizer: string
}

export interface MeetingAttendeeRow {
  Meeting_ID: string
  Name: string
  Email: string
  Attendance_Status: string
}

export interface DecisionRow {
  Meeting_ID: string
  Decision_ID: string
  Decision: string
}

export interface ActionRow {
  Meeting_ID: string
  Action_ID: string
  Task: string
  Owner: string
  Owner_email: string
  Due_Date: string
  Status: string
}

export interface RiskRow {
  Meeting_ID: string
  Risk_ID: string
  Risk: string
}

export interface DiscussionRow {
  Meeting_ID: string
  Discussion_ID: string
  Discussion: string
}

export interface MeetingDatabase {
  meetings: MeetingRow[]
  attendees: MeetingAttendeeRow[]
  decisions: DecisionRow[]
  actions: ActionRow[]
  risks: RiskRow[]
  discussions: DiscussionRow[]
}

/**
 * Fetch all meeting data for a project from the database.xlsx file.
 * Reads from: meetings, meeting_attendees, decisions, actions, risks, discussion worksheets.
 */
export async function fetchMeetingDatabase(
  token: string,
  projectFolderId: string
): Promise<MeetingDatabase> {
  console.log("[v0] fetchMeetingDatabase for project:", projectFolderId)
  const fileId = await findDatabaseFile(token)

  const [allMeetings, allAttendees, allDecisions, allActions, allRisks, allDiscussions] = await Promise.all([
    readWorksheet<MeetingRow>(token, fileId, "meetings").catch(() => []),
    readWorksheet<MeetingAttendeeRow>(token, fileId, "meeting_attendees").catch(() => []),
    readWorksheet<DecisionRow>(token, fileId, "decisions").catch(() => []),
    readWorksheet<ActionRow>(token, fileId, "actions").catch(() => []),
    readWorksheet<RiskRow>(token, fileId, "risks").catch(() => []),
    readWorksheet<DiscussionRow>(token, fileId, "discussion").catch(() => []),
  ])

  // Filter all data by project folder ID via meeting_id lookup
  const projectMeetingIds = new Set(
    allMeetings
      .filter((m) => m.Project_folder_ID === projectFolderId)
      .map((m) => m.Meeting_ID)
  )

  const meetings = allMeetings.filter((m) => m.Project_folder_ID === projectFolderId)
  const attendees = allAttendees.filter((a) => projectMeetingIds.has(a.Meeting_ID))
  const decisions = allDecisions.filter((d) => projectMeetingIds.has(d.Meeting_ID))
  const actions = allActions.filter((a) => projectMeetingIds.has(a.Meeting_ID))
  const risks = allRisks.filter((r) => projectMeetingIds.has(r.Meeting_ID))
  const discussions = allDiscussions.filter((d) => projectMeetingIds.has(d.Meeting_ID))

  console.log("[v0] fetchMeetingDatabase: found", meetings.length, "meetings,", attendees.length, "attendees,", decisions.length, "decisions,", actions.length, "actions,", risks.length, "risks,", discussions.length, "discussions")
  
  return { meetings, attendees, decisions, actions, risks, discussions }
}

/**
 * Send transcript and meeting data to the webhook for processing.
 */
export async function sendTranscriptToWebhook(payload: {
  title: string
  date: string
  meeting_id: string
  code: string
  project_id: string
  project_team: Array<{ name: string; email: string; designation: string }>
  transcript: string
}): Promise<any> {
  console.log("[v0] sendTranscriptToWebhook:", payload.title)
  
  // Call the server-side proxy instead of calling n8n directly (avoids CORS)
  const res = await fetch("/api/webhook-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error ?? `HTTP ${res.status}`)
  }
  
  const data = await res.json()
  console.log("[v0] sendTranscriptToWebhook response:", data)
  return data
}

// ─── Meeting Data Insertion Functions ──────────────────────────────────────────

async function insertMeetingRows(token: string, rows: MeetingRow[]): Promise<void> {
  if (rows.length === 0) return
  const fileId = await findDatabaseFile(token)
  const url = `${GRAPH_BASE}/me/drive/items/${fileId}/workbook/worksheets/meetings/tables/meetings/rows/add`
  const values = rows.map((r) => [r.Meeting_ID, r.Project_folder_ID, r.Meeting_title, r.Meeting_date, r.Organizer])
  console.log("[v0] insertMeetingRows:", rows.length, "rows")
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
}

async function insertDecisionRows(token: string, rows: DecisionRow[]): Promise<void> {
  if (rows.length === 0) return
  const fileId = await findDatabaseFile(token)
  const url = `${GRAPH_BASE}/me/drive/items/${fileId}/workbook/worksheets/decisions/tables/decisions/rows/add`
  const values = rows.map((r) => [r.Meeting_ID, r.Decision_ID, r.Decision])
  console.log("[v0] insertDecisionRows:", rows.length, "rows")
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
}

async function insertActionRows(token: string, rows: ActionRow[]): Promise<void> {
  if (rows.length === 0) return
  const fileId = await findDatabaseFile(token)
  const url = `${GRAPH_BASE}/me/drive/items/${fileId}/workbook/worksheets/actions/tables/actions/rows/add`
  const values = rows.map((r) => [r.Meeting_ID, r.Action_ID, r.Task, r.Owner, r.Owner_email, r.Due_Date, r.Status])
  console.log("[v0] insertActionRows:", rows.length, "rows")
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
}

async function insertRiskRows(token: string, rows: RiskRow[]): Promise<void> {
  if (rows.length === 0) return
  const fileId = await findDatabaseFile(token)
  const url = `${GRAPH_BASE}/me/drive/items/${fileId}/workbook/worksheets/risks/tables/risks/rows/add`
  const values = rows.map((r) => [r.Meeting_ID, r.Risk_ID, r.Risk])
  console.log("[v0] insertRiskRows:", rows.length, "rows")
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
}

async function insertDiscussionRows(token: string, rows: DiscussionRow[]): Promise<void> {
  if (rows.length === 0) return
  const fileId = await findDatabaseFile(token)
  const url = `${GRAPH_BASE}/me/drive/items/${fileId}/workbook/worksheets/discussion/tables/discussion/rows/add`
  const values = rows.map((r) => [r.Meeting_ID, r.Discussion_ID, r.Discussion])
  console.log("[v0] insertDiscussionRows:", rows.length, "rows")
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
}

/**
 * Save webhook response data (decisions, actions, risks, discussions) to Excel database.
 */
export async function saveMeetingDataToExcel(
  token: string,
  projectFolderId: string,
  meetingId: string,
  title: string,
  date: string,
  code: string,
  projectTeam: Array<{ name: string; email: string; designation: string }>,
  webhookResponse: any
): Promise<void> {
  try {
    // Extract organizer from project team (first internal team member or default)
    const organizer = projectTeam[0]?.name || "Account Holder"

    // 1. Insert meeting record
    const meetingRow: MeetingRow = {
      Meeting_ID: meetingId,
      Project_folder_ID: projectFolderId,
      Meeting_title: title,
      Meeting_date: date,
      Organizer: organizer,
    }

    await insertMeetingRows(token, [meetingRow])
    console.log("[v0] Inserted meeting record:", meetingId)

    // 2. Insert decisions with auto-generated IDs
    const decisions = webhookResponse.output?.decisions || []
    const decisionRows: DecisionRow[] = decisions.map((d: any, idx: number) => ({
      Meeting_ID: meetingId,
      Decision_ID: `DEC_${Date.now()}_${idx}`,
      Decision: d.decision || "",
    }))

    if (decisionRows.length > 0) {
      await insertDecisionRows(token, decisionRows)
      console.log("[v0] Inserted", decisionRows.length, "decisions")
    }

    // 3. Insert actions with owner emails looked up from team
    const actions = webhookResponse.output?.actions || []
    const actionRows: ActionRow[] = actions.map((a: any, idx: number) => {
      // Look up owner email from team (case-insensitive match)
      const teamMember = projectTeam.find(
        (t) => t.name.toLowerCase() === a.owner?.toLowerCase()
      )
      const ownerEmail = teamMember?.email || ""

      return {
        Meeting_ID: meetingId,
        Action_ID: `ACT_${Date.now()}_${idx}`,
        Task: a.task || "",
        Owner: a.owner || "",
        Owner_email: ownerEmail,
        Due_Date: a.due_date || "",
        Status: a.status || "Pending",
      }
    })

    if (actionRows.length > 0) {
      await insertActionRows(token, actionRows)
      console.log("[v0] Inserted", actionRows.length, "actions with owner emails looked up")
    }

    // 4. Insert risks with auto-generated IDs
    const risks = webhookResponse.output?.risks || []
    const riskRows: RiskRow[] = risks.map((r: any, idx: number) => ({
      Meeting_ID: meetingId,
      Risk_ID: `RISK_${Date.now()}_${idx}`,
      Risk: r.risk || "",
    }))

    if (riskRows.length > 0) {
      await insertRiskRows(token, riskRows)
      console.log("[v0] Inserted", riskRows.length, "risks")
    }

    // 5. Insert discussion points with auto-generated IDs
    const discussions = webhookResponse.output?.discussion_points || []
    const discussionRows: DiscussionRow[] = discussions.map((dp: any, idx: number) => ({
      Meeting_ID: meetingId,
      Discussion_ID: `DISC_${Date.now()}_${idx}`,
      Discussion: dp.point || "",
    }))

    if (discussionRows.length > 0) {
      await insertDiscussionRows(token, discussionRows)
      console.log("[v0] Inserted", discussionRows.length, "discussion points")
    }

    console.log("[v0] Successfully saved all meeting data to Excel")
  } catch (err) {
    console.error("[v0] Failed to save meeting data:", err)
    throw err
  }
}

// ─── PPTX Utilities ─────────────────────────────────────────────────────────

/**
 * List ALL children of a folder (files + folders) — used to find .pptx files.
 */
export async function listFolderFiles(
  token: string,
  itemId: string
): Promise<DriveItem[]> {
  const url = `${GRAPH_BASE}/me/drive/items/${itemId}/children?$select=id,name,folder,file,webUrl&$top=200`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
  }
  const data: { value: DriveItem[] } = await res.json()
  return data.value
}

// ─── Microsoft Planner ───────────────────────────────────────────────────────

export interface PlannerPlan {
  id: string
  title: string
  owner: string
}

export interface PlannerTask {
  id: string
  title: string
  planId: string
  startDateTime: string | null
  dueDateTime: string | null
  percentComplete: number
  priority: number
  assignments: Record<string, { assignedDateTime: string }>
}

export interface AssigneeInfo {
  id: string
  displayName: string
  email: string
}

export interface PlannerTaskWithAssignees extends PlannerTask {
  assigneeNames: string[]
  assignees: AssigneeInfo[]
}

/** Priority label mapping per Microsoft Planner conventions */
export function plannerPriorityLabel(p: number): { label: string; color: string } {
  if (p === 1) return { label: "Urgent",    color: "oklch(0.55 0.26 25)" }
  if (p === 3) return { label: "Important", color: "oklch(0.65 0.20 55)" }
  if (p === 5) return { label: "Medium",    color: "oklch(0.55 0.20 240)" }
  return           { label: "Low",       color: "oklch(0.55 0.15 150)" }
}

/**
 * Fetch all Planner plans for the authenticated user, then find the one
 * whose title exactly matches the given project name (case-insensitive).
 */
export async function fetchPlannerPlanByName(
  token: string,
  projectName: string
): Promise<PlannerPlan | null> {
  const res = await fetch(`${GRAPH_BASE}/me/planner/plans`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  const plans: PlannerPlan[] = data.value ?? []
  // Exact case-insensitive match on plan title
  const targetTitle = projectName.toLowerCase()
  return plans.find((p) => p.title.toLowerCase() === targetTitle) ?? null
}

/**
 * Fetch all tasks for a Planner plan by plan ID.
 */
export async function fetchPlannerTasks(
  token: string,
  planId: string
): Promise<PlannerTask[]> {
  const res = await fetch(`${GRAPH_BASE}/planner/plans/${planId}/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.value ?? []
}

/**
 * Resolve a user ID to display name + email via /users/{id}.
 */
export async function fetchUserDetails(
  token: string,
  userId: string
): Promise<AssigneeInfo> {
  const res = await fetch(`${GRAPH_BASE}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return { id: userId, displayName: userId, email: "" }
  const data = await res.json()
  return {
    id: userId,
    displayName: data.displayName ?? userId,
    email: data.mail ?? data.userPrincipalName ?? "",
  }
}

/**
 * Fetch Planner tasks for a plan and resolve all assignee display names.
 * Deduplicates user lookups so each unique user ID is fetched only once.
 */
export async function fetchPlannerTasksWithAssignees(
  token: string,
  planId: string
): Promise<PlannerTaskWithAssignees[]> {
  const tasks = await fetchPlannerTasks(token, planId)

  // Collect unique user IDs across all tasks
  const userIds = new Set<string>()
  for (const task of tasks) {
    for (const uid of Object.keys(task.assignments)) userIds.add(uid)
  }

  // Fetch all user details in parallel
  const userMap = new Map<string, AssigneeInfo>()
  await Promise.all(
    Array.from(userIds).map(async (uid) => {
      const info = await fetchUserDetails(token, uid)
      userMap.set(uid, info)
    })
  )

  return tasks.map((task) => {
    const assigneeList = Object.keys(task.assignments).map(
      (uid) => userMap.get(uid) ?? { id: uid, displayName: uid, email: "" }
    )
    return {
      ...task,
      assigneeNames: assigneeList.map((a) => a.displayName),
      assignees: assigneeList,
    }
  })
}

/**
 * Send a reminder email from the authenticated user's Outlook mailbox via POST /me/sendMail.
 */
export async function sendNudgeEmail(
  token: string,
  to: string[],
  subject: string,
  body: string
): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/me/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: body },
        toRecipients: to.map((addr) => ({ emailAddress: { address: addr } })),
      },
      saveToSentItems: true,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
}

/**
 * Download a Drive item as an ArrayBuffer (for binary files like PPTX).
 */
export async function fetchFileAsArrayBuffer(
  token: string,
  itemId: string
): Promise<ArrayBuffer> {
  // First get the download URL
  const url = `${GRAPH_BASE}/me/drive/items/${itemId}/content`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
  }
  return res.arrayBuffer()
}


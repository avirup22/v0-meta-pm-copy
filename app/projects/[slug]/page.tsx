"use client"

import { useState, useEffect, useCallback } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  CalendarDays,
  CheckSquare,
  FileText,
  ChevronRight,
  Users,
  Briefcase,
  Clock,
  TrendingUp,
  AlertTriangle,
  Send,
  Sparkles,
  ArrowRight,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import {
  fetchAllCustomersWithProjects,
  fetchProjectDatabase,
  type ProjectDatabase,
} from "@/lib/graph"
import { EditProjectModal } from "@/components/edit-project-modal"
import { EditTeamModal } from "@/components/edit-team-modal"

// ─── Webhook URLs (commented out — to be wired up from meetings page)
// const WEBHOOK_TRANSCRIPT = "https://indegene-sbx.app.n8n.cloud/webhook/meta-pm"
// const WEBHOOK_GET_MOM    = "https://indegene-sbx.app.n8n.cloud/webhook/get-mom"

function slugToTitle(slug: string) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-")
}

// Derive initials from a full name
function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

// Format Excel date (serial number) or dd-mm-yyyy string to dd-mm-yyyy
function formatDate(value: string | number): string {
  if (!value) return "—"
  
  const str = String(value).trim()
  
  // If it's already in dd-mm-yyyy format, return as-is
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    return str
  }
  
  // If it's formatted as dd-mm-xxxxx (Excel serial number as string with partial separator)
  // e.g., "01-01-46084" → parse and convert
  const parts = str.split("-")
  if (parts.length === 3 && /^\d+$/.test(parts[2]) && parts[2].length > 4) {
    const serialNum = parseInt(parts[2], 10)
    if (serialNum > 1000) {
      // Excel epoch starts at Jan 1, 1900
      const excelEpoch = new Date(1900, 0, -1)
      const date = new Date(excelEpoch.getTime() + serialNum * 86400000)
      const dd = String(date.getDate()).padStart(2, "0")
      const mm = String(date.getMonth() + 1).padStart(2, "0")
      const yyyy = date.getFullYear()
      return `${dd}-${mm}-${yyyy}`
    }
  }
  
  // Try to parse as numeric serial (if it's a large number)
  const num = Number(str)
  if (!isNaN(num) && num > 1000) {
    const excelEpoch = new Date(1900, 0, -1)
    const date = new Date(excelEpoch.getTime() + num * 86400000)
    const dd = String(date.getDate()).padStart(2, "0")
    const mm = String(date.getMonth() + 1).padStart(2, "0")
    const yyyy = date.getFullYear()
    return `${dd}-${mm}-${yyyy}`
  }
  
  // Try to parse as ISO/standard date string
  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = d.getFullYear()
    return `${dd}-${mm}-${yyyy}`
  }
  
  return str
}

const AVATAR_COLORS = [
  "#3b5fc0", "#0e9e6e", "#c07a2a", "#7c3abd",
  "#c0393b", "#1a8fa8", "#6b7c45", "#a83a70",
]

const SUGGESTED_PROMPTS = [
  "What decisions were made in the meeting?",
  "Show open tasks for Sarvesh",
  "What risks exist in this project?",
]

const SUGGESTED_ACTIONS = [
  "Summarize the last 3 meetings",
  "List all unresolved tasks",
]

const EXPORT_ITEMS = ["Project Charter", "RACI Matrix", "Client SOW"]

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function ProjectPage({ params }: PageProps) {
  const { slug } = use(params)
  const { isAuthenticated, token, displayName } = useAuth()
  const router = useRouter()
  const [askInput, setAskInput] = useState("")

  // Data state
  const [db, setDb] = useState<ProjectDatabase | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Edit modal state
  const [editModal, setEditModal] = useState<"project" | "internal-team" | "client-team" | null>(null)

  useEffect(() => {
    if (!isAuthenticated) router.replace("/")
  }, [isAuthenticated, router])

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      // Step 1: resolve slug → OneDrive folder ID
      const customers = await fetchAllCustomersWithProjects(token)
      const allProjects = customers.flatMap((c) => c.projects)
      const folder = allProjects.find((p) => toSlug(p.name) === slug)
      if (!folder) throw new Error(`Project folder not found for slug: ${slug}`)
      setFolderId(folder.id)

      // Step 2: fetch from Excel database
      const data = await fetchProjectDatabase(token, folder.id)
      setDb(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load project data")
    } finally {
      setLoading(false)
    }
  }, [token, slug])

  useEffect(() => {
    if (isAuthenticated && token) loadData()
  }, [isAuthenticated, token, loadData])

  if (!isAuthenticated) return null

  // ── Derived display values ───────────────────────────────────────────────
  const proj = db?.project
  const projectName = proj?.Project_Name ?? slugToTitle(slug)
  const clientName  = proj?.Client_Name ?? "—"
  const pm          = proj?.Project_Manager ?? displayName ?? "—"
  const startDate   = formatDate(proj?.Start_Date ?? "")
  const endDate     = formatDate(proj?.End_date ?? "")
  const status      = proj?.Project_status ?? "—"
  const type        = proj?.Project_Type ?? "—"
  
  // De-duplicate team members by email (fix for duplicate rows in Excel)
  const dedupInternalTeam = db?.internalTeam 
    ? Array.from(new Map(db.internalTeam.map(m => [m.Email, m])).values())
    : []
  const dedupClientTeam = db?.clientTeam
    ? Array.from(new Map(db.clientTeam.map(m => [m.Email, m])).values())
    : []

  const internalTeam = db?.internalTeam ?? []
  const clientTeam   = db?.clientTeam ?? []
  const allTeam      = [...internalTeam, ...clientTeam]

  const overviewRows = [
    { label: "Client",          value: clientName },
    { label: "Project Manager", value: pm },
    { label: "Start Date",      value: startDate },
    { label: "End Date",        value: endDate },
    { label: "Project Status",  value: status, badge: true },
    { label: "Project Type",    value: type },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Page header bar */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border bg-card">
        <span className="text-xs font-sans text-muted-foreground">
          <Link href="/projects" className="hover:text-primary transition-colors">Projects</Link>
          {" / "}
          <span className="text-foreground font-medium">{projectName}</span>
        </span>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm font-sans text-muted-foreground">Loading project data...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="flex flex-col items-center gap-3 text-center max-w-sm">
            <AlertTriangle size={28} className="text-orange-400" />
            <p className="text-sm font-sans text-foreground font-medium">Could not load project data</p>
            <p className="text-xs font-sans text-muted-foreground">{error}</p>
            <button
              onClick={loadData}
              className="text-xs font-sans px-3 py-1.5 rounded-lg border border-border hover:bg-secondary transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* 3-column body */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.4fr)] gap-0 min-h-full">

            {/* ── LEFT COLUMN ── */}
            <div className="border-r border-border p-6 flex flex-col gap-5">
              {/* Title + action */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground font-sans text-balance leading-tight">
                    {projectName}
                  </h1>
                  <p className="text-sm text-muted-foreground font-sans mt-0.5">
                    Client: <span className="text-foreground font-medium">{clientName}</span>
                  </p>
                </div>
                <Link
                  href={`/projects/${slug}/meetings`}
                  className="shrink-0 flex items-center gap-1.5 text-xs font-sans font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-secondary transition-colors text-foreground"
                >
                  Manage Project
                  <ChevronRight size={13} strokeWidth={2} />
                </Link>
              </div>

              {/* Timeline chips */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { icon: <Clock size={12} />,      label: `Start: ${startDate}` },
                  { icon: <ArrowRight size={12} />,  label: `End: ${endDate}` },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className="flex items-center gap-1 text-xs font-sans text-muted-foreground bg-secondary border border-border px-2.5 py-1 rounded-full"
                  >
                    {chip.icon}
                    {chip.label}
                  </span>
                ))}
                <span
                  className="flex items-center gap-1 text-xs font-sans px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: status.toLowerCase() === "active"
                      ? "oklch(0.9 0.12 145)"
                      : "var(--secondary)",
                    color: status.toLowerCase() === "active"
                      ? "oklch(0.3 0.1 145)"
                      : "var(--muted-foreground)",
                  }}
                >
                  <CheckSquare size={12} />
                  {status}
                </span>
              </div>

              {/* Project overview table */}
              <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-0 divide-y divide-border">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground font-sans">Project Overview</h2>
                  <button 
                    onClick={() => setEditModal("project")}
                    className="text-xs text-primary hover:text-primary/80 font-sans font-medium transition-colors"
                  >
                    Edit
                  </button>
                </div>
                {proj ? (
                  overviewRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 gap-4">
                      <span className="text-xs text-muted-foreground font-sans">{row.label}</span>
                      {row.badge ? (
                        <span
                          className="text-xs font-semibold px-2.5 py-0.5 rounded font-sans"
                          style={{
                            background: row.value.toLowerCase() === "active"
                              ? "oklch(0.9 0.12 145)"
                              : "var(--secondary)",
                            color: row.value.toLowerCase() === "active"
                              ? "oklch(0.3 0.1 145)"
                              : "var(--muted-foreground)",
                          }}
                        >
                          {row.value}
                        </span>
                      ) : (
                        <span className="text-xs text-foreground font-sans font-medium text-right">{row.value}</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-6 flex items-center justify-center text-center">
                    <p className="text-xs text-muted-foreground font-sans">Add details</p>
                  </div>
                )}
              </div>

              {/* Internal Team */}
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground font-sans">Internal Team</h2>
                  </div>
                  <button 
                    onClick={() => setEditModal("internal-team")}
                    className="text-xs text-primary hover:text-primary/80 font-sans font-medium transition-colors"
                  >
                    Edit
                  </button>
                </div>
                {dedupInternalTeam.length > 0 ? (
                  <div className="flex flex-wrap gap-4">
                    {dedupInternalTeam.map((m, i) => (
                      <div key={m.Email || m.Name} className="flex flex-col items-center gap-1.5">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold font-sans"
                          style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                        >
                          {initials(m.Name)}
                        </div>
                        <span className="text-xs font-sans text-foreground font-medium text-center">{m.Name.split(" ")[0]}</span>
                        <span className="text-[10px] font-sans text-muted-foreground text-center leading-tight max-w-[64px]">{m.Designation}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 flex items-center justify-center text-center">
                    <p className="text-xs text-muted-foreground font-sans">Add details</p>
                  </div>
                )}
              </div>

              {/* Client Team */}
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground font-sans">Client Team</h2>
                  </div>
                  <button 
                    onClick={() => setEditModal("client-team")}
                    className="text-xs text-primary hover:text-primary/80 font-sans font-medium transition-colors"
                  >
                    Edit
                  </button>
                </div>
                {dedupClientTeam.length > 0 ? (
                  <div className="flex flex-wrap gap-4">
                    {dedupClientTeam.map((m, i) => (
                      <div key={m.Email || m.Name} className="flex flex-col items-center gap-1.5">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold font-sans"
                          style={{ background: AVATAR_COLORS[(i + 4) % AVATAR_COLORS.length] }}
                        >
                          {initials(m.Name)}
                        </div>
                        <span className="text-xs font-sans text-foreground font-medium text-center">{m.Name.split(" ")[0]}</span>
                        <span className="text-[10px] font-sans text-muted-foreground text-center leading-tight max-w-[64px]">{m.Designation}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 flex items-center justify-center text-center">
                    <p className="text-xs text-muted-foreground font-sans">Add details</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── MIDDLE COLUMN ── */}
            <div className="border-r border-border p-6 flex flex-col gap-5">

              {/* Recent Meetings stats */}
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground font-sans">Recent Meetings</h2>
                  </div>
                  <Link href={`/projects/${slug}/meetings`} className="text-xs text-primary hover:underline font-sans">
                    View all
                  </Link>
                </div>
                <ul className="flex flex-col divide-y divide-border">
                  {[
                    { icon: <CalendarDays size={13} />, label: "Total Meetings", value: "—" },
                    { icon: <CheckSquare  size={13} />, label: "Open Tasks",     value: "—" },
                    { icon: <Briefcase   size={13} />, label: "Key Decisions",  value: "—" },
                  ].map((stat) => (
                    <li key={stat.label} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {stat.icon}
                        <span className="text-xs font-sans text-foreground">{stat.label}</span>
                      </div>
                      <span className="text-xs font-bold font-sans text-foreground">{stat.value}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/projects/${slug}/meetings`}
                  className="flex items-center gap-1 text-xs text-primary hover:underline font-sans mt-3"
                >
                  Go to meetings
                  <ChevronRight size={12} />
                </Link>
              </div>

              {/* Open Tasks placeholder */}
              <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <CheckSquare size={14} className="text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground font-sans">Open Tasks</h2>
                </div>
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <CheckSquare size={28} className="text-muted-foreground/40" />
                  <p className="text-xs font-sans text-muted-foreground text-center">
                    Tasks will appear here once meetings are processed
                  </p>
                  <Link
                    href={`/projects/${slug}/meetings`}
                    className="flex items-center gap-1 text-xs text-primary hover:underline font-sans mt-1"
                  >
                    Go to Meetings
                    <ChevronRight size={12} />
                  </Link>
                </div>
              </div>

              {/* Documents placeholder */}
              <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground font-sans">Documents</h2>
                </div>
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <FileText size={28} className="text-muted-foreground/40" />
                  <p className="text-xs font-sans text-muted-foreground text-center">
                    No documents linked yet
                  </p>
                  <Link
                    href={`/projects/${slug}/documents`}
                    className="flex items-center gap-1 text-xs text-primary hover:underline font-sans mt-1"
                  >
                    Go to Documents
                    <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="p-6 flex flex-col gap-5 bg-secondary/30">

              {/* Ask MetaPM */}
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={14} style={{ color: "var(--primary)" }} />
                  <h2 className="text-sm font-semibold text-foreground font-sans">Ask MetaPM</h2>
                </div>
                <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 mb-3 bg-background">
                  <input
                    type="text"
                    value={askInput}
                    onChange={(e) => setAskInput(e.target.value)}
                    placeholder="Ask anything about this project..."
                    className="flex-1 text-xs font-sans bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                  />
                  <button className="text-muted-foreground hover:text-primary transition-colors" aria-label="Send">
                    <Send size={14} />
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setAskInput(p)}
                      className="text-left text-xs font-sans text-muted-foreground hover:text-foreground hover:bg-secondary px-2 py-1.5 rounded-lg transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Insights */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h2 className="text-sm font-semibold text-foreground font-sans mb-4">Quick Insights</h2>
                <ul className="flex flex-col divide-y divide-border">
                  {[
                    { icon: <CalendarDays  size={13} />, label: "Total Meetings", value: "—", alert: false },
                    { icon: <CheckSquare   size={13} />, label: "Open Tasks",     value: "—", alert: false },
                    { icon: <Briefcase     size={13} />, label: "Key Decisions",  value: "—", alert: false },
                    { icon: <AlertTriangle size={13} />, label: "Risks",          value: "—", alert: false },
                  ].map((item) => (
                    <li key={item.label} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {item.icon}
                        <span className="text-xs font-sans text-foreground">{item.label}</span>
                      </div>
                      <span className="text-xs font-bold font-sans text-foreground">{item.value}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] font-sans text-muted-foreground mt-3">
                  Counts are populated from processed meetings
                </p>
              </div>

              {/* Suggested Actions */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h2 className="text-sm font-semibold text-foreground font-sans mb-3">Suggested Actions</h2>
                <div className="flex flex-col gap-2">
                  {SUGGESTED_ACTIONS.map((action) => (
                    <button
                      key={action}
                      className="flex items-center justify-between w-full text-xs font-sans text-foreground px-3 py-2.5 rounded-lg border border-border hover:bg-secondary hover:border-primary/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={12} className="text-muted-foreground" />
                        {action}
                      </div>
                      <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Insights */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h2 className="text-sm font-semibold text-foreground font-sans mb-3">Export Insights</h2>
                <ul className="flex flex-col divide-y divide-border">
                  {EXPORT_ITEMS.map((item) => (
                    <li key={item}>
                      <button className="flex items-center gap-2.5 w-full py-2.5 hover:bg-secondary px-2 -mx-2 rounded-lg transition-colors text-left">
                        <FileText size={13} className="text-muted-foreground shrink-0" />
                        <span className="text-xs font-sans text-foreground">{item}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modals */}
      {editModal === "project" && proj && (
        <EditProjectModal
          project={proj}
          folderId={folderId!}
          onClose={() => setEditModal(null)}
          onSave={loadData}
        />
      )}

      {editModal === "internal-team" && folderId && (
        <EditTeamModal
          title="Edit Internal Team"
          folderId={folderId}
          team={dedupInternalTeam}
          sheet="internal_team"
          onClose={() => setEditModal(null)}
          onSave={loadData}
        />
      )}

      {editModal === "client-team" && folderId && (
        <EditTeamModal
          title="Edit Client Team"
          folderId={folderId}
          team={dedupClientTeam}
          sheet="client_team"
          onClose={() => setEditModal(null)}
          onSave={loadData}
        />
      )}
    </div>
  )
}

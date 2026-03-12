"use client"

import { use, useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import {
  fetchAllCustomersWithProjects,
  fetchSprintPlanTracker,
  type SprintTrackerRow,
} from "@/lib/graph"
import {
  ChevronRight,
  Loader2,
  AlertTriangle,
  Search,
  RefreshCw,
  TableProperties,
  Layers,
  CheckCircle2,
  Clock,
  Circle,
  Sparkles,
  Zap,
  User,
  CalendarClock,
  Flag,
  Filter,
  MessageCircle,
  Bell,
  Mail,
  X,
  Send,
  CheckCircle,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string }>
}

const P2_COLOR = "oklch(0.52 0.22 195)"

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-")
}

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

/**
 * Convert an Excel serial date to a JS UTC timestamp (ms).
 * Returns null if not a valid serial.
 */
function excelSerialToMs(value: string): number | null {
  if (!value) return null
  const num = Number(value)
  if (isNaN(num) || num < 1) return null
  const adjusted = num >= 60 ? num - 2 : num - 1
  return Date.UTC(1900, 0, 1) + adjusted * 86400000
}

/**
 * Convert an Excel date serial (or string date) to dd-mm-yy for display.
 */
function excelDateToDisplay(value: string): string {
  if (!value) return ""
  const num = Number(value)
  if (isNaN(num)) {
    const d = new Date(value)
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getFullYear()).slice(-2)}`
    }
    return value
  }
  const ms = excelSerialToMs(value)
  if (!ms) return ""
  const d = new Date(ms)
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCFullYear()).slice(-2)}`
}

/**
 * Returns true if the row needs attention:
 * - Not started but current date has passed the start date, OR
 * - In progress but current date has passed the end date, OR
 * - Status contains "delayed" / "overdue" / "at risk"
 */
function needsAttention(row: SprintTrackerRow): boolean {
  const now = Date.now()
  const status = (row.Status ?? "").toLowerCase()

  if (/delayed|overdue|at risk/i.test(status)) return true

  const startMs = excelSerialToMs(row["Start Date"])
  const endMs   = excelSerialToMs(row["End Date"])

  if (/not started|pending|planned/i.test(status) && startMs && now > startMs) return true
  if (/progress|active|ongoing/i.test(status)     && endMs   && now > endMs)   return true

  return false
}

// ─── Status helpers ────────────────────────────────────────────────────────────

function statusStyle(status: string): { bg: string; color: string } {
  const s = status.toLowerCase()
  if (s.includes("complete") || s.includes("done"))
    return { bg: "color-mix(in oklch, oklch(0.55 0.22 150) 12%, white)", color: "oklch(0.45 0.22 150)" }
  if (s.includes("progress") || s.includes("active") || s.includes("ongoing"))
    return { bg: "color-mix(in oklch, oklch(0.65 0.20 55) 12%, white)", color: "oklch(0.50 0.22 55)" }
  if (s.includes("not started") || s.includes("pending") || s.includes("planned"))
    return { bg: "color-mix(in oklch, oklch(0.55 0.15 200) 12%, white)", color: "oklch(0.45 0.18 220)" }
  if (s.includes("hold") || s.includes("block") || s.includes("delayed") || s.includes("risk"))
    return { bg: "color-mix(in oklch, oklch(0.60 0.26 25) 10%, white)", color: "oklch(0.55 0.26 25)" }
  return { bg: "color-mix(in oklch, oklch(0.50 0.10 250) 10%, white)", color: "oklch(0.45 0.10 250)" }
}

function StatusPill({ status }: { status: string }) {
  if (!status || status === "—") return <span className="text-muted-foreground text-[10px]">—</span>
  const { bg, color } = statusStyle(status)
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-sans whitespace-nowrap"
      style={{ background: bg, color }}>
      {status}
    </span>
  )
}

function SprintBadge({ sprint }: { sprint: string }) {
  if (!sprint) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-sans whitespace-nowrap"
      style={{ background: `color-mix(in oklch, ${P2_COLOR} 12%, white)`, color: P2_COLOR }}>
      {sprint}
    </span>
  )
}

// ─── Email templates (shared with Planner 1 style) ───────────────────────────

interface MailArgs {
  activity: string
  owner: string
  startDate: string
  endDate: string
  status: string
  project: string
}

const MAIL_TEMPLATES = [
  {
    id: "friendly",
    label: "Friendly Reminder",
    subject: ({ activity }: MailArgs) => `Reminder: ${activity}`,
    body: ({ activity, endDate, owner, project }: MailArgs) =>
      `<p>Hi ${owner},</p>
<p>This is a friendly reminder about a task assigned to you in the <strong>${project}</strong> project.</p>
<table style="border-collapse:collapse;margin:12px 0;font-size:13px;">
  <tr><td style="padding:5px 16px 5px 0;font-weight:600;color:#555;">Activity</td><td style="padding:5px 0;">${activity}</td></tr>
  <tr><td style="padding:5px 16px 5px 0;font-weight:600;color:#555;">Due</td><td style="padding:5px 0;">${endDate}</td></tr>
</table>
<p>Could you please share a quick status update or let us know if there are any blockers?</p>
<p>Thanks!</p>`,
  },
  {
    id: "overdue",
    label: "Overdue Alert",
    subject: ({ activity }: MailArgs) => `Overdue Task: ${activity}`,
    body: ({ activity, endDate, owner, project }: MailArgs) =>
      `<p>Hi ${owner},</p>
<p>The following task in <strong>${project}</strong> appears to be <strong style="color:#dc2626;">past its due date</strong>. Immediate attention required.</p>
<table style="border-collapse:collapse;margin:12px 0;font-size:13px;border:1px solid #fecaca;background:#fff7f7;">
  <tr><td style="padding:6px 16px;font-weight:600;color:#dc2626;border:1px solid #fecaca;">Activity</td><td style="padding:6px 16px;border:1px solid #fecaca;">${activity}</td></tr>
  <tr><td style="padding:6px 16px;font-weight:600;color:#dc2626;border:1px solid #fecaca;">Was Due</td><td style="padding:6px 16px;border:1px solid #fecaca;">${endDate}</td></tr>
</table>
<p>Please update the task status immediately or reach out to discuss revised timelines.</p>
<p>Thank you.</p>`,
  },
  {
    id: "notstarted",
    label: "Not Started Alert",
    subject: ({ activity }: MailArgs) => `Action Required: ${activity} Not Yet Started`,
    body: ({ activity, startDate, endDate, owner, project }: MailArgs) =>
      `<p>Hi ${owner},</p>
<p>The following task in <strong>${project}</strong> was scheduled to start on <strong>${startDate}</strong> but has not been started yet.</p>
<table style="border-collapse:collapse;margin:12px 0;font-size:13px;border:1px solid #e5e7eb;">
  <tr style="background:#f9fafb;"><td style="padding:6px 16px;font-weight:600;border:1px solid #e5e7eb;">Activity</td><td style="padding:6px 16px;border:1px solid #e5e7eb;">${activity}</td></tr>
  <tr><td style="padding:6px 16px;font-weight:600;border:1px solid #e5e7eb;">Planned Start</td><td style="padding:6px 16px;border:1px solid #e5e7eb;">${startDate}</td></tr>
  <tr style="background:#f9fafb;"><td style="padding:6px 16px;font-weight:600;border:1px solid #e5e7eb;">Due Date</td><td style="padding:6px 16px;border:1px solid #e5e7eb;">${endDate}</td></tr>
</table>
<p>Please initiate this task as soon as possible to avoid delays to the project timeline.</p>
<p>Best regards</p>`,
  },
  {
    id: "standup",
    label: "Standup Check-in",
    subject: ({ activity }: MailArgs) => `Quick Check-in: ${activity}`,
    body: ({ activity, startDate, endDate, owner }: MailArgs) =>
      `<p>Hi ${owner},</p>
<p>Quick check-in on <strong>${activity}</strong>:</p>
<ul style="margin:8px 0;padding-left:20px;font-size:13px;">
  <li>Started: ${startDate}</li>
  <li>Due: ${endDate}</li>
</ul>
<p>Can you share: <strong>What's done, what's in progress, and any blockers?</strong></p>
<p>Cheers!</p>`,
  },
]

// ─── Quick Mail Modal ─────────────────────────────────────────────────────────

interface MailTarget {
  activity: string
  owner: string
  startDate: string
  endDate: string
  status: string
}

function QuickMailModal({ token, target, project, onClose }: {
  token: string
  target: MailTarget
  project: string
  onClose: () => void
}) {
  const args: MailArgs = {
    activity:  target.activity,
    owner:     target.owner,
    startDate: target.startDate,
    endDate:   target.endDate,
    status:    target.status,
    project,
  }

  const [templateId, setTemplateId] = useState(
    /not started|pending|planned/i.test(target.status) ? "notstarted" : "overdue"
  )
  const [to,         setTo]         = useState("")
  const [subject,    setSubject]    = useState(() => {
    const tpl = MAIL_TEMPLATES.find((t) => t.id === (
      /not started|pending|planned/i.test(target.status) ? "notstarted" : "overdue"
    ))!
    return tpl.subject(args)
  })
  const [body,       setBody]       = useState(() => {
    const tpl = MAIL_TEMPLATES.find((t) => t.id === (
      /not started|pending|planned/i.test(target.status) ? "notstarted" : "overdue"
    ))!
    return tpl.body(args)
  })
  const [editMode,   setEditMode]   = useState(false)
  const [sending,    setSending]    = useState(false)
  const [sent,       setSent]       = useState(false)
  const [sendError,  setSendError]  = useState<string | null>(null)

  const ringStyle = { "--tw-ring-color": `color-mix(in oklch, ${P2_COLOR} 40%, transparent)` } as React.CSSProperties
  const ALERT_COLOR = "oklch(0.60 0.26 25)"

  function applyTemplate(id: string) {
    const tpl = MAIL_TEMPLATES.find((t) => t.id === id)!
    setTemplateId(id)
    setSubject(tpl.subject(args))
    setBody(tpl.body(args))
    setSendError(null)
  }

  async function handleSend() {
    setSending(true)
    setSendError(null)
    try {
      const toAddresses = to.split(",").map((s) => s.trim()).filter(Boolean)
      if (!toAddresses.length) throw new Error("Please enter at least one recipient email address.")

      const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: body },
            toRecipients: toAddresses.map((addr) => ({ emailAddress: { address: addr } })),
          },
          saveToSentItems: true,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
      }
      setSent(true)
      setTimeout(onClose, 1800)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send email")
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "92vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0"
          style={{ background: `color-mix(in oklch, ${ALERT_COLOR} 6%, white)` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: ALERT_COLOR }}>
              <Bell size={13} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground font-sans">Attention Required</p>
              <p className="text-[10px] text-muted-foreground font-sans truncate max-w-80">{target.activity}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-secondary"
            style={{ color: "var(--muted-foreground)" }}>
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Task context strip */}
        <div className="px-5 py-2.5 border-b border-border flex items-center gap-4 flex-wrap"
          style={{ background: `color-mix(in oklch, ${ALERT_COLOR} 3%, white)` }}>
          {[
            { label: "Owner", value: target.owner },
            { label: "Status", value: target.status },
            { label: "Start", value: target.startDate },
            { label: "Due", value: target.endDate },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans">{label}</span>
              <span className="text-[10px] font-semibold text-foreground font-sans">{value || "—"}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {/* Template picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans">Template</label>
            <div className="flex gap-2 flex-wrap">
              {MAIL_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => applyTemplate(t.id)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold font-sans border transition-all"
                  style={templateId === t.id
                    ? { background: ALERT_COLOR, color: "white", borderColor: ALERT_COLOR }
                    : { background: "var(--background)", color: "var(--muted-foreground)", borderColor: "var(--border)" }
                  }>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* To */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5">
              <Mail size={10} strokeWidth={2.5} /> To
            </label>
            <input value={to} onChange={(e) => setTo(e.target.value)}
              placeholder="owner@example.com, ..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow"
              style={ringStyle} />
            <p className="text-[10px] text-muted-foreground font-sans">Enter the email address for: <strong>{target.owner}</strong></p>
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-sans text-foreground focus:outline-none focus:ring-2 transition-shadow"
              style={ringStyle} />
          </div>

          {/* Body — preview / edit toggle */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans">Message</label>
              <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5" style={{ background: "var(--background)" }}>
                {(["Preview", "Edit HTML"] as const).map((mode) => {
                  const active = editMode ? mode === "Edit HTML" : mode === "Preview"
                  return (
                    <button key={mode} onClick={() => setEditMode(mode === "Edit HTML")}
                      className="px-2.5 py-1 rounded-md text-[10px] font-semibold font-sans transition-all"
                      style={active ? { background: ALERT_COLOR, color: "white" } : { color: "var(--muted-foreground)" }}>
                      {mode}
                    </button>
                  )
                })}
              </div>
            </div>

            {editMode ? (
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-[11px] font-mono text-foreground leading-relaxed resize-none focus:outline-none focus:ring-2 transition-shadow"
                style={ringStyle} />
            ) : (
              <div
                className="w-full rounded-lg border border-border bg-white px-4 py-3 text-xs font-sans text-foreground leading-relaxed overflow-auto"
                style={{ minHeight: "180px", maxHeight: "240px" }}
                dangerouslySetInnerHTML={{ __html: body }}
              />
            )}
          </div>

          {sendError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs font-sans"
              style={{ background: "color-mix(in oklch, oklch(0.60 0.26 25) 8%, white)", borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 25%, transparent)", color: "oklch(0.55 0.26 25)" }}>
              <AlertTriangle size={12} strokeWidth={2} className="shrink-0 mt-0.5" />{sendError}
            </div>
          )}
          {sent && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold font-sans"
              style={{ background: "color-mix(in oklch, oklch(0.55 0.22 150) 8%, white)", borderColor: "color-mix(in oklch, oklch(0.55 0.22 150) 25%, transparent)", color: "oklch(0.45 0.22 150)" }}>
              <CheckCircle size={12} strokeWidth={2.5} /> Email sent successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border bg-card flex items-center justify-between shrink-0">
          <p className="text-[10px] text-muted-foreground font-sans">Sends from your Outlook — saved to Sent Items</p>
          <div className="flex items-center gap-2.5">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold font-sans border border-border transition-all hover:bg-secondary"
              style={{ color: "var(--muted-foreground)" }}>
              Cancel
            </button>
            <button onClick={handleSend} disabled={sending || sent || !to.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold font-sans text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: sent ? "oklch(0.55 0.22 150)" : ALERT_COLOR }}>
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} strokeWidth={2.5} />}
              {sending ? "Sending..." : sent ? "Sent!" : "Send Email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function Planner2Page({ params }: PageProps) {
  const { slug } = use(params)
  const { token, isAuthenticated } = useAuth()

  const [rows,           setRows]           = useState<SprintTrackerRow[]>([])
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [projectTitle,   setProjectTitle]   = useState(slugToTitle(slug))
  const [search,         setSearch]         = useState("")
  const [sprintFilter,   setSprintFilter]   = useState("All")
  const [statusFilter,   setStatusFilter]   = useState("All")
  const [streamFilter,   setStreamFilter]   = useState("All")
  const [attentionOnly,  setAttentionOnly]  = useState(false)
  const [mailTarget,     setMailTarget]     = useState<MailTarget | null>(null)

  async function load() {
    if (!token || !isAuthenticated) return
    setLoading(true)
    setError(null)
    try {
      const customers = await fetchAllCustomersWithProjects(token)
      let folderId: string | null = null
      for (const { projects } of customers) {
        const match = projects.find((p) => toSlug(p.name) === slug)
        if (match) { folderId = match.id; setProjectTitle(match.name); break }
      }
      if (!folderId) { setError(`Project folder not found for "${slug}".`); setLoading(false); return }
      const data = await fetchSprintPlanTracker(token, folderId)
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sprint tracker")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isAuthenticated) load() }, [isAuthenticated, token])

  // ── Derived values ─────────────────────────────────────────────────────────

  const sprints = useMemo(() => {
    const s = new Set(rows.map((r) => r.Sprint).filter(Boolean))
    return ["All", ...Array.from(s).sort()]
  }, [rows])

  const statuses = useMemo(() => {
    const s = new Set(rows.map((r) => r.Status).filter(Boolean))
    return ["All", ...Array.from(s).sort()]
  }, [rows])

  const streams = useMemo(() => {
    const s = new Set(rows.map((r) => r.Stream).filter(Boolean))
    return ["All", ...Array.from(s).sort()]
  }, [rows])

  const attentionCount = useMemo(() => rows.filter(needsAttention).length, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const q = search.toLowerCase()
      const matchSearch = !q || [r.Activity, r["Owner(s),"], r.Stream, r.WAVE, r.Sprint, r.Note]
        .some((v) => v?.toLowerCase().includes(q))
      const matchSprint  = sprintFilter  === "All" || r.Sprint  === sprintFilter
      const matchStatus  = statusFilter  === "All" || r.Status  === statusFilter
      const matchStream  = streamFilter  === "All" || r.Stream  === streamFilter
      const matchAttention = !attentionOnly || needsAttention(r)
      return matchSearch && matchSprint && matchStatus && matchStream && matchAttention
    })
  }, [rows, search, sprintFilter, statusFilter, streamFilter, attentionOnly])

  const totalRows   = rows.length
  const completed   = rows.filter((r) => /complete|done/i.test(r.Status)).length
  const inProgress  = rows.filter((r) => /progress|active|ongoing/i.test(r.Status)).length
  const notStarted  = rows.filter((r) => /not started|pending|planned/i.test(r.Status)).length
  const sprintCount = sprints.length - 1

  const STATS = [
    { label: "Total Tasks",   value: totalRows,      color: P2_COLOR,                icon: <TableProperties size={15} color="white" strokeWidth={2} /> },
    { label: "Sprints",       value: sprintCount,    color: "oklch(0.55 0.20 270)",  icon: <Layers size={15} color="white" strokeWidth={2} /> },
    { label: "In Progress",   value: inProgress,     color: "oklch(0.65 0.20 55)",   icon: <Clock size={15} color="white" strokeWidth={2} /> },
    { label: "Completed",     value: completed,      color: "oklch(0.55 0.22 150)",  icon: <CheckCircle2 size={15} color="white" strokeWidth={2} /> },
    { label: "Needs Attention", value: attentionCount, color: "oklch(0.60 0.26 25)", icon: <Bell size={15} color="white" strokeWidth={2} /> },
  ]

  // ── Table columns ──────────────────────────────────────────────────────────

  const COLS: {
    key: keyof SprintTrackerRow
    label: string
    width: string
    render?: (v: string, row: SprintTrackerRow) => React.ReactNode
  }[] = [
    { key: "Sprint",     label: "Sprint",     width: "min-w-[90px]",  render: (v) => <SprintBadge sprint={v} /> },
    { key: "Task#",      label: "Task #",     width: "min-w-[60px]",  render: (v) => <span className="font-mono text-[11px] text-muted-foreground">{v || "—"}</span> },
    { key: "WAVE",       label: "Wave",       width: "min-w-[70px]" },
    { key: "Geography",  label: "Geography",  width: "min-w-[90px]" },
    {
      key: "Activity", label: "Activity", width: "min-w-[200px] max-w-[260px]",
      render: (v) => <span className="text-xs font-semibold text-foreground font-sans leading-tight block">{v || "—"}</span>,
    },
    { key: "Stream",     label: "Stream",     width: "min-w-[100px]" },
    { key: "Integration / Input Source", label: "Integration", width: "min-w-[120px] max-w-[160px]" },
    {
      key: "Owner(s),", label: "Owner(s)", width: "min-w-[140px]",
      render: (v, row) => {
        const owners = v ? v.split(/[,;/]/).map((o) => o.trim()).filter(Boolean) : []
        const attention = needsAttention(row)
        return (
          <div className="flex flex-wrap gap-1 items-center">
            {owners.length > 0 ? owners.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold font-sans"
                style={{ background: `color-mix(in oklch, ${P2_COLOR} 10%, white)`, color: P2_COLOR }}>
                <User size={8} strokeWidth={2.5} />{name}
              </span>
            )) : <span className="text-muted-foreground text-[10px]">—</span>}
            {attention && (
              <button
                onClick={() => setMailTarget({
                  activity:  row.Activity  || "",
                  owner:     v             || "",
                  startDate: excelDateToDisplay(row["Start Date"]),
                  endDate:   excelDateToDisplay(row["End Date"]),
                  status:    row.Status    || "",
                })}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full transition-all hover:scale-110"
                style={{ background: "oklch(0.60 0.26 25)", animation: "pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite" }}
                title="Send attention email to owner"
              >
                <MessageCircle size={9} color="white" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )
      },
    },
    {
      key: "Duration (Days)", label: "Days", width: "min-w-[55px]",
      render: (v) => v ? <span className="text-[11px] font-bold text-foreground font-mono">{v}</span> : <span className="text-muted-foreground text-[10px]">—</span>,
    },
    {
      key: "Start Date", label: "Start", width: "min-w-[90px]",
      render: (v) => { const d = excelDateToDisplay(v); return d ? (
        <span className="text-[10px] font-sans text-muted-foreground whitespace-nowrap flex items-center gap-1">
          <CalendarClock size={9} strokeWidth={2} />{d}
        </span>
      ) : <span className="text-muted-foreground text-[10px]">—</span> },
    },
    {
      key: "End Date", label: "End", width: "min-w-[90px]",
      render: (v) => { const d = excelDateToDisplay(v); return d ? (
        <span className="text-[10px] font-sans text-muted-foreground whitespace-nowrap flex items-center gap-1">
          <CalendarClock size={9} strokeWidth={2} />{d}
        </span>
      ) : <span className="text-muted-foreground text-[10px]">—</span> },
    },
    { key: "Status", label: "Status", width: "min-w-[110px]", render: (v) => <StatusPill status={v} /> },
    { key: "Stage",  label: "Stage",  width: "min-w-[90px]" },
    {
      key: "Note", label: "Note", width: "min-w-[140px] max-w-[200px]",
      render: (v) => v ? <span className="text-[10px] text-muted-foreground font-sans italic leading-tight line-clamp-2">{v}</span> : <span className="text-muted-foreground text-[10px]">—</span>,
    },
  ]

  const ALERT_COLOR = "oklch(0.60 0.26 25)"
  const hasFilters = sprintFilter !== "All" || statusFilter !== "All" || streamFilter !== "All" || search || attentionOnly

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Pulse keyframe */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.65; transform: scale(1.15); }
        }
      `}</style>

      {/* Page header */}
      <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-sans text-muted-foreground">
          <Link href="/projects" className="hover:text-primary transition-colors font-medium">Projects</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <Link href={`/projects/${slug}`} className="hover:text-primary transition-colors font-medium">{projectTitle}</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <span className="text-foreground font-semibold">Planner 2</span>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-border transition-all hover:bg-secondary"
          style={{ color: "var(--muted-foreground)" }}>
          <RefreshCw size={11} strokeWidth={2} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-6 max-w-full mx-auto">

          {/* Stats row */}
          <div className="grid grid-cols-5 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border bg-card p-4 flex items-center gap-3 overflow-hidden relative"
                style={{ borderColor: `color-mix(in oklch, ${s.color} 20%, transparent)` }}>
                <div className="absolute top-0 right-0 w-16 h-16 -translate-y-6 translate-x-6 rounded-full opacity-15" style={{ background: s.color }} />
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative" style={{ background: s.color }}>
                  {s.icon}
                </div>
                <div className="relative">
                  <p className="text-xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Intelligence banner */}
          <div className="rounded-2xl border overflow-hidden relative"
            style={{ background: `color-mix(in oklch, ${P2_COLOR} 5%, white)`, borderColor: `color-mix(in oklch, ${P2_COLOR} 20%, transparent)` }}>
            <div className="absolute top-0 right-0 w-28 h-28 -translate-y-8 translate-x-8 rounded-full opacity-20" style={{ background: P2_COLOR }} />
            <div className="p-5 relative flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: P2_COLOR }}>
                    <Sparkles size={14} color="white" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground font-sans tracking-tight">Sprint Timeline Intelligence</p>
                    <p className="text-[10px] text-muted-foreground font-sans">Live from Sprint_Plan_and_Status_Tracker.xlsx · Reference Documents</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: P2_COLOR, color: "white" }}>
                    <Zap size={9} strokeWidth={2.5} />
                    Excel
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    `${totalRows} total task${totalRows !== 1 ? "s" : ""}`,
                    `${sprintCount} sprint${sprintCount !== 1 ? "s" : ""}`,
                    `${inProgress} in progress`,
                    `${completed} completed`,
                    attentionCount > 0 ? `${attentionCount} need attention` : null,
                  ].filter(Boolean).map((chip) => (
                    <span key={chip!} className="text-[10px] font-semibold font-sans px-2.5 py-1 rounded-full border bg-white"
                      style={{ color: P2_COLOR, borderColor: `color-mix(in oklch, ${P2_COLOR} 25%, transparent)` }}>
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Filters + search */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search activity, owner, stream..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-card text-xs font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow"
                  style={{ "--tw-ring-color": `color-mix(in oklch, ${P2_COLOR} 40%, transparent)` } as React.CSSProperties} />
              </div>

              {/* Attention filter — blinking */}
              <button
                onClick={() => setAttentionOnly(!attentionOnly)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold font-sans transition-all relative"
                style={attentionOnly
                  ? { background: ALERT_COLOR, color: "white", borderColor: ALERT_COLOR }
                  : { background: "color-mix(in oklch, oklch(0.60 0.26 25) 8%, white)", color: ALERT_COLOR, borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 30%, transparent)" }
                }>
                {!attentionOnly && attentionCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white"
                    style={{ background: ALERT_COLOR, animation: "pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite" }}>
                    {attentionCount}
                  </span>
                )}
                <Bell size={11} strokeWidth={2.5} style={!attentionOnly ? { animation: "pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite" } : {}} />
                Attention
              </button>

              {/* Sprint filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1">
                  <Layers size={9} strokeWidth={2.5} />Sprint
                </span>
                {sprints.slice(0, 7).map((s) => (
                  <button key={s} onClick={() => setSprintFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold font-sans border transition-all"
                    style={sprintFilter === s
                      ? { background: P2_COLOR, color: "white", borderColor: P2_COLOR }
                      : { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Status + Stream filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1">
                  <Flag size={9} strokeWidth={2.5} />Status
                </span>
                {statuses.slice(0, 6).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold font-sans border transition-all"
                    style={statusFilter === s
                      ? { background: P2_COLOR, color: "white", borderColor: P2_COLOR }
                      : { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1">
                  <Filter size={9} strokeWidth={2.5} />Stream
                </span>
                {streams.slice(0, 5).map((s) => (
                  <button key={s} onClick={() => setStreamFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold font-sans border transition-all"
                    style={streamFilter === s
                      ? { background: P2_COLOR, color: "white", borderColor: P2_COLOR }
                      : { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `color-mix(in oklch, ${P2_COLOR} 10%, white)`, border: `1px solid color-mix(in oklch, ${P2_COLOR} 20%, transparent)` }}>
                <Loader2 size={22} className="animate-spin" style={{ color: P2_COLOR }} />
              </div>
              <p className="text-sm font-semibold text-foreground font-sans">Loading sprint tracker...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border p-8 flex flex-col items-center gap-4 text-center"
              style={{ background: "color-mix(in oklch, oklch(0.60 0.26 25) 5%, white)", borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 20%, transparent)" }}>
              <AlertTriangle size={20} style={{ color: "oklch(0.60 0.26 25)" }} strokeWidth={2} />
              <div>
                <p className="text-sm font-bold text-foreground font-sans">Could not load Sprint Tracker</p>
                <p className="text-xs text-muted-foreground font-sans mt-1 max-w-md">{error}</p>
              </div>
              <button onClick={load}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "oklch(0.60 0.26 25)" }}>
                <RefreshCw size={12} strokeWidth={2} />
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border p-12 flex flex-col items-center gap-3 text-center"
              style={{ background: `color-mix(in oklch, ${P2_COLOR} 4%, white)`, borderColor: `color-mix(in oklch, ${P2_COLOR} 15%, transparent)` }}>
              <TableProperties size={20} style={{ color: P2_COLOR }} strokeWidth={1.5} />
              <p className="text-sm font-bold text-foreground font-sans">No tasks match filters</p>
              <p className="text-xs text-muted-foreground font-sans">Adjust the sprint, status or stream filters above</p>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden bg-card"
              style={{ borderColor: `color-mix(in oklch, ${P2_COLOR} 15%, transparent)` }}>
              {/* Result count bar */}
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between"
                style={{ background: `color-mix(in oklch, ${P2_COLOR} 4%, white)` }}>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold text-muted-foreground font-sans">
                    Showing <span className="font-black" style={{ color: P2_COLOR }}>{filtered.length}</span> of {totalRows} tasks
                  </p>
                  {attentionOnly && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                      style={{ background: `color-mix(in oklch, ${ALERT_COLOR} 12%, white)`, color: ALERT_COLOR }}>
                      <Bell size={8} strokeWidth={2.5} /> Attention filter active
                    </span>
                  )}
                </div>
                {hasFilters && (
                  <button
                    onClick={() => { setSearch(""); setSprintFilter("All"); setStatusFilter("All"); setStreamFilter("All"); setAttentionOnly(false) }}
                    className="text-[10px] font-semibold font-sans transition-colors hover:underline"
                    style={{ color: P2_COLOR }}>
                    Clear filters
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px] font-sans">
                  <thead>
                    <tr style={{ background: `color-mix(in oklch, ${P2_COLOR} 6%, white)`, borderBottom: `1px solid color-mix(in oklch, ${P2_COLOR} 15%, transparent)` }}>
                      {COLS.map((col) => (
                        <th key={col.key}
                          className={`px-3 py-2.5 text-left text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${col.width}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => {
                      const attention = needsAttention(row)
                      return (
                        <tr key={i}
                          className="border-b border-border transition-colors hover:bg-secondary/40 group"
                          style={attention
                            ? { background: "color-mix(in oklch, oklch(0.60 0.26 25) 4%, white)" }
                            : i % 2 === 0
                              ? { background: `color-mix(in oklch, ${P2_COLOR} 2%, white)` }
                              : { background: "var(--card)" }
                          }>
                          {COLS.map((col) => (
                            <td key={col.key} className={`px-3 py-2.5 align-top ${col.width}`}>
                              {col.render
                                ? col.render(row[col.key] ?? "", row)
                                : <span className="text-[11px] font-sans text-foreground">{row[col.key] || "—"}</span>
                              }
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick mail modal */}
      {mailTarget && (
        <QuickMailModal
          token={token!}
          target={mailTarget}
          project={projectTitle}
          onClose={() => setMailTarget(null)}
        />
      )}
    </div>
  )
}

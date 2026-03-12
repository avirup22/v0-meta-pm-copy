"use client"

import { use, useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import {
  fetchAllCustomersWithProjects,
  fetchSprintPlanTracker,
  appendSprintTrackerRow,
  updateSprintTrackerRow,
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
  Plus,
  Pencil,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string }>
}

const P2_COLOR   = "oklch(0.52 0.22 195)"
const ALERT_COLOR = "oklch(0.60 0.26 25)"

// ─── Table column order (must match Excel table header order) ─────────────────
const TABLE_COLS = [
  "Sprint", "Task#", "WAVE", "Geography", "Activity", "Stream",
  "Integration / Input Source", "Owner(s),", "Duration (Days)",
  "Start Date", "End Date", "Status", "Stage", "Note",
] as const

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-")
}
function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

function excelSerialToMs(value: string): number | null {
  const num = Number(value)
  if (!value || isNaN(num) || num < 1) return null
  const adjusted = num >= 60 ? num - 2 : num - 1
  return Date.UTC(1900, 0, 1) + adjusted * 86400000
}

function excelDateToDisplay(value: string): string {
  if (!value) return ""
  const num = Number(value)
  if (isNaN(num)) {
    const d = new Date(value)
    if (!isNaN(d.getTime()))
      return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getFullYear()).slice(-2)}`
    return value
  }
  const ms = excelSerialToMs(value)
  if (!ms) return ""
  const d = new Date(ms)
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCFullYear()).slice(-2)}`
}

// Convert a yyyy-mm-dd input value to an Excel serial for writing back
function dateInputToExcelSerial(value: string): number | null {
  if (!value) return null
  const d = new Date(value + "T00:00:00Z")
  if (isNaN(d.getTime())) return null
  const epoch = Date.UTC(1900, 0, 1)
  const diff = Math.round((d.getTime() - epoch) / 86400000) + 1
  return diff >= 60 ? diff + 1 : diff + 1  // +1 for Lotus bug compensation
}

// Convert an Excel serial to yyyy-mm-dd for <input type="date">
function excelSerialToInputDate(value: string): string {
  const ms = excelSerialToMs(value)
  if (!ms) return ""
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

function needsAttention(row: SprintTrackerRow): boolean {
  const status = row.Status?.toLowerCase() ?? ""
  if (/delay|overdue|at risk/i.test(status)) return true
  const now = Date.now()
  const startMs = excelSerialToMs(row["Start Date"])
  const endMs   = excelSerialToMs(row["End Date"])
  if (/not started|pending|planned/i.test(status) && startMs && now > startMs) return true
  if (/in progress|active|ongoing/i.test(status) && endMs && now > endMs) return true
  return false
}

// ─── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  if (!status) return <span className="text-muted-foreground text-[10px]">—</span>
  let color = "oklch(0.55 0.10 240)"
  if (/complete|done/i.test(status))          color = "oklch(0.55 0.22 150)"
  else if (/progress|active|ongoing/i.test(status)) color = "oklch(0.65 0.20 55)"
  else if (/not started|pending|planned/i.test(status)) color = "oklch(0.55 0.10 240)"
  else if (/delay|overdue|risk/i.test(status)) color = ALERT_COLOR
  return (
    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={{ background: `color-mix(in oklch, ${color} 12%, white)`, color, border: `1px solid color-mix(in oklch, ${color} 25%, transparent)` }}>
      {status}
    </span>
  )
}

// ─── Mail templates ────────────────────────────────────────────────────────────
interface MailArgs { activity: string; owner: string; startDate: string; endDate: string; status: string; project: string }

const MAIL_TEMPLATES = [
  {
    id: "friendly", label: "Friendly Reminder",
    subject: ({ activity }: MailArgs) => `Reminder: ${activity}`,
    body: ({ activity, endDate, owner, project }: MailArgs) =>
      `<p>Hi ${owner},</p><p>This is a friendly reminder about a task assigned to you in <strong>${project}</strong>.</p><table style="border-collapse:collapse;margin:12px 0;font-size:13px;"><tr><td style="padding:5px 16px 5px 0;font-weight:600;color:#555;">Activity</td><td>${activity}</td></tr><tr><td style="padding:5px 16px 5px 0;font-weight:600;color:#555;">Due</td><td>${endDate}</td></tr></table><p>Could you please share a status update?</p><p>Thanks!</p>`,
  },
  {
    id: "overdue", label: "Overdue Alert",
    subject: ({ activity }: MailArgs) => `Overdue Task: ${activity}`,
    body: ({ activity, endDate, owner, project }: MailArgs) =>
      `<p>Hi ${owner},</p><p>The following task in <strong>${project}</strong> is <strong style="color:#dc2626;">past its due date</strong>.</p><table style="border-collapse:collapse;margin:12px 0;font-size:13px;border:1px solid #fecaca;background:#fff7f7;"><tr><td style="padding:6px 16px;font-weight:600;color:#dc2626;border:1px solid #fecaca;">Activity</td><td style="padding:6px 16px;border:1px solid #fecaca;">${activity}</td></tr><tr><td style="padding:6px 16px;font-weight:600;color:#dc2626;border:1px solid #fecaca;">Was Due</td><td style="padding:6px 16px;border:1px solid #fecaca;">${endDate}</td></tr></table><p>Please update the status or discuss revised timelines.</p>`,
  },
  {
    id: "notstarted", label: "Not Started Alert",
    subject: ({ activity }: MailArgs) => `Action Required: ${activity} Not Yet Started`,
    body: ({ activity, startDate, endDate, owner, project }: MailArgs) =>
      `<p>Hi ${owner},</p><p>The following task in <strong>${project}</strong> was scheduled to start on <strong>${startDate}</strong> but has not been started.</p><table style="border-collapse:collapse;margin:12px 0;font-size:13px;border:1px solid #e5e7eb;"><tr style="background:#f9fafb;"><td style="padding:6px 16px;font-weight:600;border:1px solid #e5e7eb;">Activity</td><td style="padding:6px 16px;border:1px solid #e5e7eb;">${activity}</td></tr><tr><td style="padding:6px 16px;font-weight:600;border:1px solid #e5e7eb;">Planned Start</td><td style="padding:6px 16px;border:1px solid #e5e7eb;">${startDate}</td></tr><tr style="background:#f9fafb;"><td style="padding:6px 16px;font-weight:600;border:1px solid #e5e7eb;">Due Date</td><td style="padding:6px 16px;border:1px solid #e5e7eb;">${endDate}</td></tr></table><p>Please initiate this task as soon as possible.</p>`,
  },
  {
    id: "standup", label: "Standup Check-in",
    subject: ({ activity }: MailArgs) => `Quick Check-in: ${activity}`,
    body: ({ activity, startDate, endDate, owner }: MailArgs) =>
      `<p>Hi ${owner},</p><p>Quick check-in on <strong>${activity}</strong>:</p><ul style="margin:8px 0;padding-left:20px;font-size:13px;"><li>Started: ${startDate}</li><li>Due: ${endDate}</li></ul><p>Can you share: <strong>What's done, what's in progress, and any blockers?</strong></p><p>Cheers!</p>`,
  },
]

// ─── Quick Mail Modal ─────────────────────────────────────────────────────────
interface MailTarget { activity: string; owner: string; startDate: string; endDate: string; status: string }

function QuickMailModal({ token, target, project, onClose }: {
  token: string; target: MailTarget; project: string; onClose: () => void
}) {
  const args: MailArgs = { ...target, project }
  const defaultId = /not started|pending|planned/i.test(target.status) ? "notstarted" : "overdue"
  const [templateId, setTemplateId] = useState(defaultId)
  const [to,         setTo]         = useState("")
  const [subject,    setSubject]    = useState(() => MAIL_TEMPLATES.find((t) => t.id === defaultId)!.subject(args))
  const [body,       setBody]       = useState(() => MAIL_TEMPLATES.find((t) => t.id === defaultId)!.body(args))
  const [editMode,   setEditMode]   = useState(false)
  const [sending,    setSending]    = useState(false)
  const [sent,       setSent]       = useState(false)
  const [sendError,  setSendError]  = useState<string | null>(null)
  const ringStyle = { "--tw-ring-color": `color-mix(in oklch, ${P2_COLOR} 40%, transparent)` } as React.CSSProperties

  function applyTemplate(id: string) {
    const tpl = MAIL_TEMPLATES.find((t) => t.id === id)!
    setTemplateId(id); setSubject(tpl.subject(args)); setBody(tpl.body(args)); setSendError(null)
  }

  async function handleSend() {
    setSending(true); setSendError(null)
    try {
      const toAddresses = to.split(",").map((s) => s.trim()).filter(Boolean)
      const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { subject, body: { contentType: "HTML", content: body }, toRecipients: toAddresses.map((addr) => ({ emailAddress: { address: addr } })) }, saveToSentItems: true }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message ?? `HTTP ${res.status}`) }
      setSent(true); setTimeout(onClose, 1800)
    } catch (err) { setSendError(err instanceof Error ? err.message : "Failed to send") }
    finally { setSending(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0"
          style={{ background: `color-mix(in oklch, ${ALERT_COLOR} 5%, white)` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: ALERT_COLOR }}>
              <Bell size={13} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground font-sans">Quick Nudge</p>
              <p className="text-[10px] text-muted-foreground font-sans truncate max-w-72">{target.activity}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-secondary">
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans">Template</label>
            <div className="flex gap-2 flex-wrap">
              {MAIL_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => applyTemplate(t.id)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold font-sans border transition-all"
                  style={templateId === t.id ? { background: ALERT_COLOR, color: "white", borderColor: ALERT_COLOR } : { color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5"><Mail size={10} strokeWidth={2.5} />To</label>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@example.com, ..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-sans focus:outline-none focus:ring-2 transition-shadow" style={ringStyle} />
            <p className="text-[10px] text-muted-foreground font-sans">Separate multiple addresses with commas</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-sans focus:outline-none focus:ring-2 transition-shadow" style={ringStyle} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans">Message</label>
              <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
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
            {editMode
              ? <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-[11px] font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 transition-shadow" style={ringStyle} />
              : <div className="w-full rounded-lg border border-border bg-white px-4 py-3 text-xs font-sans leading-relaxed overflow-auto"
                  style={{ minHeight: "160px", maxHeight: "220px" }} dangerouslySetInnerHTML={{ __html: body }} />
            }
          </div>
          {sendError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs font-sans"
              style={{ background: "color-mix(in oklch, oklch(0.60 0.26 25) 8%, white)", borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 25%, transparent)", color: ALERT_COLOR }}>
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
        <div className="px-5 py-4 border-t border-border bg-card flex items-center justify-between shrink-0">
          <p className="text-[10px] text-muted-foreground font-sans">Sends from your Outlook — saved to Sent Items</p>
          <div className="flex items-center gap-2.5">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold font-sans border border-border transition-all hover:bg-secondary" style={{ color: "var(--muted-foreground)" }}>Cancel</button>
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

// ─── Row form (shared by Add + Edit) ─────────────────────────────────────────
type RowDraft = Record<typeof TABLE_COLS[number], string>

const EMPTY_DRAFT: RowDraft = {
  "Sprint": "", "Task#": "", "WAVE": "", "Geography": "", "Activity": "",
  "Stream": "", "Integration / Input Source": "", "Owner(s),": "",
  "Duration (Days)": "", "Start Date": "", "End Date": "",
  "Status": "", "Stage": "", "Note": "",
}

const DATE_COLS = new Set(["Start Date", "End Date"])
const FIELD_LABELS: Record<string, string> = {
  "Sprint": "Sprint", "Task#": "Task #", "WAVE": "WAVE", "Geography": "Geography",
  "Activity": "Activity", "Stream": "Stream",
  "Integration / Input Source": "Integration / Input Source",
  "Owner(s),": "Owner(s)", "Duration (Days)": "Duration (Days)",
  "Start Date": "Start Date", "End Date": "End Date",
  "Status": "Status", "Stage": "Stage", "Note": "Note",
}

function RowForm({ draft, onChange }: { draft: RowDraft; onChange: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {TABLE_COLS.map((col) => (
        <div key={col} className={`flex flex-col gap-1 ${col === "Activity" || col === "Note" ? "col-span-2" : ""}`}>
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans">
            {FIELD_LABELS[col]}
          </label>
          {col === "Note" ? (
            <textarea
              value={draft[col]}
              onChange={(e) => onChange(col, e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-sans focus:outline-none focus:ring-2 resize-none transition-shadow"
              style={{ "--tw-ring-color": `color-mix(in oklch, ${P2_COLOR} 40%, transparent)` } as React.CSSProperties}
            />
          ) : DATE_COLS.has(col) ? (
            <input
              type="date"
              value={draft[col]}
              onChange={(e) => onChange(col, e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-sans focus:outline-none focus:ring-2 transition-shadow"
              style={{ "--tw-ring-color": `color-mix(in oklch, ${P2_COLOR} 40%, transparent)` } as React.CSSProperties}
            />
          ) : (
            <input
              type="text"
              value={draft[col]}
              onChange={(e) => onChange(col, e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-sans focus:outline-none focus:ring-2 transition-shadow"
              style={{ "--tw-ring-color": `color-mix(in oklch, ${P2_COLOR} 40%, transparent)` } as React.CSSProperties}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function draftToValues(draft: RowDraft): (string | number | null)[] {
  return TABLE_COLS.map((col) => {
    const val = draft[col]
    if (DATE_COLS.has(col) && val) {
      return dateInputToExcelSerial(val)
    }
    const num = Number(val)
    if (val !== "" && !isNaN(num) && col === "Duration (Days)") return num
    return val || null
  })
}

// ─── Add Row Modal ─────────────────────────────────────────────────────────────
function AddRowModal({ token, fileId, insertAfterIndex, onClose, onCreated }: {
  token: string; fileId: string; insertAfterIndex: number; onClose: () => void; onCreated: () => void
}) {
  const [draft,   setDraft]   = useState<RowDraft>({ ...EMPTY_DRAFT })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  function onChange(k: string, v: string) { setDraft((d) => ({ ...d, [k]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.Activity.trim()) return
    setSaving(true); setError(null)
    try {
      await appendSprintTrackerRow(token, fileId, draftToValues(draft))
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add row")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0"
          style={{ background: `color-mix(in oklch, ${P2_COLOR} 5%, white)` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: P2_COLOR }}>
              <Plus size={13} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground font-sans">Add Row</p>
              <p className="text-[10px] text-muted-foreground font-sans">Appended to Sprint_Plan_and_Status_Tracker.xlsx</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-secondary"><X size={14} strokeWidth={2.5} /></button>
        </div>
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <RowForm draft={draft} onChange={onChange} />
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs font-sans"
              style={{ background: "color-mix(in oklch, oklch(0.60 0.26 25) 8%, white)", borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 25%, transparent)", color: ALERT_COLOR }}>
              <AlertTriangle size={12} strokeWidth={2} className="shrink-0 mt-0.5" />{error}
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <p className="text-[10px] text-muted-foreground font-sans">Writes directly to the Excel table</p>
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold font-sans border border-border transition-all hover:bg-secondary" style={{ color: "var(--muted-foreground)" }}>Cancel</button>
              <button type="submit" disabled={saving || !draft.Activity.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold font-sans text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: P2_COLOR }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2.5} />}
                {saving ? "Saving..." : "Add Row"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Row Modal ────────────────────────────────────────────────────────────
function EditRowModal({ token, fileId, rowIndex, initial, onClose, onSaved }: {
  token: string; fileId: string; rowIndex: number; initial: SprintTrackerRow; onClose: () => void; onSaved: () => void
}) {
  const initDraft: RowDraft = {} as RowDraft
  TABLE_COLS.forEach((col) => {
    initDraft[col] = DATE_COLS.has(col) ? excelSerialToInputDate(initial[col] ?? "") : (initial[col] ?? "")
  })

  const [draft,   setDraft]  = useState<RowDraft>(initDraft)
  const [saving,  setSaving] = useState(false)
  const [error,   setError]  = useState<string | null>(null)

  function onChange(k: string, v: string) { setDraft((d) => ({ ...d, [k]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await updateSprintTrackerRow(token, fileId, rowIndex, draftToValues(draft))
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update row")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0"
          style={{ background: `color-mix(in oklch, ${P2_COLOR} 5%, white)` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: P2_COLOR }}>
              <Pencil size={12} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground font-sans">Edit Row</p>
              <p className="text-[10px] text-muted-foreground font-sans truncate max-w-xs">{initial.Activity || `Row ${rowIndex + 1}`}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-secondary"><X size={14} strokeWidth={2.5} /></button>
        </div>
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <RowForm draft={draft} onChange={onChange} />
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs font-sans"
              style={{ background: "color-mix(in oklch, oklch(0.60 0.26 25) 8%, white)", borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 25%, transparent)", color: ALERT_COLOR }}>
              <AlertTriangle size={12} strokeWidth={2} className="shrink-0 mt-0.5" />{error}
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <p className="text-[10px] text-muted-foreground font-sans">Updates row #{rowIndex + 1} in the Excel table</p>
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold font-sans border border-border transition-all hover:bg-secondary" style={{ color: "var(--muted-foreground)" }}>Cancel</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold font-sans text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: P2_COLOR }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} strokeWidth={2.5} />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Planner2Page({ params }: PageProps) {
  const { slug } = use(params)
  const { token, isAuthenticated } = useAuth()

  const [rows,           setRows]           = useState<SprintTrackerRow[]>([])
  const [trackerFileId,  setTrackerFileId]  = useState<string | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [projectTitle,   setProjectTitle]   = useState(slugToTitle(slug))
  const [search,         setSearch]         = useState("")
  const [sprintFilter,   setSprintFilter]   = useState("All")
  const [statusFilter,   setStatusFilter]   = useState("All")
  const [streamFilter,   setStreamFilter]   = useState("All")
  const [attentionOnly,  setAttentionOnly]  = useState(false)
  const [mailTarget,     setMailTarget]     = useState<MailTarget | null>(null)
  const [addAfterIndex,  setAddAfterIndex]  = useState<number | null>(null)
  const [editTarget,     setEditTarget]     = useState<{ rowIndex: number; row: SprintTrackerRow } | null>(null)
  const [hoveredInsert,  setHoveredInsert]  = useState<number | null>(null)

  async function load() {
    if (!token || !isAuthenticated) return
    setLoading(true); setError(null)
    try {
      const customers = await fetchAllCustomersWithProjects(token)
      let folderId: string | null = null
      for (const { projects } of customers) {
        const match = projects.find((p) => toSlug(p.name) === slug)
        if (match) { folderId = match.id; setProjectTitle(match.name); break }
      }
      if (!folderId) { setError(`Project folder not found for "${slug}".`); setLoading(false); return }
      const { rows: data, fileId } = await fetchSprintPlanTracker(token, folderId)
      setRows(data)
      setTrackerFileId(fileId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sprint tracker")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isAuthenticated) load() }, [isAuthenticated, token])

  const sprints  = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.Sprint).filter(Boolean))).sort()], [rows])
  const statuses = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.Status).filter(Boolean))).sort()], [rows])
  const streams  = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.Stream).filter(Boolean))).sort()], [rows])
  const attentionCount = useMemo(() => rows.filter(needsAttention).length, [rows])

  const filtered = useMemo(() => rows.filter((r) => {
    const q = search.toLowerCase()
    const matchSearch = !q || [r.Activity, r["Owner(s),"], r.Stream, r.WAVE, r.Sprint, r.Note].some((v) => v?.toLowerCase().includes(q))
    return matchSearch
      && (sprintFilter  === "All" || r.Sprint  === sprintFilter)
      && (statusFilter  === "All" || r.Status  === statusFilter)
      && (streamFilter  === "All" || r.Stream  === streamFilter)
      && (!attentionOnly || needsAttention(r))
  }), [rows, search, sprintFilter, statusFilter, streamFilter, attentionOnly])

  const totalRows   = rows.length
  const completed   = rows.filter((r) => /complete|done/i.test(r.Status)).length
  const inProgress  = rows.filter((r) => /progress|active|ongoing/i.test(r.Status)).length
  const sprintCount = sprints.length - 1

  const STATS = [
    { label: "Total Tasks",  value: totalRows,     color: P2_COLOR,               icon: <TableProperties size={15} color="white" strokeWidth={2} /> },
    { label: "Sprints",      value: sprintCount,   color: "oklch(0.55 0.20 270)", icon: <Layers size={15} color="white" strokeWidth={2} /> },
    { label: "In Progress",  value: inProgress,    color: "oklch(0.65 0.20 55)",  icon: <Clock size={15} color="white" strokeWidth={2} /> },
    { label: "Completed",    value: completed,     color: "oklch(0.55 0.22 150)", icon: <CheckCircle2 size={15} color="white" strokeWidth={2} /> },
    { label: "Needs Attention", value: attentionCount, color: ALERT_COLOR,        icon: <Bell size={15} color="white" strokeWidth={2} /> },
  ]

  const hasFilters = sprintFilter !== "All" || statusFilter !== "All" || streamFilter !== "All" || !!search || attentionOnly

  // Column definitions
  const COLS: { key: string; label: string; width: string; render?: (v: string, row: SprintTrackerRow) => React.ReactNode }[] = [
    { key: "Sprint",    label: "Sprint",   width: "min-w-[70px]",
      render: (v) => v ? <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide"
        style={{ background: `color-mix(in oklch, ${P2_COLOR} 12%, white)`, color: P2_COLOR }}>{v}</span>
        : <span className="text-muted-foreground text-[10px]">—</span> },
    { key: "Task#",     label: "Task #",   width: "min-w-[55px]" },
    { key: "WAVE",      label: "WAVE",     width: "min-w-[55px]" },
    { key: "Geography", label: "Geo",      width: "min-w-[60px]" },
    { key: "Activity",  label: "Activity", width: "min-w-[180px] max-w-[220px]",
      render: (v) => <span className="text-[11px] font-semibold font-sans text-foreground leading-tight line-clamp-2">{v || "—"}</span> },
    { key: "Stream",    label: "Stream",   width: "min-w-[90px]" },
    { key: "Integration / Input Source", label: "Integration", width: "min-w-[120px] max-w-[160px]",
      render: (v) => v ? <span className="text-[10px] text-muted-foreground line-clamp-2">{v}</span> : <span className="text-[10px] text-muted-foreground">—</span> },
    { key: "Owner(s),", label: "Owner(s)", width: "min-w-[110px]",
      render: (v, row) => {
        const owners = v ? v.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : []
        const alert = needsAttention(row)
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {owners.length > 0
              ? owners.map((o) => (
                <span key={o} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold"
                  style={{ background: `color-mix(in oklch, ${P2_COLOR} 10%, white)`, color: P2_COLOR }}>
                  <User size={8} strokeWidth={2} />{o}
                </span>
              ))
              : <span className="text-muted-foreground text-[10px]">—</span>
            }
            {alert && (
              <button
                onClick={() => setMailTarget({ activity: row.Activity, owner: owners.join(", ") || "team", startDate: excelDateToDisplay(row["Start Date"]), endDate: excelDateToDisplay(row["End Date"]), status: row.Status })}
                title="Send nudge email"
                className="flex items-center justify-center w-5 h-5 rounded-full transition-all hover:scale-110"
                style={{ background: `color-mix(in oklch, ${ALERT_COLOR} 12%, white)`, color: ALERT_COLOR, animation: "pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite", border: `1px solid color-mix(in oklch, ${ALERT_COLOR} 30%, transparent)` }}>
                <MessageCircle size={10} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )
      }
    },
    { key: "Duration (Days)", label: "Days", width: "min-w-[50px]" },
    { key: "Start Date", label: "Start", width: "min-w-[90px]",
      render: (v) => { const d = excelDateToDisplay(v); return d
        ? <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1"><CalendarClock size={9} strokeWidth={2} />{d}</span>
        : <span className="text-muted-foreground text-[10px]">—</span> }
    },
    { key: "End Date", label: "End", width: "min-w-[90px]",
      render: (v) => { const d = excelDateToDisplay(v); return d
        ? <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1"><CalendarClock size={9} strokeWidth={2} />{d}</span>
        : <span className="text-muted-foreground text-[10px]">—</span> }
    },
    { key: "Status", label: "Status", width: "min-w-[110px]", render: (v) => <StatusPill status={v} /> },
    { key: "Stage",  label: "Stage",  width: "min-w-[90px]" },
    { key: "Note",   label: "Note",   width: "min-w-[140px] max-w-[200px]",
      render: (v) => v ? <span className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">{v}</span> : <span className="text-muted-foreground text-[10px]">—</span> },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.65;transform:scale(1.15)} }
        .insert-btn { opacity: 0; transition: opacity 0.15s; }
        tr:hover .insert-btn, .insert-row:hover .insert-btn { opacity: 1; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-sans text-muted-foreground">
          <Link href="/projects" className="hover:text-primary transition-colors font-medium">Projects</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <Link href={`/projects/${slug}`} className="hover:text-primary transition-colors font-medium">{projectTitle}</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <span className="text-foreground font-semibold">Planner 2</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-border transition-all hover:bg-secondary"
            style={{ color: "var(--muted-foreground)" }}>
            <RefreshCw size={11} strokeWidth={2} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          {trackerFileId && (
            <button onClick={() => setAddAfterIndex(-1)}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90"
              style={{ background: P2_COLOR }}>
              <Plus size={12} strokeWidth={2.5} />
              Add Row
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-6 max-w-full mx-auto">

          {/* Stats */}
          <div className="grid grid-cols-5 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border bg-card p-4 flex items-center gap-3 overflow-hidden relative"
                style={{ borderColor: `color-mix(in oklch, ${s.color} 20%, transparent)` }}>
                <div className="absolute top-0 right-0 w-16 h-16 -translate-y-6 translate-x-6 rounded-full opacity-15" style={{ background: s.color }} />
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative" style={{ background: s.color }}>{s.icon}</div>
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
                    <p className="text-sm font-black text-foreground font-sans">Sprint Timeline Intelligence</p>
                    <p className="text-[10px] text-muted-foreground font-sans">Live from Sprint_Plan_and_Status_Tracker.xlsx · Reference Documents</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: P2_COLOR, color: "white" }}>
                    <Zap size={9} strokeWidth={2.5} />Excel
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    `${totalRows} total tasks`,
                    `${sprintCount} sprints`,
                    `${inProgress} in progress`,
                    `${completed} completed`,
                    attentionCount > 0 ? `${attentionCount} need attention` : null,
                  ].filter(Boolean).map((chip) => (
                    <span key={chip!} className="text-[10px] font-semibold font-sans px-2.5 py-1 rounded-full border bg-white"
                      style={{ color: P2_COLOR, borderColor: `color-mix(in oklch, ${P2_COLOR} 25%, transparent)` }}>{chip}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search size={11} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks, owners..."
                  className="pl-7 pr-3 py-1.5 rounded-lg border border-border bg-card text-[11px] font-sans focus:outline-none focus:ring-2 transition-shadow w-52"
                  style={{ "--tw-ring-color": `color-mix(in oklch, ${P2_COLOR} 40%, transparent)` } as React.CSSProperties} />
              </div>

              {/* Attention filter */}
              <button onClick={() => setAttentionOnly((v) => !v)} className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold font-sans transition-all"
                style={attentionOnly
                  ? { background: ALERT_COLOR, color: "white", borderColor: ALERT_COLOR }
                  : { background: "color-mix(in oklch, oklch(0.60 0.26 25) 8%, white)", color: ALERT_COLOR, borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 30%, transparent)" }}>
                {!attentionOnly && attentionCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white"
                    style={{ background: ALERT_COLOR, animation: "pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite" }}>{attentionCount}</span>
                )}
                <Bell size={11} strokeWidth={2.5} style={!attentionOnly ? { animation: "pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite" } : {}} />
                Attention
              </button>

              {/* Sprint */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1">
                  <Layers size={9} strokeWidth={2.5} />Sprint
                </span>
                {sprints.slice(0, 7).map((s) => (
                  <button key={s} onClick={() => setSprintFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold font-sans border transition-all"
                    style={sprintFilter === s ? { background: P2_COLOR, color: "white", borderColor: P2_COLOR } : { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1">
                  <Flag size={9} strokeWidth={2.5} />Status
                </span>
                {statuses.slice(0, 6).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold font-sans border transition-all"
                    style={statusFilter === s ? { background: P2_COLOR, color: "white", borderColor: P2_COLOR } : { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
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
                    style={streamFilter === s ? { background: P2_COLOR, color: "white", borderColor: P2_COLOR } : { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
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
              <AlertTriangle size={20} style={{ color: ALERT_COLOR }} strokeWidth={2} />
              <div>
                <p className="text-sm font-bold text-foreground font-sans">Could not load Sprint Tracker</p>
                <p className="text-xs text-muted-foreground font-sans mt-1 max-w-md">{error}</p>
              </div>
              <button onClick={load} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90" style={{ background: ALERT_COLOR }}>
                <RefreshCw size={12} strokeWidth={2} /> Try again
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
                  <button onClick={() => { setSearch(""); setSprintFilter("All"); setStatusFilter("All"); setStreamFilter("All"); setAttentionOnly(false) }}
                    className="text-[10px] font-semibold font-sans transition-colors hover:underline" style={{ color: P2_COLOR }}>
                    Clear filters
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px] font-sans">
                  <thead>
                    <tr style={{ background: `color-mix(in oklch, ${P2_COLOR} 6%, white)`, borderBottom: `1px solid color-mix(in oklch, ${P2_COLOR} 15%, transparent)` }}>
                      {/* edit col header */}
                      <th className="w-8 px-1" />
                      {COLS.map((col) => (
                        <th key={col.key} className={`px-3 py-2.5 text-left text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${col.width}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => {
                      const attention = needsAttention(row)
                      // Find the real index in rows[] for this filtered row (needed for Excel update)
                      const realIndex = rows.indexOf(row)
                      return (
                        <>
                          {/* Hover-to-insert separator above row */}
                          <tr key={`insert-${i}`} className="insert-row h-0 group/ins"
                            style={{ height: 0 }}
                            onMouseEnter={() => setHoveredInsert(i)}
                            onMouseLeave={() => setHoveredInsert(null)}>
                            <td colSpan={COLS.length + 1} className="p-0 relative" style={{ height: 0 }}>
                              <div className="relative h-0">
                                <button
                                  onClick={() => trackerFileId && setAddAfterIndex(realIndex - 1)}
                                  className="insert-btn absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full flex items-center justify-center shadow-md border transition-all hover:scale-125"
                                  style={{ background: P2_COLOR, borderColor: "white", color: "white" }}
                                  title="Insert row here">
                                  <Plus size={10} strokeWidth={3} />
                                </button>
                                {hoveredInsert === i && (
                                  <div className="absolute inset-x-0 top-0 h-px" style={{ background: P2_COLOR, opacity: 0.5 }} />
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Data row */}
                          <tr key={i}
                            className="border-b border-border transition-colors hover:bg-secondary/40 group"
                            style={attention
                              ? { background: "color-mix(in oklch, oklch(0.60 0.26 25) 4%, white)" }
                              : i % 2 === 0
                                ? { background: `color-mix(in oklch, ${P2_COLOR} 2%, white)` }
                                : { background: "var(--card)" }}>
                            {/* Edit button cell */}
                            <td className="px-1 py-2 align-top w-8">
                              <button
                                onClick={() => trackerFileId && setEditTarget({ rowIndex: realIndex, row })}
                                className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center border border-border hover:border-current"
                                style={{ color: P2_COLOR }}
                                title="Edit row">
                                <Pencil size={10} strokeWidth={2.5} />
                              </button>
                            </td>
                            {COLS.map((col) => (
                              <td key={col.key} className={`px-3 py-2.5 align-top ${col.width}`}>
                                {col.render
                                  ? col.render(row[col.key] ?? "", row)
                                  : <span className="text-[11px] font-sans text-foreground">{row[col.key] || "—"}</span>
                                }
                              </td>
                            ))}
                          </tr>
                        </>
                      )
                    })}

                    {/* Insert after last row */}
                    <tr className="insert-row h-0 group/ins"
                      onMouseEnter={() => setHoveredInsert(filtered.length)}
                      onMouseLeave={() => setHoveredInsert(null)}>
                      <td colSpan={COLS.length + 1} className="p-0 relative" style={{ height: 0 }}>
                        <div className="relative h-0">
                          <button
                            onClick={() => trackerFileId && setAddAfterIndex(rows.length - 1)}
                            className="insert-btn absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full flex items-center justify-center shadow-md border transition-all hover:scale-125"
                            style={{ background: P2_COLOR, borderColor: "white", color: "white" }}
                            title="Insert row at end">
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {mailTarget && (
        <QuickMailModal token={token!} target={mailTarget} project={projectTitle} onClose={() => setMailTarget(null)} />
      )}
      {addAfterIndex !== null && trackerFileId && (
        <AddRowModal
          token={token!} fileId={trackerFileId} insertAfterIndex={addAfterIndex}
          onClose={() => setAddAfterIndex(null)}
          onCreated={() => { setAddAfterIndex(null); load() }}
        />
      )}
      {editTarget && trackerFileId && (
        <EditRowModal
          token={token!} fileId={trackerFileId} rowIndex={editTarget.rowIndex} initial={editTarget.row}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load() }}
        />
      )}
    </div>
  )
}

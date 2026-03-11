"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { fetchMeetingDatabase, fetchAllCustomersWithProjects } from "@/lib/graph"
import { RichTextEditor } from "@/components/rich-text-editor"
import { DEMO_TOKEN, getDemoProjectBySlug, DEMO_MEETINGS } from "@/lib/demo-data"
import {
  ChevronRight,
  Users,
  CalendarDays,
  Loader2,
  AlertTriangle,
  Edit2,
  Save,
  X,
  CheckSquare,
  Lightbulb,
  ShieldAlert,
  MessageSquare,
  FileText,
  Sparkles,
  ClipboardList,
  User,
  Clock,
  Circle,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string; meetingId: string }>
}

type Tab = "mom" | "decisions" | "actions" | "risks" | "discussions"

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

function meetingIdToTitle(id: string) {
  return id.replace(/-\d{4}-\d{2}-\d{2}$/, "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  "Open":        { bg: "color-mix(in oklch, oklch(0.65 0.26 15) 12%, white)",  color: "oklch(0.55 0.26 15)" },
  "In Progress": { bg: "color-mix(in oklch, oklch(0.58 0.30 293) 12%, white)", color: "oklch(0.48 0.28 293)" },
  "Done":        { bg: "color-mix(in oklch, oklch(0.55 0.22 150) 12%, white)", color: "oklch(0.45 0.22 150)" },
  "Closed":      { bg: "color-mix(in oklch, oklch(0.55 0.22 150) 12%, white)", color: "oklch(0.45 0.22 150)" },
}

const TAB_DEFS: { key: Tab; label: string; icon: React.ElementType; color: string; bg: string; border: string }[] = [
  { key: "mom",         label: "MOM",         icon: ClipboardList, color: "oklch(0.58 0.30 293)", bg: "color-mix(in oklch, oklch(0.58 0.30 293) 8%, white)",  border: "color-mix(in oklch, oklch(0.58 0.30 293) 20%, transparent)" },
  { key: "decisions",   label: "Decisions",   icon: Lightbulb,     color: "oklch(0.72 0.20 55)",  bg: "color-mix(in oklch, oklch(0.72 0.20 55) 8%, white)",   border: "color-mix(in oklch, oklch(0.72 0.20 55) 20%, transparent)" },
  { key: "actions",     label: "Actions",     icon: CheckSquare,   color: "oklch(0.55 0.22 150)", bg: "color-mix(in oklch, oklch(0.55 0.22 150) 8%, white)",  border: "color-mix(in oklch, oklch(0.55 0.22 150) 20%, transparent)" },
  { key: "risks",       label: "Risks",       icon: ShieldAlert,   color: "oklch(0.62 0.24 15)",  bg: "color-mix(in oklch, oklch(0.62 0.24 15) 8%, white)",   border: "color-mix(in oklch, oklch(0.62 0.24 15) 20%, transparent)" },
  { key: "discussions", label: "Discussions", icon: MessageSquare, color: "oklch(0.58 0.18 200)", bg: "color-mix(in oklch, oklch(0.58 0.18 200) 8%, white)",  border: "color-mix(in oklch, oklch(0.58 0.18 200) 20%, transparent)" },
]

export default function MeetingDetailPage({ params }: PageProps) {
  const { slug, meetingId } = use(params)
  const projectName = slugToTitle(slug)
  const meetingTitle = meetingIdToTitle(meetingId)
  const { isAuthenticated, token } = useAuth()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<Tab>("mom")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meeting, setMeeting] = useState<any>(null)
  const [decisions, setDecisions] = useState<any[]>([])
  const [actions, setActions] = useState<any[]>([])
  const [risks, setRisks] = useState<any[]>([])
  const [discussions, setDiscussions] = useState<any[]>([])
  const [momContent, setMomContent] = useState<string>("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")

  useEffect(() => {
    if (!isAuthenticated) router.replace("/")
  }, [isAuthenticated, router])

  useEffect(() => {
    const load = async () => {
      if (!token) return
      setLoading(true)
      setError(null)
      try {
        if (token === DEMO_TOKEN) {
          const folder = getDemoProjectBySlug(slug)
          if (!folder) { setError("Demo project not found"); return }
          const demoMtgs = DEMO_MEETINGS[folder.id] ?? []
          const m = demoMtgs.find((x) => x.id === meetingId)
          if (!m) { setError("Meeting not found"); return }
          setMeeting({ Meeting_title: m.title, Meeting_date: m.date, Organizer: m.organizer })
          setDecisions([{ Decision_ID: "d1", Decision: "Approved Q2 roadmap with revised timeline." }, { Decision_ID: "d2", Decision: "Agreed to proceed with vendor shortlisting for integration layer." }])
          setActions([
            { Action_ID: "a1", Task: "Finalise scope document", Owner: "Alex M.", Due_Date: "2025-06-10", Status: "In Progress" },
            { Action_ID: "a2", Task: "Share updated timeline", Owner: "Priya K.", Due_Date: "2025-06-05", Status: "Open" },
            { Action_ID: "a3", Task: "Review vendor proposals", Owner: "Ben C.", Due_Date: "2025-06-15", Status: "Open" },
          ])
          setRisks([{ Risk_ID: "r1", Risk: "Scope creep due to changing client requirements — medium probability." }, { Risk_ID: "r2", Risk: "Resource availability conflict with another active project." }])
          setDiscussions([{ Discussion_ID: "dp1", Discussion: "Team discussed the need for a clearer RACI matrix before the next sprint." }, { Discussion_ID: "dp2", Discussion: "Client requested bi-weekly status reports instead of monthly." }])
          return
        }
        const customers = await fetchAllCustomersWithProjects(token)
        let projectFolderId: string | null = null
        for (const { projects } of customers) {
          const p = projects.find((p) => p.name.toLowerCase().replace(/\s+/g, "-") === slug)
          if (p) { projectFolderId = p.id; break }
        }
        if (!projectFolderId) { setError("Project not found"); return }
        const db = await fetchMeetingDatabase(token, projectFolderId)
        const m = db.meetings.find((m) => m.Meeting_ID === meetingId)
        if (!m) { setError("Meeting not found"); return }
        setMeeting(m)
        setDecisions(db.decisions.filter((d) => d.Meeting_ID === meetingId))
        setActions(db.actions.filter((a) => a.Meeting_ID === meetingId))
        setRisks(db.risks.filter((r) => r.Meeting_ID === meetingId))
        setDiscussions(db.discussions.filter((dp) => dp.Meeting_ID === meetingId))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load meeting data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug, meetingId, token, isAuthenticated])

  if (!isAuthenticated) return null

  const generateMOM = () => {
    let mom = `# Minutes of Meeting: ${meeting?.Meeting_title || meetingTitle}\n\n`
    mom += `**Date:** ${meeting?.Meeting_date || "—"}\n**Organizer:** ${meeting?.Organizer || "—"}\n\n`
    if (decisions.length > 0) {
      mom += `## Decisions\n`
      decisions.forEach((d) => { mom += `- ${d.Decision}\n` })
      mom += `\n`
    }
    if (actions.length > 0) {
      mom += `## Action Items\n| Task | Owner | Due Date | Status |\n|------|-------|----------|--------|\n`
      actions.forEach((a) => { mom += `| ${a.Task} | ${a.Owner} | ${a.Due_Date} | ${a.Status} |\n` })
      mom += `\n`
    }
    if (risks.length > 0) {
      mom += `## Risks\n`
      risks.forEach((r) => { mom += `- ${r.Risk}\n` })
      mom += `\n`
    }
    if (discussions.length > 0) {
      mom += `## Discussion Points\n`
      discussions.forEach((dp) => { mom += `- ${dp.Discussion}\n` })
    }
    return mom
  }

  const activeTabDef = TAB_DEFS.find((t) => t.key === activeTab)!

  const STATS = [
    { label: "Decisions",   value: decisions.length,   color: "oklch(0.72 0.20 55)",  icon: Lightbulb },
    { label: "Actions",     value: actions.length,     color: "oklch(0.55 0.22 150)", icon: CheckSquare },
    { label: "Risks",       value: risks.length,       color: "oklch(0.62 0.24 15)",  icon: ShieldAlert },
    { label: "Discussions", value: discussions.length, color: "oklch(0.58 0.18 200)", icon: MessageSquare },
  ]

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="bg-card border-b border-border px-8 py-4">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-sans mb-3">
          <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors">{projectName}</Link>
          <ChevronRight size={11} strokeWidth={2} />
          <Link href={`/projects/${slug}/meetings`} className="hover:text-foreground transition-colors">Meetings</Link>
          <ChevronRight size={11} strokeWidth={2} />
          <span className="text-foreground font-semibold">{meeting?.Meeting_title || meetingTitle}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-extrabold text-foreground font-sans leading-tight">
              {meeting?.Meeting_title || meetingTitle}
            </h1>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
                <CalendarDays size={12} strokeWidth={2} />
                {meeting?.Meeting_date || "—"}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
                <User size={12} strokeWidth={2} />
                {meeting?.Organizer || "—"}
              </span>
            </div>
          </div>

          {/* Stats pills */}
          {!loading && !error && (
            <div className="flex items-center gap-2 shrink-0">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold font-sans"
                  style={{
                    background: `color-mix(in oklch, ${s.color} 10%, white)`,
                    borderColor: `color-mix(in oklch, ${s.color} 22%, transparent)`,
                    color: s.color,
                  }}
                >
                  <s.icon size={11} strokeWidth={2.5} />
                  {s.value}
                  <span className="font-medium opacity-80 hidden lg:inline">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-card border-b border-border px-8">
        <div className="flex items-center gap-1">
          {TAB_DEFS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="relative flex items-center gap-1.5 px-3.5 py-3 text-[13px] font-sans font-semibold transition-all duration-150"
                style={{ color: isActive ? tab.color : "var(--muted-foreground)" }}
              >
                <tab.icon size={13} strokeWidth={2.5} />
                {tab.label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                    style={{ background: tab.color }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-background">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-28">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "color-mix(in oklch, var(--primary) 12%, white)" }}>
              <Loader2 size={22} strokeWidth={2} className="animate-spin" style={{ color: "var(--primary)" }} />
            </div>
            <p className="text-sm font-semibold text-muted-foreground font-sans">Loading meeting data...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-28">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "color-mix(in oklch, oklch(0.62 0.24 15) 12%, white)" }}>
              <AlertTriangle size={22} strokeWidth={1.5} style={{ color: "oklch(0.55 0.24 15)" }} />
            </div>
            <p className="text-sm font-semibold font-sans" style={{ color: "oklch(0.45 0.24 15)" }}>{error}</p>
          </div>
        ) : (
          <div className="p-6 max-w-4xl flex flex-col gap-5">

            {/* ── MOM ── */}
            {activeTab === "mom" && (
              <div>
                {/* AI summary banner — alternate card with bubble */}
                <div
                  className="rounded-2xl border p-5 mb-5 flex items-start gap-4 overflow-hidden relative"
                  style={{ background: activeTabDef.bg, borderColor: activeTabDef.border }}
                >
                  <div className="absolute top-0 right-0 w-28 h-28 -translate-y-8 translate-x-8 rounded-full opacity-20" style={{ background: activeTabDef.color }} />
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative" style={{ background: activeTabDef.color }}>
                    <Sparkles size={16} color="white" strokeWidth={2} />
                  </div>
                  <div className="relative">
                    <p className="text-xs font-extrabold uppercase tracking-widest mb-1" style={{ color: activeTabDef.color }}>AI-Generated MOM</p>
                    <p className="text-sm text-foreground font-sans leading-relaxed">
                      This minutes document was compiled from decisions, actions, risks, and discussions. Edit freely — changes are local to your session.
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-6">
                  <RichTextEditor
                    content={momContent || generateMOM()}
                    onChange={setMomContent}
                    disabled={false}
                  />
                </div>
              </div>
            )}

            {/* ── DECISIONS ── */}
            {activeTab === "decisions" && (
              <div className="flex flex-col gap-3">
                {decisions.length === 0 ? (
                  <EmptyState icon={Lightbulb} label="No decisions recorded" color="oklch(0.72 0.20 55)" />
                ) : decisions.map((d, i) => (
                  <div
                    key={d.Decision_ID}
                    className="rounded-2xl border p-5 flex items-start gap-4 overflow-hidden relative"
                    style={{
                      background: i % 2 === 0 ? activeTabDef.bg : "var(--card)",
                      borderColor: i % 2 === 0 ? activeTabDef.border : "var(--border)",
                    }}
                  >
                    {i % 2 === 0 && (
                      <div className="absolute top-0 right-0 w-28 h-28 -translate-y-8 translate-x-8 rounded-full opacity-20" style={{ background: activeTabDef.color }} />
                    )}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative" style={{ background: activeTabDef.color }}>
                      <Lightbulb size={13} color="white" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 relative">
                      {editingId === d.Decision_ID ? (
                        <EditRow value={editingText} onChange={setEditingText} onSave={() => setEditingId(null)} onCancel={() => setEditingId(null)} color={activeTabDef.color} />
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-foreground font-sans leading-relaxed">{d.Decision}</p>
                          <button onClick={() => { setEditingId(d.Decision_ID); setEditingText(d.Decision) }} className="shrink-0 opacity-40 hover:opacity-100 transition-opacity">
                            <Edit2 size={13} strokeWidth={2} style={{ color: activeTabDef.color }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── ACTIONS ── */}
            {activeTab === "actions" && (
              <div className="flex flex-col gap-3">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-1">
                  {[
                    { label: "Open",        count: actions.filter((a) => a.Status === "Open").length,        color: "oklch(0.65 0.26 15)" },
                    { label: "In Progress", count: actions.filter((a) => a.Status === "In Progress").length, color: "oklch(0.58 0.30 293)" },
                    { label: "Done",        count: actions.filter((a) => ["Done","Closed"].includes(a.Status)).length, color: "oklch(0.55 0.22 150)" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border px-4 py-3 flex items-center gap-3 overflow-hidden relative"
                      style={{ background: `color-mix(in oklch, ${s.color} 8%, white)`, borderColor: `color-mix(in oklch, ${s.color} 20%, transparent)` }}>
                      <p className="text-2xl font-black" style={{ color: s.color }}>{s.count}</p>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {actions.length === 0 ? (
                  <EmptyState icon={CheckSquare} label="No actions recorded" color={activeTabDef.color} />
                ) : actions.map((a, i) => {
                  const statusStyle = STATUS_COLORS[a.Status] ?? { bg: "var(--secondary)", color: "var(--muted-foreground)" }
                  return (
                    <div
                      key={a.Action_ID}
                      className="rounded-2xl border p-5 overflow-hidden relative"
                      style={{
                        background: i % 2 === 0 ? activeTabDef.bg : "var(--card)",
                        borderColor: i % 2 === 0 ? activeTabDef.border : "var(--border)",
                      }}
                    >
                      {i % 2 === 0 && (
                        <div className="absolute top-0 right-0 w-28 h-28 -translate-y-8 translate-x-8 rounded-full opacity-20" style={{ background: activeTabDef.color }} />
                      )}
                      <div className="flex items-start justify-between gap-4 relative">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: activeTabDef.color }}>
                            <CheckSquare size={13} color="white" strokeWidth={2.5} />
                          </div>
                          <div className="flex flex-col gap-1.5 flex-1">
                            {editingId === a.Action_ID ? (
                              <EditRow value={editingText} onChange={setEditingText} onSave={() => setEditingId(null)} onCancel={() => setEditingId(null)} color={activeTabDef.color} />
                            ) : (
                              <p className="text-sm font-semibold text-foreground font-sans">{a.Task}</p>
                            )}
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-sans">
                                <User size={10} strokeWidth={2} />{a.Owner}
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-sans">
                                <Clock size={10} strokeWidth={2} />{a.Due_Date}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                                {a.Status}
                              </span>
                            </div>
                          </div>
                        </div>
                        {editingId !== a.Action_ID && (
                          <button onClick={() => { setEditingId(a.Action_ID); setEditingText(a.Task) }} className="shrink-0 opacity-40 hover:opacity-100 transition-opacity mt-0.5">
                            <Edit2 size={13} strokeWidth={2} style={{ color: activeTabDef.color }} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── RISKS ── */}
            {activeTab === "risks" && (
              <div className="flex flex-col gap-3">
                {risks.length === 0 ? (
                  <EmptyState icon={ShieldAlert} label="No risks recorded" color={activeTabDef.color} />
                ) : risks.map((r, i) => (
                  <div
                    key={r.Risk_ID}
                    className="rounded-2xl border p-5 flex items-start gap-4 overflow-hidden relative"
                    style={{
                      background: i % 2 === 0 ? activeTabDef.bg : "var(--card)",
                      borderColor: i % 2 === 0 ? activeTabDef.border : "var(--border)",
                    }}
                  >
                    {i % 2 === 0 && (
                      <div className="absolute top-0 right-0 w-28 h-28 -translate-y-8 translate-x-8 rounded-full opacity-20" style={{ background: activeTabDef.color }} />
                    )}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative" style={{ background: activeTabDef.color }}>
                      <ShieldAlert size={13} color="white" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 relative">
                      {editingId === r.Risk_ID ? (
                        <EditRow value={editingText} onChange={setEditingText} onSave={() => setEditingId(null)} onCancel={() => setEditingId(null)} color={activeTabDef.color} />
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-foreground font-sans leading-relaxed">{r.Risk}</p>
                          <button onClick={() => { setEditingId(r.Risk_ID); setEditingText(r.Risk) }} className="shrink-0 opacity-40 hover:opacity-100 transition-opacity">
                            <Edit2 size={13} strokeWidth={2} style={{ color: activeTabDef.color }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── DISCUSSIONS ── */}
            {activeTab === "discussions" && (
              <div className="flex flex-col gap-3">
                {discussions.length === 0 ? (
                  <EmptyState icon={MessageSquare} label="No discussion points recorded" color={activeTabDef.color} />
                ) : discussions.map((dp, i) => (
                  <div
                    key={dp.Discussion_ID}
                    className="rounded-2xl border p-5 flex items-start gap-4 overflow-hidden relative"
                    style={{
                      background: i % 2 === 0 ? activeTabDef.bg : "var(--card)",
                      borderColor: i % 2 === 0 ? activeTabDef.border : "var(--border)",
                    }}
                  >
                    {i % 2 === 0 && (
                      <div className="absolute top-0 right-0 w-28 h-28 -translate-y-8 translate-x-8 rounded-full opacity-20" style={{ background: activeTabDef.color }} />
                    )}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative" style={{ background: activeTabDef.color }}>
                      <MessageSquare size={13} color="white" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 relative">
                      {editingId === dp.Discussion_ID ? (
                        <EditRow value={editingText} onChange={setEditingText} onSave={() => setEditingId(null)} onCancel={() => setEditingId(null)} color={activeTabDef.color} />
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-foreground font-sans leading-relaxed">{dp.Discussion}</p>
                          <button onClick={() => { setEditingId(dp.Discussion_ID); setEditingText(dp.Discussion) }} className="shrink-0 opacity-40 hover:opacity-100 transition-opacity">
                            <Edit2 size={13} strokeWidth={2} style={{ color: activeTabDef.color }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

/* ── Helpers ── */

function EmptyState({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `color-mix(in oklch, ${color} 12%, white)` }}>
        <Icon size={22} strokeWidth={1.5} style={{ color }} />
      </div>
      <p className="text-sm font-semibold text-muted-foreground font-sans">{label}</p>
    </div>
  )
}

function EditRow({ value, onChange, onSave, onCancel, color }: {
  value: string; onChange: (v: string) => void
  onSave: () => void; onCancel: () => void; color: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 rounded-xl border border-border bg-white text-foreground font-sans text-sm focus:outline-none focus:ring-2 resize-none"
        style={{ "--tw-ring-color": color } as React.CSSProperties}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button onClick={onSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90" style={{ background: color }}>
          <Save size={11} strokeWidth={2.5} /> Save
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-white text-muted-foreground hover:bg-secondary transition-colors">
          <X size={11} strokeWidth={2.5} /> Cancel
        </button>
      </div>
    </div>
  )
}

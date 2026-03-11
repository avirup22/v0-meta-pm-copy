"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import {
  fetchAllCustomersWithProjects,
  fetchMeetingDatabase,
  type MeetingDatabase,
} from "@/lib/graph"
import { NewMeetingModal } from "@/components/new-meeting-modal"
import { DEMO_TOKEN, getDemoProjectBySlug, DEMO_MEETINGS } from "@/lib/demo-data"
import {
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Users,
  Plus,
  FileText,
  Loader2,
  AlertTriangle,
  Search,
  TrendingUp,
  Mic,
  BarChart3,
  Clock,
  ArrowUpRight,
  Filter,
  Sparkles,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string }>
}

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

function formatDateDisplay(value: string | number): string {
  if (!value) return "—"
  const str = String(value).trim()
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const parts = str.split("-")
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    if (!isNaN(d.getTime())) return `${d.toLocaleString("default", { month: "short" })} ${parseInt(parts[0])}`
    return str
  }
  const num = Number(str)
  if (!isNaN(num) && num > 1000) {
    const date = new Date(new Date(1900, 0, -1).getTime() + num * 86400000)
    return `${date.toLocaleString("default", { month: "short" })} ${date.getDate()}`
  }
  return str
}

export interface MeetingRecord {
  id: string
  title: string
  date: string
  displayDate: string
  organizer: string
  participants: number
  taskCount: number
  decisionCount: number
  riskCount: number
  hasTranscript?: boolean
  hasMOM?: boolean
}

const MOCK_MEETINGS: MeetingRecord[] = [
  { id: "weekly-sync-2026-06-12",      title: "Weekly Sync",       date: "2026-06-12", displayDate: "Jun 12", organizer: "Alex M.",  participants: 5,  taskCount: 4, decisionCount: 2, riskCount: 1, hasTranscript: true,  hasMOM: true  },
  { id: "planning-session-2026-06-05", title: "Planning Session",  date: "2026-06-05", displayDate: "Jun 5",  organizer: "Sara K.",  participants: 7,  taskCount: 0, decisionCount: 3, riskCount: 0, hasTranscript: true,  hasMOM: false },
  { id: "stakeholder-call-2026-06-30", title: "Stakeholder Call",  date: "2026-06-30", displayDate: "Jun 30", organizer: "John D.",  participants: 4,  taskCount: 4, decisionCount: 0, riskCount: 2, hasTranscript: false, hasMOM: false },
  { id: "client-review-2026-05-21",    title: "Client Review",     date: "2026-05-21", displayDate: "May 21", organizer: "Sara K.",  participants: 6,  taskCount: 4, decisionCount: 1, riskCount: 1, hasTranscript: true,  hasMOM: true  },
  { id: "project-kickoff-2026-05-14",  title: "Project Kickoff",   date: "2026-05-14", displayDate: "May 14", organizer: "Alex M.", participants: 10, taskCount: 4, decisionCount: 4, riskCount: 0, hasTranscript: true,  hasMOM: true  },
]

// ── Meeting type colour map ────────────────────────────────────────────────────
function colorForTitle(title: string) {
  const t = title.toLowerCase()
  if (t.includes("kickoff"))    return { color: "oklch(0.70 0.20 35)",   bg: "color-mix(in oklch, oklch(0.70 0.20 35) 12%, white)" }
  if (t.includes("planning"))   return { color: "oklch(0.58 0.30 293)",  bg: "color-mix(in oklch, oklch(0.58 0.30 293) 10%, white)" }
  if (t.includes("stakeholder") || t.includes("client")) return { color: "oklch(0.56 0.25 240)", bg: "color-mix(in oklch, oklch(0.56 0.25 240) 10%, white)" }
  if (t.includes("review"))     return { color: "oklch(0.55 0.22 150)",  bg: "color-mix(in oklch, oklch(0.55 0.22 150) 10%, white)" }
  return { color: "oklch(0.63 0.20 195)", bg: "color-mix(in oklch, oklch(0.63 0.20 195) 10%, white)" }
}

// ── MeetingCard ───────────────────────────────────────────────────────────────
function MeetingCard({ meeting, projectSlug }: { meeting: MeetingRecord; projectSlug: string }) {
  const accent = colorForTitle(meeting.title)
  const [month, day] = meeting.displayDate.split(" ")

  return (
    <Link
      href={`/projects/${projectSlug}/meetings/${meeting.id}`}
      className="group relative flex flex-col gap-3 rounded-2xl border bg-card p-4 overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: `color-mix(in oklch, ${accent.color} 22%, var(--border))`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 10px 32px -6px ${accent.color}30`
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none"
      }}
    >
      {/* Accent bar top */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
        style={{ background: accent.color }} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mt-1">
        {/* Date badge */}
        <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0"
          style={{ background: accent.bg }}>
          <span className="text-[8px] font-black uppercase leading-none tracking-wide" style={{ color: accent.color }}>{month}</span>
          <span className="text-base font-black leading-tight" style={{ color: accent.color }}>{day}</span>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground font-sans leading-tight group-hover:text-primary transition-colors line-clamp-1">
            {meeting.title}
          </h3>
          {meeting.organizer && (
            <p className="text-[10px] text-muted-foreground font-sans mt-0.5">{meeting.organizer}</p>
          )}
        </div>

        <ArrowUpRight size={14} strokeWidth={2.5} className="shrink-0 text-muted-foreground/30 group-hover:text-primary transition-colors" />
      </div>

      {/* Participants */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-sans">
        <Users size={10} strokeWidth={2} />
        <span>{meeting.participants} participants</span>
        {(meeting.hasTranscript) && (
          <>
            <span className="mx-1 opacity-30">·</span>
            <Mic size={10} strokeWidth={2} />
            <span>Transcript</span>
          </>
        )}
      </div>

      {/* Stat pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {meeting.taskCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: "color-mix(in oklch, oklch(0.55 0.22 150) 10%, white)", color: "oklch(0.35 0.18 150)", border: "1px solid color-mix(in oklch, oklch(0.55 0.22 150) 20%, transparent)" }}>
            <CheckSquare size={9} strokeWidth={2.5} />{meeting.taskCount} tasks
          </span>
        )}
        {meeting.decisionCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: "color-mix(in oklch, oklch(0.58 0.30 293) 10%, white)", color: "oklch(0.35 0.22 293)", border: "1px solid color-mix(in oklch, oklch(0.58 0.30 293) 20%, transparent)" }}>
            <CalendarDays size={9} strokeWidth={2.5} />{meeting.decisionCount} decisions
          </span>
        )}
        {meeting.riskCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: "color-mix(in oklch, oklch(0.62 0.24 15) 10%, white)", color: "oklch(0.38 0.20 15)", border: "1px solid color-mix(in oklch, oklch(0.62 0.24 15) 20%, transparent)" }}>
            <AlertTriangle size={9} strokeWidth={2.5} />{meeting.riskCount} risks
          </span>
        )}
        {meeting.hasMOM && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: "color-mix(in oklch, oklch(0.56 0.25 240) 10%, white)", color: "oklch(0.35 0.20 240)", border: "1px solid color-mix(in oklch, oklch(0.56 0.25 240) 20%, transparent)" }}>
            <FileText size={9} strokeWidth={2.5} />MOM
          </span>
        )}
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MeetingsListPage({ params }: PageProps) {
  const { slug } = use(params)
  const projectName = slugToTitle(slug)
  const router = useRouter()

  const [showModal, setShowModal] = useState(false)
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [activeTab, setActiveTab] = useState<"all" | "tasks" | "decisions" | "risks">("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectFolderId, setProjectFolderId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const { token, isAuthenticated } = useAuth()

  const loadMeetingsFromDB = async () => {
    if (!token || !isAuthenticated) return
    setLoading(true)
    setError(null)
    try {
      if (token === DEMO_TOKEN) {
        const folder = getDemoProjectBySlug(slug)
        if (folder) {
          setProjectFolderId(folder.id)
          const demoMtgs = DEMO_MEETINGS[folder.id] ?? []
          setMeetings(demoMtgs.map((m) => ({
            id: m.id, title: m.title, date: m.date,
            displayDate: formatDateDisplay(m.date),
            organizer: m.organizer, participants: m.participants,
            taskCount: m.taskCount, decisionCount: m.decisionCount, riskCount: m.riskCount,
          })))
        } else {
          setMeetings(MOCK_MEETINGS)
        }
        return
      }
      const customersWithProjects = await fetchAllCustomersWithProjects(token)
      let folderId: string | null = null
      for (const { projects } of customersWithProjects) {
        const p = projects.find((p) => p.name.toLowerCase().replace(/\s+/g, "-") === slug)
        if (p) { folderId = p.id; setProjectFolderId(p.id); break }
      }
      if (!folderId) { setMeetings([]); return }
      const db = await fetchMeetingDatabase(token, folderId)
      setMeetings(db.meetings.map((m) => ({
        id: m.Meeting_ID,
        title: m.Meeting_title,
        date: m.Meeting_date,
        displayDate: formatDateDisplay(m.Meeting_date),
        organizer: m.Organizer,
        participants: db.attendees.filter((a) => a.Meeting_ID === m.Meeting_ID).length,
        taskCount: db.actions.filter((a) => a.Meeting_ID === m.Meeting_ID).length,
        decisionCount: db.decisions.filter((d) => d.Meeting_ID === m.Meeting_ID).length,
        riskCount: db.risks.filter((r) => r.Meeting_ID === m.Meeting_ID).length,
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meetings")
      setMeetings(MOCK_MEETINGS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (!isAuthenticated) router.replace("/") }, [isAuthenticated, router])
  useEffect(() => { loadMeetingsFromDB() }, [slug, token, isAuthenticated])

  if (!isAuthenticated) return null

  const totalTasks     = meetings.reduce((s, m) => s + m.taskCount, 0)
  const totalDecisions = meetings.reduce((s, m) => s + m.decisionCount, 0)
  const totalRisks     = meetings.reduce((s, m) => s + m.riskCount, 0)

  const filtered = meetings.filter((m) => {
    const q = search.toLowerCase()
    const matchesSearch = !q || m.title.toLowerCase().includes(q) || m.organizer?.toLowerCase().includes(q)
    if (!matchesSearch) return false
    if (activeTab === "tasks")     return m.taskCount > 0
    if (activeTab === "decisions") return m.decisionCount > 0
    if (activeTab === "risks")     return m.riskCount > 0
    return true
  })

  const TABS = [
    { id: "all",       label: "All Meetings", count: meetings.length },
    { id: "tasks",     label: "Has Tasks",    count: meetings.filter((m) => m.taskCount > 0).length },
    { id: "decisions", label: "Decisions",    count: meetings.filter((m) => m.decisionCount > 0).length },
    { id: "risks",     label: "Risks",        count: meetings.filter((m) => m.riskCount > 0).length },
  ] as const

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-sans text-muted-foreground">
          <Link href="/projects" className="hover:text-primary transition-colors font-medium">Projects</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <Link href={`/projects/${slug}`} className="hover:text-primary transition-colors font-medium">{projectName}</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <span className="text-foreground font-semibold">Meetings</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-background text-[11px] font-sans text-muted-foreground">
            <Search size={11} strokeWidth={2} />
            <input
              className="bg-transparent outline-none w-36 placeholder:text-muted-foreground text-foreground"
              placeholder="Search meetings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Tab switcher */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 transition-all"
                style={{
                  background: activeTab === tab.id ? "var(--primary)" : "transparent",
                  color: activeTab === tab.id ? "white" : "var(--muted-foreground)",
                }}
              >
                {tab.label}
                <span className="text-[9px] opacity-70">({tab.count})</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90 hover:shadow-md"
            style={{ background: "var(--primary)" }}
          >
            <Plus size={12} strokeWidth={2.5} />
            New Meeting
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Meetings", value: meetings.length,   icon: CalendarDays, color: "oklch(0.58 0.30 293)" },
              { label: "Open Tasks",     value: totalTasks,         icon: CheckSquare,  color: "oklch(0.55 0.22 150)" },
              { label: "Decisions Made", value: totalDecisions,     icon: TrendingUp,   color: "oklch(0.56 0.25 240)" },
              { label: "Risks Raised",   value: totalRisks,         icon: AlertTriangle,color: "oklch(0.62 0.24 15)"  },
            ].map((s) => (
              <div key={s.label}
                className="rounded-xl border bg-card p-4 flex items-center gap-3"
                style={{ borderColor: `color-mix(in oklch, ${s.color} 20%, transparent)` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in oklch, ${s.color} 12%, white)` }}>
                  <s.icon size={15} style={{ color: s.color }} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-xl font-black text-foreground leading-none">{loading ? "—" : s.value}</p>
                  <p className="text-[10px] text-muted-foreground font-sans mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* AI insights banner */}
          <div className="rounded-2xl border overflow-hidden relative"
            style={{
              background: "color-mix(in oklch, oklch(0.63 0.20 195) 5%, white)",
              borderColor: "color-mix(in oklch, oklch(0.63 0.20 195) 22%, transparent)",
            }}>
            <div className="absolute top-0 right-0 w-28 h-28 -translate-y-8 translate-x-8 rounded-full opacity-20"
              style={{ background: "oklch(0.63 0.20 195)" }} />
            <div className="p-5 relative flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "oklch(0.63 0.20 195)" }}>
                <Sparkles size={16} color="white" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-foreground tracking-tight">Meeting Intelligence</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  {meetings.length > 0
                    ? `Across ${meetings.length} meetings — ${totalTasks} tasks tracked, ${totalDecisions} decisions logged, ${totalRisks} risks identified.`
                    : "No meetings yet. Upload a transcript to extract tasks, decisions, and risks automatically."}
                </p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-white shrink-0 transition-all hover:opacity-90"
                style={{ background: "oklch(0.63 0.20 195)" }}>
                <Plus size={12} strokeWidth={2.5} />
                Add Meeting
              </button>
            </div>
          </div>

          {/* Section label */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
              {activeTab === "all" ? "All Meetings" : TABS.find((t) => t.id === activeTab)?.label}
              {" "}
              <span className="font-black" style={{ color: "var(--primary)" }}>({filtered.length})</span>
            </p>
            <button className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <Filter size={10} strokeWidth={2} />
              Sort
            </button>
          </div>

          {/* Meeting cards grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <Loader2 size={36} strokeWidth={1.5} className="text-muted-foreground animate-spin" />
              <p className="text-sm font-sans text-muted-foreground">Loading meetings...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <AlertTriangle size={32} className="text-red-400" strokeWidth={1.5} />
              <p className="text-sm font-sans text-red-500">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <CalendarDays size={36} strokeWidth={1} className="text-muted-foreground/40" />
              <p className="text-sm font-sans text-muted-foreground">No meetings match this filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} projectSlug={slug} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Meeting Modal */}
      {showModal && (
        <NewMeetingModal
          projectSlug={slug}
          projectFolderId={projectFolderId ?? ""}
          onClose={() => setShowModal(false)}
          onCreated={async () => { await loadMeetingsFromDB(); setShowModal(false) }}
        />
      )}
    </div>
  )
}

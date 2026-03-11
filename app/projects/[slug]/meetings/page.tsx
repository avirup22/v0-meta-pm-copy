"use client"

import { use, useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import {
  fetchAllCustomersWithProjects,
  fetchMeetingDatabase,
  sendTranscriptToWebhook,
  type MeetingDatabase,
} from "@/lib/graph"
import { NewMeetingModal } from "@/components/new-meeting-modal"
import { DEMO_TOKEN, getDemoProjectBySlug, DEMO_MEETINGS } from "@/lib/demo-data"
import {
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Clock,
  Filter,
  Search,
  Users,
  Plus,
  X,
  Upload,
  FileText,
  Loader2,
  ChevronDown,
  AlertTriangle,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string }>
}

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

function toMeetingId(title: string, date: string) {
  return `${title.toLowerCase().replace(/\s+/g, "-")}-${date}`
}

// Format Excel date (serial number) or dd-mm-yyyy string to display format
function formatDateDisplay(value: string | number): string {
  if (!value) return "—"
  
  const str = String(value).trim()
  
  // If it's already in dd-mm-yyyy format, parse and display
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const parts = str.split("-")
    const day = parts[0]
    const month = parts[1]
    const year = parts[2]
    const d = new Date(`${year}-${month}-${day}`)
    if (!isNaN(d.getTime())) {
      const monthName = d.toLocaleString("default", { month: "long" })
      return `${monthName} ${parseInt(day)}`
    }
    return str
  }
  
  // If it's formatted as dd-mm-xxxxx (Excel serial number as string with partial separator)
  const parts = str.split("-")
  if (parts.length === 3 && /^\d+$/.test(parts[2]) && parts[2].length > 4) {
    const serialNum = parseInt(parts[2], 10)
    if (serialNum > 1000) {
      const excelEpoch = new Date(1900, 0, -1)
      const date = new Date(excelEpoch.getTime() + serialNum * 86400000)
      const monthName = date.toLocaleString("default", { month: "long" })
      return `${monthName} ${date.getDate()}`
    }
  }
  
  // Try to parse as numeric serial (if it's a large number)
  const num = Number(str)
  if (!isNaN(num) && num > 1000) {
    const excelEpoch = new Date(1900, 0, -1)
    const date = new Date(excelEpoch.getTime() + num * 86400000)
    const monthName = date.toLocaleString("default", { month: "long" })
    return `${monthName} ${date.getDate()}`
  }
  
  return str
}

// ── VTT parser (same as detail page) ─────────────────────────────────────────

function extractCues(vtt: string): { speaker: string; text: string }[] {
  let s = vtt.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const UUID_CUE_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[\d]+-[\d]+)/gi
  s = s.replace(UUID_CUE_RE, "\n§CUE§$1\n")
  const chunks = s.split(/\n§CUE§/)
  const cues: { speaker: string; text: string }[] = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim()
    if (!chunk) continue
    const tsMatch = chunk.match(/(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})/)
    if (!tsMatch) continue
    const afterTs = chunk.slice(chunk.indexOf(tsMatch[0]) + tsMatch[0].length).trim()
    let text = afterTs.replace(/<v [^>]+>/g, "").replace(/<\/v>/g, "").replace(/<[^>]+>/g, "").trim()
    let speaker = ""
    const vTagMatch = afterTs.match(/^<v ([^>]+)>/)
    if (vTagMatch) {
      speaker = vTagMatch[1].trim()
    } else if (i > 0) {
      const prevChunk = chunks[i - 1] ?? ""
      const prevTsMatch = prevChunk.match(/\d{1,2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[.,]\d{3}/)
      const afterPrevTs = prevTsMatch ? prevChunk.slice(prevChunk.indexOf(prevTsMatch[0]) + prevTsMatch[0].length) : prevChunk
      const prevLines = afterPrevTs.split("\n").map((l) => l.replace(/<[^>]+>/g, "").trim()).filter(Boolean)
      for (let j = prevLines.length - 1; j >= 0; j--) {
        const candidate = prevLines[j]
        if (!candidate.includes("-->") && !candidate.match(/^\d{1,2}:\d{2}/) && !candidate.match(/^[0-9a-f-]{8}/i) && !candidate.match(/^WEBVTT/i) && candidate.length < 80 && candidate.length > 1) {
          if (cues.length > 0) cues[cues.length - 1].text = cues[cues.length - 1].text.replace(new RegExp(`\\s*${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "").trim()
          speaker = candidate
          break
        }
      }
    }
    if (text) cues.push({ speaker, text })
  }
  return cues
}

function vttToPlainText(vtt: string): string {
  const cues = extractCues(vtt)
  const merged: { speaker: string; text: string }[] = []
  for (const cue of cues) {
    const last = merged[merged.length - 1]
    if (last && last.speaker === cue.speaker) last.text = last.text.trimEnd() + " " + cue.text
    else merged.push({ ...cue })
  }
  return merged.map((m) => (m.speaker ? `${m.speaker}: ${m.text}` : m.text)).join("\n\n")
}

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

// ── Storage helpers (sessionStorage so no DB required) ────────────────────────

function storageKey(slug: string) { return `metapm_meetings_${slug}` }

function loadMeetings(slug: string): MeetingRecord[] {
  if (typeof window === "undefined") return MOCK_MEETINGS
  const raw = sessionStorage.getItem(storageKey(slug))
  if (!raw) return MOCK_MEETINGS
  try { return JSON.parse(raw) } catch { return MOCK_MEETINGS }
}

function saveMeetings(slug: string, meetings: MeetingRecord[]) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(storageKey(slug), JSON.stringify(meetings))
}

// ── Mock seed data ─────────────────────────────────────────────────────────────

const MOCK_MEETINGS: MeetingRecord[] = [
  { id: "weekly-sync-2026-06-12",       title: "Weekly Sync",        date: "2026-06-12", displayDate: "June 12", participants: 5,  duration: 45, taskCount: 4, decisionCount: 2, hasTranscript: true,  hasMOM: true  },
  { id: "planning-session-2026-06-05",  title: "Planning Session",   date: "2026-06-05", displayDate: "June 5",  participants: 7,  duration: 60, taskCount: 0, decisionCount: 3, hasTranscript: true,  hasMOM: false },
  { id: "stakeholder-call-2026-06-30",  title: "Stakeholder Call",   date: "2026-06-30", displayDate: "June 30",participants: 4,  duration: 30, taskCount: 4, decisionCount: 0, hasTranscript: false, hasMOM: false },
  { id: "client-review-2026-05-21",     title: "Client Review",      date: "2026-05-21", displayDate: "May 21", participants: 6,  duration: 50, taskCount: 4, decisionCount: 1, hasTranscript: true,  hasMOM: true  },
  { id: "project-kickoff-2026-05-14",   title: "Project Kickoff",    date: "2026-05-14", displayDate: "May 14", participants: 10, duration: 90, taskCount: 4, decisionCount: 4, hasTranscript: true,  hasMOM: true  },
]

// ── MeetingRow ──���─────────────────────────────────────────────────────────────

function MeetingRow({ meeting, projectSlug }: { meeting: MeetingRecord; projectSlug: string }) {
  const parts = meeting.displayDate.split(" ")
  const month = parts[0] ?? ""
  const day = parts[1] ?? ""
  return (
    <Link
      href={`/projects/${projectSlug}/meetings/${meeting.id}`}
      className="group flex items-center gap-5 px-6 py-4 bg-card hover:bg-secondary/40 border-b border-border transition-colors"
    >
      {/* Date badge */}
      <div
        className="flex flex-col items-center justify-center w-12 h-12 rounded-xl shrink-0 font-sans"
        style={{ background: "color-mix(in oklch, var(--primary) 10%, transparent)" }}
      >
        <span className="text-[8px] font-bold uppercase leading-none tracking-wider" style={{ color: "var(--primary)" }}>{month}</span>
        <span className="text-lg font-black leading-tight" style={{ color: "var(--primary)" }}>{day}</span>
      </div>

      {/* Title + meta */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground font-sans group-hover:text-primary transition-colors truncate">
          {meeting.title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-sans">
          {meeting.organizer && <span>{meeting.organizer}</span>}
          <span className="flex items-center gap-1"><Users size={10} strokeWidth={2} />{meeting.participants}</span>
        </div>
      </div>

      {/* Pills */}
      <div className="flex items-center gap-2 shrink-0">
        {meeting.taskCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans"
            style={{ background: "color-mix(in oklch, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
            <CheckSquare size={10} strokeWidth={2} />{meeting.taskCount} tasks
          </span>
        )}
        {meeting.decisionCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans"
            style={{ background: "color-mix(in oklch, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
            <CalendarDays size={10} strokeWidth={2} />{meeting.decisionCount} decisions
          </span>
        )}
        {meeting.riskCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans bg-red-50 text-red-500">
            <AlertTriangle size={10} strokeWidth={2} />{meeting.riskCount} risks
          </span>
        )}
      </div>

      <ChevronRight size={15} strokeWidth={2} className="text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
    </Link>
  )
}

// ── New Meeting Modal ─────────────────────────────────────────────────────────

export default function MeetingsListPage({ params }: PageProps) {
  const { slug } = use(params)
  const projectName = slugToTitle(slug)
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectFolderId, setProjectFolderId] = useState<string | null>(null)
  const { token, isAuthenticated } = useAuth()

  // Load meetings from Excel database
  const loadMeetingsFromDB = async () => {
    if (!token || !isAuthenticated) return
    
    try {
      setLoading(true)
      setError(null)

      // Demo mode: use static data
      if (token === DEMO_TOKEN) {
        const folder = getDemoProjectBySlug(slug)
        if (folder) {
          setProjectFolderId(folder.id)
          const demoMtgs = DEMO_MEETINGS[folder.id] ?? []
          const records: MeetingRecord[] = demoMtgs.map((m) => ({
            id: m.id,
            title: m.title,
            date: m.date,
            displayDate: formatDateDisplay(m.date),
            organizer: m.organizer,
            participants: m.participants,
            taskCount: m.taskCount,
            decisionCount: m.decisionCount,
            riskCount: m.riskCount,
          }))
          setMeetings(records)
        } else {
          setMeetings([])
        }
        setLoading(false)
        return
      }
      
      // Get the project folder ID by matching slug to projects
      const customersWithProjects = await fetchAllCustomersWithProjects(token)
      let folderIdFromProjects: string | null = null
      
      for (const { projects } of customersWithProjects) {
        const project = projects.find((p) => {
          const projectSlug = p.name.toLowerCase().replace(/\s+/g, "-")
          return projectSlug === slug
        })
        if (project) {
          folderIdFromProjects = project.id
          setProjectFolderId(project.id)
          break
        }
      }
      
      if (!folderIdFromProjects) {
        setMeetings([])
        setLoading(false)
        return
      }
      
      // Fetch meeting data from Excel
      const db = await fetchMeetingDatabase(token, folderIdFromProjects)
      
      // Transform Excel data into MeetingRecords
      const records: MeetingRecord[] = db.meetings.map((m) => {
        const attendeeCount = db.attendees.filter((a) => a.Meeting_ID === m.Meeting_ID).length
        const taskCount = db.actions.filter((a) => a.Meeting_ID === m.Meeting_ID).length
        const decisionCount = db.decisions.filter((d) => d.Meeting_ID === m.Meeting_ID).length
        const riskCount = db.risks.filter((r) => r.Meeting_ID === m.Meeting_ID).length
        
        // Format date using the formatDateDisplay function
        const displayDate = formatDateDisplay(m.Meeting_date)
        
        return {
          id: m.Meeting_ID,
          title: m.Meeting_title,
          date: m.Meeting_date,
          displayDate,
          organizer: m.Organizer,
          participants: attendeeCount,
          taskCount,
          decisionCount,
          riskCount,
        }
      })
      
      setMeetings(records)
    } catch (err) {
      console.error("[v0] Failed to load meetings:", err)
      setError(err instanceof Error ? err.message : "Failed to load meetings")
      setMeetings([])
    } finally {
      setLoading(false)
    }
  }

  const handleMeetingCreated = async (webhookResponse: any) => {
    // Reload meetings after processing
    await loadMeetingsFromDB()
    console.log("[v0] Meeting created with webhook response:", webhookResponse)
  }

  useEffect(() => {
    if (!isAuthenticated) router.replace("/")
  }, [isAuthenticated, router])

  useEffect(() => {
    loadMeetingsFromDB()
  }, [slug, token, isAuthenticated])

  if (!isAuthenticated) return null

  const tabs = ["Meetings", "Generated Tasks", "Decisions", "Notes"]

  return (
    <div className="flex flex-col h-full">

      {/* Page header */}
      <div className="bg-card border-b border-border px-8 pt-6 pb-0 shrink-0">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-sans mb-1">{projectName}</p>
            <h1 className="text-2xl font-black text-foreground font-sans tracking-tight">Meetings</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-background text-xs font-sans text-muted-foreground">
              <Search size={12} strokeWidth={2} />
              <input className="bg-transparent outline-none w-40 placeholder:text-muted-foreground text-foreground" placeholder="Search meetings..." />
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-sans font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-md"
              style={{ background: "var(--primary)" }}
            >
              <Plus size={14} strokeWidth={2.5} />
              New Meeting
            </button>
          </div>
        </div>

        {/* Sub-nav tabs */}
        <div className="flex items-center gap-0">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className="relative px-4 py-3 text-sm font-sans font-medium transition-colors"
              style={{ color: activeTab === i ? "var(--primary)" : "var(--muted-foreground)" }}
            >
              {tab}
              {activeTab === i && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: "var(--primary)" }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Meetings list */}
      <div className="flex-1 overflow-y-auto bg-background">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Loader2 size={40} strokeWidth={1.5} className="text-muted-foreground animate-spin" />
            <p className="text-sm font-sans text-muted-foreground">Loading meetings...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <p className="text-sm font-sans text-red-500">{error}</p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <CalendarDays size={40} strokeWidth={1} className="text-muted-foreground" />
            <p className="text-sm font-sans text-muted-foreground text-center max-w-xs">No data available</p>
          </div>
        ) : (
          <div>
            {meetings.map((meeting) => (
              <MeetingRow key={meeting.id} meeting={meeting} projectSlug={slug} />
            ))}
          </div>
        )}
      </div>

      {/* New Meeting Modal */}
      {showModal && projectFolderId && (
        <NewMeetingModal
          projectSlug={slug}
          projectFolderId={projectFolderId}
          onClose={() => setShowModal(false)}
          onCreated={handleMeetingCreated}
        />
      )}
    </div>
  )
}

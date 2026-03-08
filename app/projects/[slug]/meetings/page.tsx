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

// ── MeetingRow ────────────────────────────────────────────────────────────────

function MeetingRow({ meeting, projectSlug }: { meeting: MeetingRecord; projectSlug: string }) {
  const [month, day] = meeting.displayDate.split(" ")
  return (
    <Link
      href={`/projects/${projectSlug}/meetings/${meeting.id}`}
      className="group flex items-center gap-4 px-6 py-4 bg-card border-b border-border hover:bg-secondary/50 transition-colors"
    >
      <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0 font-sans" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
        <span className="text-[9px] font-medium uppercase leading-none opacity-80">{month}</span>
        <span className="text-base font-bold leading-tight">{day}</span>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground font-sans group-hover:text-primary transition-colors truncate">
          {meeting.displayDate} &ndash; {meeting.title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-sans">
          <span className="flex items-center gap-1"><Users size={11} strokeWidth={2} />{meeting.participants} participants</span>
          {meeting.organizer && <span className="flex items-center gap-1">by {meeting.organizer}</span>}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {meeting.taskCount > 0 && <div className="flex items-center gap-1.5 text-xs font-sans text-muted-foreground"><CheckSquare size={13} strokeWidth={1.8} />{meeting.taskCount} Tasks</div>}
        {meeting.decisionCount > 0 && <div className="flex items-center gap-1.5 text-xs font-sans text-muted-foreground"><CalendarDays size={13} strokeWidth={1.8} />{meeting.decisionCount} Decisions</div>}
        {meeting.riskCount > 0 && <div className="flex items-center gap-1.5 text-xs font-sans text-muted-foreground"><AlertTriangle size={13} strokeWidth={1.8} />{meeting.riskCount} Risks</div>}
      </div>
      <ChevronRight size={16} strokeWidth={1.8} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </Link>
  )
}

// ── New Meeting Modal ─────────────────────────────────────────────────────────

type ModalStep = "form" | "processing" | "done"
type InputMode = "upload" | "manual"

function NewMeetingModal({
  projectSlug,
  onClose,
  onCreated,
}: {
  projectSlug: string
  onClose: () => void
  onCreated: (meeting: MeetingRecord) => void
}) {
  const [step, setStep] = useState<ModalStep>("form")
  const [inputMode, setInputMode] = useState<InputMode>("upload")
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [participants, setParticipants] = useState("4")
  const [duration, setDuration] = useState("45")
  const [file, setFile] = useState<File | null>(null)
  const [manualText, setManualText] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [processingStep, setProcessingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const PROCESSING_STEPS = ["Parsing transcript...", "Sending to n8n...", "Generating MOM...", "Extracting tasks & decisions..."]

  function handleFile(f: File) {
    setFile(f)
    // Auto-fill title from filename if empty
    if (!title) {
      const base = f.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ")
      setTitle(base)
    }
    // Auto-fill date from filename
    const match = f.name.match(/(\d{4})[_-](\d{2})[_-](\d{2})/)
    if (match) setDate(`${match[1]}-${match[2]}-${match[3]}`)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function handleCreate() {
    if (!title.trim()) { setError("Please enter a meeting title."); return }
    const hasContent = file || manualText.trim()
    if (!hasContent) { setError("Please upload a transcript file or enter transcript text."); return }
    setError(null)
    setStep("processing")

    // Simulate processing steps
    for (let i = 0; i < PROCESSING_STEPS.length; i++) {
      setProcessingStep(i)
      await new Promise((r) => setTimeout(r, 700))
    }

    // Build transcript text
    let transcriptText = manualText.trim()
    if (file) {
      const raw = await file.text()
      const isVTT = file.name.endsWith(".vtt") || raw.includes("-->")
      transcriptText = isVTT ? vttToPlainText(raw) : raw
    }

    // Build meeting record
    const d = new Date(date)
    const monthName = d.toLocaleString("default", { month: "long" })
    const day = d.getDate()
    const meeting: MeetingRecord = {
      id: toMeetingId(title, date),
      title: title.trim(),
      date,
      displayDate: `${monthName} ${day}`,
      participants: parseInt(participants) || 4,
      duration: parseInt(duration) || 45,
      taskCount: 0,
      decisionCount: 0,
      hasTranscript: !!transcriptText,
      hasMOM: false,
      transcript: transcriptText,
    }

    // Store transcript so detail page can pick it up
    sessionStorage.setItem(`metapm_transcript_${meeting.id}`, transcriptText)

    setStep("done")
    await new Promise((r) => setTimeout(r, 600))
    onCreated(meeting)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-foreground font-sans">New Meeting</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X size={16} />
          </button>
        </div>

        {step === "form" && (
          <div className="overflow-y-auto flex-1">
            <div className="px-6 py-5 flex flex-col gap-5">

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground font-sans">Meeting Title</label>
                <input
                  className="h-9 px-3 rounded-lg border border-border bg-background text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. Sprint Planning, Weekly Sync..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Date / Participants / Duration */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground font-sans">Date</label>
                  <input type="date" className="h-9 px-3 rounded-lg border border-border bg-background text-sm font-sans text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground font-sans">Participants</label>
                  <input type="number" min="1" className="h-9 px-3 rounded-lg border border-border bg-background text-sm font-sans text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" value={participants} onChange={(e) => setParticipants(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground font-sans">Duration (min)</label>
                  <input type="number" min="1" className="h-9 px-3 rounded-lg border border-border bg-background text-sm font-sans text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
              </div>

              {/* Mode toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground font-sans">Transcript</label>
                <div className="flex rounded-lg border border-border overflow-hidden bg-background text-xs font-sans">
                  {(["upload", "manual"] as InputMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setInputMode(m)}
                      className="flex-1 py-2 font-medium transition-colors capitalize"
                      style={{
                        background: inputMode === m ? "var(--primary)" : "transparent",
                        color: inputMode === m ? "var(--primary-foreground)" : "var(--muted-foreground)",
                      }}
                    >
                      {m === "upload" ? "Upload File" : "Type / Paste"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload zone */}
              {inputMode === "upload" && (
                <div
                  className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer"
                  style={{ borderColor: dragOver ? "var(--primary)" : "var(--border)", background: dragOver ? "oklch(0.52 0.16 240 / 0.05)" : "var(--secondary)" }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".vtt,.txt,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                  {file ? (
                    <>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.52 0.16 240 / 0.12)" }}>
                        <FileText size={20} style={{ color: "var(--primary)" }} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground font-sans">{file.name}</p>
                        <p className="text-xs text-muted-foreground font-sans">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        className="text-xs text-muted-foreground underline font-sans"
                        onClick={(e) => { e.stopPropagation(); setFile(null) }}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--secondary)" }}>
                        <Upload size={20} className="text-muted-foreground" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground font-sans">Drop your transcript here</p>
                        <p className="text-xs text-muted-foreground font-sans mt-0.5">.vtt, .txt, or .docx &mdash; or click to browse</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Manual text area */}
              {inputMode === "manual" && (
                <textarea
                  className="w-full rounded-xl border border-border bg-background text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none p-3 leading-relaxed"
                  rows={8}
                  placeholder={"Paste or type transcript here...\n\nSpeaker Name: What they said..."}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                />
              )}

              {error && <p className="text-xs text-red-500 font-sans">{error}</p>}
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center gap-6 px-6 py-14">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "oklch(0.52 0.16 240 / 0.1)" }}>
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--primary)" }} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-semibold text-foreground font-sans">{PROCESSING_STEPS[processingStep]}</p>
              <div className="flex gap-1.5 mt-1">
                {PROCESSING_STEPS.map((_, i) => (
                  <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i <= processingStep ? "24px" : "6px", background: i <= processingStep ? "var(--primary)" : "var(--border)" }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-14">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "oklch(0.52 0.16 240 / 0.1)" }}>
              <CheckSquare size={28} style={{ color: "var(--primary)" }} />
            </div>
            <p className="text-sm font-semibold text-foreground font-sans">Meeting created!</p>
          </div>
        )}

        {/* Footer */}
        {step === "form" && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card shrink-0">
            <button onClick={onClose} className="px-4 h-9 rounded-lg text-sm font-sans font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-sans font-medium text-primary-foreground transition-colors"
              style={{ background: "var(--primary)" }}
            >
              <Plus size={14} strokeWidth={2.5} />
              Create Meeting
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MeetingsListPage({ params }: PageProps) {
  const { slug } = use(params)
  const projectName = slugToTitle(slug)
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { token, isAuthenticated } = useAuth()

  // Load meetings from Excel database
  const loadMeetingsFromDB = async () => {
    if (!token || !isAuthenticated) return
    
    try {
      setLoading(true)
      setError(null)
      
      // Get the project folder ID by matching slug to projects
      const customersWithProjects = await fetchAllCustomersWithProjects(token)
      let projectFolderId: string | null = null
      
      for (const { projects } of customersWithProjects) {
        const project = projects.find((p) => {
          const projectSlug = p.name.toLowerCase().replace(/\s+/g, "-")
          return projectSlug === slug
        })
        if (project) {
          projectFolderId = project.id
          break
        }
      }
      
      if (!projectFolderId) {
        setMeetings([])
        setLoading(false)
        return
      }
      
      // Fetch meeting data from Excel
      const db = await fetchMeetingDatabase(token, projectFolderId)
      
      // Transform Excel data into MeetingRecords
      const records: MeetingRecord[] = db.meetings.map((m) => {
        const attendeeCount = db.attendees.filter((a) => a.Meeting_ID === m.Meeting_ID).length
        const taskCount = db.actions.filter((a) => a.Meeting_ID === m.Meeting_ID).length
        const decisionCount = db.decisions.filter((d) => d.Meeting_ID === m.Meeting_ID).length
        const riskCount = db.risks.filter((r) => r.Meeting_ID === m.Meeting_ID).length
        
        // Format date from dd-mm-yyyy to display format
        let displayDate = m.Meeting_date
        try {
          const dateStr = m.Meeting_date.includes("-") ? m.Meeting_date : ""
          if (dateStr) {
            const d = new Date(dateStr)
            if (!isNaN(d.getTime())) {
              const monthName = d.toLocaleString("default", { month: "long" })
              displayDate = `${monthName} ${d.getDate()}`
            }
          }
        } catch (e) {
          // Keep original if parse fails
        }
        
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
      <div className="bg-card border-b border-border px-8 py-5 shrink-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground font-sans mb-0.5">{projectName}</p>
            <h1 className="text-xl font-bold text-foreground font-sans">Meetings</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-sans font-medium text-primary-foreground transition-colors hover:opacity-90"
            style={{ background: "var(--primary)" }}
          >
            <Plus size={14} strokeWidth={2.5} />
            New Meeting
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { icon: <Filter size={12} strokeWidth={2} />, label: "Any Time" },
            { icon: <CalendarDays size={12} strokeWidth={2} />, label: projectName },
            { icon: <Users size={12} strokeWidth={2} />, label: "People" },
          ].map((f) => (
            <button key={f.label} className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border bg-background text-xs font-sans text-muted-foreground hover:bg-secondary transition-colors">
              {f.icon}
              {f.label}
              <ChevronDown size={11} strokeWidth={2} />
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 px-3 h-8 rounded-lg border border-border bg-background text-xs font-sans text-muted-foreground">
            <Search size={12} strokeWidth={2} />
            <input className="bg-transparent outline-none w-36 placeholder:text-muted-foreground text-foreground" placeholder="Search meetings..." />
          </div>
        </div>
      </div>

      {/* Sub-nav tabs */}
      <div className="bg-card border-b border-border px-8 shrink-0">
        <div className="flex items-center gap-0">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className="relative px-4 py-3 text-sm font-sans font-medium transition-colors"
              style={{ color: activeTab === i ? "var(--primary)" : "var(--muted-foreground)" }}
            >
              {tab}
              {activeTab === i && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: "var(--primary)" }} />}
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
      {showModal && (
        <NewMeetingModal
          projectSlug={slug}
          onClose={() => setShowModal(false)}
          onCreated={handleMeetingCreated}
        />
      )}
    </div>
  )
}

"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import {
  Upload,
  Users,
  Clock,
  ChevronDown,
  ChevronRight,
  FileOutput,
  ListChecks,
  Loader2,
  MoreHorizontal,
  ExternalLink,
  Copy,
  MessageSquare,
  Sparkles,
  Send,
  FileText,
} from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

interface TranscriptLine {
  timestamp: string
  speaker: string
  text: string
}

interface ActionItem {
  id: string
  assignee: string
  task: string
  dueDate: string
  assignedTo: string
}

interface PageProps {
  params: Promise<{ slug: string; meetingId: string }>
}

type Tab = "mom" | "transcript" | "tasks" | "decisions"

// ── VTT parser ────────────────────────────────────────────────────────────────

function extractCues(vtt: string): { timestamp: string; speaker: string; text: string }[] {
  let s = vtt.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const UUID_CUE_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[\d]+-[\d]+)/gi
  s = s.replace(UUID_CUE_RE, "\n§CUE§$1\n")
  const chunks = s.split(/\n§CUE§/)
  const cues: { timestamp: string; speaker: string; text: string }[] = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim()
    if (!chunk) continue
    const tsMatch = chunk.match(/(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})/)
    if (!tsMatch) continue
    const timestamp = tsMatch[1].replace(/[.,]\d{3}$/, "")
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
          if (cues.length > 0) {
            cues[cues.length - 1].text = cues[cues.length - 1].text.replace(new RegExp(`\\s*${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "").trim()
          }
          speaker = candidate
          break
        }
      }
    }
    if (text) cues.push({ timestamp, speaker, text })
  }
  return cues
}

function parseVTTToLines(vtt: string): TranscriptLine[] {
  const cues = extractCues(vtt)
  const merged: TranscriptLine[] = []
  for (const cue of cues) {
    const last = merged[merged.length - 1]
    if (last && last.speaker === cue.speaker) {
      last.text = last.text.trimEnd() + " " + cue.text
    } else {
      merged.push({ ...cue })
    }
  }
  return merged
}

function parseVTTToText(vtt: string): string {
  const cues = extractCues(vtt)
  const merged: { speaker: string; text: string }[] = []
  for (const cue of cues) {
    const last = merged[merged.length - 1]
    if (last && last.speaker === cue.speaker) {
      last.text = last.text.trimEnd() + " " + cue.text
    } else {
      merged.push({ speaker: cue.speaker, text: cue.text })
    }
  }
  return merged.map((m) => (m.speaker ? `${m.speaker}: ${m.text}` : m.text)).join("\n\n")
}

function extractDateFromFilename(name: string): string {
  const match = name.match(/(\d{4})[_-](\d{2})[_-](\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  return new Date().toISOString().split("T")[0]
}

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

function meetingIdToTitle(id: string) {
  // e.g. "weekly-sync-2026-06-12" → "Weekly Sync"
  return id.replace(/-\d{4}-\d{2}-\d{2}$/, "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// ── Webhook constants ─────────────────────────────────────────────────────────
const WEBHOOK_TRANSCRIPT = "https://indegene-sbx.app.n8n.cloud/webhook/meta-pm"
const WEBHOOK_GET_MOM    = "https://indegene-sbx.app.n8n.cloud/webhook/get-mom"

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold font-sans shrink-0"
      style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
    >
      {initials}
    </span>
  )
}

// ── ToneSelect ────────────────────────────────────────────────────────────────
function ToneSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border bg-card text-xs font-sans text-foreground hover:bg-secondary transition-colors"
      >
        {value}
        <ChevronDown size={11} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-card border border-border rounded-lg shadow-lg min-w-[140px] py-1">
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs font-sans hover:bg-secondary transition-colors"
              style={{ color: opt === value ? "var(--primary)" : "var(--foreground)" }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MeetingDetailPage({ params }: PageProps) {
  const { slug, meetingId } = use(params)
  const projectName = slugToTitle(slug)
  const meetingTitle = meetingIdToTitle(meetingId)
  const { isAuthenticated, displayName } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) router.replace("/")
  }, [isAuthenticated, router])

  // ── Transcript state
  const [activeTab, setActiveTab] = useState<Tab>("transcript")
  const [dragOver, setDragOver] = useState(false)
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([])
  const [transcriptText, setTranscriptText] = useState("")
  const [fileName, setFileName] = useState("")
  const [meetingDate, setMeetingDate] = useState("")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load transcript if this meeting was just created via the New Meeting modal
  useEffect(() => {
    const stored = sessionStorage.getItem(`metapm_transcript_${meetingId}`)
    if (stored && stored.trim()) {
      const lines = stored.split("\n\n").map((block, idx) => {
        const colon = block.indexOf(": ")
        if (colon > 0 && colon < 40) {
          return { timestamp: `00:0${idx}:00`, speaker: block.slice(0, colon), text: block.slice(colon + 2) }
        }
        return { timestamp: `00:0${idx}:00`, speaker: "", text: block }
      })
      setTranscriptLines(lines)
      setTranscriptText(stored)
      setFileName(meetingTitle)
      setMeetingDate(new Date().toISOString().split("T")[0])
      // Open on transcript tab so they can review it
      setActiveTab("transcript")
    }
  }, [meetingId, meetingTitle])

  // ── Send state
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // ── MOM state
  const [tone, setTone] = useState("Client-ready")
  const [audience, setAudience] = useState("Internal team")
  const [momHtml, setMomHtml] = useState<string | null>(null)
  const [momLoading, setMomLoading] = useState(false)
  const [momError, setMomError] = useState<string | null>(null)

  // ── Tasks (mock)
  const [actionItems] = useState<ActionItem[]>([
    { id: "1", assignee: "Sarvesh", task: "Update the project time and roadmap.", dueDate: "March 8",  assignedTo: "March 8" },
    { id: "2", assignee: "Lisa",    task: "Prepare and send the revised budget proposal.", dueDate: "March 7", assignedTo: "March 7" },
    { id: "3", assignee: "Michael", task: "Follow up with client on their feedback.", dueDate: "March 7", assignedTo: "March 7" },
    { id: "4", assignee: "Ramona",  task: "Review and approve updated budget.", dueDate: "March 7",    assignedTo: "March 7" },
  ])

  // ── Decisions (mock)
  const decisions = [
    { text: "Campaign launch moved to April.", age: "1 week ago" },
    { text: "Final deliverable list to be confirmed with client by June 10.", age: "2 week ago" },
    { text: "Budget allocation adjusted for upcoming phase.", age: "2 week ago" },
  ]

  // ── File handling
  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".vtt")) {
      setUploadError("Please upload a .vtt file.")
      return
    }
    setUploadError(null)
    try {
      const text = await file.text()
      const lines = parseVTTToLines(text)
      const plain = parseVTTToText(text)
      const name = file.name.replace(/\.[^/.]+$/, "")
      setTranscriptLines(lines)
      setTranscriptText(plain)
      setFileName(name)
      setMeetingDate(extractDateFromFilename(name))
      setActiveTab("transcript")
    } catch {
      setUploadError("Failed to read file.")
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  // ── Send transcript
  async function handleSendTranscript() {
    if (!transcriptText || sending) return
    setSending(true)
    try {
      await fetch(WEBHOOK_TRANSCRIPT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: displayName ?? "User",
          project_name: projectName,
          file_name: fileName,
          meeting_date: meetingDate,
          transcript: transcriptText,
        }),
      })
      setSent(true)
    } catch { /* silent */ } finally { setSending(false) }
  }

  // ── Generate MOM
  async function handleGenerateMOM() {
    if (!fileName) return
    setMomLoading(true)
    setMomError(null)
    setMomHtml(null)
    try {
      const res = await fetch(WEBHOOK_GET_MOM, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: fileName }),
      })
      const resText = await res.text()
      let html: string | null = null
      try {
        const parsed = JSON.parse(resText)
        if (parsed?.output && typeof parsed.output === "string") {
          html = parsed.output.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim()
        }
      } catch {
        if (resText.trim().startsWith("<")) html = resText
      }
      setMomHtml(html)
      if (html) setActiveTab("mom")
    } catch (err) {
      setMomError(err instanceof Error ? err.message : "Failed to generate MOM.")
    } finally { setMomLoading(false) }
  }

  if (!isAuthenticated) return null

  const hasTranscript = transcriptLines.length > 0
  const displayDate = meetingDate
    ? new Date(meetingDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "March 6, 2026"

  const TABS: { key: Tab; label: string }[] = [
    { key: "mom",       label: "MOM" },
    { key: "transcript",label: "Transcript" },
    { key: "tasks",     label: "Tasks" },
    { key: "decisions", label: "Decisions" },
  ]

  return (
    <div className="flex flex-col h-full">

      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="bg-card border-b border-border px-8 py-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans mb-3">
          <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors">{projectName}</Link>
          <ChevronRight size={12} strokeWidth={2} />
          <Link href={`/projects/${slug}/meetings`} className="hover:text-foreground transition-colors">Meetings</Link>
          <ChevronRight size={12} strokeWidth={2} />
          <span className="text-foreground font-medium">{meetingTitle}</span>
        </div>

        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-bold text-foreground font-sans">
              {projectName} &ndash; {meetingTitle}
            </h1>
            <div className="flex items-center gap-4 text-xs text-muted-foreground font-sans">
              <span>{displayDate}</span>
              <span className="flex items-center gap-1"><Users size={11} strokeWidth={2} /> 6 Participants</span>
              <span className="flex items-center gap-1"><Clock size={11} strokeWidth={2} /> 45 min</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="Open">
              <ExternalLink size={14} strokeWidth={1.8} />
            </button>
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="Copy">
              <Copy size={14} strokeWidth={1.8} />
            </button>
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="Comment">
              <MessageSquare size={14} strokeWidth={1.8} />
            </button>
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="More">
              <MoreHorizontal size={14} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium text-primary-foreground"
            style={{ background: "var(--primary)" }}
          >
            <Upload size={13} strokeWidth={2.5} />
            Upload Transcript
          </button>
          <input ref={fileInputRef} type="file" accept=".vtt" className="hidden" onChange={handleFileInput} />

          <button className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium border border-border bg-card hover:bg-secondary transition-colors text-foreground">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
              <path d="M20 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM8 4h12v12H8V4zM4 6H2v14a2 2 0 0 0 2 2h14v-2H4V6z"/>
            </svg>
            Import from Teams
          </button>

          {hasTranscript && !sent && (
            <button
              onClick={handleSendTranscript}
              disabled={sending}
              className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium border border-border bg-card hover:bg-secondary transition-colors text-foreground disabled:opacity-60"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} strokeWidth={2} />}
              Send Transcript
            </button>
          )}
          {sent && (
            <span className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium border border-border text-green-600">
              Transcript Sent
            </span>
          )}
          {momHtml && (
            <span className="flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-sans font-medium border border-border"
              style={{ color: "var(--primary)" }}>
              <FileOutput size={12} strokeWidth={2} />
              MOM
            </span>
          )}
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────── */}
      <div className="bg-card border-b border-border px-8">
        <div className="flex items-center">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative px-4 py-3 text-sm font-sans font-medium transition-colors"
              style={{ color: activeTab === tab.key ? "var(--primary)" : "var(--muted-foreground)" }}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: "var(--primary)" }} />
              )}
            </button>
          ))}
          {activeTab === "tasks" && (
            <button
              className="ml-auto flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium text-primary-foreground mb-1.5"
              style={{ background: "var(--primary)" }}
            >
              <ListChecks size={13} strokeWidth={2.5} />
              Create Planner Tasks
            </button>
          )}
          <button className="ml-auto p-2 rounded hover:bg-secondary text-muted-foreground transition-colors">
            <MoreHorizontal size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-background">

        {/* MOM tab */}
        {activeTab === "mom" && (
          <div className="flex gap-0 h-full">
            {/* Main MOM content */}
            <div className="flex-1 p-8 overflow-y-auto">
              {/* Tone controls */}
              <div className="flex items-center gap-2 flex-wrap mb-6">
                <span className="text-xs font-sans text-muted-foreground mr-1">Tone:</span>
                <ToneSelect value={tone} onChange={setTone} options={["Client-ready", "Action-focused", "Formal", "Concise"]} />
                <ToneSelect value={audience} onChange={setAudience} options={["Internal team", "Executive", "Client", "All stakeholders"]} />
                <button
                  onClick={handleGenerateMOM}
                  disabled={momLoading || !fileName}
                  className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
                  style={{ background: "var(--primary)" }}
                >
                  {momLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} strokeWidth={2} />}
                  Generate MOM
                </button>
                {!fileName && (
                  <span className="text-xs text-muted-foreground font-sans">Upload a transcript first</span>
                )}
              </div>

              {momError && (
                <p className="text-xs font-sans mb-4" style={{ color: "var(--destructive)" }}>{momError}</p>
              )}

              {momHtml ? (
                <div
                  className="font-sans text-sm text-foreground leading-relaxed
                    [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:text-foreground
                    [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-foreground [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1
                    [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-1 [&_h3]:text-foreground
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1
                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1
                    [&_li]:text-muted-foreground
                    [&_strong]:text-foreground [&_strong]:font-semibold
                    [&_p]:my-2 [&_p]:text-muted-foreground
                    [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm
                    [&_th]:border [&_th]:border-border [&_th]:px-4 [&_th]:py-2 [&_th]:bg-secondary [&_th]:text-foreground [&_th]:font-semibold [&_th]:text-left
                    [&_td]:border [&_td]:border-border [&_td]:px-4 [&_td]:py-2 [&_td]:text-muted-foreground
                    [&_hr]:border-border [&_hr]:my-4"
                  dangerouslySetInnerHTML={{ __html: momHtml }}
                />
              ) : (
                /* Empty MOM state — shows structure preview */
                !momLoading && (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h2 className="text-base font-bold text-foreground font-sans mb-2">Minutes of Meeting</h2>
                    <p className="text-sm text-muted-foreground font-sans mb-4">
                      <strong className="text-foreground">Summary:</strong> The discussion focused on marketing campaign timeline adjustments and client deliverables.
                    </p>
                    <h3 className="text-sm font-semibold text-foreground font-sans mb-2">Key Discussion Points</h3>
                    <ul className="list-none space-y-1.5 text-sm text-muted-foreground font-sans">
                      {["Budget review and alignment", "Timeline adjustments for next milestone", "Client's feedback on deliverables"].map((pt) => (
                        <li key={pt} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--primary)" }} />
                          {pt}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground font-sans mt-4 italic">Upload a transcript and click Generate MOM to populate this section.</p>
                  </div>
                )
              )}
              {momLoading && (
                <div className="flex items-center gap-3 py-12 justify-center">
                  <Loader2 size={20} className="animate-spin" style={{ color: "var(--primary)" }} />
                  <span className="text-sm text-muted-foreground font-sans">Generating minutes...</span>
                </div>
              )}
            </div>

            {/* AI Tools sidebar */}
            <div className="w-56 shrink-0 border-l border-border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground font-sans uppercase tracking-widest">AI Tools</span>
                <Sparkles size={13} strokeWidth={1.8} className="text-muted-foreground" />
              </div>
              {[
                { label: "Generate Summary", primary: true },
                { label: "View Open Tasks (2)", primary: false },
                { label: "View Decisions", primary: false },
                { label: "Extract Action Items", primary: false },
              ].map((btn) => (
                <button
                  key={btn.label}
                  className="w-full px-3 py-2 rounded-lg text-xs font-sans font-medium text-left transition-colors"
                  style={btn.primary
                    ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                    : { background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }
                  }
                >
                  {btn.label}
                </button>
              ))}
              <div className="border-t border-border pt-3 mt-1">
                <p className="text-[10px] font-sans text-muted-foreground uppercase tracking-widest mb-2">Export &amp; Share</p>
                {["Export as PDF", "Sync MOM to Teams"].map((label) => (
                  <button key={label} className="w-full px-3 py-1.5 rounded-lg text-xs font-sans text-left text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TRANSCRIPT tab */}
        {activeTab === "transcript" && (
          <div className="p-8">
            {!hasTranscript ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors py-20"
                style={{
                  borderColor: dragOver ? "var(--primary)" : "var(--border)",
                  background: dragOver ? "oklch(0.52 0.16 240 / 0.05)" : "var(--card)",
                }}
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "var(--secondary)" }}>
                  <Upload size={24} strokeWidth={1.5} style={{ color: "var(--muted-foreground)" }} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm font-medium text-foreground font-sans">Upload Transcript</p>
                  <p className="text-xs text-muted-foreground font-sans">Drag and drop a .vtt file, or click to browse</p>
                </div>
                {uploadError && <p className="text-xs font-sans" style={{ color: "var(--destructive)" }}>{uploadError}</p>}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-foreground font-sans">
                    {fileName} <span className="font-normal text-muted-foreground">({transcriptLines.length} segments)</span>
                  </h2>
                </div>
                <div className="flex flex-col divide-y divide-border">
                  {transcriptLines.map((line, idx) => (
                    <div key={idx} className="flex gap-4 py-3">
                      <span className="text-xs font-mono text-muted-foreground w-20 shrink-0 pt-0.5">{line.timestamp}</span>
                      <div className="flex flex-col gap-0.5 flex-1">
                        {line.speaker && (
                          <span className="text-xs font-semibold font-sans" style={{ color: "var(--primary)" }}>{line.speaker}</span>
                        )}
                        <p className="text-sm text-foreground font-sans leading-relaxed">{line.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TASKS tab */}
        {activeTab === "tasks" && (
          <div className="flex gap-0 h-full">
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-foreground font-sans">
                  {actionItems.length} Open Tasks
                </h2>
                <button
                  className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium border border-border bg-card hover:bg-secondary transition-colors text-foreground"
                >
                  <FileText size={12} strokeWidth={2} />
                  Show Tasks
                </button>
              </div>

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 border-b border-border bg-secondary">
                  <span className="text-xs font-semibold text-muted-foreground font-sans">Extracted Action Items</span>
                  <span className="text-xs font-semibold text-muted-foreground font-sans w-24 text-right">Due</span>
                  <span className="text-xs font-semibold text-muted-foreground font-sans w-24 text-right">Due to</span>
                </div>
                {actionItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/40 transition-colors items-center">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={item.assignee} />
                      <p className="text-sm text-foreground font-sans truncate">
                        <span className="font-medium">{item.assignee}</span>
                        {" · "}
                        <span className="text-muted-foreground">{item.task}</span>
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground font-sans w-24 text-right whitespace-nowrap">{item.dueDate}</span>
                    <span className="text-xs text-muted-foreground font-sans w-24 text-right whitespace-nowrap">{item.assignedTo}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Tools sidebar */}
            <div className="w-56 shrink-0 border-l border-border bg-card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground font-sans uppercase tracking-widest">AI Tools</span>
                <Sparkles size={13} strokeWidth={1.8} className="text-muted-foreground" />
              </div>
              {[
                { label: "Summarize Tasks", primary: true },
                { label: "Generate MOM", primary: false },
                { label: "Extract Action Items", primary: false },
                { label: "Generate Follow-Up Email", primary: false },
              ].map((btn) => (
                <button key={btn.label}
                  className="w-full px-3 py-2 rounded-lg text-xs font-sans font-medium text-left transition-colors"
                  style={btn.primary
                    ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                    : { background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }
                  }
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DECISIONS tab */}
        {activeTab === "decisions" && (
          <div className="flex gap-0 h-full">
            <div className="flex-1 p-8 overflow-y-auto">
              <h2 className="text-base font-bold text-foreground font-sans mb-4">Key Decisions</h2>
              <div className="flex flex-col gap-3">
                {decisions.map((d, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: "var(--primary)" }} />
                    <div className="flex-1">
                      <p className="text-sm text-foreground font-sans leading-relaxed">{d.text}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-sans shrink-0 mt-0.5 whitespace-nowrap">{d.age}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Tools sidebar */}
            <div className="w-56 shrink-0 border-l border-border bg-card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground font-sans uppercase tracking-widest">AI Tools</span>
                <Sparkles size={13} strokeWidth={1.8} className="text-muted-foreground" />
              </div>
              {[
                { label: "Generate Follow-Up Email", primary: true },
                { label: "Generate MOM", primary: false },
                { label: "Send to Teams", primary: false },
                { label: "Send Email Summary", primary: false },
                { label: "Create Planner Tasks", primary: false },
              ].map((btn) => (
                <button key={btn.label}
                  className="w-full px-3 py-2 rounded-lg text-xs font-sans font-medium text-left transition-colors"
                  style={btn.primary
                    ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                    : { background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }
                  }
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

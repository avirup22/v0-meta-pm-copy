"use client"

import { useState, useRef, useCallback } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import {
  Upload,
  Users,
  Clock,
  ChevronDown,
  Sparkles,
  FileOutput,
  ListChecks,
  Loader2,
  MoreHorizontal,
  ExternalLink,
  Copy,
  MessageSquare,
  Share2,
  X,
} from "lucide-react"
import { useEffect } from "react"

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
  params: Promise<{ slug: string }>
}

type Tab = "transcript" | "mom" | "tasks" | "decisions" | "notes"

type Tone = "Client-ready" | "Action-focused" | "Internal team"

// ── VTT parser (same logic as transcript-panel) ───────────────────────────

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

// ── Webhook constants ─────────────────────────────────────────────────────
const WEBHOOK_TRANSCRIPT = "https://indegene-sbx.app.n8n.cloud/webhook/meta-pm"
const WEBHOOK_GET_MOM    = "https://indegene-sbx.app.n8n.cloud/webhook/get-mom"

// ── Sub-components ────────────────────────────────────────────────────────

function ToneSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border bg-card text-xs font-sans text-foreground hover:bg-secondary transition-colors"
      >
        {value}
        <ChevronDown size={12} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-card border border-border rounded-lg shadow-lg min-w-[140px] py-1">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false) }}
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

// ── Main page ─────────────────────────────────────────────────────────────

export default function MeetingsPage({ params }: PageProps) {
  const { slug } = use(params)
  const projectName = slugToTitle(slug)
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

  // ── Webhook/send state
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // ── MOM state
  const [tone, setTone] = useState<Tone>("Client-ready")
  const [audience, setAudience] = useState("Internal team")
  const [momHtml, setMomHtml] = useState<string | null>(null)
  const [momLoading, setMomLoading] = useState(false)
  const [momError, setMomError] = useState<string | null>(null)
  const [momModalOpen, setMomModalOpen] = useState(false)

  // ── Tasks state (mock parsed from transcript)
  const [actionItems] = useState<ActionItem[]>([
    { id: "1", assignee: "Sarvesh", task: "Update the project time and roadmap.", dueDate: "March 8", assignedTo: "March 8" },
    { id: "2", assignee: "Lisa", task: "Prepare and send the revised budget proposal.", dueDate: "March 7", assignedTo: "March 7" },
    { id: "3", assignee: "Michael", task: "Follow up with client on their feedback.", dueDate: "March 7", assignedTo: "March 7" },
  ])

  // ── Decisions state (mock)
  const decisions = [
    "Campaign launch moved to April.",
    "Budget adjustments approved.",
    "Vendor shortlist finalized.",
  ]

  // ── File handling ─────────────────────────────────────────────────────

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

  // ── Send transcript to n8n ────────────────────────────────────────────

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
    } catch {
      // silent — don't block UI
    } finally {
      setSending(false)
    }
  }

  // ── Generate MOM ──────────────────────────────────────────────────────

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
    } finally {
      setMomLoading(false)
    }
  }

  if (!isAuthenticated) return null

  const hasTranscript = transcriptLines.length > 0

  // ── Meeting meta (derived from file or defaults) ──────────────────────
  const displayDate = meetingDate
    ? new Date(meetingDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null

  const TABS: { key: Tab; label: string }[] = [
    { key: "transcript", label: "Transcript" },
    { key: "mom",        label: "MOM" },
    { key: "tasks",      label: "Tasks" },
    { key: "decisions",  label: "Decisions" },
    { key: "notes",      label: "Notes" },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="bg-card border-b border-border px-8 py-5 flex flex-col gap-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold text-foreground font-sans text-balance">
              {projectName} — Team Sync
            </h1>
            {displayDate && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground font-sans">
                <span>{displayDate}</span>
                <span className="flex items-center gap-1"><Users size={12} strokeWidth={2} /> 6 Participants</span>
                <span className="flex items-center gap-1"><Clock size={12} strokeWidth={2} /> 45 min</span>
              </div>
            )}
          </div>
          {/* Header actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="Open">
              <ExternalLink size={15} strokeWidth={1.8} />
            </button>
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="Copy">
              <Copy size={15} strokeWidth={1.8} />
            </button>
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="Comment">
              <MessageSquare size={15} strokeWidth={1.8} />
            </button>
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="More">
              <MoreHorizontal size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Upload transcript */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium transition-colors text-primary-foreground"
            style={{ background: "var(--primary)" }}
          >
            <Upload size={13} strokeWidth={2.5} />
            Upload Transcript
          </button>
          <input ref={fileInputRef} type="file" accept=".vtt" className="hidden" onChange={handleFileInput} />

          {/* Import from Teams */}
          <button className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium border border-border bg-card hover:bg-secondary transition-colors text-foreground">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
              <path d="M20 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM8 4h12v12H8V4zM4 6H2v14a2 2 0 0 0 2 2h14v-2H4V6z"/>
            </svg>
            Import from Teams +
          </button>

          {/* Send transcript badge — appears after upload */}
          {hasTranscript && (
            <button
              onClick={handleSendTranscript}
              disabled={sending || sent}
              className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium border border-border bg-card hover:bg-secondary transition-colors text-foreground disabled:opacity-60"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : sent ? <span className="text-green-600 font-semibold">Sent</span> : null}
              {!sent && "Send to n8n"}
            </button>
          )}

          {/* MOM badge — visible when MOM exists */}
          {momHtml && (
            <button
              onClick={() => setMomModalOpen(true)}
              className="flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-sans font-medium border border-border bg-card hover:bg-secondary transition-colors"
              style={{ color: "var(--primary)" }}
            >
              <FileOutput size={13} strokeWidth={2} />
              MOM
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="bg-card border-b border-border px-8">
        <div className="flex items-center gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              disabled={tab.key !== "transcript" && !hasTranscript}
              className="relative px-4 py-3 text-sm font-sans font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                color: activeTab === tab.key ? "var(--primary)" : "var(--muted-foreground)",
              }}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: "var(--primary)" }} />
              )}
            </button>
          ))}

          {/* Tasks action in tab bar */}
          {activeTab === "tasks" && hasTranscript && (
            <button
              className="ml-auto flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium text-primary-foreground mb-1.5"
              style={{ background: "var(--primary)" }}
            >
              <ListChecks size={13} strokeWidth={2.5} />
              Create Planner Tasks
            </button>
          )}

          <div className="ml-auto flex items-center gap-1 pb-1">
            <button className="p-2 rounded hover:bg-secondary text-muted-foreground transition-colors" title="More options">
              <MoreHorizontal size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-background">

        {/* TRANSCRIPT tab */}
        {activeTab === "transcript" && (
          <div className="p-8">
            {!hasTranscript ? (
              /* Drop zone */
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
              /* Transcript lines */
              <div className="flex flex-col gap-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-foreground font-sans">
                    {fileName} <span className="font-normal text-muted-foreground">({transcriptLines.length} segments)</span>
                  </h2>
                  {uploadError && <p className="text-xs" style={{ color: "var(--destructive)" }}>{uploadError}</p>}
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

        {/* MOM tab */}
        {activeTab === "mom" && (
          <div className="p-8 max-w-4xl">
            {/* Tone controls */}
            <div className="flex items-center gap-2 flex-wrap mb-6">
              <span className="text-xs text-muted-foreground font-sans font-medium">Tone:</span>
              <ToneSelect value={tone} onChange={(v) => setTone(v as Tone)} options={["Client-ready", "Action-focused", "Internal team"]} />
              <ToneSelect value={audience} onChange={setAudience} options={["Internal team", "Executive", "Client-facing", "Technical"]} />
              <button
                onClick={handleGenerateMOM}
                disabled={momLoading || !hasTranscript}
                className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium text-primary-foreground disabled:opacity-60 transition-colors"
                style={{ background: "var(--primary)" }}
              >
                {momLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} strokeWidth={2.5} />}
                Generate MOM
              </button>
            </div>

            {momError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive font-sans mb-4">
                {momError}
              </div>
            )}

            {momHtml ? (
              <div
                className="bg-card rounded-xl border border-border p-8 font-sans text-sm text-foreground leading-relaxed
                  [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-4
                  [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1
                  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1
                  [&_li]:text-muted-foreground
                  [&_strong]:text-foreground [&_strong]:font-semibold
                  [&_p]:my-2 [&_p]:text-muted-foreground
                  [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
                  [&_th]:border [&_th]:border-border [&_th]:px-4 [&_th]:py-2 [&_th]:bg-secondary [&_th]:text-foreground [&_th]:font-semibold [&_th]:text-left [&_th]:text-xs
                  [&_td]:border [&_td]:border-border [&_td]:px-4 [&_td]:py-2 [&_td]:text-muted-foreground [&_td]:text-sm
                  [&_hr]:border-border [&_hr]:my-4"
                dangerouslySetInnerHTML={{ __html: momHtml }}
              />
            ) : !momLoading && (
              <div className="bg-card rounded-xl border border-border flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--secondary)" }}>
                  <FileOutput size={22} strokeWidth={1.5} className="text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground font-sans">
                  {hasTranscript ? "Configure tone and click Generate MOM" : "Upload a transcript first"}
                </p>
              </div>
            )}

            {momLoading && (
              <div className="bg-card rounded-xl border border-border flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={28} className="animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground font-sans">Generating minutes of meeting...</p>
              </div>
            )}
          </div>
        )}

        {/* TASKS tab */}
        {activeTab === "tasks" && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground font-sans">Extracted Action Items</h2>
              <button
                className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-sans font-medium text-primary-foreground"
                style={{ background: "var(--primary)" }}
              >
                <ListChecks size={13} strokeWidth={2.5} />
                Create Planner Tasks
              </button>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-0 border-b border-border">
                <div className="px-4 py-3 text-xs font-semibold text-muted-foreground font-sans flex items-center gap-1">
                  Extracted Action Items
                  <ChevronDown size={12} strokeWidth={2.5} />
                </div>
                <div className="px-4 py-3 text-xs font-semibold text-muted-foreground font-sans flex items-center gap-1 border-l border-border w-32">
                  Due <ChevronDown size={12} strokeWidth={2.5} />
                </div>
                <div className="px-4 py-3 text-xs font-semibold text-muted-foreground font-sans flex items-center gap-1 border-l border-border w-32">
                  Due to <ChevronDown size={12} strokeWidth={2.5} />
                </div>
              </div>

              {/* Table rows */}
              {actionItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-0 hover:bg-secondary transition-colors"
                  style={{ borderBottom: idx < actionItems.length - 1 ? "1px solid var(--border)" : "none" }}
                >
                  <div className="px-4 py-3 flex items-center gap-2">
                    {/* Avatar */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-semibold font-sans shrink-0"
                      style={{ background: "var(--primary)" }}
                    >
                      {item.assignee[0]}
                    </div>
                    <span className="text-sm font-sans text-foreground">
                      <span className="font-medium">{item.assignee}</span>
                      <span className="text-muted-foreground"> · {item.task}</span>
                    </span>
                  </div>
                  <div className="px-4 py-3 text-sm font-sans text-muted-foreground border-l border-border w-32 flex items-center">
                    {item.dueDate}
                  </div>
                  <div className="px-4 py-3 text-sm font-sans text-muted-foreground border-l border-border w-32 flex items-center">
                    {item.assignedTo}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DECISIONS tab */}
        {activeTab === "decisions" && (
          <div className="p-8 flex gap-6 items-start">
            {/* Decisions content */}
            <div className="flex-1 bg-card rounded-xl border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground font-sans mb-4">Extracted Key Decisions</h2>
              <ul className="flex flex-col gap-2">
                {decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-sans text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--primary)" }} />
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Tools panel */}
            <div className="w-52 shrink-0 bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground font-sans">AI Tools</span>
                <Sparkles size={14} strokeWidth={2} className="text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Generate MOM", primary: true, action: handleGenerateMOM },
                  { label: "Extract Tasks", primary: false, action: () => setActiveTab("tasks") },
                  { label: "Summarize Meeting", primary: false, action: () => {} },
                  { label: "Generate Follow-Up Email", primary: false, action: () => {} },
                  { label: "Generate Client Summary", primary: false, action: () => {} },
                ].map((tool) => (
                  <button
                    key={tool.label}
                    onClick={tool.action}
                    className="w-full px-3 py-2 rounded-lg text-xs font-sans font-medium text-left transition-colors"
                    style={
                      tool.primary
                        ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                        : { background: "var(--secondary)", color: "var(--foreground)" }
                    }
                  >
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* NOTES tab */}
        {activeTab === "notes" && (
          <div className="p-8">
            <div className="bg-card rounded-xl border border-border p-6 min-h-[300px]">
              <textarea
                className="w-full h-full min-h-[260px] resize-none bg-transparent text-sm font-sans text-foreground placeholder:text-muted-foreground outline-none"
                placeholder="Add your meeting notes here..."
              />
            </div>
          </div>
        )}
      </div>

      {/* ── MOM full-screen modal ─────────────────────────────────────── */}
      {momModalOpen && momHtml && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-3">
              <FileOutput size={18} className="text-primary" />
              <span className="font-sans font-semibold text-foreground text-base">Minutes of Meeting</span>
            </div>
            <button onClick={() => setMomModalOpen(false)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl w-full mx-auto">
            <div
              className="font-sans text-sm text-foreground leading-relaxed
                [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-4
                [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1
                [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1
                [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1
                [&_li]:text-muted-foreground
                [&_strong]:text-foreground [&_strong]:font-semibold
                [&_p]:my-2 [&_p]:text-muted-foreground
                [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
                [&_th]:border [&_th]:border-border [&_th]:px-4 [&_th]:py-2 [&_th]:bg-secondary [&_th]:font-semibold [&_th]:text-left [&_th]:text-xs
                [&_td]:border [&_td]:border-border [&_td]:px-4 [&_td]:py-2 [&_td]:text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: momHtml }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

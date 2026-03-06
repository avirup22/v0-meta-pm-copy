
"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText,
  Upload,
  Video,
  X,
  CheckCircle,
  Loader2,
  ChevronDown,
  AlertCircle,
  Send,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import {
  fetchRecordingFiles,
  type DriveItem,
} from "@/lib/graph"

interface TranscriptLine {
  timestamp: string
  speaker: string
  text: string
}

interface ApiLog {
  step: number
  label: string
  url: string
  status: number
  responsePreview: string
}

type Mode = "idle" | "upload-confirm" | "meeting-search" | "extracting" | "done" | "error"

interface PendingFile {
  name: string
  sizeKB: number
  rawFile?: File          // the actual File object for local uploads
  driveItemId?: string
  driveId?: string
  siteUrl?: string
  originalName?: string
}

interface TranscriptPanelProps {
  projectName?: string
  userName?: string
}

// Parse a VTT file into plain readable text
function parseVTTToText(vtt: string): string {
  const lines: string[] = []
  const blocks = vtt.split(/\n\n+/)
  for (const block of blocks) {
    const rows = block.trim().split("\n")
    const tsIdx = rows.findIndex((l) => l.includes(" --> "))
    if (tsIdx === -1) continue
    const rawText = rows.slice(tsIdx + 1).join(" ").trim()
    const speakerMatch = rawText.match(/^<v ([^>]+)>/)
    const speaker = speakerMatch ? speakerMatch[1] : ""
    const text = rawText.replace(/<v [^>]+>/g, "").replace(/<\/v>/g, "").replace(/<[^>]+>/g, "").trim()
    if (text) {
      lines.push(speaker ? `${speaker}: ${text}` : text)
    }
  }
  return lines.join("\n")
}

// Parse a VTT file into structured lines for display
function parseVTTToLines(vtt: string): TranscriptLine[] {
  const lines: TranscriptLine[] = []
  const blocks = vtt.split(/\n\n+/)
  for (const block of blocks) {
    const rows = block.trim().split("\n")
    const tsIdx = rows.findIndex((l) => l.includes(" --> "))
    if (tsIdx === -1) continue
    const timestamp = rows[tsIdx].split(" --> ")[0].trim().replace(/\.\d{3}$/, "")
    const rawText = rows.slice(tsIdx + 1).join(" ").trim()
    const speakerMatch = rawText.match(/^<v ([^>]+)>/)
    const speaker = speakerMatch ? speakerMatch[1] : ""
    const text = rawText.replace(/<v [^>]+>/g, "").replace(/<\/v>/g, "").replace(/<[^>]+>/g, "").trim()
    if (text) lines.push({ timestamp, speaker, text })
  }
  return lines
}

// Derive a meeting date from the file name (looks for YYYY-MM-DD or YYYY_MM_DD pattern)
function extractDateFromFilename(name: string): string {
  const match = name.match(/(\d{4})[_-](\d{2})[_-](\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  return new Date().toISOString().split("T")[0]
}

export function TranscriptPanel({ projectName = "Unknown Project", userName = "User" }: TranscriptPanelProps) {
  const { token } = useAuth()
  const [mode, setMode] = useState<Mode>("idle")
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Meeting search state
  const [meetingQuery, setMeetingQuery] = useState("")
  const [recordings, setRecordings] = useState<DriveItem[]>([])
  const [recordingsLoading, setRecordingsLoading] = useState(false)
  const [recordingsError, setRecordingsError] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Transcript state
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([])
  const [transcriptText, setTranscriptText] = useState<string>("")
  const [extractError, setExtractError] = useState<string | null>(null)
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([])
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState("")
  const [webhookPayload, setWebhookPayload] = useState<object | null>(null)
  const [webhookLog, setWebhookLog] = useState<ApiLog | null>(null)
  const [webhookSending, setWebhookSending] = useState(false)

  // Fetch recordings when entering meeting-search mode
  useEffect(() => {
    if (mode !== "meeting-search") return
    if (!token) {
      setRecordingsError("No authentication token available.")
      return
    }
    setRecordingsLoading(true)
    setRecordingsError(null)
    fetchRecordingFiles(token)
      .then(({ files }) => {
        setRecordings(files)
        setDropdownOpen(true)
      })
      .catch((err) => setRecordingsError(err.message))
      .finally(() => setRecordingsLoading(false))
  }, [mode, token])

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  // Scroll to bottom of transcript when new lines arrive
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcriptLines])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile({ name: file.name, sizeKB: Math.round(file.size / 1024) || 1, rawFile: file })
    setMode("upload-confirm")
    e.target.value = ""
  }

  async function handleConfirm() {
    if (!pendingFile) return

    setMode("extracting")
    setExtractError(null)
    setApiLogs([])
    setTranscriptLines([])
    setTranscriptText("")
    setWebhookPayload(null)
    setWebhookLog(null)

    try {
      let vttText = ""
      let parsedLines: TranscriptLine[] = []
      let plainText = ""

      if (pendingFile.rawFile) {
        // ── Local VTT upload ──────────────────────────────────────────────
        vttText = await pendingFile.rawFile.text()
        parsedLines = parseVTTToLines(vttText)
        plainText = parseVTTToText(vttText)
      } else if (pendingFile.driveItemId) {
        // ── OneDrive meeting recording — proxy via server route ────────────
        if (!pendingFile.driveId || !pendingFile.siteUrl) {
          throw new Error("Missing driveId or siteUrl. Re-select the meeting.")
        }

        const res = await fetch("/api/extract-transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteUrl: pendingFile.siteUrl,
            driveId: pendingFile.driveId,
            itemId: pendingFile.driveItemId,
          }),
        })

        const data = await res.json() as { lines?: TranscriptLine[]; logs?: ApiLog[]; error?: string; plainText?: string }
        if (data.logs) setApiLogs(data.logs)
        if (!res.ok || data.error) throw new Error(data.error ?? `Server error HTTP ${res.status}`)

        parsedLines = data.lines ?? []
        plainText = data.plainText ?? parsedLines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join("\n")
      }

      // Build webhook payload
      const fileName = (pendingFile.originalName ?? pendingFile.name).replace(/\.[^/.]+$/, "")
      const payload = {
        user_name: userName,
        project_name: projectName,
        file_name: fileName,
        meeting_date: extractDateFromFilename(fileName),
        transcript: plainText,
      }

      setTranscriptLines(parsedLines)
      setTranscriptText(plainText)
      setWebhookPayload(payload)
      setMode("done")

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process transcript."
      setExtractError(msg)
      setMode("error")
    }
  }

  async function handleSendWebhook() {
    if (!webhookUrl.trim() || !webhookPayload) return
    setWebhookSending(true)
    setWebhookLog(null)

    try {
      const res = await fetch(webhookUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      })
      const resText = await res.text()
      setWebhookLog({
        step: 3,
        label: "n8n Webhook",
        url: webhookUrl.trim(),
        status: res.status,
        responsePreview: resText,
      })
    } catch (err: unknown) {
      setWebhookLog({
        step: 3,
        label: "n8n Webhook",
        url: webhookUrl.trim(),
        status: 0,
        responsePreview: err instanceof Error ? err.message : "Network error",
      })
    } finally {
      setWebhookSending(false)
    }
  }

  function handleCancel() {
    setPendingFile(null)
    setMeetingQuery("")
    setRecordings([])
    setRecordingsError(null)
    setDropdownOpen(false)
    setTranscriptLines([])
    setTranscriptText("")
    setExtractError(null)
    setApiLogs([])
    setWebhookPayload(null)
    setWebhookLog(null)
    setMode("idle")
  }

  function handleMeetingSelect(item: DriveItem) {
    setPendingFile({
      name: item.name,
      sizeKB: 0,
      driveItemId: item.id,
      driveId: item.driveId,
      siteUrl: item.siteUrl,
      originalName: item.originalName ?? item.name,
    })
    setMode("upload-confirm")
    setDropdownOpen(false)
  }

  const filteredRecordings = recordings.filter((r) =>
    r.name.toLowerCase().includes(meetingQuery.toLowerCase())
  )

  return (
    <aside className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-5">
      <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase font-sans">
        Transcript
      </h3>

      {/* IDLE: action buttons */}
      {mode === "idle" && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 text-sm font-sans text-foreground hover:bg-secondary transition-colors duration-150 text-left"
          >
            <Upload size={16} className="text-primary shrink-0" />
            Upload Transcript
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.docx,.pdf,.vtt"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Upload transcript file"
          />

          <button
            onClick={() => setMode("meeting-search")}
            className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 text-sm font-sans text-foreground hover:bg-secondary transition-colors duration-150 text-left"
          >
            <Video size={16} className="text-primary shrink-0" />
            Search Meeting
          </button>
        </div>
      )}

      {/* MEETING SEARCH */}
      {mode === "meeting-search" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground font-sans">
              Search Meeting
            </span>
            <button
              onClick={handleCancel}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="w-full flex items-center justify-between border border-border rounded-lg px-4 py-2.5 text-sm font-sans text-foreground hover:bg-secondary transition-colors duration-150 bg-card"
              aria-expanded={dropdownOpen}
              aria-haspopup="listbox"
            >
              <span className="text-muted-foreground">
                {recordingsLoading ? "Loading meetings..." : "Select a meeting"}
              </span>
              {recordingsLoading ? (
                <Loader2 size={15} className="animate-spin text-muted-foreground" />
              ) : (
                <ChevronDown size={15} className="text-muted-foreground" />
              )}
            </button>

            {dropdownOpen && !recordingsLoading && (
              <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                <div className="p-2 border-b border-border">
                  <Input
                    className="h-8 text-sm font-sans"
                    placeholder="Filter meetings..."
                    value={meetingQuery}
                    onChange={(e) => setMeetingQuery(e.target.value)}
                    autoFocus
                  />
                </div>

                {recordingsError ? (
                  <div className="px-4 py-3 text-sm text-red-500 font-sans">
                    {recordingsError}
                  </div>
                ) : filteredRecordings.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground font-sans">
                    No meetings found.
                  </div>
                ) : (
                  <ul
                    className="max-h-56 overflow-y-auto"
                    role="listbox"
                    aria-label="Meeting recordings"
                  >
                    {filteredRecordings.map((item) => (
                      <li key={item.id} role="option" aria-selected={false}>
                        <button
                          onClick={() => handleMeetingSelect(item)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-foreground hover:bg-secondary transition-colors duration-150 text-left"
                        >
                          <Video size={14} className="text-muted-foreground shrink-0" />
                          {item.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPLOAD CONFIRM */}
      {mode === "upload-confirm" && pendingFile && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 bg-secondary rounded-lg p-3">
            <FileText size={20} className="text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground font-sans">
                {pendingFile.name}
              </span>
              {pendingFile.sizeKB > 0 && (
                <span className="text-xs text-muted-foreground font-sans">
                  ({pendingFile.sizeKB} KB)
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-foreground font-sans">
            Is this the correct file to upload?
          </p>
          <Button
            onClick={handleConfirm}
            className="w-full rounded-lg font-sans font-medium"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            Confirm Upload
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full rounded-lg font-sans font-medium border-border text-foreground"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* API CALL LOGS — shown during extracting, error and done states */}
      {apiLogs.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase font-sans">API Calls</p>
          {apiLogs.map((log) => (
            <div key={log.step} className="rounded-lg border border-border bg-secondary overflow-hidden text-xs font-mono">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
                <span
                  className={`shrink-0 font-bold px-1.5 py-0.5 rounded text-white ${log.status >= 200 && log.status < 300 ? "bg-green-600" : "bg-red-500"}`}
                >
                  {log.status}
                </span>
                <span className="font-sans font-semibold text-foreground">Step {log.step}: {log.label}</span>
              </div>
              <div className="px-3 py-2 border-b border-border text-muted-foreground break-all leading-relaxed">
                <span className="text-primary font-semibold">GET </span>{log.url}
              </div>
              <details>
                <summary className="cursor-pointer px-3 py-1.5 text-muted-foreground hover:text-foreground select-none">
                  Response body
                </summary>
                <pre className="px-3 pb-3 pt-1 overflow-x-auto overflow-y-auto max-h-48 whitespace-pre-wrap text-muted-foreground leading-relaxed">
                  {log.responsePreview}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}

      {/* EXTRACTING */}
      {mode === "extracting" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-sans text-center">
            Extracting transcript from recording...
          </p>
        </div>
      )}

      {/* ERROR */}
      {mode === "error" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 font-sans">{extractError}</p>
          </div>
          <button
            onClick={handleCancel}
            className="text-xs text-muted-foreground hover:text-primary font-sans transition-colors text-left"
          >
            Try again
          </button>
        </div>
      )}

      {/* DONE: transcript viewer */}
      {mode === "done" && pendingFile && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-500 shrink-0" />
            <span className="text-sm font-medium text-foreground font-sans truncate">
              {pendingFile.name}
            </span>
            <button
              onClick={handleCancel}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Close transcript"
            >
              <X size={15} />
            </button>
          </div>

          {transcriptLines.length === 0 ? (
            <div className="bg-secondary rounded-lg px-4 py-3 text-sm text-muted-foreground font-sans">
              Transcript uploaded. No parsed lines to display.
            </div>
          ) : (
            <div
              ref={transcriptRef}
              className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1"
              aria-label="Extracted transcript"
            >
              {transcriptLines.map((line, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary font-mono font-medium shrink-0">
                      {line.timestamp}
                    </span>
                    {line.speaker && (
                      <span className="text-xs font-semibold text-muted-foreground font-sans truncate">
                        {line.speaker}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground font-sans leading-relaxed">
                    {line.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Webhook section */}
          {webhookPayload && (
            <div className="flex flex-col gap-3 pt-2 border-t border-border">
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase font-sans">
                Send to n8n
              </p>

              {/* Payload preview */}
              <details className="rounded-lg border border-border overflow-hidden text-xs font-mono">
                <summary className="cursor-pointer px-3 py-2 bg-secondary text-muted-foreground hover:text-foreground select-none font-sans">
                  Payload preview
                </summary>
                <pre className="px-3 py-3 overflow-x-auto whitespace-pre-wrap text-muted-foreground leading-relaxed bg-card max-h-48 overflow-y-auto">
                  {JSON.stringify(webhookPayload, null, 2)}
                </pre>
              </details>

              {/* Webhook URL input */}
              <div className="flex flex-col gap-2">
                <Input
                  className="h-9 text-sm font-sans"
                  placeholder="https://your-n8n.cloud/webhook/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <Button
                  onClick={handleSendWebhook}
                  disabled={!webhookUrl.trim() || webhookSending}
                  className="w-full rounded-lg font-sans font-medium flex items-center gap-2"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {webhookSending ? (
                    <><Loader2 size={15} className="animate-spin" /> Sending...</>
                  ) : (
                    <><Send size={15} /> Send to Webhook</>
                  )}
                </Button>
              </div>

              {/* Webhook response */}
              {webhookLog && (
                <div className="rounded-lg border border-border overflow-hidden text-xs font-mono">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary">
                    <span className={`font-bold px-1.5 py-0.5 rounded text-white ${webhookLog.status >= 200 && webhookLog.status < 300 ? "bg-green-600" : "bg-red-500"}`}>
                      {webhookLog.status || "ERR"}
                    </span>
                    <span className="font-sans font-semibold text-foreground">{webhookLog.label}</span>
                  </div>
                  <pre className="px-3 py-3 overflow-x-auto whitespace-pre-wrap text-muted-foreground leading-relaxed max-h-32 overflow-y-auto">
                    {webhookLog.responsePreview}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

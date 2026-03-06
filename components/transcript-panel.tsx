
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
  driveItemId?: string
  driveId?: string
  siteUrl?: string
  originalName?: string
}

export function TranscriptPanel() {
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
  const [extractError, setExtractError] = useState<string | null>(null)
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([])
  const transcriptRef = useRef<HTMLDivElement>(null)

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
    setPendingFile({ name: file.name, sizeKB: Math.round(file.size / 1024) || 6 })
    setMode("upload-confirm")
    e.target.value = ""
  }

  async function handleConfirm() {
    // Local file upload — no transcript extraction
    if (!pendingFile?.driveItemId) {
      setMode("done")
      setTranscriptLines([])
      return
    }

    if (!pendingFile.driveId || !pendingFile.siteUrl) {
      setExtractError("Missing driveId or siteUrl. Re-select the meeting from the dropdown.")
      setMode("error")
      return
    }

    setMode("extracting")
    setExtractError(null)
    setApiLogs([])
    setTranscriptLines([])

    const { driveItemId, driveId, siteUrl } = pendingFile

    try {
      // Proxy through our server route so the Bearer token is sent server-side
      // (browser cross-origin fetch with credentials:include is blocked by CORS wildcard)
      const res = await fetch("/api/extract-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl, driveId, itemId: driveItemId, token }),
      })

      const data = await res.json() as {
        lines?: TranscriptLine[]
        logs?: ApiLog[]
        error?: string
      }

      if (data.logs) setApiLogs(data.logs)

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Server error HTTP ${res.status}`)
      }

      setTranscriptLines(data.lines ?? [])
      setMode("done")

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to extract transcript."
      setExtractError(msg)
      setMode("error")
    }
  }

  function handleCancel() {
    setPendingFile(null)
    setMeetingQuery("")
    setRecordings([])
    setRecordingsError(null)
    setDropdownOpen(false)
    setTranscriptLines([])
    setExtractError(null)
    setApiLogs([])
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
              className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1"
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
        </div>
      )}
    </aside>
  )
}

"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileText, Upload, Video, X, CheckCircle, Loader2, ChevronDown } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { fetchRecordingFiles, type DriveItem } from "@/lib/graph"

type Mode = "idle" | "upload-confirm" | "meeting-search" | "confirmed"

interface PendingFile {
  name: string
  sizeKB: number
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

  // Fetch recordings when entering meeting-search mode
  useEffect(() => {
    if (mode !== "meeting-search") return
    if (!token) {
      setRecordingsError("No authentication token available.")
      return
    }

    setRecordingsLoading(true)
    setRecordingsError(null)
    console.log("[v0] TranscriptPanel: fetching recordings with token")

    fetchRecordingFiles(token)
      .then((files) => {
        console.log("[v0] TranscriptPanel: recordings loaded:", files.map((f) => f.name))
        setRecordings(files)
        setDropdownOpen(true)
      })
      .catch((err) => {
        console.error("[v0] TranscriptPanel: recordings fetch error:", err.message)
        setRecordingsError(err.message)
      })
      .finally(() => setRecordingsLoading(false))
  }, [mode, token])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile({ name: file.name, sizeKB: Math.round(file.size / 1024) || 6 })
    setMode("upload-confirm")
    e.target.value = ""
  }

  function handleConfirm() {
    setMode("confirmed")
  }

  function handleCancel() {
    setPendingFile(null)
    setMeetingQuery("")
    setRecordings([])
    setRecordingsError(null)
    setDropdownOpen(false)
    setMode("idle")
  }

  function handleMeetingSelect(item: DriveItem) {
    console.log("[v0] TranscriptPanel: meeting selected:", item.name)
    setPendingFile({ name: item.name, sizeKB: 0 })
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

          {/* Dropdown trigger */}
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
              {recordingsLoading
                ? <Loader2 size={15} className="animate-spin text-muted-foreground" />
                : <ChevronDown size={15} className="text-muted-foreground" />
              }
            </button>

            {/* Dropdown panel */}
            {dropdownOpen && !recordingsLoading && (
              <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {/* Search inside dropdown */}
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

      {/* CONFIRMED */}
      {mode === "confirmed" && pendingFile && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-sans text-foreground">
            <CheckCircle size={16} className="text-green-500 shrink-0" />
            <span>{pendingFile.name} selected successfully.</span>
          </div>
          <button
            onClick={handleCancel}
            className="text-xs text-muted-foreground hover:text-primary font-sans transition-colors text-left"
          >
            Choose a different transcript
          </button>
        </div>
      )}
    </aside>
  )
}

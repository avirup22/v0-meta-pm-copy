"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileText, Upload, Search, X, CheckCircle } from "lucide-react"

type Mode = "idle" | "upload-confirm" | "sharepoint-search" | "confirmed"

interface PendingFile {
  name: string
  sizeKB: number
}

export function TranscriptPanel() {
  const [mode, setMode] = useState<Mode>("idle")
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [sharepointQuery, setSharepointQuery] = useState("")
  const [sharepointResults] = useState([
    "meeting_transcript_jan.txt",
    "meeting_transcript_feb.txt",
    "project_kickoff_transcript.txt",
  ])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile({ name: file.name, sizeKB: Math.round(file.size / 1024) || 6 })
    setMode("upload-confirm")
    // reset input so same file can be re-selected
    e.target.value = ""
  }

  function handleConfirm() {
    setMode("confirmed")
  }

  function handleCancel() {
    setPendingFile(null)
    setMode("idle")
  }

  function handleSharepointSelect(name: string) {
    setPendingFile({ name, sizeKB: Math.round(Math.random() * 50 + 5) })
    setMode("upload-confirm")
  }

  return (
    <aside className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-5">
      <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase font-sans">
        Transcript
      </h3>

      {/* IDLE: action buttons */}
      {mode === "idle" && (
        <div className="flex flex-col gap-3">
          {/* Upload document */}
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

          {/* Search SharePoint */}
          <button
            onClick={() => setMode("sharepoint-search")}
            className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 text-sm font-sans text-foreground hover:bg-secondary transition-colors duration-150 text-left"
          >
            <Search size={16} className="text-primary shrink-0" />
            Search SharePoint
          </button>
        </div>
      )}

      {/* SHAREPOINT SEARCH */}
      {mode === "sharepoint-search" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              className="flex-1 h-9 text-sm font-sans"
              placeholder="Search SharePoint transcripts..."
              value={sharepointQuery}
              onChange={(e) => setSharepointQuery(e.target.value)}
              autoFocus
            />
            <button
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {sharepointResults
              .filter((r) =>
                r.toLowerCase().includes(sharepointQuery.toLowerCase())
              )
              .map((result) => (
                <li key={result}>
                  <button
                    onClick={() => handleSharepointSelect(result)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-sans text-foreground hover:bg-secondary transition-colors duration-150 text-left"
                  >
                    <FileText size={15} className="text-muted-foreground shrink-0" />
                    {result}
                  </button>
                </li>
              ))}
          </ul>
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
              <span className="text-xs text-muted-foreground font-sans">
                ({pendingFile.sizeKB} KB)
              </span>
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
            <span>{pendingFile.name} uploaded successfully.</span>
          </div>
          <button
            onClick={handleCancel}
            className="text-xs text-muted-foreground hover:text-primary font-sans transition-colors text-left"
          >
            Upload another transcript
          </button>
        </div>
      )}
    </aside>
  )
}

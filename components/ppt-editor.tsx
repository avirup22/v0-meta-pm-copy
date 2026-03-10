"use client"

import { useState } from "react"
import JSZip from "jszip"
import { Presentation, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { fetchFileAsArrayBuffer, getDriveItemByPath } from "@/lib/graph"

interface PptEditorProps {
  /** The OneDrive folder ID of the project (meta_pm folder) */
  projectFolderId: string
  projectName: string
}

type Status = "idle" | "searching" | "editing" | "ready" | "error"

/**
 * Replace the text content of every <a:t> run inside any shape whose
 * <p:sp><p:nvSpPr><p:cNvPr name="Project Scope"> matches.
 * Falls back to searching all text nodes for the literal string "Project Scope".
 */
function editPptxProjectScope(xmlContent: string, newText: string): string {
  // Strategy 1: find the shape by its cNvPr name attribute (exact name match)
  const shapeRegex = /<p:sp\b[^>]*>[\s\S]*?<p:cNvPr[^>]*\bname=["']Project Scope["'][^>]*>[\s\S]*?<\/p:sp>/g
  let found = false

  const result = xmlContent.replace(shapeRegex, (shapeXml) => {
    found = true
    // Replace all <a:t>...</a:t> text runs inside this shape with the new text,
    // collapsing them into a single run so we don't get partial replacements.
    const firstRun = shapeXml.replace(/<a:r\b[\s\S]*?<\/a:r>/g, (run, offset, full) => {
      // Only keep the first run, replace its <a:t> content
      if (!found) return run // should never hit, just safety
      found = false // use as "first run already replaced" flag
      return run.replace(/<a:t>[^<]*<\/a:t>/, `<a:t>${newText}</a:t>`)
    })
    // Remove any remaining runs (they would be duplicates)
    return firstRun.replace(/<a:r\b[\s\S]*?<\/a:r>/g, (run) => {
      // If this run still has <a:t> it means first pass didn't get it yet
      if (/<a:t>/.test(run)) return run.replace(/<a:t>[^<]*<\/a:t>/, `<a:t>${newText}</a:t>`)
      return ""
    })
  })

  if (result !== xmlContent) return result

  // Strategy 2: fallback — replace the literal text "Project Scope" inside any <a:t>
  return xmlContent.replace(/<a:t>([^<]*Project Scope[^<]*)<\/a:t>/g, `<a:t>${newText}</a:t>`)
}

// Fixed path to the global template in the MetaPM root folder
const TEMPLATE_PATH = "MetaPM/template.pptx"

export function PptEditor({ projectFolderId, projectName }: PptEditorProps) {
  const { token } = useAuth()
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [pptxName, setPptxName] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [shapesFound, setShapesFound] = useState<string[]>([])

  async function handleEdit() {
    if (!token) return
    setStatus("searching")
    setError(null)
    setDownloadUrl(null)
    setPptxName(null)

    try {
      // Resolve the template by its fixed global path: MetaPM/template.pptx
      const templateItem = await getDriveItemByPath(token, TEMPLATE_PATH)
      setPptxName(templateItem.name)
      setStatus("editing")

      // Download the template as binary
      const buffer = await fetchFileAsArrayBuffer(token, templateItem.id)

      // Unzip
      const zip = await JSZip.loadAsync(buffer)

      // Find all slide XML files and edit shapes named "Project Scope"
      const slideFiles = Object.keys(zip.files).filter((f) => /ppt\/slides\/slide\d+\.xml$/.test(f))
      const found: string[] = []

      for (const slidePath of slideFiles) {
        let xml = await zip.files[slidePath].async("string")
        const before = xml

        // Track which slides had changes
        const edited = editPptxProjectScope(xml, "hello world")
        if (edited !== before) {
          found.push(slidePath)
          zip.file(slidePath, edited)
        }
      }

      setShapesFound(found)

      // Re-zip and create a blob URL for download
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      setStatus("ready")
    } catch (err) {
      console.error("[v0] PptEditor error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
      setStatus("error")
    }
  }

  function handleDownload() {
    if (!downloadUrl || !pptxName) return
    const a = document.createElement("a")
    a.href = downloadUrl
    a.download = pptxName.replace(".pptx", "_edited.pptx")
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--primary)" }}>
          <Presentation size={18} className="text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground font-sans">PPT Template Editor</p>
          <p className="text-xs text-muted-foreground font-sans">
            Edits &quot;Project Scope&quot; in the project template
          </p>
        </div>
      </div>

      {status === "idle" && (
        <button
          onClick={handleEdit}
          className="w-full px-4 py-2 text-sm font-sans font-semibold text-primary-foreground rounded-lg transition-colors flex items-center justify-center gap-2"
          style={{ background: "var(--primary)" }}
        >
          <Presentation size={14} strokeWidth={2} />
          Edit Template
        </button>
      )}

      {(status === "searching" || status === "editing") && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary text-sm font-sans text-muted-foreground">
          <Loader2 size={16} className="animate-spin shrink-0 text-primary" />
          {status === "searching" ? "Locating PPTX in project folder…" : `Editing ${pptxName}…`}
        </div>
      )}

      {status === "ready" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-foreground font-sans">{pptxName}</p>
              <p className="text-xs text-muted-foreground font-sans">
                {shapesFound.length > 0
                  ? `"Project Scope" updated on ${shapesFound.length} slide(s)`
                  : 'No shape named "Project Scope" found — file unchanged'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 px-4 py-2 text-sm font-sans font-semibold text-primary-foreground rounded-lg transition-colors flex items-center justify-center gap-2"
              style={{ background: "var(--primary)" }}
            >
              <Download size={14} strokeWidth={2} />
              Download Edited PPT
            </button>
            <button
              onClick={() => { setStatus("idle"); setDownloadUrl(null); setShapesFound([]) }}
              className="px-4 py-2 text-sm font-sans text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-600 font-sans">{error}</p>
          </div>
          <button
            onClick={() => setStatus("idle")}
            className="px-4 py-2 text-sm font-sans text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}

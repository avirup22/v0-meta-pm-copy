"use client"

import { use, useState } from "react"
import Link from "next/link"
import {
  FileSpreadsheet,
  FileText,
  Presentation,
  ChevronRight,
  Sparkles,
  Download,
  Eye,
  Clock,
  CheckCircle2,
  Loader2,
  Send,
  RefreshCw,
  FolderOpen,
  Zap,
  TrendingUp,
  BarChart3,
  BookOpen,
  CalendarRange,
  ListChecks,
  Plus,
  Pencil,
  AlertTriangle,
  X,
} from "lucide-react"
import { generateRACIFromSOW } from "@/lib/graph"

interface PageProps {
  params: Promise<{ slug: string }>
}

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// Document template definitions
const DOC_TEMPLATES = [
  {
    id: "excel-timeline",
    label: "Excel Timeline",
    description: "Auto-generates a Gantt-style project timeline from your milestones and sprint data.",
    icon: CalendarRange,
    color: "oklch(0.55 0.22 150)",
    bg: "color-mix(in oklch, oklch(0.55 0.22 150) 8%, white)",
    border: "color-mix(in oklch, oklch(0.55 0.22 150) 22%, transparent)",
    type: "xlsx",
    category: "Excel",
  },
  {
    id: "excel-sprint",
    label: "Excel Sprint Plan",
    description: "Structured sprint backlog with task assignments, story points, and velocity tracking.",
    icon: ListChecks,
    color: "oklch(0.58 0.30 293)",
    bg: "color-mix(in oklch, oklch(0.58 0.30 293) 8%, white)",
    border: "color-mix(in oklch, oklch(0.58 0.30 293) 22%, transparent)",
    type: "xlsx",
    category: "Excel",
  },
  {
    id: "word-frd",
    label: "Word FRD",
    description: "Functional Requirements Document — pre-filled with project scope, stakeholders, and features.",
    icon: BookOpen,
    color: "oklch(0.56 0.25 240)",
    bg: "color-mix(in oklch, oklch(0.56 0.25 240) 8%, white)",
    border: "color-mix(in oklch, oklch(0.56 0.25 240) 22%, transparent)",
    type: "docx",
    category: "Word",
  },
  {
    id: "kickoff-ppt",
    label: "Kickoff Presentation",
    description: "Executive-ready PPT with project overview, objectives, team, timeline, and risks.",
    icon: Presentation,
    color: "oklch(0.70 0.20 35)",
    bg: "color-mix(in oklch, oklch(0.70 0.20 35) 8%, white)",
    border: "color-mix(in oklch, oklch(0.70 0.20 35) 22%, transparent)",
    type: "pptx",
    category: "PowerPoint",
  },
  {
    id: "weekly-ppt",
    label: "Weekly Update PPT",
    description: "Stakeholder update deck with progress, blockers, decisions, and next steps this week.",
    icon: BarChart3,
    color: "oklch(0.63 0.20 195)",
    bg: "color-mix(in oklch, oklch(0.63 0.20 195) 8%, white)",
    border: "color-mix(in oklch, oklch(0.63 0.20 195) 22%, transparent)",
    type: "pptx",
    category: "PowerPoint",
  },
  {
    id: "weekly-word",
    label: "Weekly Update Report",
    description: "Formatted Word report summarising meeting outcomes, actions, and KPIs for the week.",
    icon: FileText,
    color: "oklch(0.62 0.24 15)",
    bg: "color-mix(in oklch, oklch(0.62 0.24 15) 8%, white)",
    border: "color-mix(in oklch, oklch(0.62 0.24 15) 22%, transparent)",
    type: "docx",
    category: "Word",
  },
]

type GenerationStatus = "idle" | "thinking" | "generating" | "done" | "error"

interface GeneratedDoc {
  id: string
  templateId: string
  label: string
  type: string
  color: string
  generatedAt: string
  size: string
}

// Simulated library of generated docs
const MOCK_LIBRARY: GeneratedDoc[] = [
  { id: "d1", templateId: "kickoff-ppt", label: "Kickoff Presentation", type: "pptx", color: "oklch(0.70 0.20 35)", generatedAt: "11 Mar 2026", size: "2.4 MB" },
  { id: "d2", templateId: "excel-timeline", label: "Excel Timeline", type: "xlsx", color: "oklch(0.55 0.22 150)", generatedAt: "10 Mar 2026", size: "340 KB" },
  { id: "d3", templateId: "word-frd", label: "Word FRD", type: "docx", color: "oklch(0.56 0.25 240)", generatedAt: "8 Mar 2026", size: "1.1 MB" },
  { id: "d4", templateId: "weekly-ppt", label: "Weekly Update PPT", type: "pptx", color: "oklch(0.63 0.20 195)", generatedAt: "7 Mar 2026", size: "1.8 MB" },
]

const TYPE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  xlsx: { label: "XLSX", color: "oklch(0.28 0.12 145)", bg: "oklch(0.92 0.10 145)" },
  docx: { label: "DOCX", color: "oklch(0.26 0.08 240)", bg: "oklch(0.93 0.07 240)" },
  pptx: { label: "PPTX", color: "oklch(0.36 0.14 30)", bg: "oklch(0.94 0.08 35)" },
}

const AI_SUGGESTIONS = [
  "Generate a sprint plan for the next 2 weeks",
  "Create a weekly update for Monday's standup",
  "Build a risk register for the FRD",
  "Draft an executive summary slide",
]

export default function DocumentsPage({ params }: PageProps) {
  const { slug } = use(params)
  const projectName = slugToTitle(slug)

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [status, setStatus] = useState<GenerationStatus>("idle")
  const [aiPrompt, setAiPrompt] = useState("")
  const [library, setLibrary] = useState<GeneratedDoc[]>(MOCK_LIBRARY)
  const [activeTab, setActiveTab] = useState<"generate" | "library">("generate")
  const [thinkingText, setThinkingText] = useState("")
  const [showRACIModal, setShowRACIModal] = useState(false)

  const template = DOC_TEMPLATES.find((t) => t.id === selectedTemplate)

  const stats = {
    total: library.length,
    xlsx: library.filter((d) => d.type === "xlsx").length,
    docx: library.filter((d) => d.type === "docx").length,
    pptx: library.filter((d) => d.type === "pptx").length,
  }

  async function handleGenerate() {
    if (!selectedTemplate) return
    const tmpl = DOC_TEMPLATES.find((t) => t.id === selectedTemplate)!

    setStatus("thinking")
    setThinkingText("Analysing project data...")
    await delay(900)
    setThinkingText("Structuring document outline...")
    await delay(800)
    setThinkingText("Populating with project context...")
    setStatus("generating")
    await delay(1200)

    const newDoc: GeneratedDoc = {
      id: `d${Date.now()}`,
      templateId: tmpl.id,
      label: tmpl.label,
      type: tmpl.type,
      color: tmpl.color,
      generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      size: `${(Math.random() * 2.5 + 0.3).toFixed(1)} MB`,
    }
    setLibrary((prev) => [newDoc, ...prev])
    setStatus("done")
    await delay(2000)
    setStatus("idle")
    setSelectedTemplate(null)
    setActiveTab("library")
  }

  function delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms))
  }

  const isGenerating = status === "thinking" || status === "generating"

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Page header */}
      <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-sans text-muted-foreground">
          <Link href="/projects" className="hover:text-primary transition-colors font-medium">Projects</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <Link href={`/projects/${slug}`} className="hover:text-primary transition-colors font-medium">{projectName}</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <span className="text-foreground font-semibold">Documents</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRACIModal(true)}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all border border-border hover:bg-secondary"
            style={{ color: "var(--muted-foreground)" }}
          >
            <BarChart3 size={11} />
            Create RACI
          </button>
          <button
            onClick={() => setActiveTab("generate")}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: activeTab === "generate" ? "var(--primary)" : "transparent",
              color: activeTab === "generate" ? "white" : "var(--muted-foreground)",
              border: activeTab === "generate" ? "none" : "1px solid var(--border)",
            }}
          >
            <Sparkles size={11} />
            Generate
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: activeTab === "library" ? "var(--primary)" : "transparent",
              color: activeTab === "library" ? "white" : "var(--muted-foreground)",
              border: activeTab === "library" ? "none" : "1px solid var(--border)",
            }}
          >
            <FolderOpen size={11} />
            Library ({stats.total})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── GENERATE TAB ── */}
        {activeTab === "generate" && (
          <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total Docs", value: stats.total, icon: FileText, color: "oklch(0.58 0.30 293)" },
                { label: "Spreadsheets", value: stats.xlsx, icon: FileSpreadsheet, color: "oklch(0.55 0.22 150)" },
                { label: "Word Docs", value: stats.docx, icon: BookOpen, color: "oklch(0.56 0.25 240)" },
                { label: "Presentations", value: stats.pptx, icon: Presentation, color: "oklch(0.70 0.20 35)" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border bg-card p-4 flex items-center gap-3"
                  style={{ borderColor: `color-mix(in oklch, ${s.color} 20%, transparent)` }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `color-mix(in oklch, ${s.color} 12%, white)` }}>
                    <s.icon size={15} style={{ color: s.color }} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-xl font-black text-foreground leading-none">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground font-sans mt-0.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Generate section */}
            <div className="rounded-2xl border overflow-hidden relative"
              style={{
                background: "color-mix(in oklch, oklch(0.58 0.30 293) 5%, white)",
                borderColor: "color-mix(in oklch, oklch(0.58 0.30 293) 20%, transparent)",
              }}>
              {/* Bubble */}
              <div className="absolute top-0 right-0 w-28 h-28 -translate-y-8 translate-x-8 rounded-full opacity-20"
                style={{ background: "oklch(0.58 0.30 293)" }} />

              <div className="p-5 relative">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                    style={{ background: "oklch(0.58 0.30 293)" }}>
                    <Sparkles size={14} color="white" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground font-sans tracking-tight">MetaPM Document AI</p>
                    <p className="text-[10px] text-muted-foreground font-sans">Powered by your project data</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: "oklch(0.58 0.30 293)", color: "white" }}>
                    <Zap size={9} strokeWidth={2.5} />
                    AI
                  </div>
                </div>

                {/* Prompt input */}
                <div className="flex items-center gap-2 bg-white rounded-xl border px-3 py-2.5 mb-3"
                  style={{ borderColor: "color-mix(in oklch, oklch(0.58 0.30 293) 25%, transparent)" }}>
                  <Sparkles size={13} style={{ color: "oklch(0.58 0.30 293)" }} strokeWidth={2} />
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Tell me what to generate... e.g. &quot;Sprint plan for backend phase&quot;"
                    className="flex-1 text-xs font-sans bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Send prompt"
                  >
                    <Send size={13} strokeWidth={2} />
                  </button>
                </div>

                {/* Quick suggestions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {AI_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setAiPrompt(s)}
                      className="text-[10px] font-sans font-medium px-2.5 py-1 rounded-full border bg-white hover:bg-secondary transition-colors"
                      style={{
                        color: "oklch(0.58 0.30 293)",
                        borderColor: "color-mix(in oklch, oklch(0.58 0.30 293) 25%, transparent)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Template grid */}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground mb-3">
                Choose a template
              </p>
              <div className="grid grid-cols-3 gap-3">
                {DOC_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplate === tmpl.id
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(isSelected ? null : tmpl.id)}
                      className="rounded-xl border p-4 text-left flex flex-col gap-3 transition-all duration-150 relative overflow-hidden group"
                      style={{
                        background: isSelected ? tmpl.bg : "var(--card)",
                        borderColor: isSelected
                          ? tmpl.color
                          : "var(--border)",
                        boxShadow: isSelected ? `0 0 0 2px ${tmpl.color}30` : "none",
                        transform: isSelected ? "scale(1.01)" : "scale(1)",
                      }}
                    >
                      {/* type badge */}
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: isSelected ? tmpl.color : `color-mix(in oklch, ${tmpl.color} 12%, white)` }}>
                          <tmpl.icon size={15} color={isSelected ? "white" : tmpl.color} strokeWidth={2} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={TYPE_BADGE[tmpl.type]
                            ? { color: TYPE_BADGE[tmpl.type].color, background: TYPE_BADGE[tmpl.type].bg }
                            : {}}>
                          {tmpl.type.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground font-sans">{tmpl.label}</p>
                        <p className="text-[10px] text-muted-foreground font-sans mt-0.5 leading-relaxed">{tmpl.description}</p>
                      </div>

                      {/* selected checkmark */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: tmpl.color }}>
                          <CheckCircle2 size={10} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Generate button */}
            {selectedTemplate && (
              <div className="sticky bottom-0 bg-background/90 backdrop-blur-sm border-t border-border -mx-6 px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {isGenerating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" style={{ color: template?.color }} />
                      <span className="text-xs font-sans text-muted-foreground">{thinkingText}</span>
                    </>
                  ) : status === "done" ? (
                    <>
                      <CheckCircle2 size={14} style={{ color: "oklch(0.55 0.22 150)" }} />
                      <span className="text-xs font-sans font-medium" style={{ color: "oklch(0.55 0.22 150)" }}>Document generated successfully</span>
                    </>
                  ) : (
                    <span className="text-xs font-sans text-muted-foreground">
                      Selected: <span className="text-foreground font-semibold">{template?.label}</span>
                    </span>
                  )}
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-60"
                  style={{
                    background: template?.color ?? "var(--primary)",
                    boxShadow: `0 4px 16px -4px ${template?.color ?? "var(--primary)"}60`,
                  }}
                >
                  {isGenerating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} strokeWidth={2.5} />
                  )}
                  {isGenerating ? "Generating..." : `Generate ${template?.label}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── LIBRARY TAB ── */}
        {activeTab === "library" && (
          <div className="p-6 flex flex-col gap-5 max-w-5xl mx-auto">

            {/* Quick stats row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total Docs", value: stats.total, icon: FileText, color: "oklch(0.58 0.30 293)" },
                { label: "Spreadsheets", value: stats.xlsx, icon: FileSpreadsheet, color: "oklch(0.55 0.22 150)" },
                { label: "Word Docs", value: stats.docx, icon: BookOpen, color: "oklch(0.56 0.25 240)" },
                { label: "Presentations", value: stats.pptx, icon: Presentation, color: "oklch(0.70 0.20 35)" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border bg-card p-4 flex items-center gap-3"
                  style={{ borderColor: `color-mix(in oklch, ${s.color} 20%, transparent)` }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `color-mix(in oklch, ${s.color} 12%, white)` }}>
                    <s.icon size={15} style={{ color: s.color }} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-xl font-black text-foreground leading-none">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground font-sans mt-0.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Library list */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">All Documents</p>
                <button
                  onClick={() => setActiveTab("generate")}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90"
                  style={{ background: "var(--primary)" }}
                >
                  <Sparkles size={11} strokeWidth={2.5} />
                  Generate New
                </button>
              </div>

              {library.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FolderOpen size={32} className="text-muted-foreground/30" />
                  <p className="text-sm font-sans text-muted-foreground">No documents generated yet</p>
                  <button
                    onClick={() => setActiveTab("generate")}
                    className="text-xs font-semibold text-primary hover:underline font-sans"
                  >
                    Generate your first document
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {library.map((doc) => {
                    const badge = TYPE_BADGE[doc.type]
                    return (
                      <li key={doc.id}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors group"
                      >
                        {/* Icon */}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `color-mix(in oklch, ${doc.color} 12%, white)` }}>
                          {doc.type === "xlsx" && <FileSpreadsheet size={16} style={{ color: doc.color }} strokeWidth={2} />}
                          {doc.type === "docx" && <BookOpen size={16} style={{ color: doc.color }} strokeWidth={2} />}
                          {doc.type === "pptx" && <Presentation size={16} style={{ color: doc.color }} strokeWidth={2} />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground font-sans truncate">{doc.label}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Clock size={10} className="text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground font-sans">{doc.generatedAt}</span>
                            <span className="text-[10px] text-muted-foreground font-sans">&middot; {doc.size}</span>
                          </div>
                        </div>

                        {/* Type badge */}
                        {badge && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0"
                            style={{ color: badge.color, background: badge.bg }}>
                            {badge.label}
                          </span>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors" aria-label="Preview">
                            <Eye size={13} className="text-muted-foreground" />
                          </button>
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors" aria-label="Download">
                            <Download size={13} className="text-muted-foreground" />
                          </button>
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors" aria-label="Regenerate">
                            <RefreshCw size={13} className="text-muted-foreground" />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* RACI Modal */}
      {showRACIModal && <RACIModal onClose={() => setShowRACIModal(false)} />}
    </div>
  )
}

// ─── RACI Modal Component ──────────────────────────────────────────────────────

// Dynamic row: task + responsibility + arbitrary stakeholder keys
type RACIRow = Record<string, string>

const RACI_BADGE_COLORS: Record<string, string> = {
  R: "oklch(0.55 0.26 25)",
  A: "oklch(0.55 0.22 50)",
  C: "oklch(0.65 0.20 55)",
  I: "oklch(0.55 0.20 240)",
}

function RACIModal({ onClose }: { onClose: () => void }) {
  const [sowText, setSowText]         = useState("")
  const [raciRows, setRACIRows]       = useState<RACIRow[]>([])
  const [stakeholders, setStakeholders] = useState<string[]>([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [step, setStep]               = useState<"input" | "view">("input")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft]     = useState<RACIRow | null>(null)

  const RACI_COLOR = "oklch(0.65 0.20 55)"

  async function handleGenerate() {
    if (!sowText.trim()) { setError("Please enter SOW text"); return }
    setLoading(true)
    setError(null)
    try {
      const raw = await generateRACIFromSOW(sowText)
      // Normalise response shapes:
      // [{ output: { raci_matrix: [] } }]  ← actual webhook shape
      // { output: { raci_matrix: [] } }
      // { rows: [] }
      // [] direct array
      let matrix: RACIRow[] = []
      if (Array.isArray(raw)) {
        const first = (raw as any[])[0]
        if (first?.output?.raci_matrix) {
          matrix = first.output.raci_matrix as RACIRow[]
        } else {
          matrix = raw as RACIRow[]
        }
      } else if (Array.isArray((raw as any)?.output?.raci_matrix)) {
        matrix = (raw as any).output.raci_matrix as RACIRow[]
      } else if (Array.isArray((raw as any)?.rows)) {
        matrix = (raw as any).rows as RACIRow[]
      }
      if (matrix.length === 0) throw new Error("No RACI data returned. Check your SOW input.")
      // Collect stakeholder columns across ALL rows (some rows omit certain keys)
      const colSet = new Set<string>()
      matrix.forEach(r => Object.keys(r).forEach(k => { if (k !== "task" && k !== "responsibility") colSet.add(k) }))
      const cols = Array.from(colSet)
      setStakeholders(cols)
      setRACIRows(matrix)
      setStep("view")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate RACI")
    } finally {
      setLoading(false)
    }
  }

  function startEdit(i: number) { setEditingIndex(i); setEditDraft({ ...raciRows[i] }) }
  function saveEdit() {
    if (editingIndex !== null && editDraft) {
      const updated = [...raciRows]; updated[editingIndex] = editDraft
      setRACIRows(updated); setEditingIndex(null); setEditDraft(null)
    }
  }
  function addRow() {
    const blank: RACIRow = { task: "", responsibility: "" }
    stakeholders.forEach(s => { blank[s] = "" })
    setRACIRows([...raciRows, blank])
  }
  function deleteRow(i: number) { setRACIRows(raciRows.filter((_, idx) => idx !== i)) }

  // Group rows by task for merged cells
  const tasks = Array.from(new Set(raciRows.map(r => r.task || "")))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-6xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0"
          style={{ background: `color-mix(in oklch, ${RACI_COLOR} 5%, white)` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: RACI_COLOR }}>
              <BarChart3 size={16} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground font-sans">Create RACI Matrix</p>
              <p className="text-[10px] text-muted-foreground font-sans">From Scope of Work</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-secondary"
            style={{ color: "var(--muted-foreground)" }}>
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {step === "input" ? (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-foreground font-sans">Scope of Work (SOW)</label>
                <p className="text-[10px] text-muted-foreground font-sans mb-2">
                  Paste your project SOW or description. AI will extract activities and map RACI responsibilities.
                </p>
                <textarea value={sowText} onChange={(e) => setSowText(e.target.value)}
                  placeholder="Paste your Scope of Work here..."
                  rows={10}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow resize-none" />
              </div>
              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs font-sans"
                  style={{ background: "color-mix(in oklch, oklch(0.60 0.26 25) 8%, white)", borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 25%, transparent)", color: "oklch(0.55 0.26 25)" }}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />{error}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold font-sans border border-border transition-all hover:bg-secondary" style={{ color: "var(--muted-foreground)" }}>
                  Cancel
                </button>
                <button onClick={handleGenerate} disabled={loading}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold font-sans text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: RACI_COLOR }}>
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} strokeWidth={2.5} />}
                  {loading ? "Generating..." : "Generate RACI"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground font-sans">RACI Matrix</h3>
                  <p className="text-[10px] text-muted-foreground font-sans">{raciRows.length} responsibilities across {tasks.length} tasks</p>
                </div>
                <button onClick={addRow}
                  className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90"
                  style={{ background: RACI_COLOR }}>
                  <Plus size={11} strokeWidth={2.5} /> Add Row
                </button>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-3 py-2 rounded-lg border border-border text-[10px] font-sans flex-wrap">
                <span className="font-bold text-foreground">Legend:</span>
                {Object.entries(RACI_BADGE_COLORS).map(([letter, color]) => (
                  <div key={letter} className="flex items-center gap-1.5">
                    <span className="inline-block w-5 h-5 rounded text-center font-bold text-white text-[9px] leading-5" style={{ background: color }}>{letter}</span>
                    <span className="text-muted-foreground">{letter === "R" ? "Responsible" : letter === "A" ? "Accountable" : letter === "C" ? "Consulted" : "Informed"}</span>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs font-sans border-collapse bg-white">
                  <thead>
                    <tr style={{ background: `color-mix(in oklch, ${RACI_COLOR} 8%, white)` }}>
                      <th className="px-4 py-2.5 text-left font-bold text-foreground border-b border-r border-border min-w-[130px]">Task</th>
                      <th className="px-4 py-2.5 text-left font-bold text-foreground border-b border-r border-border min-w-[200px]">Responsibility</th>
                      {stakeholders.map(s => (
                        <th key={s} className="px-4 py-2.5 text-center font-bold text-foreground border-b border-r border-border min-w-[90px]">{s}</th>
                      ))}
                      <th className="px-4 py-2.5 text-center font-bold text-foreground border-b border-border w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const renderedTasks = new Set<string>()
                      return raciRows.map((row, i) => {
                        const task = row.task || ""
                        const taskCount = raciRows.filter(r => r.task === task).length
                        const showTaskCell = !renderedTasks.has(task)
                        if (showTaskCell) renderedTasks.add(task)
                        const isEditing = editingIndex === i

                        return (
                          <tr key={i} className="border-b border-border hover:bg-muted/20 transition-colors group">
                            {showTaskCell && (
                              <td rowSpan={taskCount} className="px-4 py-2 font-semibold text-foreground border-r border-border align-top bg-muted/10">
                                {isEditing
                                  ? <input type="text" value={editDraft?.task ?? ""} onChange={e => setEditDraft({ ...editDraft!, task: e.target.value })} className="w-full px-2 py-1 rounded border border-border text-[10px] focus:outline-none focus:ring-1" />
                                  : task
                                }
                              </td>
                            )}
                            <td className="px-4 py-2 text-foreground border-r border-border">
                              {isEditing
                                ? <input type="text" value={editDraft?.responsibility ?? ""} onChange={e => setEditDraft({ ...editDraft!, responsibility: e.target.value })} className="w-full px-2 py-1 rounded border border-border text-[10px] focus:outline-none focus:ring-1" />
                                : row.responsibility
                              }
                            </td>
                            {stakeholders.map(s => {
                              const val = isEditing ? (editDraft?.[s] ?? "") : (row[s] ?? "")
                              // values can be comma-separated e.g. "R,A" or "C,I"
                              const letters = val ? val.split(",").map(v => v.trim().toUpperCase()).filter(Boolean) : []
                              return (
                                <td key={s} className="px-4 py-2 text-center border-r border-border">
                                  {isEditing
                                    ? <input type="text" value={val} onChange={e => setEditDraft({ ...editDraft!, [s]: e.target.value.toUpperCase() })} placeholder="R,A" className="w-14 px-2 py-1 rounded border border-border text-[10px] font-bold text-center uppercase focus:outline-none focus:ring-1 mx-auto block" />
                                    : letters.length > 0
                                      ? <div className="flex items-center justify-center gap-0.5 flex-wrap">
                                          {letters.map((letter, li) => (
                                            <span key={li} className="inline-block w-5 h-5 rounded text-center font-bold text-white text-[9px] leading-5"
                                              style={{ background: RACI_BADGE_COLORS[letter] ?? "var(--muted-foreground)" }}>
                                              {letter}
                                            </span>
                                          ))}
                                        </div>
                                      : <span className="text-muted-foreground">—</span>
                                  }
                                </td>
                              )
                            })}
                            <td className="px-4 py-2">
                              <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {isEditing ? (
                                  <>
                                    <button onClick={saveEdit} className="text-[9px] font-bold px-2 py-1 rounded text-white" style={{ background: RACI_COLOR }}>Save</button>
                                    <button onClick={() => setEditingIndex(null)} className="text-[9px] font-bold px-2 py-1 rounded border border-border text-muted-foreground">Cancel</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => startEdit(i)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-secondary" title="Edit">
                                      <Pencil size={11} className="text-muted-foreground" strokeWidth={2} />
                                    </button>
                                    <button onClick={() => deleteRow(i)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50" title="Delete">
                                      <X size={11} className="text-red-500" strokeWidth={2.5} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setStep("input")} className="px-4 py-2 rounded-lg text-xs font-semibold font-sans border border-border transition-all hover:bg-secondary" style={{ color: "var(--muted-foreground)" }}>
                  Back
                </button>
                <button onClick={onClose} className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold font-sans text-white transition-all hover:opacity-90" style={{ background: RACI_COLOR }}>
                  <CheckCircle2 size={12} strokeWidth={2.5} /> Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

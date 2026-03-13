"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { generateRACIFromSOW } from "@/lib/graph"
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

interface PageProps {
  params: Promise<{ slug: string }>
}

interface RACIMatrixRow {
  task: string
  responsibility: string
  [stakeholder: string]: string
}

export default function DocumentsPage({ params }: PageProps) {
  const { slug } = use(params)
  const { token, user } = useAuth()
  const [showRACIModal, setShowRACIModal] = useState(false)

  if (!token || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${slug}`}>
            <span className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {slug}
            </span>
          </Link>
          <ChevronRight size={14} className="text-muted-foreground" />
          <h1 className="text-xl font-black text-foreground font-sans">Documents</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6">
        {/* RACI Creation Card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                <BarChart3 size={20} className="text-orange-600 dark:text-orange-400" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Create RACI Matrix</h2>
                <p className="text-xs text-muted-foreground">Generate from Scope of Work</p>
              </div>
            </div>
            <button
              onClick={() => setShowRACIModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
            >
              <Plus size={14} strokeWidth={2.5} />
              Create
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Paste your project Scope of Work and let AI extract activities and map RACI responsibilities across your team members.
          </p>
        </div>
      </div>

      {/* RACI Modal */}
      {showRACIModal && <RACIModal onClose={() => setShowRACIModal(false)} />}
    </div>
  )
}

// ─── RACI Modal Component ──────────────────────────────────────────────────────

function RACIModal({ onClose }: { onClose: () => void }) {
  const [sowText, setSowText] = useState("")
  const [raciRows, setRACIRows] = useState<RACIMatrixRow[]>([])
  const [stakeholders, setStakeholders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"input" | "view">("input")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<RACIMatrixRow | null>(null)

  async function handleGenerate() {
    if (!sowText.trim()) {
      setError("Please enter SOW text")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await generateRACIFromSOW(sowText)
      const rows = result.output.raci_matrix

      // Extract dynamic stakeholder column names
      const stakeholderCols = rows.length > 0 
        ? Object.keys(rows[0]).filter(k => k !== 'task' && k !== 'responsibility')
        : []

      setRACIRows(rows)
      setStakeholders(stakeholderCols)
      setStep("view")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate RACI")
    } finally {
      setLoading(false)
    }
  }

  function startEdit(index: number) {
    setEditingIndex(index)
    setEditDraft({ ...raciRows[index] })
  }

  function saveEdit() {
    if (editingIndex !== null && editDraft) {
      const updated = [...raciRows]
      updated[editingIndex] = editDraft
      setRACIRows(updated)
      setEditingIndex(null)
      setEditDraft(null)
    }
  }

  function addRow() {
    const newRow: RACIMatrixRow = { task: "", responsibility: "" }
    stakeholders.forEach(s => { newRow[s] = "" })
    setRACIRows([...raciRows, newRow])
  }

  function deleteRow(index: number) {
    setRACIRows(raciRows.filter((_, i) => i !== index))
  }

  const RACI_COLOR = "oklch(0.65 0.20 55)"
  const raciColors: Record<string, string> = {
    "R": "oklch(0.55 0.26 25)",
    "A": "oklch(0.60 0.20 25)",
    "C": "oklch(0.65 0.20 55)",
    "I": "oklch(0.55 0.20 240)",
  }

  const groupedByTask = raciRows.reduce((acc, row, idx) => {
    const task = row.task || "Ungrouped"
    if (!acc[task]) acc[task] = []
    acc[task].push({ ...row, _index: idx })
    return acc
  }, {} as Record<string, (RACIMatrixRow & { _index: number })[]>)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-6xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0" style={{ background: `color-mix(in oklch, ${RACI_COLOR} 5%, white)` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: RACI_COLOR }}>
              <BarChart3 size={16} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground font-sans">Create RACI Matrix</p>
              <p className="text-xs text-muted-foreground font-sans">From Scope of Work</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-secondary"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {step === "input" ? (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-foreground font-sans">Scope of Work (SOW)</label>
                <p className="text-xs text-muted-foreground font-sans mb-2">Paste your project SOW. The AI will extract activities and map RACI responsibilities.</p>
                <textarea
                  value={sowText}
                  onChange={(e) => setSowText(e.target.value)}
                  placeholder="Paste your Scope of Work here..."
                  rows={10}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow resize-none"
                  style={{ "--tw-ring-color": `color-mix(in oklch, ${RACI_COLOR} 40%, transparent)` } as React.CSSProperties}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs font-sans" style={{ background: "color-mix(in oklch, oklch(0.60 0.26 25) 8%, white)", borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 25%, transparent)", color: "oklch(0.55 0.26 25)" }}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-semibold font-sans border border-border transition-all hover:bg-secondary"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold font-sans text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: RACI_COLOR }}
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} strokeWidth={2.5} />}
                  {loading ? "Generating..." : "Generate RACI"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-foreground font-sans">RACI Matrix ({raciRows?.length || 0} items)</h3>
                <button
                  onClick={addRow}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90"
                  style={{ background: RACI_COLOR }}
                >
                  <Plus size={11} strokeWidth={2.5} />
                  Add Row
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border bg-white">
                <table className="w-full text-xs font-sans border-collapse">
                  <thead>
                    <tr style={{ background: `color-mix(in oklch, ${RACI_COLOR} 8%, white)` }}>
                      <th className="px-4 py-2.5 text-left font-bold text-foreground border-b border-border min-w-[120px]">Task</th>
                      <th className="px-4 py-2.5 text-left font-bold text-foreground border-b border-border min-w-[180px]">Responsibility</th>
                      {stakeholders.map((s) => (
                        <th key={s} className="px-4 py-2.5 text-center font-bold text-foreground border-b border-border min-w-[100px]">
                          {s}
                        </th>
                      ))}
                      <th className="px-4 py-2.5 text-center font-bold text-foreground border-b border-border min-w-[80px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedByTask).map(([task, rows]) =>
                      rows.map((row, rowIdx) => (
                        <tr key={row._index} className="border-b border-border hover:bg-muted/30 transition-colors group">
                          {rowIdx === 0 && (
                            <td rowSpan={rows.length} className="px-4 py-2 text-foreground font-semibold border-r border-border bg-muted/20 align-top">
                              {editingIndex === row._index ? (
                                <input type="text" value={editDraft?.task || ""} onChange={(e) => setEditDraft({...editDraft!, task: e.target.value})} className="w-full px-2 py-1 rounded border border-border text-xs focus:outline-none focus:ring-1" />
                              ) : (
                                task
                              )}
                            </td>
                          )}
                          <td className="px-4 py-2 text-foreground border-r border-border">
                            {editingIndex === row._index ? (
                              <input type="text" value={editDraft?.responsibility || ""} onChange={(e) => setEditDraft({...editDraft!, responsibility: e.target.value})} className="w-full px-2 py-1 rounded border border-border text-xs focus:outline-none focus:ring-1" />
                            ) : (
                              row.responsibility
                            )}
                          </td>
                          {stakeholders.map((s) => {
                            const val = editingIndex === row._index ? (editDraft?.[s] || "") : (row[s] || "")
                            const bgColor = val && raciColors[val] ? raciColors[val] : "transparent"
                            return (
                              <td key={s} className="px-4 py-2 text-center border-r border-border">
                                {editingIndex === row._index ? (
                                  <input type="text" value={val} onChange={(e) => setEditDraft({...editDraft!, [s]: e.target.value.toUpperCase()})} className="w-full px-2 py-1 rounded border border-border text-xs font-bold text-center focus:outline-none focus:ring-1 uppercase" maxLength={3} />
                                ) : (
                                  <span className="inline-block px-2 py-1 rounded text-white font-bold" style={{ background: bgColor || "var(--border)" }}>
                                    {val || "—"}
                                  </span>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-4 py-2 text-center flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(row._index)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-secondary transition-colors" title="Edit">
                              <Pencil size={11} className="text-muted-foreground" strokeWidth={2} />
                            </button>
                            {editingIndex === row._index ? (
                              <>
                                <button onClick={saveEdit} className="text-xs font-bold px-2 py-1 rounded text-white transition-all" style={{ background: RACI_COLOR }}>Save</button>
                                <button onClick={() => setEditingIndex(null)} className="text-xs font-bold px-2 py-1 rounded border border-border text-muted-foreground transition-all hover:bg-secondary">Cancel</button>
                              </>
                            ) : (
                              <button onClick={() => deleteRow(row._index)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 transition-colors" title="Delete">
                                <X size={11} className="text-red-500" strokeWidth={2.5} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setStep("input")}
                  className="px-4 py-2 rounded-lg text-xs font-semibold font-sans border border-border transition-all hover:bg-secondary"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Back
                </button>
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold font-sans text-white transition-all hover:opacity-90"
                  style={{ background: RACI_COLOR }}
                >
                  <CheckCircle2 size={12} strokeWidth={2.5} />
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

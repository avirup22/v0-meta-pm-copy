"use client"

import { use, useState } from "react"
import Link from "next/link"
import {
  ChevronRight,
  BarChart3,
  Sparkles,
  Loader2,
  AlertTriangle,
  Plus,
  Pencil,
  X,
  CheckCircle2,
  Download,
  RefreshCw,
} from "lucide-react"
import { generateRACIFromSOW } from "@/lib/graph"

interface PageProps {
  params: Promise<{ slug: string }>
}

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

type RACIRow = Record<string, string>

const RACI_COLOR = "oklch(0.52 0.18 55)"

const RACI_BADGE_COLORS: Record<string, string> = {
  R: "oklch(0.55 0.26 25)",
  A: "oklch(0.52 0.22 50)",
  C: "oklch(0.52 0.18 55)",
  I: "oklch(0.52 0.20 240)",
}

const RACI_DESCRIPTIONS: Record<string, string> = {
  R: "Responsible — does the work",
  A: "Accountable — owns the outcome",
  C: "Consulted — provides input",
  I: "Informed — kept up to date",
}

export default function RACIPage({ params }: PageProps) {
  const { slug } = use(params)
  const projectName = slugToTitle(slug)

  const [sowText, setSowText] = useState("")
  const [raciRows, setRACIRows] = useState<RACIRow[]>([])
  const [stakeholders, setStakeholders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"input" | "view">("input")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<RACIRow | null>(null)

  async function handleGenerate() {
    if (!sowText.trim()) { setError("Please enter SOW text"); return }
    setLoading(true)
    setError(null)
    try {
      const raw = await generateRACIFromSOW(sowText)
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
      const colSet = new Set<string>()
      matrix.forEach(r => Object.keys(r).forEach(k => { if (k !== "task" && k !== "responsibility") colSet.add(k) }))
      setStakeholders(Array.from(colSet))
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
      const updated = [...raciRows]
      updated[editingIndex] = editDraft
      setRACIRows(updated)
      setEditingIndex(null)
      setEditDraft(null)
    }
  }
  function addRow() {
    const blank: RACIRow = { task: "New Task", responsibility: "" }
    stakeholders.forEach(s => { blank[s] = "" })
    setRACIRows([...raciRows, blank])
    setEditingIndex(raciRows.length)
    setEditDraft(blank)
  }
  function deleteRow(i: number) { setRACIRows(raciRows.filter((_, idx) => idx !== i)) }

  const tasks = Array.from(new Set(raciRows.map(r => r.task || "")))

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-sans text-muted-foreground">
          <Link href="/projects" className="hover:text-primary transition-colors font-medium">Projects</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <Link href={`/projects/${slug}`} className="hover:text-primary transition-colors font-medium">{projectName}</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <Link href={`/projects/${slug}/documents`} className="hover:text-primary transition-colors font-medium">Documents</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <span className="text-foreground font-semibold">RACI Matrix</span>
        </div>
        {step === "view" && (
          <div className="flex items-center gap-2">
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all border border-border hover:bg-secondary"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Plus size={11} strokeWidth={2.5} />
              Add Row
            </button>
            <button
              onClick={() => setStep("input")}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all border border-border hover:bg-secondary"
              style={{ color: "var(--muted-foreground)" }}
            >
              <RefreshCw size={11} strokeWidth={2} />
              Regenerate
            </button>
            <button
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all text-white"
              style={{ background: RACI_COLOR }}
            >
              <Download size={11} strokeWidth={2.5} />
              Export
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">

          {/* ── INPUT STEP ── */}
          {step === "input" && (
            <>
              {/* Hero card */}
              <div className="rounded-2xl border p-6 flex flex-col gap-4"
                style={{
                  background: `color-mix(in oklch, ${RACI_COLOR} 5%, white)`,
                  borderColor: `color-mix(in oklch, ${RACI_COLOR} 22%, transparent)`,
                }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: RACI_COLOR }}>
                    <BarChart3 size={20} color="white" strokeWidth={2} />
                  </div>
                  <div>
                    <h1 className="text-base font-black text-foreground font-sans">AI-Powered RACI Matrix</h1>
                    <p className="text-xs text-muted-foreground font-sans mt-1 leading-relaxed max-w-xl">
                      Paste your Scope of Work below. The AI will extract all project activities and automatically map each stakeholder role — Responsible, Accountable, Consulted, and Informed.
                    </p>
                  </div>
                </div>

                {/* Legend pills */}
                <div className="flex items-center gap-3 flex-wrap">
                  {Object.entries(RACI_BADGE_COLORS).map(([letter, color]) => (
                    <div key={letter} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white">
                      <span className="inline-flex w-5 h-5 rounded items-center justify-center font-black text-white text-[9px]"
                        style={{ background: color }}>{letter}</span>
                      <span className="text-[10px] font-sans text-muted-foreground">{RACI_DESCRIPTIONS[letter]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SOW input */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
                <div>
                  <label className="text-sm font-bold text-foreground font-sans">Scope of Work (SOW)</label>
                  <p className="text-[10px] text-muted-foreground font-sans mt-0.5">
                    Include project phases, deliverables, team roles, and key activities for best results.
                  </p>
                </div>
                <textarea
                  value={sowText}
                  onChange={(e) => setSowText(e.target.value)}
                  placeholder="Paste your Scope of Work here...&#10;&#10;Example:&#10;Phase 1 – Discovery: Conduct stakeholder interviews, gather requirements, produce BRD...&#10;Phase 2 – Design: Create wireframes, get UX sign-off, develop design system..."
                  rows={14}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow resize-none leading-relaxed"
                  style={{ focusRingColor: RACI_COLOR } as any}
                />
                {error && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs font-sans"
                    style={{
                      background: "color-mix(in oklch, oklch(0.60 0.26 25) 8%, white)",
                      borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 25%, transparent)",
                      color: "oklch(0.55 0.26 25)",
                    }}>
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[10px] text-muted-foreground font-sans">
                    {sowText.length} characters
                  </span>
                  <button
                    onClick={handleGenerate}
                    disabled={loading || !sowText.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-50"
                    style={{ background: RACI_COLOR, boxShadow: `0 4px 16px -4px ${RACI_COLOR}60` }}
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} strokeWidth={2.5} />}
                    {loading ? "Generating RACI..." : "Generate RACI Matrix"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── MATRIX VIEW STEP ── */}
          {step === "view" && (
            <>
              {/* Summary bar */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Rows", value: raciRows.length, color: RACI_COLOR },
                  { label: "Tasks", value: tasks.length, color: "oklch(0.55 0.26 25)" },
                  { label: "Stakeholders", value: stakeholders.length, color: "oklch(0.52 0.20 240)" },
                  { label: "Roles Mapped", value: raciRows.reduce((acc, r) => acc + stakeholders.filter(s => r[s]).length, 0), color: "oklch(0.55 0.22 150)" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border bg-card p-4 flex items-center gap-3"
                    style={{ borderColor: `color-mix(in oklch, ${s.color} 20%, transparent)` }}>
                    <div>
                      <p className="text-2xl font-black text-foreground leading-none">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground font-sans mt-0.5">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 flex-wrap px-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Legend:</span>
                {Object.entries(RACI_BADGE_COLORS).map(([letter, color]) => (
                  <div key={letter} className="flex items-center gap-1.5">
                    <span className="inline-flex w-5 h-5 rounded items-center justify-center font-black text-white text-[9px]"
                      style={{ background: color }}>{letter}</span>
                    <span className="text-[10px] font-sans text-muted-foreground">
                      {letter === "R" ? "Responsible" : letter === "A" ? "Accountable" : letter === "C" ? "Consulted" : "Informed"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-sans border-collapse bg-white">
                    <thead>
                      <tr style={{ background: `color-mix(in oklch, ${RACI_COLOR} 8%, white)` }}>
                        <th className="px-4 py-3 text-left font-bold text-foreground border-b border-r border-border min-w-[150px] sticky left-0"
                          style={{ background: `color-mix(in oklch, ${RACI_COLOR} 8%, white)` }}>
                          Task
                        </th>
                        <th className="px-4 py-3 text-left font-bold text-foreground border-b border-r border-border min-w-[220px]">
                          Responsibility
                        </th>
                        {stakeholders.map(s => (
                          <th key={s} className="px-4 py-3 text-center font-bold text-foreground border-b border-r border-border min-w-[100px]">
                            {s}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center font-bold text-foreground border-b border-border w-24">
                          Actions
                        </th>
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
                                <td rowSpan={taskCount}
                                  className="px-4 py-2.5 font-semibold text-foreground border-r border-border align-top sticky left-0"
                                  style={{ background: `color-mix(in oklch, ${RACI_COLOR} 4%, white)` }}>
                                  {isEditing
                                    ? <input type="text" value={editDraft?.task ?? ""}
                                        onChange={e => setEditDraft({ ...editDraft!, task: e.target.value })}
                                        className="w-full px-2 py-1 rounded border border-border text-[11px] focus:outline-none focus:ring-1" />
                                    : <span className="text-[11px]">{task}</span>
                                  }
                                </td>
                              )}
                              <td className="px-4 py-2.5 text-foreground border-r border-border">
                                {isEditing
                                  ? <input type="text" value={editDraft?.responsibility ?? ""}
                                      onChange={e => setEditDraft({ ...editDraft!, responsibility: e.target.value })}
                                      className="w-full px-2 py-1 rounded border border-border text-[11px] focus:outline-none focus:ring-1" />
                                  : <span className="text-[11px] text-muted-foreground">{row.responsibility}</span>
                                }
                              </td>
                              {stakeholders.map(s => {
                                const val = isEditing ? (editDraft?.[s] ?? "") : (row[s] ?? "")
                                const letters = val ? val.split(",").map(v => v.trim().toUpperCase()).filter(Boolean) : []
                                return (
                                  <td key={s} className="px-4 py-2.5 text-center border-r border-border">
                                    {isEditing
                                      ? <input type="text" value={val}
                                          onChange={e => setEditDraft({ ...editDraft!, [s]: e.target.value.toUpperCase() })}
                                          placeholder="R,A"
                                          className="w-16 px-2 py-1 rounded border border-border text-[10px] font-bold text-center uppercase focus:outline-none focus:ring-1 mx-auto block" />
                                      : letters.length > 0
                                        ? <div className="flex items-center justify-center gap-0.5 flex-wrap">
                                            {letters.map((letter, li) => (
                                              <span key={li}
                                                className="inline-flex w-5 h-5 rounded items-center justify-center font-black text-white text-[9px]"
                                                style={{ background: RACI_BADGE_COLORS[letter] ?? "var(--muted-foreground)" }}>
                                                {letter}
                                              </span>
                                            ))}
                                          </div>
                                        : <span className="text-muted-foreground/40 text-base">—</span>
                                    }
                                  </td>
                                )
                              })}
                              <td className="px-4 py-2.5">
                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {isEditing ? (
                                    <>
                                      <button onClick={saveEdit}
                                        className="text-[9px] font-bold px-2.5 py-1 rounded text-white"
                                        style={{ background: RACI_COLOR }}>
                                        Save
                                      </button>
                                      <button onClick={() => { setEditingIndex(null); setEditDraft(null) }}
                                        className="text-[9px] font-bold px-2 py-1 rounded border border-border text-muted-foreground">
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => startEdit(i)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
                                        title="Edit row">
                                        <Pencil size={12} className="text-muted-foreground" strokeWidth={2} />
                                      </button>
                                      <button onClick={() => deleteRow(i)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                                        title="Delete row">
                                        <X size={12} className="text-red-400" strokeWidth={2.5} />
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

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
                  <p className="text-[10px] text-muted-foreground font-sans">
                    {raciRows.length} responsibilities across {tasks.length} tasks · {stakeholders.length} stakeholders
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={addRow}
                      className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary transition-colors"
                      style={{ color: "var(--muted-foreground)" }}>
                      <Plus size={10} strokeWidth={2.5} /> Add Row
                    </button>
                    <button
                      className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg text-white transition-all hover:opacity-90"
                      style={{ background: RACI_COLOR }}>
                      <CheckCircle2 size={10} strokeWidth={2.5} /> Save Matrix
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { use, useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import {
  fetchAllCustomersWithProjects,
  fetchSprintPlanTracker,
  type SprintTrackerRow,
} from "@/lib/graph"
import {
  ChevronRight,
  Loader2,
  AlertTriangle,
  Search,
  RefreshCw,
  TableProperties,
  Layers,
  CheckCircle2,
  Clock,
  Circle,
  Sparkles,
  Zap,
  User,
  CalendarClock,
  Flag,
  Filter,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string }>
}

const P2_COLOR = "oklch(0.52 0.22 195)"   // teal — distinct from Planner violet

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-")
}

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// ─── Status helpers ────────────────────────────────────────────────────────────

function statusStyle(status: string): { bg: string; color: string } {
  const s = status.toLowerCase()
  if (s.includes("complete") || s.includes("done"))
    return { bg: "color-mix(in oklch, oklch(0.55 0.22 150) 12%, white)", color: "oklch(0.45 0.22 150)" }
  if (s.includes("progress") || s.includes("active") || s.includes("ongoing"))
    return { bg: "color-mix(in oklch, oklch(0.65 0.20 55) 12%, white)", color: "oklch(0.50 0.22 55)" }
  if (s.includes("not started") || s.includes("pending") || s.includes("planned"))
    return { bg: "color-mix(in oklch, oklch(0.55 0.15 200) 12%, white)", color: "oklch(0.45 0.18 220)" }
  if (s.includes("hold") || s.includes("block") || s.includes("risk"))
    return { bg: "color-mix(in oklch, oklch(0.60 0.26 25) 10%, white)", color: "oklch(0.55 0.26 25)" }
  return { bg: "color-mix(in oklch, oklch(0.50 0.10 250) 10%, white)", color: "oklch(0.45 0.10 250)" }
}

function StatusPill({ status }: { status: string }) {
  if (!status || status === "—") return <span className="text-muted-foreground text-[10px]">—</span>
  const { bg, color } = statusStyle(status)
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-sans whitespace-nowrap"
      style={{ background: bg, color }}>
      {status}
    </span>
  )
}

function SprintBadge({ sprint }: { sprint: string }) {
  if (!sprint) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-sans whitespace-nowrap"
      style={{ background: `color-mix(in oklch, ${P2_COLOR} 12%, white)`, color: P2_COLOR }}>
      {sprint}
    </span>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function Planner2Page({ params }: PageProps) {
  const { slug } = use(params)
  const { token, isAuthenticated } = useAuth()

  const [rows,         setRows]         = useState<SprintTrackerRow[]>([])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [projectTitle, setProjectTitle] = useState(slugToTitle(slug))
  const [search,       setSearch]       = useState("")
  const [sprintFilter, setSprintFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [streamFilter, setStreamFilter] = useState("All")

  async function load() {
    if (!token || !isAuthenticated) return
    setLoading(true)
    setError(null)
    try {
      // Resolve slug → real folder name + folder ID
      const customers = await fetchAllCustomersWithProjects(token)
      let folderId: string | null = null
      for (const { projects } of customers) {
        const match = projects.find((p) => toSlug(p.name) === slug)
        if (match) { folderId = match.id; setProjectTitle(match.name); break }
      }
      if (!folderId) {
        setError(`Project folder not found for "${slug}".`)
        setLoading(false)
        return
      }
      const data = await fetchSprintPlanTracker(token, folderId)
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sprint tracker")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isAuthenticated) load() }, [isAuthenticated, token])

  // ── Derived values ──────────────────────────────────────────────────────────

  const sprints = useMemo(() => {
    const s = new Set(rows.map((r) => r.Sprint).filter(Boolean))
    return ["All", ...Array.from(s).sort()]
  }, [rows])

  const statuses = useMemo(() => {
    const s = new Set(rows.map((r) => r.Status).filter(Boolean))
    return ["All", ...Array.from(s).sort()]
  }, [rows])

  const streams = useMemo(() => {
    const s = new Set(rows.map((r) => r.Stream).filter(Boolean))
    return ["All", ...Array.from(s).sort()]
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const q = search.toLowerCase()
      const matchSearch = !q || [r.Activity, r["Owner(s),"], r.Stream, r.WAVE, r.Sprint, r.Note]
        .some((v) => v?.toLowerCase().includes(q))
      const matchSprint = sprintFilter === "All" || r.Sprint === sprintFilter
      const matchStatus = statusFilter === "All" || r.Status === statusFilter
      const matchStream = streamFilter === "All" || r.Stream === streamFilter
      return matchSearch && matchSprint && matchStatus && matchStream
    })
  }, [rows, search, sprintFilter, statusFilter, streamFilter])

  const totalRows   = rows.length
  const completed   = rows.filter((r) => /complete|done/i.test(r.Status)).length
  const inProgress  = rows.filter((r) => /progress|active|ongoing/i.test(r.Status)).length
  const notStarted  = rows.filter((r) => /not started|pending|planned/i.test(r.Status)).length
  const sprintCount = sprints.length - 1

  const STATS = [
    { label: "Total Tasks",  value: totalRows,   color: P2_COLOR,                icon: <TableProperties size={15} color="white" strokeWidth={2} /> },
    { label: "Sprints",      value: sprintCount, color: "oklch(0.55 0.20 270)",  icon: <Layers size={15} color="white" strokeWidth={2} /> },
    { label: "In Progress",  value: inProgress,  color: "oklch(0.65 0.20 55)",   icon: <Clock size={15} color="white" strokeWidth={2} /> },
    { label: "Completed",    value: completed,   color: "oklch(0.55 0.22 150)",  icon: <CheckCircle2 size={15} color="white" strokeWidth={2} /> },
    { label: "Not Started",  value: notStarted,  color: "oklch(0.55 0.15 200)",  icon: <Circle size={15} color="white" strokeWidth={2} /> },
  ]

  // ── Table columns config ────────────────────────────────────────────────────

  const COLS: { key: keyof SprintTrackerRow; label: string; width: string; render?: (v: string, row: SprintTrackerRow) => React.ReactNode }[] = [
    { key: "Sprint",                       label: "Sprint",          width: "min-w-[90px]",  render: (v) => <SprintBadge sprint={v} /> },
    { key: "Task#",                        label: "Task #",          width: "min-w-[60px]",  render: (v) => <span className="font-mono text-[11px] text-muted-foreground">{v || "—"}</span> },
    { key: "WAVE",                         label: "Wave",            width: "min-w-[70px]" },
    { key: "Geography",                    label: "Geography",       width: "min-w-[90px]" },
    { key: "Activity",                     label: "Activity",        width: "min-w-[200px] max-w-[260px]",
      render: (v) => <span className="text-xs font-semibold text-foreground font-sans leading-tight block">{v || "—"}</span> },
    { key: "Stream",                       label: "Stream",          width: "min-w-[100px]" },
    { key: "Integration / Input Source",   label: "Integration",     width: "min-w-[120px] max-w-[160px]" },
    { key: "Owner(s),",                    label: "Owner(s)",        width: "min-w-[110px]",
      render: (v) => v ? (
        <div className="flex flex-wrap gap-1">
          {v.split(/[,;/]/).map((o) => o.trim()).filter(Boolean).map((name) => (
            <span key={name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold font-sans"
              style={{ background: `color-mix(in oklch, ${P2_COLOR} 10%, white)`, color: P2_COLOR }}>
              <User size={8} strokeWidth={2.5} />{name}
            </span>
          ))}
        </div>
      ) : <span className="text-muted-foreground text-[10px]">—</span>
    },
    { key: "Duration (Days)",              label: "Days",            width: "min-w-[55px]",
      render: (v) => v ? <span className="text-[11px] font-bold text-foreground font-mono">{v}</span> : <span className="text-muted-foreground text-[10px]">—</span> },
    { key: "Start Date",                   label: "Start",           width: "min-w-[90px]",
      render: (v) => v ? (
        <span className="text-[10px] font-sans text-muted-foreground whitespace-nowrap flex items-center gap-1">
          <CalendarClock size={9} strokeWidth={2} />{v}
        </span>
      ) : <span className="text-muted-foreground text-[10px]">—</span> },
    { key: "End Date",                     label: "End",             width: "min-w-[90px]",
      render: (v) => v ? (
        <span className="text-[10px] font-sans text-muted-foreground whitespace-nowrap flex items-center gap-1">
          <CalendarClock size={9} strokeWidth={2} />{v}
        </span>
      ) : <span className="text-muted-foreground text-[10px]">—</span> },
    { key: "Status",                       label: "Status",          width: "min-w-[110px]", render: (v) => <StatusPill status={v} /> },
    { key: "Stage",                        label: "Stage",           width: "min-w-[90px]" },
    { key: "Note",                         label: "Note",            width: "min-w-[140px] max-w-[200px]",
      render: (v) => v ? <span className="text-[10px] text-muted-foreground font-sans italic leading-tight line-clamp-2">{v}</span> : <span className="text-muted-foreground text-[10px]">—</span> },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Page header */}
      <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-sans text-muted-foreground">
          <Link href="/projects" className="hover:text-primary transition-colors font-medium">Projects</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <Link href={`/projects/${slug}`} className="hover:text-primary transition-colors font-medium">{projectTitle}</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <span className="text-foreground font-semibold">Planner 2</span>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-border transition-all hover:bg-secondary"
          style={{ color: "var(--muted-foreground)" }}>
          <RefreshCw size={11} strokeWidth={2} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-6 max-w-full mx-auto">

          {/* Stats row */}
          <div className="grid grid-cols-5 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border bg-card p-4 flex items-center gap-3 overflow-hidden relative"
                style={{ borderColor: `color-mix(in oklch, ${s.color} 20%, transparent)` }}>
                <div className="absolute top-0 right-0 w-16 h-16 -translate-y-6 translate-x-6 rounded-full opacity-15"
                  style={{ background: s.color }} />
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative" style={{ background: s.color }}>
                  {s.icon}
                </div>
                <div className="relative">
                  <p className="text-xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Intelligence banner */}
          <div className="rounded-2xl border overflow-hidden relative"
            style={{ background: `color-mix(in oklch, ${P2_COLOR} 5%, white)`, borderColor: `color-mix(in oklch, ${P2_COLOR} 20%, transparent)` }}>
            <div className="absolute top-0 right-0 w-28 h-28 -translate-y-8 translate-x-8 rounded-full opacity-20" style={{ background: P2_COLOR }} />
            <div className="p-5 relative flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: P2_COLOR }}>
                    <Sparkles size={14} color="white" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground font-sans tracking-tight">Sprint Timeline Intelligence</p>
                    <p className="text-[10px] text-muted-foreground font-sans">Live from Sprint_Plan_and_Status_Tracker.xlsx · Reference Documents</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: P2_COLOR, color: "white" }}>
                    <Zap size={9} strokeWidth={2.5} />
                    Excel
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    `${totalRows} total task${totalRows !== 1 ? "s" : ""}`,
                    `${sprintCount} sprint${sprintCount !== 1 ? "s" : ""}`,
                    `${inProgress} in progress`,
                    `${completed} completed`,
                    `${notStarted} not started`,
                  ].map((chip) => (
                    <span key={chip} className="text-[10px] font-semibold font-sans px-2.5 py-1 rounded-full border bg-white"
                      style={{ color: P2_COLOR, borderColor: `color-mix(in oklch, ${P2_COLOR} 25%, transparent)` }}>
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Filters + search */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search activity, owner, stream..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-card text-xs font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow"
                  style={{ "--tw-ring-color": `color-mix(in oklch, ${P2_COLOR} 40%, transparent)` } as React.CSSProperties} />
              </div>

              {/* Sprint filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1">
                  <Layers size={9} strokeWidth={2.5} />Sprint
                </span>
                {sprints.slice(0, 7).map((s) => (
                  <button key={s} onClick={() => setSprintFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold font-sans border transition-all"
                    style={sprintFilter === s
                      ? { background: P2_COLOR, color: "white", borderColor: P2_COLOR }
                      : { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Status + Stream filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1">
                  <Flag size={9} strokeWidth={2.5} />Status
                </span>
                {statuses.slice(0, 6).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold font-sans border transition-all"
                    style={statusFilter === s
                      ? { background: P2_COLOR, color: "white", borderColor: P2_COLOR }
                      : { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1">
                  <Filter size={9} strokeWidth={2.5} />Stream
                </span>
                {streams.slice(0, 5).map((s) => (
                  <button key={s} onClick={() => setStreamFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold font-sans border transition-all"
                    style={streamFilter === s
                      ? { background: P2_COLOR, color: "white", borderColor: P2_COLOR }
                      : { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `color-mix(in oklch, ${P2_COLOR} 10%, white)`, border: `1px solid color-mix(in oklch, ${P2_COLOR} 20%, transparent)` }}>
                <Loader2 size={22} className="animate-spin" style={{ color: P2_COLOR }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground font-sans">Loading sprint tracker...</p>
                <p className="text-[11px] text-muted-foreground font-sans mt-0.5">Reading Timeline_Sprint_Tracker from Excel</p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border p-8 flex flex-col items-center gap-4 text-center"
              style={{ background: "color-mix(in oklch, oklch(0.60 0.26 25) 5%, white)", borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 20%, transparent)" }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "color-mix(in oklch, oklch(0.60 0.26 25) 12%, white)", border: "1px solid color-mix(in oklch, oklch(0.60 0.26 25) 25%, transparent)" }}>
                <AlertTriangle size={20} style={{ color: "oklch(0.60 0.26 25)" }} strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground font-sans">Could not load Sprint Tracker</p>
                <p className="text-xs text-muted-foreground font-sans mt-1 max-w-md leading-relaxed">{error}</p>
              </div>
              <button onClick={load}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "oklch(0.60 0.26 25)" }}>
                <RefreshCw size={12} strokeWidth={2} />
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border p-12 flex flex-col items-center gap-3 text-center"
              style={{ background: `color-mix(in oklch, ${P2_COLOR} 4%, white)`, borderColor: `color-mix(in oklch, ${P2_COLOR} 15%, transparent)` }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `color-mix(in oklch, ${P2_COLOR} 12%, white)`, border: `1px solid color-mix(in oklch, ${P2_COLOR} 20%, transparent)` }}>
                <TableProperties size={20} style={{ color: P2_COLOR }} strokeWidth={1.5} />
              </div>
              <p className="text-sm font-bold text-foreground font-sans">No tasks match filters</p>
              <p className="text-xs text-muted-foreground font-sans">Adjust the sprint, status or stream filters above</p>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden bg-card"
              style={{ borderColor: `color-mix(in oklch, ${P2_COLOR} 15%, transparent)` }}>
              {/* Result count */}
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between"
                style={{ background: `color-mix(in oklch, ${P2_COLOR} 4%, white)` }}>
                <p className="text-[11px] font-semibold text-muted-foreground font-sans">
                  Showing <span className="font-black" style={{ color: P2_COLOR }}>{filtered.length}</span> of {totalRows} tasks
                </p>
                {(sprintFilter !== "All" || statusFilter !== "All" || streamFilter !== "All" || search) && (
                  <button
                    onClick={() => { setSearch(""); setSprintFilter("All"); setStatusFilter("All"); setStreamFilter("All") }}
                    className="text-[10px] font-semibold font-sans transition-colors hover:underline"
                    style={{ color: P2_COLOR }}>
                    Clear filters
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px] font-sans">
                  <thead>
                    <tr style={{ background: `color-mix(in oklch, ${P2_COLOR} 6%, white)`, borderBottom: `1px solid color-mix(in oklch, ${P2_COLOR} 15%, transparent)` }}>
                      {COLS.map((col) => (
                        <th key={col.key}
                          className={`px-3 py-2.5 text-left text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${col.width}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => (
                      <tr key={i}
                        className="border-b border-border transition-colors hover:bg-secondary/40 group"
                        style={i % 2 === 0
                          ? { background: `color-mix(in oklch, ${P2_COLOR} 2%, white)` }
                          : { background: "var(--card)" }
                        }>
                        {COLS.map((col) => (
                          <td key={col.key} className={`px-3 py-2.5 align-top ${col.width}`}>
                            {col.render
                              ? col.render(row[col.key] ?? "", row)
                              : <span className="text-[11px] font-sans text-foreground">{row[col.key] || "—"}</span>
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

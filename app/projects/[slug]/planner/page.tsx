"use client"

import { use, useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import {
  fetchAllCustomersWithProjects,
  fetchPlannerPlanByName,
  fetchPlannerTasksWithAssignees,
  plannerPriorityLabel,
  type PlannerTaskWithAssignees,
} from "@/lib/graph"
import {
  CheckSquare,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Search,
  ListTodo,
  User,
  Flag,
  RefreshCw,
  Clock,
  CheckCircle2,
  Circle,
  LayoutGrid,
  List,
  Zap,
  Sparkles,
  CalendarClock,
  ArrowUpRight,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string }>
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-")
}

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

const PRIORITY_ORDER = [1, 3, 5, 9]
const FILTERS = ["All", "Urgent", "Important", "Medium", "Low"] as const

const PLANNER_COLOR = "oklch(0.55 0.20 240)"

export default function PlannerPage({ params }: PageProps) {
  const { slug } = use(params)
  const { token, isAuthenticated } = useAuth()

  const [tasks, setTasks] = useState<PlannerTaskWithAssignees[]>([])
  const [planTitle, setPlanTitle] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<typeof FILTERS[number]>("All")
  const [view, setView] = useState<"table" | "board">("table")

  const projectTitle = slugToTitle(slug)

  useEffect(() => {
    if (!token || !isAuthenticated) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthenticated, slug])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const customers = await fetchAllCustomersWithProjects(token!)
      let realFolderName: string | null = null
      for (const { projects } of customers) {
        const match = projects.find((p) => toSlug(p.name) === slug)
        if (match) { realFolderName = match.name; break }
      }
      if (!realFolderName) {
        setError(`Project folder not found for "${slug}". Check that the project exists in your OneDrive MetaPM folder.`)
        setLoading(false)
        return
      }
      const plan = await fetchPlannerPlanByName(token!, realFolderName)
      if (!plan) {
        setError(`No Planner plan found with title "${realFolderName}". The plan title in Microsoft Planner must exactly match the project folder name.`)
        setLoading(false)
        return
      }
      setPlanTitle(plan.title)
      const fetched = await fetchPlannerTasksWithAssignees(token!, plan.id)
      fetched.sort((a, b) => {
        if (a.priority !== b.priority) return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
        if (a.dueDateTime && b.dueDateTime) return new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime()
        return 0
      })
      setTasks(fetched)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load planner tasks")
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.assigneeNames.some((n) => n.toLowerCase().includes(search.toLowerCase()))
      const matchFilter = filter === "All" || plannerPriorityLabel(t.priority).label === filter
      return matchSearch && matchFilter
    })
  }, [tasks, search, filter])

  const total      = tasks.length
  const notStarted = tasks.filter((t) => t.percentComplete === 0).length
  const inProgress = tasks.filter((t) => t.percentComplete > 0 && t.percentComplete < 100).length
  const completed  = tasks.filter((t) => t.percentComplete === 100).length
  const overdue    = tasks.filter((t) => t.percentComplete < 100 && isOverdue(t.dueDateTime)).length

  const STATS = [
    { label: "Total Tasks",  value: total,      color: PLANNER_COLOR,            icon: <ListTodo size={15} color="white" strokeWidth={2} /> },
    { label: "Not Started",  value: notStarted, color: "oklch(0.55 0.15 200)",   icon: <Circle size={15} color="white" strokeWidth={2} /> },
    { label: "In Progress",  value: inProgress, color: "oklch(0.65 0.20 55)",    icon: <Clock size={15} color="white" strokeWidth={2} /> },
    { label: "Completed",    value: completed,  color: "oklch(0.55 0.22 150)",   icon: <CheckCircle2 size={15} color="white" strokeWidth={2} /> },
    { label: "Overdue",      value: overdue,    color: "oklch(0.60 0.26 25)",    icon: <AlertTriangle size={15} color="white" strokeWidth={2} /> },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Page header — mirrors documents page */}
      <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-sans text-muted-foreground">
          <Link href="/projects" className="hover:text-primary transition-colors font-medium">Projects</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <Link href={`/projects/${slug}`} className="hover:text-primary transition-colors font-medium">{projectTitle}</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <span className="text-foreground font-semibold">Planner</span>
          {planTitle && (
            <>
              <ChevronRight size={11} strokeWidth={2.5} />
              <span className="truncate max-w-48">{planTitle}</span>
            </>
          )}
        </div>

        {/* View toggle + Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setView("table")}
              className="px-2.5 py-1.5 transition-colors"
              style={{
                background: view === "table" ? PLANNER_COLOR : "transparent",
                color: view === "table" ? "white" : "var(--muted-foreground)",
              }}
              title="Table view"
            >
              <List size={13} strokeWidth={2} />
            </button>
            <button
              onClick={() => setView("board")}
              className="px-2.5 py-1.5 transition-colors"
              style={{
                background: view === "board" ? PLANNER_COLOR : "transparent",
                color: view === "board" ? "white" : "var(--muted-foreground)",
              }}
              title="Board view"
            >
              <LayoutGrid size={13} strokeWidth={2} />
            </button>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: "transparent",
              color: "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            <RefreshCw size={11} strokeWidth={2} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto">

          {/* Stats row */}
          <div className="grid grid-cols-5 gap-3">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border bg-card p-4 flex items-center gap-3 overflow-hidden relative"
                style={{ borderColor: `color-mix(in oklch, ${s.color} 20%, transparent)` }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in oklch, ${s.color} 14%, white)` }}>
                  {/* re-render with colour override */}
                  <span style={{ color: s.color }}>
                    {s.icon}
                  </span>
                </div>
                <div>
                  <p className="text-xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* AI Intelligence banner */}
          <div
            className="rounded-2xl border overflow-hidden relative"
            style={{
              background: `color-mix(in oklch, ${PLANNER_COLOR} 5%, white)`,
              borderColor: `color-mix(in oklch, ${PLANNER_COLOR} 20%, transparent)`,
            }}
          >
            {/* Bubble accent */}
            <div className="absolute top-0 right-0 w-28 h-28 -translate-y-8 translate-x-8 rounded-full opacity-20"
              style={{ background: PLANNER_COLOR }} />

            <div className="p-5 relative flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: PLANNER_COLOR }}>
                    <Sparkles size={14} color="white" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground font-sans tracking-tight">Planner Intelligence</p>
                    <p className="text-[10px] text-muted-foreground font-sans">Live from Microsoft Planner · Auto-synced</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: PLANNER_COLOR, color: "white" }}>
                    <Zap size={9} strokeWidth={2.5} />
                    Live
                  </div>
                </div>
                {/* Quick insight chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    overdue > 0 ? `${overdue} overdue task${overdue > 1 ? "s" : ""}` : "No overdue tasks",
                    inProgress > 0 ? `${inProgress} in progress` : "Nothing in progress",
                    completed > 0 ? `${completed} completed` : "No completions yet",
                    `${total} total task${total !== 1 ? "s" : ""}`,
                  ].map((chip) => (
                    <span
                      key={chip}
                      className="text-[10px] font-semibold font-sans px-2.5 py-1 rounded-full border bg-white"
                      style={{
                        color: PLANNER_COLOR,
                        borderColor: `color-mix(in oklch, ${PLANNER_COLOR} 25%, transparent)`,
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Search + filter bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks or assignees..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-card text-xs font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow"
                style={{ "--tw-ring-color": `color-mix(in oklch, ${PLANNER_COLOR} 40%, transparent)` } as React.CSSProperties}
              />
            </div>
            <div className="flex items-center gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold font-sans border transition-all"
                  style={filter === f
                    ? { background: PLANNER_COLOR, color: "white", borderColor: PLANNER_COLOR }
                    : { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--border)" }
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Content area */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `color-mix(in oklch, ${PLANNER_COLOR} 10%, white)`, border: `1px solid color-mix(in oklch, ${PLANNER_COLOR} 20%, transparent)` }}>
                <Loader2 size={22} className="animate-spin" style={{ color: PLANNER_COLOR }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground font-sans">Loading planner tasks...</p>
                <p className="text-[11px] text-muted-foreground font-sans mt-0.5">Fetching from Microsoft Planner</p>
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
                <p className="text-sm font-bold text-foreground font-sans">Could not load Planner</p>
                <p className="text-xs text-muted-foreground font-sans mt-1 max-w-md leading-relaxed">{error}</p>
              </div>
              <button
                onClick={load}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "oklch(0.60 0.26 25)" }}
              >
                <RefreshCw size={12} strokeWidth={2} />
                Try again
              </button>
            </div>
          ) : view === "table" ? (
            <TaskTable tasks={filtered} />
          ) : (
            <BoardView tasks={filtered} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Table View ───────────────────────────────────────────────────────────────

function TaskTable({ tasks }: { tasks: PlannerTaskWithAssignees[] }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-border flex flex-col items-center justify-center py-20 gap-3 bg-card">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: `color-mix(in oklch, ${PLANNER_COLOR} 8%, white)`, border: `1px solid color-mix(in oklch, ${PLANNER_COLOR} 18%, transparent)` }}>
          <CheckSquare size={20} style={{ color: PLANNER_COLOR }} strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground font-sans">No tasks found</p>
          <p className="text-xs text-muted-foreground font-sans mt-0.5">Try adjusting your filters</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <table className="w-full text-sm font-sans border-collapse">
        <thead>
          <tr style={{ background: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
            {["Task", "Assignees", "Priority", "Start Date", "Due Date", "Status"].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, i) => {
            const { label, color } = plannerPriorityLabel(task.priority)
            const overdue = task.percentComplete < 100 && isOverdue(task.dueDateTime)
            const done = task.percentComplete === 100
            const isAlt = i % 2 !== 0
            return (
              <tr
                key={task.id}
                className="transition-colors"
                style={{
                  background: isAlt ? "var(--secondary)" : "white",
                  borderBottom: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `color-mix(in oklch, ${PLANNER_COLOR} 5%, white)` }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isAlt ? "var(--secondary)" : "white" }}
              >
                {/* Title */}
                <td className="px-4 py-3 max-w-xs">
                  <div className="flex items-start gap-2">
                    {done
                      ? <CheckCircle2 size={13} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: "oklch(0.55 0.22 150)" }} />
                      : <Circle size={13} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
                    }
                    <span className={`text-xs font-medium leading-relaxed ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {task.title}
                    </span>
                  </div>
                </td>
                {/* Assignees */}
                <td className="px-4 py-3">
                  {task.assigneeNames.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground italic">Unassigned</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {task.assigneeNames.map((name) => (
                        <span key={name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: `color-mix(in oklch, ${PLANNER_COLOR} 10%, white)`, color: PLANNER_COLOR }}>
                          <User size={8} strokeWidth={2.5} />
                          {name.split(" ").slice(0, 2).join(" ")}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                {/* Priority */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ background: `color-mix(in oklch, ${color} 12%, white)`, color }}>
                    <Flag size={8} strokeWidth={2.5} />
                    {label}
                  </span>
                </td>
                {/* Start Date */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CalendarClock size={10} strokeWidth={2} />
                    {formatDate(task.startDateTime)}
                  </div>
                </td>
                {/* Due Date */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-[11px] font-medium"
                    style={{ color: overdue ? "oklch(0.60 0.26 25)" : "var(--muted-foreground)" }}>
                    {overdue && <AlertTriangle size={10} strokeWidth={2.5} />}
                    {formatDate(task.dueDateTime)}
                  </div>
                </td>
                {/* Status */}
                <td className="px-4 py-3">
                  <StatusPill percent={task.percentComplete} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Board View ───────────────────────────────────────────────────────────────

const BUCKETS = [
  { label: "Urgent",    filter: (t: PlannerTaskWithAssignees) => t.priority === 1, color: "oklch(0.55 0.26 25)" },
  { label: "Important", filter: (t: PlannerTaskWithAssignees) => t.priority === 3, color: "oklch(0.65 0.20 55)" },
  { label: "Medium",    filter: (t: PlannerTaskWithAssignees) => t.priority === 5, color: PLANNER_COLOR },
  { label: "Low",       filter: (t: PlannerTaskWithAssignees) => t.priority === 9, color: "oklch(0.55 0.15 150)" },
]

function BoardView({ tasks }: { tasks: PlannerTaskWithAssignees[] }) {
  return (
    <div className="grid grid-cols-4 gap-4 items-start">
      {BUCKETS.map(({ label, filter, color }) => {
        const group = tasks.filter(filter)
        return (
          <div key={label} className="rounded-2xl border overflow-hidden"
            style={{ borderColor: `color-mix(in oklch, ${color} 22%, transparent)` }}>

            {/* Column header */}
            <div className="px-4 py-3 flex items-center gap-2 border-b"
              style={{
                background: `color-mix(in oklch, ${color} 8%, white)`,
                borderColor: `color-mix(in oklch, ${color} 18%, transparent)`,
              }}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: color }}>
                <Flag size={10} color="white" strokeWidth={2.5} />
              </div>
              <span className="text-xs font-bold" style={{ color }}>{label}</span>
              <span className="ml-auto text-xs font-black px-1.5 py-0.5 rounded-full"
                style={{ background: color, color: "white" }}>
                {group.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-px" style={{ background: "var(--border)" }}>
              {group.length === 0 ? (
                <div className="bg-card px-4 py-8 text-center text-[11px] text-muted-foreground font-sans">
                  No tasks
                </div>
              ) : (
                group.map((task) => {
                  const overdue = task.percentComplete < 100 && isOverdue(task.dueDateTime)
                  const done = task.percentComplete === 100
                  return (
                    <div key={task.id} className="bg-card px-4 py-3 flex flex-col gap-2 transition-colors"
                      onMouseEnter={(e) => { e.currentTarget.style.background = `color-mix(in oklch, ${color} 4%, white)` }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "white" }}>
                      {/* Title */}
                      <div className="flex items-start gap-1.5">
                        {done
                          ? <CheckCircle2 size={12} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: "oklch(0.55 0.22 150)" }} />
                          : <Circle size={12} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
                        }
                        <p className={`text-[11px] font-medium leading-relaxed flex-1 ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {task.title}
                        </p>
                      </div>
                      {/* Assignees */}
                      {task.assigneeNames.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {task.assigneeNames.map((name) => (
                            <span key={name} className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: `color-mix(in oklch, ${color} 10%, white)`, color }}>
                              <User size={8} strokeWidth={2.5} />
                              {name.split(" ")[0]}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] font-medium"
                          style={{ color: overdue ? "oklch(0.60 0.26 25)" : "var(--muted-foreground)" }}>
                          {overdue && <AlertTriangle size={9} strokeWidth={2.5} />}
                          <CalendarClock size={9} strokeWidth={2} />
                          {formatDate(task.dueDateTime)}
                        </div>
                        <StatusPill percent={task.percentComplete} small />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function StatusPill({ percent, small }: { percent: number; small?: boolean }) {
  const done = percent === 100
  const inProg = percent > 0 && percent < 100
  const color = done ? "oklch(0.55 0.22 150)" : inProg ? "oklch(0.65 0.20 55)" : "oklch(0.55 0.15 200)"
  const label = done ? "Done" : inProg ? "In Progress" : "Not Started"
  const icon = done ? <CheckCircle2 size={small ? 8 : 9} strokeWidth={2.5} /> : inProg ? <Clock size={small ? 8 : 9} strokeWidth={2.5} /> : <Circle size={small ? 8 : 9} strokeWidth={2.5} />
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ${small ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2.5 py-1"}`}
      style={{ background: `color-mix(in oklch, ${color} 12%, white)`, color }}>
      {icon}
      {label}
    </span>
  )
}

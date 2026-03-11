"use client"

import { use, useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import {
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
  CalendarClock,
  User,
  Flag,
  RefreshCw,
  Clock,
  CheckCircle2,
  Circle,
  ArrowUpRight,
  LayoutGrid,
  List,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string }>
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
      const plan = await fetchPlannerPlanByName(token!, slug)
      if (!plan) {
        setError(`No Planner plan found matching "${projectTitle}". Make sure a plan exists in Microsoft Planner with this project name.`)
        setTasks([])
        setLoading(false)
        return
      }
      setPlanTitle(plan.title)
      const fetched = await fetchPlannerTasksWithAssignees(token!, plan.id)
      // Sort by priority then due date
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

  // Stats
  const total      = tasks.length
  const notStarted = tasks.filter((t) => t.percentComplete === 0).length
  const inProgress = tasks.filter((t) => t.percentComplete > 0 && t.percentComplete < 100).length
  const completed  = tasks.filter((t) => t.percentComplete === 100).length
  const overdue    = tasks.filter((t) => t.percentComplete < 100 && isOverdue(t.dueDateTime)).length

  const STATS = [
    { label: "Total Tasks",  value: total,      color: "oklch(0.55 0.20 240)", icon: <ListTodo size={14} color="white" strokeWidth={2.5} /> },
    { label: "Not Started",  value: notStarted, color: "oklch(0.55 0.15 200)", icon: <Circle size={14} color="white" strokeWidth={2.5} /> },
    { label: "In Progress",  value: inProgress, color: "oklch(0.65 0.20 55)",  icon: <Clock size={14} color="white" strokeWidth={2.5} /> },
    { label: "Completed",    value: completed,  color: "oklch(0.55 0.22 150)", icon: <CheckCircle2 size={14} color="white" strokeWidth={2.5} /> },
    { label: "Overdue",      value: overdue,    color: "oklch(0.60 0.26 25)",  icon: <AlertTriangle size={14} color="white" strokeWidth={2.5} /> },
  ]

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 text-sm font-sans">
          <Link href={`/projects/${slug}`} className="text-muted-foreground hover:text-foreground transition-colors">
            {projectTitle}
          </Link>
          <ChevronRight size={14} className="text-muted-foreground" />
          <span className="font-semibold text-foreground">Planner</span>
          {planTitle && (
            <>
              <ChevronRight size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground text-xs truncate max-w-48">{planTitle}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden" style={{ background: "var(--secondary)" }}>
            <button
              onClick={() => setView("table")}
              className="px-2.5 py-1.5 transition-colors"
              style={{
                background: view === "table" ? "oklch(0.55 0.20 240)" : "transparent",
                color: view === "table" ? "white" : "var(--muted-foreground)",
              }}
              title="Table view"
            >
              <List size={14} strokeWidth={2} />
            </button>
            <button
              onClick={() => setView("board")}
              className="px-2.5 py-1.5 transition-colors"
              style={{
                background: view === "board" ? "oklch(0.55 0.20 240)" : "transparent",
                color: view === "board" ? "white" : "var(--muted-foreground)",
              }}
              title="Board view"
            >
              <LayoutGrid size={14} strokeWidth={2} />
            </button>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold font-sans text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <RefreshCw size={12} strokeWidth={2} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {/* Stats row */}
        <div className="grid grid-cols-5 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border p-4 flex items-center gap-3 overflow-hidden relative"
              style={{
                background: `color-mix(in oklch, ${s.color} 8%, white)`,
                borderColor: `color-mix(in oklch, ${s.color} 22%, transparent)`,
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.color }}>
                {s.icon}
              </div>
              <div>
                <p className="text-xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + filter bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks or assignees..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-card text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow"
              style={{ "--tw-ring-color": "oklch(0.55 0.20 240 / 0.3)" } as React.CSSProperties}
            />
          </div>
          <div className="flex items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold font-sans border transition-all"
                style={filter === f
                  ? { background: "oklch(0.55 0.20 240)", color: "white", borderColor: "oklch(0.55 0.20 240)" }
                  : { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--border)" }
                }
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 size={28} className="animate-spin" style={{ color: "oklch(0.55 0.20 240)" }} />
            <p className="text-sm text-muted-foreground font-sans">Loading planner tasks...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border p-6 flex flex-col items-center gap-3 text-center"
            style={{ background: "color-mix(in oklch, oklch(0.60 0.26 25) 6%, white)", borderColor: "color-mix(in oklch, oklch(0.60 0.26 25) 20%, transparent)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.60 0.26 25)" }}>
              <AlertTriangle size={18} color="white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground font-sans">No Planner plan found</p>
              <p className="text-xs text-muted-foreground font-sans mt-1 max-w-md">{error}</p>
            </div>
          </div>
        ) : view === "table" ? (
          <TaskTable tasks={filtered} />
        ) : (
          <BoardView tasks={filtered} />
        )}
      </div>
    </div>
  )
}

// ─── Table View ───────────────────────────────────────────────────────────────

function TaskTable({ tasks }: { tasks: PlannerTaskWithAssignees[] }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <CheckSquare size={32} className="text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground font-sans">No tasks match your filters</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <table className="w-full text-sm font-sans border-collapse">
        <thead>
          <tr style={{ background: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
            {["Task", "Assignees", "Priority", "Start Date", "Due Date", "Status"].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
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
            return (
              <tr
                key={task.id}
                className="group transition-colors"
                style={{
                  background: i % 2 === 0 ? "white" : "var(--secondary)",
                  borderBottom: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `color-mix(in oklch, oklch(0.55 0.20 240) 5%, white)` }}
                onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? "white" : "var(--secondary)" }}
              >
                {/* Title */}
                <td className="px-4 py-3 max-w-xs">
                  <div className="flex items-start gap-2">
                    {done
                      ? <CheckCircle2 size={14} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: "oklch(0.55 0.22 150)" }} />
                      : <Circle size={14} strokeWidth={2} className="shrink-0 mt-0.5 text-muted-foreground/40" />
                    }
                    <span className={`text-xs font-medium leading-relaxed ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {task.title}
                    </span>
                  </div>
                </td>
                {/* Assignees */}
                <td className="px-4 py-3">
                  {task.assigneeNames.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {task.assigneeNames.map((name) => (
                        <span key={name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: "color-mix(in oklch, oklch(0.55 0.20 240) 12%, white)", color: "oklch(0.45 0.20 240)" }}>
                          <User size={9} strokeWidth={2.5} />
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
                    <Flag size={9} strokeWidth={2.5} />
                    {label}
                  </span>
                </td>
                {/* Start Date */}
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">{formatDate(task.startDateTime)}</span>
                </td>
                {/* Due Date */}
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${overdue ? "font-bold" : ""}`}
                    style={{ color: overdue ? "oklch(0.60 0.26 25)" : "var(--muted-foreground)" }}>
                    {overdue && <AlertTriangle size={10} className="inline mr-1" strokeWidth={2.5} />}
                    {formatDate(task.dueDateTime)}
                  </span>
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

const BUCKET_PRIORITIES = [
  { label: "Urgent",    filter: (t: PlannerTaskWithAssignees) => t.priority === 1, color: "oklch(0.55 0.26 25)" },
  { label: "Important", filter: (t: PlannerTaskWithAssignees) => t.priority === 3, color: "oklch(0.65 0.20 55)" },
  { label: "Medium",    filter: (t: PlannerTaskWithAssignees) => t.priority === 5, color: "oklch(0.55 0.20 240)" },
  { label: "Low",       filter: (t: PlannerTaskWithAssignees) => t.priority === 9, color: "oklch(0.55 0.15 150)" },
]

function BoardView({ tasks }: { tasks: PlannerTaskWithAssignees[] }) {
  return (
    <div className="grid grid-cols-4 gap-4 items-start">
      {BUCKET_PRIORITIES.map(({ label, filter, color }) => {
        const group = tasks.filter(filter)
        return (
          <div key={label} className="rounded-xl border overflow-hidden"
            style={{ borderColor: `color-mix(in oklch, ${color} 22%, transparent)` }}>
            {/* Column header */}
            <div className="px-3 py-2.5 flex items-center gap-2"
              style={{ background: `color-mix(in oklch, ${color} 10%, white)`, borderBottom: `1px solid color-mix(in oklch, ${color} 20%, transparent)` }}>
              <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: color }}>
                <Flag size={9} color="white" strokeWidth={2.5} />
              </div>
              <span className="text-xs font-bold" style={{ color }}>{label}</span>
              <span className="ml-auto text-xs font-black" style={{ color }}>{group.length}</span>
            </div>
            {/* Cards */}
            <div className="flex flex-col gap-px bg-border">
              {group.length === 0 ? (
                <div className="bg-card px-3 py-6 text-center text-[11px] text-muted-foreground font-sans">No tasks</div>
              ) : (
                group.map((task) => {
                  const overdue = task.percentComplete < 100 && isOverdue(task.dueDateTime)
                  return (
                    <div key={task.id} className="bg-card px-3 py-3 flex flex-col gap-2">
                      <p className={`text-xs font-medium leading-relaxed ${task.percentComplete === 100 ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.title}
                      </p>
                      {task.assigneeNames.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {task.assigneeNames.map((name) => (
                            <span key={name} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: `color-mix(in oklch, ${color} 10%, white)`, color }}>
                              {name.split(" ").slice(0, 2).join(" ")}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-medium ${overdue ? "font-bold" : "text-muted-foreground"}`}
                          style={{ color: overdue ? "oklch(0.60 0.26 25)" : undefined }}>
                          {overdue && <AlertTriangle size={9} className="inline mr-0.5" />}
                          {formatDate(task.dueDateTime)}
                        </span>
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

// ─── Shared components ────────────────────────────────────────────────────────

function StatusPill({ percent, small }: { percent: number; small?: boolean }) {
  const { label, bg, color } =
    percent === 100 ? { label: "Done",        bg: "color-mix(in oklch, oklch(0.55 0.22 150) 12%, white)", color: "oklch(0.55 0.22 150)" } :
    percent > 0     ? { label: "In Progress", bg: "color-mix(in oklch, oklch(0.65 0.20 55)  12%, white)", color: "oklch(0.60 0.20 55)" }  :
                      { label: "Not Started", bg: "color-mix(in oklch, oklch(0.55 0.15 200) 10%, white)", color: "oklch(0.45 0.15 200)" }
  return (
    <span className={`inline-flex items-center rounded-full font-bold ${small ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"}`}
      style={{ background: bg, color }}>
      {label}
    </span>
  )
}

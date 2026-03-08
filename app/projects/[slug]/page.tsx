"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  CalendarDays,
  CheckSquare,
  FileText,
  ChevronRight,
  Users,
  Briefcase,
  Clock,
  TrendingUp,
  AlertTriangle,
  Send,
  Sparkles,
  ArrowRight,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

// ─── Webhook URLs (commented out — to be wired up from meetings page)
// const WEBHOOK_TRANSCRIPT = "https://indegene-sbx.app.n8n.cloud/webhook/meta-pm"
// const WEBHOOK_GET_MOM    = "https://indegene-sbx.app.n8n.cloud/webhook/get-mom"

function slugToTitle(slug: string) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

const TEAM = [
  { name: "Sarvesh", role: "Project Manager", initials: "SK", color: "#3b5fc0" },
  { name: "Lisa",    role: "Client Lead",     initials: "LM", color: "#0e9e6e" },
  { name: "Mayank",  role: "Strategy",        initials: "MA", color: "#c07a2a" },
  { name: "Ramona",  role: "Marketing",       initials: "RD", color: "#7c3abd" },
]

const RECENT_MEETINGS = [
  { date: "June 12", title: "Weekly Sync",       tag: null },
  { date: "June 5",  title: "Planning Session",  tag: "May 15" },
  { date: "May 21",  title: "Client Review",     tag: "Aug 2026" },
]

const OPEN_TASKS = [
  { title: "Update campaign timeline",  assignee: "Sarvesh", due: null },
  { title: "Send revised proposal",     assignee: null,      due: "May 15" },
  { title: "Review vendor shortlist",   assignee: "Ramona",  due: null },
]

const DOCUMENTS = [
  "Project Charter",
  "RACI Matrix",
  "Client SOW",
  "Kickoff Deck",
]

const SUGGESTED_PROMPTS = [
  "What decisions were made in the meeting?",
  "Show open tasks for Sarvesh",
  "What risks exist in this project?",
]

const SUGGESTED_ACTIONS = [
  "Summarize the last 3 meetings",
  "List all unresolved tasks",
]

const EXPORT_ITEMS = ["Project Charter", "RACI Matrix", "Client SOW"]

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function ProjectPage({ params }: PageProps) {
  const { slug } = use(params)
  const projectName = slugToTitle(slug)
  const { isAuthenticated, displayName } = useAuth()
  const router = useRouter()
  const [askInput, setAskInput] = useState("")

  useEffect(() => {
    if (!isAuthenticated) router.replace("/")
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  return (
    <div className="flex flex-col h-full">
      {/* Page header bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card">
        <span className="text-xs font-sans text-muted-foreground">
          <Link href="/projects" className="hover:text-primary transition-colors">Projects</Link>
          {" / "}
          <span className="text-foreground font-medium">{projectName}</span>
        </span>
      </div>

      {/* 3-column body */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.4fr)] gap-0 h-full">

          {/* ── LEFT COLUMN ── */}
          <div className="border-r border-border p-6 flex flex-col gap-5">
            {/* Title + action */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground font-sans text-balance leading-tight">
                  {projectName}
                </h1>
                <p className="text-sm text-muted-foreground font-sans mt-0.5">
                  Client: <span className="text-foreground font-medium">Gilead Sciences</span>
                </p>
              </div>
              <Link
                href={`/projects/${slug}/meetings`}
                className="shrink-0 flex items-center gap-1.5 text-xs font-sans font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-secondary transition-colors text-foreground"
              >
                Manage Project
                <ChevronRight size={13} strokeWidth={2} />
              </Link>
            </div>

            {/* Timeline chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { icon: <Clock size={12} />, label: "Start: Jan 2026" },
                { icon: <ArrowRight size={12} />, label: "End: Aug 2026" },
                { icon: <CheckSquare size={12} />, label: "+ 100 Done" },
              ].map((chip) => (
                <span
                  key={chip.label}
                  className="flex items-center gap-1 text-xs font-sans text-muted-foreground bg-secondary border border-border px-2.5 py-1 rounded-full"
                >
                  {chip.icon}
                  {chip.label}
                </span>
              ))}
            </div>

            {/* Project overview table */}
            <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-0 divide-y divide-border">
              <h2 className="text-sm font-semibold text-foreground font-sans pb-3">Project Overview</h2>
              {[
                { label: "Client",          value: "Gilead Sciences" },
                { label: "Project Manager", value: displayName ?? "Sarvesh" },
                { label: "Start Date",      value: "Jan 2026" },
                { label: "End Date",        value: "Aug 2026" },
                { label: "Project Status",  value: "Active",  badge: true },
                { label: "Project Type",    value: "Marketing Campaign" },
                { label: "Program",         value: "Product Launch" },
                { label: "Budget",          value: "$250,000" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 gap-4">
                  <span className="text-xs text-muted-foreground font-sans">{row.label}</span>
                  {row.badge ? (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded font-sans"
                      style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                      {row.value}
                    </span>
                  ) : (
                    <span className="text-xs text-foreground font-sans font-medium text-right">{row.value}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Team */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={14} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground font-sans">Team</h2>
              </div>
              <div className="flex flex-wrap gap-4">
                {TEAM.map((m) => (
                  <div key={m.name} className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold font-sans"
                      style={{ background: m.color }}
                    >
                      {m.initials}
                    </div>
                    <span className="text-xs font-sans text-foreground font-medium">{m.name}</span>
                    <span className="text-[10px] font-sans text-muted-foreground">{m.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Meetings list */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground font-sans">Recent Meetings</h2>
                </div>
                <Link href={`/projects/${slug}/meetings`} className="text-xs text-primary hover:underline font-sans">
                  View all
                </Link>
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {RECENT_MEETINGS.map((m) => (
                  <li key={m.title}>
                    <Link
                      href={`/projects/${slug}/meetings`}
                      className="flex items-center justify-between py-2.5 hover:bg-secondary rounded-lg px-2 -mx-2 transition-colors"
                    >
                      <span className="text-xs font-sans text-foreground">
                        <span className="text-muted-foreground">{m.date} – </span>
                        <span className="font-medium">{m.title}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {m.tag && <span className="text-[10px] text-muted-foreground font-sans">{m.tag}</span>}
                        <ChevronRight size={13} className="text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── MIDDLE COLUMN ── */}
          <div className="border-r border-border p-6 flex flex-col gap-5">

            {/* Recent Meetings stats */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground font-sans">Recent Meetings</h2>
                </div>
                <Link href={`/projects/${slug}/meetings`} className="text-xs text-primary hover:underline font-sans">
                  View all
                </Link>
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {[
                  { label: "Total Meetings",  value: 12 },
                  { label: "Open Tasks",      value: 28 },
                  { label: "Key Decisions",   value: 10 },
                ].map((stat) => (
                  <li key={stat.label} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={13} className="text-muted-foreground" />
                      <span className="text-xs font-sans text-foreground">{stat.label}</span>
                    </div>
                    <span className="text-xs font-bold font-sans text-foreground">{stat.value}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/projects/${slug}/meetings`}
                className="flex items-center gap-1 text-xs text-primary hover:underline font-sans mt-3"
              >
                View all tasks
                <ChevronRight size={12} />
              </Link>
            </div>

            {/* Open Tasks */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare size={14} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground font-sans">Open Tasks</h2>
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {OPEN_TASKS.map((task) => (
                  <li key={task.title}>
                    <div className="flex items-center justify-between py-2.5 gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: "var(--primary)" }}
                        />
                        <span className="text-xs font-sans text-foreground truncate">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.assignee && (
                          <span className="text-[10px] font-sans text-muted-foreground">{task.assignee}</span>
                        )}
                        {task.due && (
                          <span className="text-[10px] font-sans text-muted-foreground">{task.due}</span>
                        )}
                        <ChevronRight size={12} className="text-muted-foreground" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                href={`/projects/${slug}/meetings`}
                className="flex items-center gap-1 text-xs text-primary hover:underline font-sans mt-3"
              >
                View all tasks
                <ChevronRight size={12} />
              </Link>
            </div>

            {/* Documents */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={14} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground font-sans">Documents</h2>
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {DOCUMENTS.map((doc) => (
                  <li key={doc}>
                    <div className="flex items-center gap-2.5 py-2.5 hover:bg-secondary rounded-lg px-2 -mx-2 transition-colors cursor-pointer">
                      <FileText size={13} className="text-muted-foreground shrink-0" />
                      <span className="text-xs font-sans text-foreground">{doc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="p-6 flex flex-col gap-5 bg-secondary/30">

            {/* Ask MetaPM */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={14} style={{ color: "var(--primary)" }} />
                <h2 className="text-sm font-semibold text-foreground font-sans">Ask MetaPM</h2>
              </div>
              {/* Input */}
              <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 mb-3 bg-background">
                <input
                  type="text"
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  placeholder="Ask anything about this project..."
                  className="flex-1 text-xs font-sans bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                />
                <button
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Send"
                >
                  <Send size={14} />
                </button>
              </div>
              {/* Suggested prompts */}
              <div className="flex flex-col gap-1.5">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAskInput(p)}
                    className="text-left text-xs font-sans text-muted-foreground hover:text-foreground hover:bg-secondary px-2 py-1.5 rounded-lg transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Insights */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground font-sans mb-4">Quick Insights</h2>
              <ul className="flex flex-col divide-y divide-border">
                {[
                  { icon: <CalendarDays size={13} />, label: "Total Meetings", value: 12, alert: false },
                  { icon: <CheckSquare   size={13} />, label: "Open Tasks",     value: 28, alert: true  },
                  { icon: <Briefcase    size={13} />, label: "Key Decisions",  value: 10, alert: true  },
                  { icon: <AlertTriangle size={13} />, label: "Risks",          value: 3,  alert: true  },
                ].map((item) => (
                  <li key={item.label} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {item.icon}
                      <span className="text-xs font-sans text-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-sans text-foreground">{item.value}</span>
                      {item.alert && (
                        <AlertTriangle size={12} className="text-orange-400" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Suggested Actions */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground font-sans mb-3">Suggested Actions</h2>
              <div className="flex flex-col gap-2">
                {SUGGESTED_ACTIONS.map((action) => (
                  <button
                    key={action}
                    className="flex items-center justify-between w-full text-xs font-sans text-foreground px-3 py-2.5 rounded-lg border border-border hover:bg-secondary hover:border-primary/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={12} className="text-muted-foreground" />
                      {action}
                    </div>
                    <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Export Insights */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground font-sans mb-3">Export Insights</h2>
              <ul className="flex flex-col divide-y divide-border">
                {EXPORT_ITEMS.map((item) => (
                  <li key={item}>
                    <button className="flex items-center gap-2.5 w-full py-2.5 hover:bg-secondary px-2 -mx-2 rounded-lg transition-colors text-left">
                      <FileText size={13} className="text-muted-foreground shrink-0" />
                      <span className="text-xs font-sans text-foreground">{item}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

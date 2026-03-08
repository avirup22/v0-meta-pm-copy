"use client"

import { use } from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import {
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Clock,
  Filter,
  Search,
  Users,
  Plus,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string }>
}

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// Mock past meetings data — in production this would come from your API / DB
const MOCK_MEETINGS = [
  {
    id: "weekly-sync-2026-06-12",
    title: "Weekly Sync",
    date: "2026-06-12",
    displayDate: "June 12",
    participants: 5,
    duration: 45,
    taskCount: 4,
    decisionCount: 2,
    hasTranscript: true,
    hasMOM: true,
  },
  {
    id: "planning-session-2026-06-05",
    title: "Planning Session",
    date: "2026-06-05",
    displayDate: "June 5",
    participants: 7,
    duration: 60,
    taskCount: 0,
    decisionCount: 3,
    hasTranscript: true,
    hasMOM: false,
  },
  {
    id: "stakeholder-call-2026-06-30",
    title: "Stakeholder Call",
    date: "2026-06-30",
    displayDate: "June 30",
    participants: 4,
    duration: 30,
    taskCount: 4,
    decisionCount: 0,
    hasTranscript: false,
    hasMOM: false,
  },
  {
    id: "client-review-2026-05-21",
    title: "Client Review",
    date: "2026-05-21",
    displayDate: "May 21",
    participants: 6,
    duration: 50,
    taskCount: 4,
    decisionCount: 1,
    hasTranscript: true,
    hasMOM: true,
  },
  {
    id: "project-kickoff-2026-05-14",
    title: "Project Kickoff",
    date: "2026-05-14",
    displayDate: "May 14",
    participants: 10,
    duration: 90,
    taskCount: 4,
    decisionCount: 4,
    hasTranscript: true,
    hasMOM: true,
  },
]

function MeetingRow({
  meeting,
  projectSlug,
}: {
  meeting: typeof MOCK_MEETINGS[0]
  projectSlug: string
}) {
  return (
    <Link
      href={`/projects/${projectSlug}/meetings/${meeting.id}`}
      className="group flex items-center gap-4 px-6 py-4 bg-card border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer"
    >
      {/* Date badge */}
      <div
        className="flex flex-col items-center justify-center w-12 h-12 rounded-xl shrink-0 font-sans"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        <span className="text-[10px] font-medium uppercase leading-none opacity-80">
          {meeting.displayDate.split(" ")[0]}
        </span>
        <span className="text-lg font-bold leading-tight">
          {meeting.displayDate.split(" ")[1]}
        </span>
      </div>

      {/* Title + meta */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground font-sans group-hover:text-primary transition-colors truncate">
          {meeting.displayDate} &ndash; {meeting.title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-sans">
          <span className="flex items-center gap-1">
            <Users size={11} strokeWidth={2} />
            {meeting.participants} participants
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} strokeWidth={2} />
            {meeting.duration} min
          </span>
          {meeting.hasTranscript && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ background: "oklch(0.52 0.16 240 / 0.1)", color: "var(--primary)" }}>
              Transcript
            </span>
          )}
          {meeting.hasMOM && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ background: "oklch(0.38 0.09 200 / 0.12)", color: "var(--brand-teal)" }}>
              MOM
            </span>
          )}
        </div>
      </div>

      {/* Task + decision counts */}
      <div className="flex items-center gap-4 shrink-0">
        {meeting.taskCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-sans text-muted-foreground">
            <CheckSquare size={13} strokeWidth={1.8} />
            <span>{meeting.taskCount} Tasks</span>
          </div>
        )}
        {meeting.decisionCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-sans text-muted-foreground">
            <CalendarDays size={13} strokeWidth={1.8} />
            <span>{meeting.decisionCount} Decisions</span>
          </div>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight
        size={16}
        strokeWidth={1.8}
        className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
      />
    </Link>
  )
}

export default function MeetingsListPage({ params }: PageProps) {
  const { slug } = use(params)
  const projectName = slugToTitle(slug)
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) router.replace("/")
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  return (
    <div className="flex flex-col h-full">

      {/* Page header */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground font-sans mb-0.5">{projectName}</p>
            <h1 className="text-xl font-bold text-foreground font-sans">Meetings</h1>
          </div>
          <button
            className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-sans font-medium text-primary-foreground transition-colors"
            style={{ background: "var(--primary)" }}
          >
            <Plus size={14} strokeWidth={2.5} />
            New Meeting
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 h-8 rounded-lg border border-border bg-background text-xs font-sans text-muted-foreground">
            <Filter size={12} strokeWidth={2} />
            Any Time
            <ChevronRight size={12} strokeWidth={2} className="rotate-90" />
          </div>
          <div className="flex items-center gap-2 px-3 h-8 rounded-lg border border-border bg-background text-xs font-sans text-muted-foreground">
            <CalendarDays size={12} strokeWidth={2} />
            {projectName}
            <ChevronRight size={12} strokeWidth={2} className="rotate-90" />
          </div>
          <div className="flex items-center gap-2 px-3 h-8 rounded-lg border border-border bg-background text-xs font-sans text-muted-foreground">
            <Users size={12} strokeWidth={2} />
            People
            <ChevronRight size={12} strokeWidth={2} className="rotate-90" />
          </div>
          <div className="ml-auto flex items-center gap-2 px-3 h-8 rounded-lg border border-border bg-background text-xs font-sans text-muted-foreground">
            <Search size={12} strokeWidth={2} />
            Search meetings...
          </div>
        </div>
      </div>

      {/* Sub-nav tabs */}
      <div className="bg-card border-b border-border px-8">
        <div className="flex items-center gap-0">
          {["Meetings", "Generated Tasks", "Decisions", "Notes"].map((tab, i) => (
            <button
              key={tab}
              className="relative px-4 py-3 text-sm font-sans font-medium transition-colors"
              style={{
                color: i === 0 ? "var(--primary)" : "var(--muted-foreground)",
              }}
            >
              {tab}
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: "var(--primary)" }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Meetings list */}
      <div className="flex-1 overflow-y-auto bg-background">
        {MOCK_MEETINGS.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <CalendarDays size={40} strokeWidth={1} className="text-muted-foreground" />
            <p className="text-sm font-sans text-muted-foreground">No meetings yet. Import from Teams or upload a transcript to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {MOCK_MEETINGS.map((meeting) => (
              <MeetingRow key={meeting.id} meeting={meeting} projectSlug={slug} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { fetchMeetingDatabase, fetchAllCustomersWithProjects, type MeetingDatabase } from "@/lib/graph"
import {
  ChevronRight,
  Users,
  Clock,
  Loader2,
  AlertTriangle,
  Edit2,
  Save,
  X,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string; meetingId: string }>
}

type Tab = "mom" | "decisions" | "actions" | "risks" | "discussions"

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

function meetingIdToTitle(id: string) {
  return id.replace(/-\d{4}-\d{2}-\d{2}$/, "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

export default function MeetingDetailPage({ params }: PageProps) {
  const { slug, meetingId } = use(params)
  const projectName = slugToTitle(slug)
  const meetingTitle = meetingIdToTitle(meetingId)
  const { isAuthenticated, token } = useAuth()
  const router = useRouter()

  // State
  const [activeTab, setActiveTab] = useState<Tab>("mom")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meeting, setMeeting] = useState<any>(null)
  const [decisions, setDecisions] = useState<any[]>([])
  const [actions, setActions] = useState<any[]>([])
  const [risks, setRisks] = useState<any[]>([])
  const [discussions, setDiscussions] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")

  useEffect(() => {
    if (!isAuthenticated) router.replace("/")
  }, [isAuthenticated, router])

  useEffect(() => {
    const loadMeetingData = async () => {
      if (!token) return
      
      try {
        setLoading(true)
        setError(null)

        // Get project folder ID
        const customers = await fetchAllCustomersWithProjects(token)
        let projectFolderId: string | null = null
        
        for (const { projects } of customers) {
          const project = projects.find((p) => {
            const projectSlug = p.name.toLowerCase().replace(/\s+/g, "-")
            return projectSlug === slug
          })
          if (project) {
            projectFolderId = project.id
            break
          }
        }

        if (!projectFolderId) {
          setError("Project not found")
          return
        }

        // Fetch meeting database
        const db = await fetchMeetingDatabase(token, projectFolderId)
        
        // Find the current meeting
        const currentMeeting = db.meetings.find((m) => m.Meeting_ID === meetingId)
        if (!currentMeeting) {
          setError("Meeting not found")
          return
        }

        setMeeting(currentMeeting)
        setDecisions(db.decisions.filter((d) => d.Meeting_ID === meetingId))
        setActions(db.actions.filter((a) => a.Meeting_ID === meetingId))
        setRisks(db.risks.filter((r) => r.Meeting_ID === meetingId))
        setDiscussions(db.discussion.filter((dp) => dp.Meeting_ID === meetingId))

      } catch (err) {
        console.error("[v0] Failed to load meeting data:", err)
        setError(err instanceof Error ? err.message : "Failed to load meeting data")
      } finally {
        setLoading(false)
      }
    }

    loadMeetingData()
  }, [slug, meetingId, token, isAuthenticated])

  if (!isAuthenticated) return null

  // Generate MOM from all data
  const generateMOM = () => {
    let mom = `# Minutes of Meeting: ${meeting?.Meeting_title || meetingTitle}\n\n`
    mom += `**Date:** ${meeting?.Meeting_date || "—"}\n`
    mom += `**Organizer:** ${meeting?.Organizer || "—"}\n\n`
    
    if (decisions.length > 0) {
      mom += `## Decisions\n`
      decisions.forEach((d) => {
        mom += `- ${d.Decision}\n`
      })
      mom += `\n`
    }

    if (actions.length > 0) {
      mom += `## Action Items\n`
      actions.forEach((a) => {
        mom += `| Task | Owner | Due Date | Status |\n`
        mom += `|------|-------|----------|--------|\n`
        actions.forEach((item) => {
          mom += `| ${item.Task} | ${item.Owner} | ${item.Due_Date} | ${item.Status} |\n`
        })
      })
      mom += `\n`
    }

    if (risks.length > 0) {
      mom += `## Risks\n`
      risks.forEach((r) => {
        mom += `- ${r.Risk}\n`
      })
      mom += `\n`
    }

    if (discussions.length > 0) {
      mom += `## Discussion Points\n`
      discussions.forEach((dp) => {
        mom += `- ${dp.Discussion}\n`
      })
    }

    return mom
  }

  const handleEditStart = (id: string, text: string) => {
    setEditingId(id)
    setEditingText(text)
  }

  const handleEditSave = () => {
    // TODO: Implement save to Excel
    console.log("[v0] Save edit:", { id: editingId, text: editingText })
    setEditingId(null)
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "mom", label: "MOM" },
    { key: "decisions", label: "Decisions" },
    { key: "actions", label: "Actions" },
    { key: "risks", label: "Risks" },
    { key: "discussions", label: "Discussions" },
  ]

  return (
    <div className="flex flex-col h-full">

      {/* Page header */}
      <div className="bg-card border-b border-border px-8 py-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans mb-3">
          <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors">{projectName}</Link>
          <ChevronRight size={12} strokeWidth={2} />
          <Link href={`/projects/${slug}/meetings`} className="hover:text-foreground transition-colors">Meetings</Link>
          <ChevronRight size={12} strokeWidth={2} />
          <span className="text-foreground font-medium">{meetingTitle}</span>
        </div>

        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-bold text-foreground font-sans">
              {meeting?.Meeting_title || meetingTitle}
            </h1>
            <div className="flex items-center gap-4 text-xs text-muted-foreground font-sans">
              <span>{meeting?.Meeting_date || "—"}</span>
              <span className="flex items-center gap-1"><Users size={11} strokeWidth={2} /> {meeting?.Organizer || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-card border-b border-border px-8">
        <div className="flex items-center">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative px-4 py-3 text-sm font-sans font-medium transition-colors"
              style={{ color: activeTab === tab.key ? "var(--primary)" : "var(--muted-foreground)" }}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: "var(--primary)" }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-background">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Loader2 size={40} strokeWidth={1.5} className="text-muted-foreground animate-spin" />
            <p className="text-sm font-sans text-muted-foreground">Loading meeting data...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <AlertTriangle size={40} strokeWidth={1} className="text-red-500" />
            <p className="text-sm font-sans text-red-500">{error}</p>
          </div>
        ) : (
          <div className="p-8 max-w-4xl">
            {activeTab === "mom" && (
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-lg font-semibold text-foreground font-sans mb-4">Minutes of Meeting</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="bg-secondary p-4 rounded-lg overflow-x-auto text-xs font-mono text-foreground whitespace-pre-wrap break-words">
                    {generateMOM()}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === "decisions" && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground font-sans">Decisions</h2>
                {decisions.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-sans">No decisions recorded</p>
                ) : (
                  decisions.map((d) => (
                    <div key={d.Decision_ID} className="bg-card rounded-lg border border-border p-4">
                      {editingId === d.Decision_ID ? (
                        <div className="flex gap-2">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button onClick={handleEditSave} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-sans text-sm">
                            <Save size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-2 border border-border rounded-lg hover:bg-secondary transition-colors font-sans text-sm">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-foreground font-sans">{d.Decision}</p>
                          <button onClick={() => handleEditStart(d.Decision_ID, d.Decision)} className="text-muted-foreground hover:text-primary transition-colors">
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "actions" && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground font-sans">Actions</h2>
                {actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-sans">No actions recorded</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-sans">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="px-4 py-2 text-xs font-semibold text-foreground">Task</th>
                          <th className="px-4 py-2 text-xs font-semibold text-foreground">Owner</th>
                          <th className="px-4 py-2 text-xs font-semibold text-foreground">Due Date</th>
                          <th className="px-4 py-2 text-xs font-semibold text-foreground">Status</th>
                          <th className="px-4 py-2 text-xs font-semibold text-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actions.map((a) => (
                          <tr key={a.Action_ID} className="border-b border-border hover:bg-secondary/50 transition-colors">
                            <td className="px-4 py-2">{a.Task}</td>
                            <td className="px-4 py-2">{a.Owner}</td>
                            <td className="px-4 py-2">{a.Due_Date}</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-1 rounded text-xs bg-secondary text-foreground">{a.Status}</span>
                            </td>
                            <td className="px-4 py-2">
                              <button onClick={() => handleEditStart(a.Action_ID, a.Task)} className="text-muted-foreground hover:text-primary transition-colors">
                                <Edit2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "risks" && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground font-sans">Risks</h2>
                {risks.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-sans">No risks recorded</p>
                ) : (
                  risks.map((r) => (
                    <div key={r.Risk_ID} className="bg-card rounded-lg border border-border p-4">
                      {editingId === r.Risk_ID ? (
                        <div className="flex gap-2">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button onClick={handleEditSave} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-sans text-sm">
                            <Save size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-2 border border-border rounded-lg hover:bg-secondary transition-colors font-sans text-sm">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-foreground font-sans">{r.Risk}</p>
                          <button onClick={() => handleEditStart(r.Risk_ID, r.Risk)} className="text-muted-foreground hover:text-primary transition-colors">
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "discussions" && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground font-sans">Discussion Points</h2>
                {discussions.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-sans">No discussion points recorded</p>
                ) : (
                  discussions.map((dp) => (
                    <div key={dp.Discussion_ID} className="bg-card rounded-lg border border-border p-4">
                      {editingId === dp.Discussion_ID ? (
                        <div className="flex gap-2">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button onClick={handleEditSave} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-sans text-sm">
                            <Save size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-2 border border-border rounded-lg hover:bg-secondary transition-colors font-sans text-sm">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-foreground font-sans">{dp.Discussion}</p>
                          <button onClick={() => handleEditStart(dp.Discussion_ID, dp.Discussion)} className="text-muted-foreground hover:text-primary transition-colors">
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

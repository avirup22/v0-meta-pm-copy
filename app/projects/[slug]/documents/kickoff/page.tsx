"use client"

import { use, useState } from "react"
import Link from "next/link"
import { KonvaSlideRenderer } from "@/components/konva-slide-renderer"
import {
  ChevronLeft,
  ChevronRight,
  Presentation,
  Download,
  Sparkles,
  Loader2,
  CheckCircle2,
  Users,
  Target,
  CalendarRange,
  AlertTriangle,
  BarChart3,
  FileText,
  Pencil,
  X,
  Plus,
  Check,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string }>
}

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

const KICKOFF_COLOR = "oklch(0.62 0.18 35)"

// ─── Slide data types ────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  name: string
  role: string
  responsibilities: string
}

interface Milestone {
  id: string
  name: string
  date: string
  status: "planned" | "in-progress" | "complete"
}

interface Risk {
  id: string
  description: string
  impact: "High" | "Medium" | "Low"
  mitigation: string
}

interface KickoffData {
  projectName: string
  client: string
  startDate: string
  endDate: string
  projectManager: string
  overview: string
  objectives: string[]
  scope: string[]
  outOfScope: string[]
  team: TeamMember[]
  milestones: Milestone[]
  risks: Risk[]
  nextSteps: string[]
}

const MOCK_DATA: KickoffData = {
  projectName: "Digital Transformation Programme",
  client: "Acme Corp",
  startDate: "1 Apr 2026",
  endDate: "31 Dec 2026",
  projectManager: "Sarah Mitchell",
  overview:
    "A nine-month programme to modernise Acme Corp's core systems, migrate legacy data to cloud, and deliver a unified customer-facing portal — improving operational efficiency by 35%.",
  objectives: [
    "Migrate all legacy on-premise systems to AWS by Q3 2026",
    "Launch unified customer portal with SSO across all products",
    "Reduce IT operational costs by 30% within 12 months post-launch",
    "Achieve ISO 27001 compliance for all new cloud workloads",
  ],
  scope: [
    "CRM system replacement (Salesforce)",
    "ERP cloud migration (SAP S/4HANA)",
    "Customer portal design & development",
    "Data migration & quality assurance",
    "Change management & end-user training",
  ],
  outOfScope: [
    "Legacy hardware decommissioning (separate workstream)",
    "Third-party integrations outside core ERP/CRM",
    "Mobile application development",
  ],
  team: [
    { id: "t1", name: "Sarah Mitchell", role: "Project Manager", responsibilities: "Overall delivery, stakeholder comms, risk management" },
    { id: "t2", name: "James Okafor", role: "Technical Lead", responsibilities: "Architecture decisions, code review, DevOps" },
    { id: "t3", name: "Priya Sharma", role: "Business Analyst", responsibilities: "Requirements gathering, UAT coordination" },
    { id: "t4", name: "Tom Eriksson", role: "UX Designer", responsibilities: "Portal design, design system, accessibility" },
    { id: "t5", name: "Li Wei", role: "Data Engineer", responsibilities: "Migration scripts, data quality, ETL pipelines" },
  ],
  milestones: [
    { id: "m1", name: "Project Kickoff", date: "1 Apr 2026", status: "complete" },
    { id: "m2", name: "Discovery & Requirements Complete", date: "30 Apr 2026", status: "in-progress" },
    { id: "m3", name: "Architecture Design Approved", date: "31 May 2026", status: "planned" },
    { id: "m4", name: "Development Sprint 1 Complete", date: "30 Jun 2026", status: "planned" },
    { id: "m5", name: "UAT Sign-off", date: "31 Oct 2026", status: "planned" },
    { id: "m6", name: "Go-Live", date: "1 Dec 2026", status: "planned" },
  ],
  risks: [
    { id: "r1", description: "Legacy data quality issues causing migration delays", impact: "High", mitigation: "Early data profiling sprint in April; dedicated data quality team" },
    { id: "r2", description: "Resource availability during peak business periods", impact: "Medium", mitigation: "Resource plan agreed with client; no releases in Nov" },
    { id: "r3", description: "Scope creep from additional integration requests", impact: "Medium", mitigation: "Formal change control process; weekly scope review" },
    { id: "r4", description: "Third-party vendor delivery delays (SAP)", impact: "High", mitigation: "Vendor SLAs in contract; fortnightly vendor sync" },
  ],
  nextSteps: [
    "Distribute project charter to all stakeholders by 4 Apr",
    "Schedule weekly steering committee — every Monday 9am",
    "Complete stakeholder RACI and distribute by 7 Apr",
    "Begin discovery workshops week of 8 Apr",
    "Set up Jira project board and onboard team by 5 Apr",
  ],
}

const STATUS_COLORS = {
  planned: { bg: "oklch(0.93 0.04 240)", color: "oklch(0.45 0.15 240)", label: "Planned" },
  "in-progress": { bg: "oklch(0.93 0.08 50)", color: "oklch(0.50 0.20 50)", label: "In Progress" },
  complete: { bg: "oklch(0.92 0.10 145)", color: "oklch(0.42 0.18 145)", label: "Complete" },
}

const IMPACT_COLORS = {
  High: { bg: "color-mix(in oklch, oklch(0.55 0.26 25) 10%, white)", color: "oklch(0.50 0.26 25)", border: "color-mix(in oklch, oklch(0.55 0.26 25) 22%, transparent)" },
  Medium: { bg: "color-mix(in oklch, oklch(0.65 0.20 55) 10%, white)", color: "oklch(0.48 0.18 55)", border: "color-mix(in oklch, oklch(0.65 0.20 55) 22%, transparent)" },
  Low: { bg: "color-mix(in oklch, oklch(0.55 0.22 150) 10%, white)", color: "oklch(0.42 0.18 145)", border: "color-mix(in oklch, oklch(0.55 0.22 150) 22%, transparent)" },
}

type SlideId = "title" | "overview" | "objectives" | "scope" | "team" | "timeline" | "risks" | "next-steps"

const SLIDES: { id: SlideId; label: string; icon: React.ElementType }[] = [
  { id: "title", label: "Title", icon: Presentation },
  { id: "overview", label: "Overview", icon: FileText },
  { id: "objectives", label: "Objectives", icon: Target },
  { id: "scope", label: "Scope", icon: BarChart3 },
  { id: "team", label: "Team", icon: Users },
  { id: "timeline", label: "Timeline", icon: CalendarRange },
  { id: "risks", label: "Risks", icon: AlertTriangle },
  { id: "next-steps", label: "Next Steps", icon: CheckCircle2 },
]

export default function KickoffPage({ params }: PageProps) {
  const { slug } = use(params)
  const projectName = slugToTitle(slug)

  const [data, setData] = useState<KickoffData>({ ...MOCK_DATA, projectName })
  const [activeSlide, setActiveSlide] = useState<SlideId>("title")
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    await new Promise(r => setTimeout(r, 800))
    setGenerating(false)
    setGenerated(true)
  }

  async function handleDownload() {
    try {
      const response = await fetch(`/api/generate-pptx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Failed to generate PPTX")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${data.projectName}-Kickoff.pptx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Failed to download PPTX:", err)
    }
  }

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
          <span className="text-foreground font-semibold">Kickoff Presentation</span>
        </div>
        <div className="flex items-center gap-2">
          {generated && (
            <button onClick={handleDownload} className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-secondary transition-all"
              style={{ color: "var(--muted-foreground)" }}>
              <Download size={11} strokeWidth={2} />
              Download PPTX
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 text-[11px] font-bold px-4 py-1.5 rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: KICKOFF_COLOR }}>
            {generating ? <Loader2 size={11} className="animate-spin" /> : generated ? <CheckCircle2 size={11} strokeWidth={2.5} /> : <Sparkles size={11} strokeWidth={2.5} />}
            {generating ? "Generating..." : generated ? "Regenerate" : "Generate PPTX"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Slide navigator ── */}
        <aside className="w-48 border-r border-border bg-card shrink-0 overflow-y-auto flex flex-col py-3">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground px-4 mb-2">Slides</p>
          {SLIDES.map((slide, idx) => {
            const isActive = activeSlide === slide.id
            return (
              <button key={slide.id}
                onClick={() => setActiveSlide(slide.id)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-left transition-all hover:bg-secondary/60 group"
                style={{
                  background: isActive ? `color-mix(in oklch, ${KICKOFF_COLOR} 8%, white)` : "transparent",
                  borderLeft: isActive ? `2px solid ${KICKOFF_COLOR}` : "2px solid transparent",
                }}>
                <span className="text-[9px] font-bold w-4 text-muted-foreground/60">{String(idx + 1).padStart(2, "0")}</span>
                <slide.icon size={13} style={{ color: isActive ? KICKOFF_COLOR : "var(--muted-foreground)" }} strokeWidth={2} />
                <span className="text-[11px] font-semibold font-sans"
                  style={{ color: isActive ? KICKOFF_COLOR : "var(--muted-foreground)" }}>
                  {slide.label}
                </span>
              </button>
            )
          })}
        </aside>

        {/* ── Konva canvas viewer ── */}
        <main className="flex-1 overflow-y-auto bg-muted/30 p-8 flex flex-col items-center justify-center">
          <div className="w-full max-w-4xl">
            <div className="rounded-2xl border border-border overflow-hidden shadow-lg" style={{ background: "white" }}>
              <div style={{ width: "960px", height: "540px" }}>
                <KonvaSlideRenderer data={data} currentSlide={getSlideIndex(activeSlide)} />
              </div>
            </div>

            {/* ── Slide navigation buttons ── */}
            <div className="flex items-center justify-between mt-6 gap-4">
              <button
                onClick={() => goToPreviousSlide()}
                disabled={activeSlide === "title"}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-50 transition-all text-sm font-semibold"
                style={{ color: "var(--muted-foreground)" }}>
                <ChevronLeft size={14} strokeWidth={2} />
                Previous
              </button>
              <p className="text-xs font-semibold text-muted-foreground">
                {getSlideIndex(activeSlide) + 1} / 8
              </p>
              <button
                onClick={() => goToNextSlide()}
                disabled={activeSlide === "nextSteps"}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-50 transition-all text-sm font-semibold"
                style={{ color: "var(--muted-foreground)" }}>
                Next
                <ChevronRight size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )

  function getSlideIndex(id: SlideId): number {
    return SLIDES.findIndex(s => s.id === id)
  }

  function goToPreviousSlide() {
    const idx = getSlideIndex(activeSlide)
    if (idx > 0) setActiveSlide(SLIDES[idx - 1].id)
  }

  function goToNextSlide() {
    const idx = getSlideIndex(activeSlide)
    if (idx < SLIDES.length - 1) setActiveSlide(SLIDES[idx + 1].id)
  }
}

// ─── Helper Components ────────────────────────────────────────────────────

type SlideId = "title" | "overview" | "objectives" | "scope" | "team" | "timeline" | "risks" | "nextSteps"

interface Slide {
  id: SlideId
  label: string
  icon: React.ElementType
}

const SLIDES: Slide[] = [
  { id: "title", label: "Title", icon: Presentation },
  { id: "overview", label: "Overview", icon: FileText },
  { id: "objectives", label: "Objectives", icon: Target },
  { id: "scope", label: "Scope", icon: BarChart3 },
  { id: "team", label: "Team", icon: Users },
  { id: "timeline", label: "Timeline", icon: CalendarRange },
] value={data.client} onChange={v => setData({ ...data, client: v })}
                          className="text-white/80 text-sm font-semibold font-sans" placeholder="Client" />
                        <span className="text-white/40">·</span>
                        <EditableText value={data.projectManager} onChange={v => setData({ ...data, projectManager: v })}
                          className="text-white/80 text-sm font-semibold font-sans" placeholder="Project Manager" />
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-white/50 text-[9px] uppercase tracking-wider font-sans">Start Date</p>
                        <EditableText value={data.startDate} onChange={v => setData({ ...data, startDate: v })}
                          className="text-white text-xs font-bold font-sans" placeholder="Start Date" />
                      </div>
                      <div>
                        <p className="text-white/50 text-[9px] uppercase tracking-wider font-sans">End Date</p>
                        <EditableText value={data.endDate} onChange={v => setData({ ...data, endDate: v })}
                          className="text-white text-xs font-bold font-sans" placeholder="End Date" />
                      </div>
                    </div>
                  </div>
                </div>
              </SlideCard>
            )}

            {/* ── OVERVIEW SLIDE ── */}
            {activeSlide === "overview" && (
              <SlideCard label="02 · Project Overview">
                <div className="rounded-2xl border border-border bg-white p-8 flex flex-col gap-5 min-h-[340px]">
                  <SlideSectionHeader icon={FileText} color={KICKOFF_COLOR} title="Project Overview" />
                  <div className="rounded-xl border border-border bg-muted/20 p-5">
                    <EditableTextarea
                      value={data.overview}
                      onChange={v => setData({ ...data, overview: v })}
                      className="text-sm font-sans text-foreground leading-relaxed w-full bg-transparent outline-none resize-none"
                      rows={5}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {[
                      { label: "Client", value: data.client },
                      { label: "PM", value: data.projectManager },
                      { label: "Duration", value: `${data.startDate} – ${data.endDate}` },
                    ].map(item => (
                      <div key={item.label} className="rounded-lg border border-border p-3">
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                        <p className="text-xs font-bold text-foreground font-sans mt-1">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </SlideCard>
            )}

            {/* ── OBJECTIVES SLIDE ── */}
            {activeSlide === "objectives" && (
              <SlideCard label="03 · Objectives">
                <div className="rounded-2xl border border-border bg-white p-8 flex flex-col gap-5 min-h-[340px]">
                  <SlideSectionHeader icon={Target} color={KICKOFF_COLOR} title="Project Objectives" />
                  <EditableList
                    items={data.objectives}
                    onChange={items => setData({ ...data, objectives: items })}
                    color={KICKOFF_COLOR}
                    icon={<Target size={13} strokeWidth={2.5} />}
                  />
                </div>
              </SlideCard>
            )}

            {/* ── SCOPE SLIDE ── */}
            {activeSlide === "scope" && (
              <SlideCard label="04 · Scope">
                <div className="rounded-2xl border border-border bg-white p-8 flex flex-col gap-5 min-h-[400px]">
                  <SlideSectionHeader icon={BarChart3} color={KICKOFF_COLOR} title="Scope" />
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider mb-3"
                        style={{ color: "oklch(0.42 0.18 145)" }}>In Scope</p>
                      <EditableList items={data.scope} onChange={items => setData({ ...data, scope: items })}
                        color="oklch(0.42 0.18 145)"
                        icon={<Check size={12} strokeWidth={2.5} style={{ color: "oklch(0.42 0.18 145)" }} />} />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider mb-3"
                        style={{ color: "oklch(0.50 0.26 25)" }}>Out of Scope</p>
                      <EditableList items={data.outOfScope} onChange={items => setData({ ...data, outOfScope: items })}
                        color="oklch(0.50 0.26 25)"
                        icon={<X size={12} strokeWidth={2.5} style={{ color: "oklch(0.50 0.26 25)" }} />} />
                    </div>
                  </div>
                </div>
              </SlideCard>
            )}

            {/* ── TEAM SLIDE ── */}
            {activeSlide === "team" && (
              <SlideCard label="05 · Team">
                <div className="rounded-2xl border border-border bg-white p-8 flex flex-col gap-5 min-h-[400px]">
                  <div className="flex items-center justify-between">
                    <SlideSectionHeader icon={Users} color={KICKOFF_COLOR} title="Project Team" />
                    <button
                      onClick={() => setData({ ...data, team: [...data.team, { id: `t${Date.now()}`, name: "Team Member", role: "Role", responsibilities: "" }] })}
                      className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-border hover:bg-secondary transition-colors"
                      style={{ color: "var(--muted-foreground)" }}>
                      <Plus size={10} strokeWidth={2.5} /> Add Member
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {data.team.map((member, i) => (
                      <div key={member.id} className="rounded-xl border border-border p-4 flex items-start gap-3 group relative">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-black"
                          style={{ background: KICKOFF_COLOR }}>
                          {member.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <input value={member.name}
                            onChange={e => { const t = [...data.team]; t[i] = { ...t[i], name: e.target.value }; setData({ ...data, team: t }) }}
                            className="text-xs font-bold text-foreground font-sans w-full bg-transparent outline-none border-b border-transparent focus:border-border" />
                          <input value={member.role}
                            onChange={e => { const t = [...data.team]; t[i] = { ...t[i], role: e.target.value }; setData({ ...data, team: t }) }}
                            className="text-[10px] font-semibold font-sans w-full bg-transparent outline-none mt-0.5"
                            style={{ color: KICKOFF_COLOR }} />
                          <input value={member.responsibilities}
                            onChange={e => { const t = [...data.team]; t[i] = { ...t[i], responsibilities: e.target.value }; setData({ ...data, team: t }) }}
                            className="text-[10px] text-muted-foreground font-sans w-full bg-transparent outline-none mt-0.5 border-b border-transparent focus:border-border"
                            placeholder="Responsibilities..." />
                        </div>
                        <button onClick={() => setData({ ...data, team: data.team.filter((_, idx) => idx !== i) })}
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 transition-all shrink-0">
                          <X size={10} className="text-red-400" strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </SlideCard>
            )}

            {/* ── TIMELINE SLIDE ── */}
            {activeSlide === "timeline" && (
              <SlideCard label="06 · Timeline & Milestones">
                <div className="rounded-2xl border border-border bg-white p-8 flex flex-col gap-5 min-h-[400px]">
                  <div className="flex items-center justify-between">
                    <SlideSectionHeader icon={CalendarRange} color={KICKOFF_COLOR} title="Key Milestones" />
                    <button
                      onClick={() => setData({ ...data, milestones: [...data.milestones, { id: `m${Date.now()}`, name: "New Milestone", date: "", status: "planned" }] })}
                      className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-border hover:bg-secondary transition-colors"
                      style={{ color: "var(--muted-foreground)" }}>
                      <Plus size={10} strokeWidth={2.5} /> Add
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {data.milestones.map((m, i) => {
                      const sc = STATUS_COLORS[m.status]
                      return (
                        <div key={m.id} className="flex items-center gap-4 group">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-2"
                            style={{ background: sc.color, ringColor: sc.color } as any} />
                          <div className="flex-1 flex items-center gap-4 rounded-lg border border-border px-4 py-2.5 bg-white">
                            <input value={m.name}
                              onChange={e => { const ms = [...data.milestones]; ms[i] = { ...ms[i], name: e.target.value }; setData({ ...data, milestones: ms }) }}
                              className="flex-1 text-xs font-semibold text-foreground font-sans bg-transparent outline-none" />
                            <input value={m.date}
                              onChange={e => { const ms = [...data.milestones]; ms[i] = { ...ms[i], date: e.target.value }; setData({ ...data, milestones: ms }) }}
                              className="text-[10px] text-muted-foreground font-sans bg-transparent outline-none w-28 text-right" placeholder="Date" />
                            <select value={m.status}
                              onChange={e => { const ms = [...data.milestones]; ms[i] = { ...ms[i], status: e.target.value as any }; setData({ ...data, milestones: ms }) }}
                              className="text-[9px] font-bold px-2 py-0.5 rounded-full border-none outline-none cursor-pointer"
                              style={{ background: sc.bg, color: sc.color }}>
                              <option value="planned">Planned</option>
                              <option value="in-progress">In Progress</option>
                              <option value="complete">Complete</option>
                            </select>
                          </div>
                          <button onClick={() => setData({ ...data, milestones: data.milestones.filter((_, idx) => idx !== i) })}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 transition-all">
                            <X size={11} className="text-red-400" strokeWidth={2.5} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </SlideCard>
            )}

            {/* ── RISKS SLIDE ── */}
            {activeSlide === "risks" && (
              <SlideCard label="07 · Risks & Mitigation">
                <div className="rounded-2xl border border-border bg-white p-8 flex flex-col gap-5 min-h-[400px]">
                  <div className="flex items-center justify-between">
                    <SlideSectionHeader icon={AlertTriangle} color={KICKOFF_COLOR} title="Key Risks" />
                    <button
                      onClick={() => setData({ ...data, risks: [...data.risks, { id: `r${Date.now()}`, description: "New Risk", impact: "Medium", mitigation: "" }] })}
                      className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-border hover:bg-secondary transition-colors"
                      style={{ color: "var(--muted-foreground)" }}>
                      <Plus size={10} strokeWidth={2.5} /> Add Risk
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {data.risks.map((risk, i) => {
                      const ic = IMPACT_COLORS[risk.impact]
                      return (
                        <div key={risk.id} className="rounded-xl border p-4 flex items-start gap-4 group"
                          style={{ borderColor: ic.border, background: ic.bg }}>
                          <select value={risk.impact}
                            onChange={e => { const rs = [...data.risks]; rs[i] = { ...rs[i], impact: e.target.value as any }; setData({ ...data, risks: rs }) }}
                            className="text-[9px] font-black px-2 py-0.5 rounded-full border-none outline-none cursor-pointer shrink-0 mt-0.5"
                            style={{ background: "white", color: ic.color, border: `1px solid ${ic.border}` }}>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                          <div className="flex-1 flex flex-col gap-1">
                            <input value={risk.description}
                              onChange={e => { const rs = [...data.risks]; rs[i] = { ...rs[i], description: e.target.value }; setData({ ...data, risks: rs }) }}
                              className="text-xs font-semibold text-foreground font-sans bg-transparent outline-none w-full"
                              placeholder="Risk description..." />
                            <input value={risk.mitigation}
                              onChange={e => { const rs = [...data.risks]; rs[i] = { ...rs[i], mitigation: e.target.value }; setData({ ...data, risks: rs }) }}
                              className="text-[10px] text-muted-foreground font-sans bg-transparent outline-none w-full"
                              placeholder="Mitigation strategy..." />
                          </div>
                          <button onClick={() => setData({ ...data, risks: data.risks.filter((_, idx) => idx !== i) })}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-white/60 transition-all shrink-0">
                            <X size={11} className="text-red-400" strokeWidth={2.5} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </SlideCard>
            )}

            {/* ── NEXT STEPS SLIDE ── */}
            {activeSlide === "next-steps" && (
              <SlideCard label="08 · Next Steps">
                <div className="rounded-2xl border border-border bg-white p-8 flex flex-col gap-5 min-h-[340px]">
                  <SlideSectionHeader icon={CheckCircle2} color={KICKOFF_COLOR} title="Next Steps" />
                  <EditableList
                    items={data.nextSteps}
                    onChange={items => setData({ ...data, nextSteps: items })}
                    color={KICKOFF_COLOR}
                    icon={<CheckCircle2 size={13} strokeWidth={2.5} style={{ color: KICKOFF_COLOR }} />}
                  />
                </div>
              </SlideCard>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function SlideCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      {children}
      <p className="text-[9px] text-muted-foreground font-sans text-center mt-1">Click any text to edit</p>
    </div>
  )
}

function SlideSectionHeader({ icon: Icon, color, title }: { icon: React.ElementType; color: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in oklch, ${color} 12%, white)` }}>
        <Icon size={14} style={{ color }} strokeWidth={2} />
      </div>
      <h2 className="text-sm font-black text-foreground font-sans">{title}</h2>
    </div>
  )
}

function EditableText({ value, onChange, className, placeholder }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`bg-transparent outline-none border-b border-transparent focus:border-white/30 transition-colors ${className ?? ""}`}
      placeholder={placeholder}
    />
  )
}

function EditableTextarea({ value, onChange, className, rows }: {
  value: string; onChange: (v: string) => void; className?: string; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows ?? 4}
      className={`bg-transparent outline-none resize-none ${className ?? ""}`}
    />
  )
}

function EditableList({ items, onChange, color, icon }: {
  items: string[]
  onChange: (items: string[]) => void
  color: string
  icon: React.ReactNode
}) {
  function updateItem(i: number, val: string) {
    const next = [...items]
    next[i] = val
    onChange(next)
  }
  function removeItem(i: number) { onChange(items.filter((_, idx) => idx !== i)) }
  function addItem() { onChange([...items, ""]) }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 group">
          <div className="mt-0.5 shrink-0">{icon}</div>
          <input
            value={item}
            onChange={e => updateItem(i, e.target.value)}
            className="flex-1 text-xs text-foreground font-sans bg-transparent outline-none border-b border-transparent focus:border-border transition-colors leading-relaxed"
            placeholder="Enter item..."
          />
          <button onClick={() => removeItem(i)}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 transition-all mt-0.5 shrink-0">
            <X size={10} className="text-red-400" strokeWidth={2.5} />
          </button>
        </div>
      ))}
      <button onClick={addItem}
        className="flex items-center gap-1.5 text-[10px] font-semibold mt-1 self-start transition-colors hover:opacity-70"
        style={{ color }}>
        <Plus size={11} strokeWidth={2.5} /> Add item
      </button>
    </div>
  )
}

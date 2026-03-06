"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TranscriptPanel } from "@/components/transcript-panel"
import { useAuth } from "@/contexts/auth-context"
import { ChevronRight, ArrowRight, Plus } from "lucide-react"

function slugToTitle(slug: string) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

const DOCUMENT_CHIPS = ["Kickoff", "RCI", "SOW", "RFP", "and more..."]

const DEFAULT_MOMS = ["MOM data 1", "MOM data 2", "MOM data 3"]

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function ProjectPage({ params }: PageProps) {
  const { slug } = use(params)
  const projectName = slugToTitle(slug)
  const { isAuthenticated, displayName } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/")
    }
  }, [isAuthenticated, router])

  const [moms, setMoms] = useState(DEFAULT_MOMS)

  if (!isAuthenticated) return null

  function handleCreateMOM() {
    setMoms((prev) => [...prev, `MOM data ${prev.length + 1}`])
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-6xl mx-auto px-8 py-10 flex flex-col gap-8">
        {/* Back link */}
        <Link
          href="/projects"
          className="text-sm text-muted-foreground hover:text-primary font-sans transition-colors w-fit"
        >
          ← Back to projects
        </Link>

        {/* Project title */}
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold text-foreground font-sans text-balance">
            {projectName}
          </h1>

          {/* MS Planner button */}
          <Button
            className="w-fit flex items-center gap-2 rounded-lg px-5 h-10 font-sans font-medium text-sm"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            Planner
            <ArrowRight size={15} strokeWidth={2.5} />
            Link to MS Planner
            <ChevronRight size={15} strokeWidth={2.5} />
          </Button>
        </div>

        {/* Explore Project Documents */}
        <section
          className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-5"
          aria-labelledby="docs-heading"
        >
          <h2
            id="docs-heading"
            className="text-xl font-semibold text-foreground font-sans"
          >
            Explore Project Documents
          </h2>
          <div className="flex flex-wrap gap-3">
            {DOCUMENT_CHIPS.map((chip) => (
              <button
                key={chip}
                className="border border-border rounded-lg px-4 py-2 text-sm text-foreground font-sans hover:bg-secondary hover:border-primary transition-colors duration-150"
              >
                {chip}
              </button>
            ))}
          </div>
        </section>

        {/* Bottom row: MOMs + Transcript */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          {/* Customer Meeting MOMs */}
          <section
            className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-5"
            aria-labelledby="moms-heading"
          >
            <h2
              id="moms-heading"
              className="text-xl font-semibold text-foreground font-sans"
            >
              Customer Meeting MOMs
            </h2>

            <ul className="flex flex-col divide-y divide-border">
              {moms.map((mom, idx) => (
                <li key={idx}>
                  <button className="w-full flex items-center justify-between px-4 py-4 text-sm font-sans text-foreground hover:bg-secondary transition-colors duration-150 rounded-lg text-left">
                    {mom}
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex justify-end">
              <Button
                onClick={handleCreateMOM}
                className="flex items-center gap-2 rounded-lg px-5 h-10 font-sans font-medium text-sm"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Plus size={15} strokeWidth={2.5} />
                Create New MOM
                <ChevronRight size={15} strokeWidth={2.5} />
              </Button>
            </div>
          </section>

          {/* Transcript Panel */}
          <TranscriptPanel projectName={projectName} userName={displayName ?? "User"} />
        </div>
      </main>
    </div>
  )
}

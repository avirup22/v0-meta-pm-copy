"use client"

import { useState, useEffect, useCallback } from "react"
import { ProjectCard } from "@/components/project-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, FolderOpen, Building2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { fetchAllCustomersWithProjects, type CustomerWithProjects } from "@/lib/graph"
import { DEMO_TOKEN, DEMO_CUSTOMERS } from "@/lib/demo-data"

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-")
}

export function ProjectGrid() {
  const { token } = useAuth()
  const [search, setSearch] = useState("")
  const [customers, setCustomers] = useState<CustomerWithProjects[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      if (token === DEMO_TOKEN) {
        setCustomers(DEMO_CUSTOMERS)
      } else {
        const data = await fetchAllCustomersWithProjects(token)
        setCustomers(data)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load projects"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Filter across all customers/projects
  const filteredCustomers = customers
    .map((c) => ({
      ...c,
      projects: c.projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        c.customer.name.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((c) => c.projects.length > 0)

  const totalProjects = customers.reduce((acc, c) => acc + c.projects.length, 0)

  return (
    <div className="min-h-full bg-background">
      {/* Top header bar */}
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold font-sans text-foreground tracking-tight">All Projects</h1>
            {!loading && totalProjects > 0 && (
              <p className="text-sm text-muted-foreground font-sans mt-0.5">
                {totalProjects} project{totalProjects !== 1 ? "s" : ""} across {customers.length} workspace{customers.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-background text-sm font-sans text-muted-foreground w-60">
              <RefreshCw size={13} strokeWidth={2} className={loading ? "animate-spin text-primary" : "text-muted-foreground"} />
              <input
                className="bg-transparent outline-none flex-1 text-foreground placeholder:text-muted-foreground text-sm font-sans"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search projects"
                disabled={loading}
              />
            </div>
            <Button
              onClick={loadProjects}
              disabled={loading}
              variant="outline"
              className="h-9 px-3 rounded-lg font-sans text-sm border-border"
              aria-label="Refresh projects"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-8 py-8 flex flex-col gap-10">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-28 gap-4 text-muted-foreground font-sans text-sm">
            <Loader2 size={28} className="animate-spin text-primary" />
            <span>Loading from OneDrive...</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <p className="text-sm text-destructive font-sans font-medium">{error}</p>
            <Button onClick={loadProjects} size="sm" variant="outline" className="font-sans border-border">
              Try again
            </Button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && totalProjects === 0 && (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-muted-foreground font-sans text-sm">
            <FolderOpen size={36} className="opacity-30" />
            <span>No projects found</span>
          </div>
        )}

        {/* No search results */}
        {!loading && !error && totalProjects > 0 && filteredCustomers.length === 0 && (
          <div className="flex items-center justify-center py-28 text-muted-foreground font-sans text-sm">
            No projects match your search.
          </div>
        )}

        {/* Customer sections */}
        {!loading && !error && filteredCustomers.map((c) => (
          <section key={c.customer.id} className="flex flex-col gap-4">
            {/* Customer label */}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                style={{ background: "color-mix(in oklch, var(--primary) 12%, transparent)" }}
              >
                <Building2 size={13} style={{ color: "var(--primary)" }} strokeWidth={2} />
              </div>
              <h2 className="text-xs font-bold font-sans text-foreground uppercase tracking-widest">{c.customer.name}</h2>
              <span
                className="text-[10px] font-semibold font-sans px-2 py-0.5 rounded-full"
                style={{ background: "color-mix(in oklch, var(--primary) 10%, transparent)", color: "var(--primary)" }}
              >
                {c.projects.length}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Projects grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {c.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  name={project.name}
                  slug={toSlug(project.name)}
                  customerName={c.customer.name}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

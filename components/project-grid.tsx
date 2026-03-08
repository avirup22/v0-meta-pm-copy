"use client"

import { useState, useEffect, useCallback } from "react"
import { ProjectCard } from "@/components/project-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, FolderOpen, Building2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { fetchAllCustomersWithProjects, type CustomerWithProjects } from "@/lib/graph"

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
      const data = await fetchAllCustomersWithProjects(token)
      setCustomers(data)
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
    <div className="max-w-6xl mx-auto px-8 py-10 flex flex-col gap-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-sans text-foreground tracking-tight">Projects</h1>
          {!loading && totalProjects > 0 && (
            <p className="text-sm text-muted-foreground font-sans mt-0.5">
              {totalProjects} project{totalProjects !== 1 ? "s" : ""} across {customers.length} customer{customers.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Button
          onClick={loadProjects}
          disabled={loading}
          variant="outline"
          className="rounded-lg h-9 px-3 font-sans font-medium flex items-center gap-2 border-border text-sm"
          aria-label="Refresh projects"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <Input
        className="bg-card border-border rounded-lg h-10 text-sm font-sans placeholder:text-muted-foreground focus-visible:ring-primary"
        placeholder="Search projects or customers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search projects"
        disabled={loading}
      />

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground font-sans text-sm">
          <Loader2 size={28} className="animate-spin text-primary" />
          <span>Loading from OneDrive...</span>
          <span className="text-xs opacity-60">MetaPM → Customer → Projects</span>
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
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground font-sans text-sm">
          <FolderOpen size={36} className="opacity-40" />
          <span>No projects found in MetaPM</span>
        </div>
      )}

      {/* No search results */}
      {!loading && !error && totalProjects > 0 && filteredCustomers.length === 0 && (
        <div className="flex items-center justify-center py-24 text-muted-foreground font-sans text-sm">
          No projects match your search.
        </div>
      )}

      {/* Customer sections */}
      {!loading && !error && filteredCustomers.map((c) => (
        <section key={c.customer.id} className="flex flex-col gap-4">
          {/* Customer header */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ background: "var(--primary)", opacity: 0.12 }}
            />
            <div className="flex items-center gap-2 -ml-8">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                style={{ background: "color-mix(in oklch, var(--primary) 15%, transparent)" }}
              >
                <Building2 size={15} style={{ color: "var(--primary)" }} />
              </div>
              <h2 className="text-base font-semibold font-sans text-foreground">{c.customer.name}</h2>
              <span className="text-xs text-muted-foreground font-sans bg-secondary rounded-full px-2 py-0.5">
                {c.projects.length} project{c.projects.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex-1 h-px bg-border ml-2" />
          </div>

          {/* Projects grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pl-1">
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
  )
}

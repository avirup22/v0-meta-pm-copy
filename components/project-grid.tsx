"use client"

import { useState, useEffect, useCallback } from "react"
import { ProjectCard } from "@/components/project-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, FolderOpen } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { fetchProjectFolders, type DriveItem } from "@/lib/graph"

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-")
}

export function ProjectGrid() {
  const { token } = useAuth()
  const [search, setSearch] = useState("")
  const [projects, setProjects] = useState<DriveItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    if (!token) {
      console.log("[v0] ProjectGrid: no token available, skipping fetch")
      return
    }

    setLoading(true)
    setError(null)
    console.log("[v0] ProjectGrid: starting folder fetch")

    try {
      const folders = await fetchProjectFolders(token)
      console.log("[v0] ProjectGrid: received", folders.length, "folders")
      setProjects(folders)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load projects"
      console.error("[v0] ProjectGrid: error loading folders:", message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <main className="max-w-6xl mx-auto px-8 py-10 flex flex-col gap-8">
      {/* Search + Refresh row */}
      <div className="flex items-center gap-4">
        <Input
          className="flex-1 bg-card border-border rounded-lg h-11 text-sm font-sans placeholder:text-muted-foreground focus-visible:ring-primary"
          placeholder="Search Project"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search projects"
          disabled={loading}
        />
        <Button
          onClick={loadProjects}
          disabled={loading}
          variant="outline"
          className="rounded-lg h-11 px-4 font-sans font-medium flex items-center gap-2 border-border"
          aria-label="Refresh projects"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground font-sans text-sm">
          <Loader2 size={28} className="animate-spin text-primary" />
          <span>Loading folders from OneDrive...</span>
          <span className="text-xs opacity-60">MetaPM → Projects</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <p className="text-sm text-destructive font-sans font-medium">{error}</p>
          <Button
            onClick={loadProjects}
            size="sm"
            variant="outline"
            className="font-sans border-border"
          >
            Try again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground font-sans text-sm">
          <FolderOpen size={36} className="opacity-40" />
          <span>No folders found inside MetaPM/Projects</span>
        </div>
      )}

      {/* No search matches */}
      {!loading && !error && projects.length > 0 && filtered.length === 0 && (
        <div className="flex items-center justify-center py-24 text-muted-foreground font-sans text-sm">
          No projects match your search.
        </div>
      )}

      {/* Project grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              name={project.name}
              slug={toSlug(project.name)}
            />
          ))}
        </div>
      )}
    </main>
  )
}

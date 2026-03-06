"use client"

import { useState } from "react"
import { ProjectCard } from "@/components/project-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface Project {
  name: string
  slug: string
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-")
}

const DEFAULT_PROJECTS: Project[] = [
  { name: "Project A", slug: "project-a" },
  { name: "Project B", slug: "project-b" },
  { name: "Project C", slug: "project-c" },
  { name: "Project D", slug: "project-d" },
  { name: "Project E", slug: "project-e" },
  { name: "Project F", slug: "project-f" },
  { name: "Project G", slug: "project-g" },
  { name: "Project H", slug: "project-h" },
  { name: "Project I", slug: "project-i" },
]

export function ProjectGrid() {
  const [search, setSearch] = useState("")
  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS)

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreateNew = () => {
    const name = `Project ${String.fromCharCode(65 + projects.length)}`
    setProjects((prev) => [...prev, { name, slug: toSlug(name) }])
  }

  return (
    <main className="max-w-6xl mx-auto px-8 py-10 flex flex-col gap-8">
      {/* Search + Create row */}
      <div className="flex items-center gap-4">
        <Input
          className="flex-1 bg-card border-border rounded-lg h-11 text-sm font-sans placeholder:text-muted-foreground focus-visible:ring-primary"
          placeholder="Search Project"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search projects"
        />
        <Button
          onClick={handleCreateNew}
          className="rounded-lg h-11 px-5 font-sans font-medium flex items-center gap-2"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Create New
        </Button>
      </div>

      {/* Project grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((project) => (
            <ProjectCard key={project.slug} name={project.name} slug={project.slug} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-24 text-muted-foreground font-sans text-sm">
          No projects match your search.
        </div>
      )}
    </main>
  )
}

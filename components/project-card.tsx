"use client"

interface ProjectCardProps {
  name: string
  onClick?: () => void
}

export function ProjectCard({ name, onClick }: ProjectCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-6 hover:shadow-md transition-shadow duration-200 cursor-pointer">
      <h2 className="text-xl font-semibold text-foreground font-sans">{name}</h2>
      <button
        onClick={onClick}
        className="text-sm text-muted-foreground hover:text-primary font-sans transition-colors duration-150 text-left w-fit"
      >
        Open Project
      </button>
    </div>
  )
}

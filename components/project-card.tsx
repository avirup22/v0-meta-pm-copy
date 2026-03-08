import Link from "next/link"
import { Building2 } from "lucide-react"

interface ProjectCardProps {
  name: string
  slug: string
  customerName?: string
}

export function ProjectCard({ name, slug, customerName }: ProjectCardProps) {
  return (
    <Link href={`/projects/${slug}`} className="block group">
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 flex flex-col gap-4 hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer">
        {customerName && (
          <div className="flex items-center gap-1.5">
            <Building2 size={11} className="text-muted-foreground" />
            <span className="text-[11px] font-sans text-muted-foreground uppercase tracking-wider">{customerName}</span>
          </div>
        )}
        <h2 className="text-base font-semibold text-foreground font-sans leading-snug">{name}</h2>
        <span className="text-xs text-muted-foreground group-hover:text-primary font-sans transition-colors duration-150 w-fit">
          Open Project →
        </span>
      </div>
    </Link>
  )
}

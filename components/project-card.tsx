import Link from "next/link"
import { ArrowUpRight, Folder } from "lucide-react"

interface ProjectCardProps {
  name: string
  slug: string
  customerName?: string
}

// Deterministic color per card based on name
const ACCENT_COLORS = [
  { bg: "oklch(0.97 0.025 293)", dot: "oklch(0.54 0.26 293)" },  // violet
  { bg: "oklch(0.97 0.025 240)", dot: "oklch(0.58 0.26 240)" },  // blue
  { bg: "oklch(0.97 0.025 160)", dot: "oklch(0.60 0.20 160)" },  // teal
  { bg: "oklch(0.97 0.025 30)",  dot: "oklch(0.68 0.24 30)"  },  // orange
]

function colorForName(name: string) {
  let n = 0
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i)
  return ACCENT_COLORS[n % ACCENT_COLORS.length]
}

export function ProjectCard({ name, slug, customerName }: ProjectCardProps) {
  const color = colorForName(name)
  return (
    <Link href={`/projects/${slug}`} className="block group">
      <div
        className="relative rounded-xl border border-border bg-card p-5 flex flex-col gap-5 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden"
      >
        {/* Top row: icon + arrow */}
        <div className="flex items-start justify-between">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: color.bg }}
          >
            <Folder size={18} style={{ color: color.dot }} strokeWidth={1.8} />
          </div>
          <ArrowUpRight
            size={16}
            strokeWidth={2}
            className="text-muted-foreground/40 group-hover:text-primary group-hover:opacity-100 transition-all duration-150 mt-0.5"
          />
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1">
          {customerName && (
            <span className="text-[10px] font-sans font-semibold text-muted-foreground uppercase tracking-widest">
              {customerName}
            </span>
          )}
          <h2 className="text-sm font-bold text-foreground font-sans leading-snug text-pretty">
            {name}
          </h2>
        </div>

        {/* Accent bar at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ background: color.dot }}
        />
      </div>
    </Link>
  )
}

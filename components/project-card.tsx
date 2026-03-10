import Link from "next/link"
import { ArrowUpRight, Folder } from "lucide-react"

interface ProjectCardProps {
  name: string
  slug: string
  customerName?: string
}

// Deterministic color per card — bold, saturated Figma-palette
const ACCENT_COLORS = [
  { bg: "oklch(0.94 0.06 293)",  dot: "oklch(0.58 0.30 293)",  shadow: "oklch(0.58 0.30 293 / 0.22)" },  // electric violet
  { bg: "oklch(0.93 0.06 240)",  dot: "oklch(0.56 0.28 240)",  shadow: "oklch(0.56 0.28 240 / 0.22)" },  // royal blue
  { bg: "oklch(0.92 0.07 200)",  dot: "oklch(0.58 0.18 200)",  shadow: "oklch(0.58 0.18 200 / 0.22)" },  // electric cyan
  { bg: "oklch(0.93 0.07 150)",  dot: "oklch(0.55 0.22 150)",  shadow: "oklch(0.55 0.22 150 / 0.22)" },  // emerald
  { bg: "oklch(0.94 0.07 35)",   dot: "oklch(0.68 0.24 35)",   shadow: "oklch(0.68 0.24 35 / 0.22)"  },  // vivid orange
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
        className="relative rounded-2xl border border-border bg-card p-5 flex flex-col gap-5 transition-all duration-200 cursor-pointer overflow-hidden"
        style={{
          boxShadow: "0 1px 3px oklch(0 0 0 / 0.06)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 36px -6px ${color.shadow}`
          ;(e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"
          ;(e.currentTarget as HTMLDivElement).style.borderColor = color.dot
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px oklch(0 0 0 / 0.06)"
          ;(e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"
          ;(e.currentTarget as HTMLDivElement).style.borderColor = ""
        }}
      >
        {/* Top row: icon + arrow */}
        <div className="flex items-start justify-between">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: color.bg }}
          >
            <Folder size={17} style={{ color: color.dot }} strokeWidth={2} />
          </div>
          <ArrowUpRight
            size={15}
            strokeWidth={2.5}
            className="text-muted-foreground/30 group-hover:opacity-100 transition-all duration-150 mt-0.5"
            style={{ color: color.dot }}
          />
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1">
          {customerName && (
            <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-[0.14em]">
              {customerName}
            </span>
          )}
          <h2 className="text-sm font-bold text-foreground leading-snug text-pretty">
            {name}
          </h2>
        </div>

        {/* Accent bar — always visible, colored */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ background: color.dot }}
        />
      </div>
    </Link>
  )
}

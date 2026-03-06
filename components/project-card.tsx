import Link from "next/link"

interface ProjectCardProps {
  name: string
  slug: string
}

export function ProjectCard({ name, slug }: ProjectCardProps) {
  return (
    <Link href={`/project/${slug}`} className="block">
      <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-6 hover:shadow-md transition-shadow duration-200 cursor-pointer">
        <h2 className="text-xl font-semibold text-foreground font-sans">{name}</h2>
        <span className="text-sm text-muted-foreground hover:text-primary font-sans transition-colors duration-150 w-fit">
          Open Project
        </span>
      </div>
    </Link>
  )
}

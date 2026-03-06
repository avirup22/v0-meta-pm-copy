import { Header } from "@/components/header"
import { ProjectGrid } from "@/components/project-grid"

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <ProjectGrid />
    </div>
  )
}

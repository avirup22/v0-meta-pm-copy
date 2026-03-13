"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import {
  ChevronRight,
  Loader2,
  FileText,
} from "lucide-react"

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function DocumentsPage({ params }: PageProps) {
  const { slug } = use(params)
  const { token, user } = useAuth()

  if (!token || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${slug}`}>
            <span className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {slug}
            </span>
          </Link>
          <ChevronRight size={14} className="text-muted-foreground" />
          <h1 className="text-xl font-black text-foreground font-sans">Documents</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center gap-4 min-h-[300px]">
          <FileText size={48} className="text-muted-foreground opacity-50" />
          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground mb-2">Documents</h2>
            <p className="text-sm text-muted-foreground">Document management coming soon</p>
          </div>
        </div>
      </div>
    </div>
  )
}

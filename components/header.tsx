"use client"

import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="bg-card border-b border-border">
      <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
        <span
          className="text-2xl font-bold tracking-tight font-sans"
          style={{ color: "var(--brand-teal)" }}
        >
          MetaPM
        </span>

        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground font-sans">Hi Sarvesh</span>
          <Button
            className="rounded-lg px-5 font-sans font-medium"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            Authenticate
          </Button>
        </div>
      </div>
    </header>
  )
}

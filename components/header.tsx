"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { ShieldCheck, LogOut } from "lucide-react"

export function Header() {
  const { isAuthenticated, displayName, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // Hide the header entirely on the login page
  if (pathname === "/") return null

  function handleLogout() {
    logout()
    router.replace("/")
  }

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
        <Link
          href="/projects"
          className="text-2xl font-bold tracking-tight font-sans"
          style={{ color: "var(--brand-teal)" }}
        >
          MetaPM
        </Link>

        <div className="flex items-center gap-4">
          {isAuthenticated && (
            <span className="text-sm text-foreground font-sans">
              Hi {displayName}
            </span>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span
                className="flex items-center gap-1.5 text-sm font-medium font-sans px-3 py-1.5 rounded-lg"
                style={{ background: "var(--secondary)", color: "var(--foreground)" }}
              >
                <ShieldCheck size={14} strokeWidth={2} style={{ color: "var(--primary)" }} />
                Authenticated
              </span>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="flex items-center gap-1.5 rounded-lg px-3 h-9 font-sans font-medium text-sm text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <LogOut size={14} strokeWidth={2} />
                Logout
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => router.push("/")}
              className="rounded-lg px-5 font-sans font-medium"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Authenticate
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

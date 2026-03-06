"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, ShieldCheck } from "lucide-react"

export default function AuthenticatePage() {
  const { isAuthenticated, authenticate, error, loading } = useAuth()
  const [tokenInput, setTokenInput] = useState("")
  const router = useRouter()

  // If already authenticated (e.g. session restored), skip to /projects
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/projects")
    }
  }, [isAuthenticated, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = tokenInput.trim()
    if (!trimmed) return
    await authenticate(trimmed)
    // Navigation happens via the useEffect above once isAuthenticated flips true
  }

  return (
    <main className="flex-1 flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-md flex flex-col gap-8">
        {/* Logo */}
        <div className="text-center">
          <span
            className="text-3xl font-bold tracking-tight font-sans"
            style={{ color: "var(--brand-teal)" }}
          >
            MetaPM
          </span>
        </div>

        {/* Icon + heading */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--primary)" }}
          >
            <ShieldCheck size={28} color="var(--primary-foreground)" strokeWidth={1.8} />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-sans tracking-tight">
            Authenticate with Microsoft
          </h1>
          <p className="text-sm text-muted-foreground font-sans leading-relaxed max-w-sm">
            Paste your Microsoft Graph API bearer token to sign in. We will call{" "}
            <code className="text-xs bg-secondary rounded px-1 py-0.5 font-mono">
              /v1.0/me
            </code>{" "}
            to verify your identity and retrieve your profile.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="bearer-token"
                className="text-sm font-medium text-foreground font-sans"
              >
                Bearer Token
              </label>
              <textarea
                id="bearer-token"
                className="w-full rounded-lg border border-border bg-background text-foreground text-xs font-mono p-3 min-h-[140px] resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground transition-shadow"
                placeholder="eyJ0eXAiOiJKV1QiLCJhbGci..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                aria-label="Bearer token input"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm font-sans rounded-lg bg-destructive/10 text-destructive px-3 py-2 leading-relaxed">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || !tokenInput.trim()}
              className="w-full rounded-lg h-11 font-sans font-medium flex items-center justify-center gap-2"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Verifying..." : "Authenticate"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}

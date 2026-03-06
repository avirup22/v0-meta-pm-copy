"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { X, Loader2, ShieldCheck } from "lucide-react"

export function Header() {
  const { isAuthenticated, displayName, authenticate, loading, error } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tokenInput, setTokenInput] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = tokenInput.trim()
    if (!trimmed) return
    await authenticate(trimmed)
    // Only close dialog on success (no error after await)
  }

  // Close dialog once authenticated successfully
  function handleDialogOpen() {
    if (isAuthenticated) return
    setDialogOpen(true)
  }

  // After authentication succeeds, close dialog automatically
  if (isAuthenticated && dialogOpen) {
    setDialogOpen(false)
  }

  return (
    <>
      <header className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight font-sans"
            style={{ color: "var(--brand-teal)" }}
          >
            MetaPM
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-foreground font-sans">
              Hi {displayName ?? "there"}
            </span>
            <Button
              onClick={handleDialogOpen}
              disabled={isAuthenticated}
              className="rounded-lg px-5 font-sans font-medium flex items-center gap-2"
              style={{
                background: isAuthenticated ? "var(--secondary)" : "var(--primary)",
                color: isAuthenticated ? "var(--foreground)" : "var(--primary-foreground)",
                opacity: 1,
              }}
            >
              {isAuthenticated && <ShieldCheck size={15} strokeWidth={2} />}
              {isAuthenticated ? "Authenticated" : "Authenticate"}
            </Button>
          </div>
        </div>
      </header>

      {/* Bearer Token Dialog */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialogOpen(false)
          }}
        >
          <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-5">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <h2
                id="auth-dialog-title"
                className="text-lg font-semibold text-foreground font-sans"
              >
                Enter Bearer Token
              </h2>
              <button
                onClick={() => setDialogOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors rounded-md p-1"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground font-sans leading-relaxed">
              Paste your Microsoft Graph API bearer token below. We will call{" "}
              <code className="text-xs bg-secondary rounded px-1 py-0.5 font-mono">
                /v1.0/me
              </code>{" "}
              to retrieve your profile.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <textarea
                className="w-full rounded-lg border border-border bg-background text-foreground text-xs font-mono p-3 min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                placeholder="eyJ0eXAiOiJKV1QiLCJhbGci..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                aria-label="Bearer token"
                autoFocus
              />

              {error && (
                <p className="text-sm font-sans rounded-lg bg-destructive/10 text-destructive px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="text-sm font-sans text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-secondary"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={loading || !tokenInput.trim()}
                  className="rounded-lg px-5 font-sans font-medium flex items-center gap-2"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? "Verifying..." : "Authenticate"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

interface AuthContextValue {
  token: string | null
  displayName: string | null
  isAuthenticated: boolean
  authenticate: (token: string) => Promise<void>
  error: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const authenticate = useCallback(async (bearerToken: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message ?? `Request failed with status ${res.status}`)
      }

      const profile = await res.json()
      setToken(bearerToken)
      setDisplayName(profile.displayName ?? profile.givenName ?? "User")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        token,
        displayName,
        isAuthenticated: !!token,
        authenticate,
        error,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

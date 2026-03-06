"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react"

interface AuthContextValue {
  token: string | null
  displayName: string | null
  isAuthenticated: boolean
  authenticate: (token: string) => Promise<void>
  logout: () => void
  error: string | null
  loading: boolean
}

const SESSION_TOKEN_KEY = "metapm_token"
const SESSION_NAME_KEY = "metapm_display_name"

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Restore session from sessionStorage on first mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem(SESSION_TOKEN_KEY)
    const savedName = sessionStorage.getItem(SESSION_NAME_KEY)
    if (savedToken && savedName) {
      setToken(savedToken)
      setDisplayName(savedName)
    }
    setHydrated(true)
  }, [])

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
        throw new Error(
          body?.error?.message ?? `Request failed with status ${res.status}`
        )
      }

      const profile = await res.json()
      const name = profile.displayName ?? profile.givenName ?? "User"

      setToken(bearerToken)
      setDisplayName(name)

      // Persist for the duration of the browser session
      sessionStorage.setItem(SESSION_TOKEN_KEY, bearerToken)
      sessionStorage.setItem(SESSION_NAME_KEY, name)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Authentication failed"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setDisplayName(null)
    setError(null)
    sessionStorage.removeItem(SESSION_TOKEN_KEY)
    sessionStorage.removeItem(SESSION_NAME_KEY)
  }, [])

  // Don't render children until we've restored session state
  if (!hydrated) return null

  return (
    <AuthContext.Provider
      value={{
        token,
        displayName,
        isAuthenticated: !!token,
        authenticate,
        logout,
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

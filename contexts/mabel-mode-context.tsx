"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

interface MabelModeContextType {
  isMabelMode: boolean
  toggleMabelMode: () => void
}

const MabelModeContext = createContext<MabelModeContextType | undefined>(undefined)

export function MabelModeProvider({ children }: { children: ReactNode }) {
  const [isMabelMode, setIsMabelMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("mabel-mode")
    if (saved === "true") {
      setIsMabelMode(true)
    }
    setMounted(true)
  }, [])

  // Update localStorage and DOM when mode changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("mabel-mode", isMabelMode ? "true" : "false")
      if (isMabelMode) {
        document.documentElement.classList.add("mabel-mode")
      } else {
        document.documentElement.classList.remove("mabel-mode")
      }
    }
  }, [isMabelMode, mounted])

  const toggleMabelMode = () => {
    setIsMabelMode((prev) => !prev)
  }

  return (
    <MabelModeContext.Provider value={{ isMabelMode, toggleMabelMode }}>
      {children}
    </MabelModeContext.Provider>
  )
}

export function useMabelMode() {
  const context = useContext(MabelModeContext)
  if (context === undefined) {
    throw new Error("useMabelMode must be used within MabelModeProvider")
  }
  return context
}

"use client"

import { useState } from "react"
import { useMabelMode } from "@/contexts/mabel-mode-context"
import { Sparkles } from "lucide-react"

export function MabelModeToggle() {
  const { isMabelMode, toggleMabelMode } = useMabelMode()
  const [clickCount, setClickCount] = useState(0)
  const [showTooltip, setShowTooltip] = useState(false)

  const handleClick = () => {
    setClickCount((prev) => prev + 1)
    
    // Easter egg: clicking 3 times fast
    if (clickCount === 2) {
      toggleMabelMode()
      setClickCount(0)
      setShowTooltip(true)
      setTimeout(() => setShowTooltip(false), 2000)
    }
  }

  // Reset counter after 1 second of inactivity
  const handleMouseEnter = () => {
    setClickCount(0)
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        className="p-2 rounded-lg transition-all duration-200 hover:opacity-70"
        title={isMabelMode ? "Mabel Mode ON! Click 3 times to toggle." : "Secret button... click 3 times fast!"}
        aria-label="mabel mode"
      >
        <Sparkles
          size={20}
          className={`transition-all duration-300 ${
            isMabelMode ? "text-pink-400 animate-spin" : "text-muted-foreground opacity-30"
          }`}
        />
      </button>

      {showTooltip && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs whitespace-nowrap bg-pink-500 text-white px-2 py-1 rounded-full animate-bounce">
          {isMabelMode ? "✨ Mabel Mode ON! ✨" : "Click 3x to activate!"}
        </div>
      )}
    </div>
  )
}

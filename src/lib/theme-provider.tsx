"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { applyAccentColor, loadAccentColor, saveAccentColor } from "./accent-color"

type Theme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  accentColor: string
  setAccentColor: (id: string) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  accentColor: "violet",
  setAccentColor: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light")
  const [accentColor, setAccentColorState] = useState<string>("violet")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem("theme") as Theme | null
    const savedAccent = loadAccentColor()
    const isDark = savedTheme === "dark"
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme)
      document.documentElement.classList.toggle("dark", isDark)
    }
    setAccentColorState(savedAccent)
    applyAccentColor(savedAccent, isDark)
  }, [])

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light"
    setTheme(next)
    localStorage.setItem("theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
    applyAccentColor(accentColor, next === "dark")
  }

  const setAccentColor = (id: string) => {
    setAccentColorState(id)
    saveAccentColor(id)
    applyAccentColor(id, theme === "dark")
  }

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  )
}

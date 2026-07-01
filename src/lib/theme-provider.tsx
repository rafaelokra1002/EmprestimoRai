"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { applyAccentColor, loadAccentColor, saveAccentColor } from "./accent-color"

type Theme = "light" | "dark" | "purple"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  accentColor: string
  setAccentColor: (id: string) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  accentColor: "green",
  setAccentColor: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light")
  const [accentColor, setAccentColorState] = useState<string>("green")
  const [mounted, setMounted] = useState(false)

  const applyThemeClasses = (t: Theme) => {
    document.documentElement.classList.remove("dark", "purple")
    if (t === "dark") document.documentElement.classList.add("dark")
    if (t === "purple") {
      document.documentElement.classList.add("dark")
      document.documentElement.classList.add("purple")
    }
  }

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem("theme") as Theme | null
    const savedAccent = loadAccentColor()
    // Modo roxo desativado: quem estiver salvo em "purple" volta para "dark".
    // (reativar: incluir "purple" na validação abaixo)
    const validTheme: Theme = savedTheme === "purple"
      ? "dark"
      : savedTheme === "dark" || savedTheme === "light"
        ? savedTheme : "light"
    setTheme(validTheme)
    applyThemeClasses(validTheme)
    setAccentColorState(savedAccent)
    applyAccentColor(savedAccent, validTheme !== "light")
  }, [])

  const toggleTheme = () => {
    // Modo roxo desativado — reativar adicionando "purple" ao ciclo:
    // const cycle: Theme[] = ["light", "dark", "purple"]
    const cycle: Theme[] = ["light", "dark"]
    const next = cycle[(cycle.indexOf(theme) + 1) % cycle.length]
    setTheme(next)
    localStorage.setItem("theme", next)
    applyThemeClasses(next)
    applyAccentColor(accentColor, next !== "light")
  }

  const setAccentColor = (id: string) => {
    setAccentColorState(id)
    saveAccentColor(id)
    applyAccentColor(id, theme !== "light")
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

"use client"

import { useTheme } from "@/lib/theme-provider"
import { Moon, Sun, User, MessageCircle } from "lucide-react"
import { useEffect, useState } from "react"

interface HeaderActionsProps {
  email?: string | null
}

export function HeaderActions({ email }: HeaderActionsProps) {
  const { theme, toggleTheme } = useTheme()
  const [waConnected, setWaConnected] = useState<boolean | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/whatsapp/status")
        const data = await res.json()
        setWaConnected(data.connected === true)
      } catch {
        setWaConnected(false)
      }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-3">
      {waConnected !== null && (
        <div className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-medium ${
          waConnected
            ? "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
            : "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
        }`}>
          <MessageCircle className="h-4 w-4" />
          <span className={`h-2 w-2 rounded-full ${waConnected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="hidden sm:inline">{waConnected ? "WhatsApp" : "WhatsApp"}</span>
        </div>
      )}

      <button
        type="button"
        onClick={toggleTheme}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
      >
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 text-sm font-medium text-gray-900 dark:text-zinc-100">
        <User className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
        <span className="max-w-[220px] truncate">{email || "Usuário"}</span>
      </div>
    </div>
  )
}

"use client"

import { useTheme } from "@/lib/theme-provider"
import { Moon, Sun, Sparkles, User, Settings, LogOut, ChevronDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

interface HeaderActionsProps {
  email?: string | null
}

export function HeaderActions({ email }: HeaderActionsProps) {
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggleTheme}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Alternar tema"
        title={theme === "light" ? "Modo escuro" : theme === "dark" ? "Modo roxo" : "Modo claro"}
      >
        {theme === "light" ? <Moon className="h-4 w-4" /> : theme === "dark" ? <Sparkles className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm font-medium text-slate-700 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <User className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
          <span className="max-w-[180px] truncate hidden sm:inline">{email || "Usuário"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-zinc-800">
              <p className="text-xs text-gray-400 dark:text-zinc-500">Conectado como</p>
              <p className="text-xs font-semibold text-gray-700 dark:text-zinc-200 truncate mt-0.5">{email || "Usuário"}</p>
            </div>
            <button
              onClick={() => { setMenuOpen(false); router.push("/configuracoes") }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Settings className="h-4 w-4" /> Configurações
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

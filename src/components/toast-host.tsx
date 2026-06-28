"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, AlertTriangle, Info } from "lucide-react"
import type { ToastType } from "@/lib/toast"

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      const id = Date.now() + Math.random()
      const item: ToastItem = { id, message: detail.message || "", type: detail.type || "success" }
      setToasts((prev) => [...prev, item])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3800)
    }
    window.addEventListener("app:toast", handler)
    return () => window.removeEventListener("app:toast", handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((t) => {
        const tone =
          t.type === "error"
            ? "border-red-500/50 text-white"
            : t.type === "info"
            ? "border-blue-500/50 text-white"
            : "border-green-500/50 text-white"
        const Icon = t.type === "error" ? AlertTriangle : t.type === "info" ? Info : CheckCircle2
        const iconColor = t.type === "error" ? "text-red-400" : t.type === "info" ? "text-blue-400" : "text-green-400"
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-zinc-900/95 px-4 py-3 text-sm font-medium shadow-lg shadow-black/30 backdrop-blur-sm animate-in slide-in-from-right-4 fade-in duration-300 ${tone}`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
            <span className="leading-snug">{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}

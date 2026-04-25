"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  className?: string
}

export function Dialog({ open, onClose, children, title, className }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80" onClick={onClose} />
      <div
        className={cn(
          "relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-700 dark:text-zinc-100">{title}</h2>
            <button onClick={onClose} className="text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

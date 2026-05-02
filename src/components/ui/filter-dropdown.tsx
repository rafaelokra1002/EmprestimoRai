"use client"

import { useState, type ReactNode } from "react"
import { Check, ChevronDown } from "lucide-react"

type FilterOption<T extends string> = {
  value: T
  label: string
}

type FilterDropdownProps<T extends string> = {
  label: string
  value: T
  options: readonly FilterOption<T>[]
  onChange: (value: T) => void
  icon: ReactNode
  tone?: "violet" | "emerald" | "orange" | "blue" | "gray"
  minWidthClassName?: string
}

const toneClasses = {
  violet: {
    button: "border-violet-500 text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/30",
    active: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
  },
  emerald: {
    button: "border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30",
    active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  orange: {
    button: "border-orange-500 text-orange-500 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/30",
    active: "bg-orange-50 text-orange-500 dark:bg-orange-950/30 dark:text-orange-400",
  },
  blue: {
    button: "border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30",
    active: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
  },
  gray: {
    button: "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
    active: "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-100",
  },
} as const

export function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
  tone = "violet",
  minWidthClassName = "min-w-[180px]",
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const currentTone = toneClasses[tone]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm font-semibold transition dark:bg-zinc-900 dark:hover:bg-zinc-800 ${currentTone.button}`}
      >
        {icon}
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className={`absolute left-0 top-full z-20 mt-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 ${minWidthClassName}`}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${value === option.value ? currentTone.active : "text-gray-600 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
            >
              <span>{option.label}</span>
              {value === option.value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
import { cn, formatCurrency } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: number
  icon: LucideIcon
  description?: string
  trend?: number
  className?: string
}

export function StatsCard({ title, value, icon: Icon, description, trend, className }: StatsCardProps) {
  return (
    <div className={cn("rounded-xl border border-violet-100 dark:border-violet-950/40 bg-white/90 dark:bg-zinc-900 p-6 shadow-sm shadow-violet-950/5 backdrop-blur-sm", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{title}</p>
        <Icon className="h-5 w-5 text-violet-600 dark:text-violet-300" />
      </div>
      <div className="mt-2">
        <h3 className="text-xl leading-none font-bold tabular-nums tracking-tight text-slate-700 dark:text-zinc-100">{formatCurrency(value)}</h3>
        {description && <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">{description}</p>}
        {trend !== undefined && (
          <p className={cn("text-xs mt-1", trend >= 0 ? "text-violet-600 dark:text-violet-300" : "text-red-500")}>
            {trend >= 0 ? "+" : ""}{trend}% em relação ao mês anterior
          </p>
        )}
      </div>
    </div>
  )
}

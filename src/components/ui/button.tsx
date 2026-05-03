"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground hover:brightness-90",
      destructive: "bg-red-600 text-white hover:bg-red-700",
      outline: "border border-violet-200 dark:border-violet-900/50 bg-white/80 dark:bg-zinc-900/80 text-slate-700 dark:text-zinc-100 hover:bg-violet-50 dark:hover:bg-violet-950/30",
      secondary: "bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/50",
      ghost: "text-slate-700 dark:text-zinc-100 hover:bg-violet-50 dark:hover:bg-violet-950/30",
      link: "text-violet-700 underline-offset-4 hover:underline dark:text-violet-300",
    }
    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    }
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }

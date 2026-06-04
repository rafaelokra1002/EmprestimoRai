"use client"

import { GraduationCap } from "lucide-react"

export default function AulasPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
        <GraduationCap className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Aulas</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Esta funcionalidade estará disponível em breve.</p>
      </div>
    </div>
  )
}

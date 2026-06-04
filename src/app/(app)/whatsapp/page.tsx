"use client"

import { Construction } from "lucide-react"

export default function WhatsAppPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
        <Construction className="h-8 w-8 text-amber-500" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Em Construção</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Esta funcionalidade estará disponível em breve.</p>
      </div>
    </div>
  )
}

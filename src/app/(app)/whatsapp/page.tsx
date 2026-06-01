"use client"

import { MessageCircle } from "lucide-react"

export default function WhatsAppPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
        <MessageCircle className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Em Breve</h1>
      <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-xs">
        Esta funcionalidade está em construção e estará disponível em breve.
      </p>
    </div>
  )
}

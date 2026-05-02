"use client"

import { Loader2 } from "lucide-react"

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600 dark:text-violet-300" />
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-600 dark:text-violet-300" />
        <p className="text-gray-500 dark:text-zinc-400 mt-4">Carregando...</p>
      </div>
    </div>
  )
}

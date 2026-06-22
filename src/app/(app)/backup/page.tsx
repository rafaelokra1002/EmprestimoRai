"use client"

import { useState } from "react"
import { localDateStr } from "@/lib/utils"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  DollarSign,
  Users,
  Landmark,
  Lightbulb,
  UserX,
  FolderArchive,
} from "lucide-react"

const backupSections = [
  {
    key: "clients",
    title: "Clientes",
    description: "Todos os seus clientes cadastrados",
    icon: Users,
    iconClassName: "text-blue-500",
  },
  {
    key: "loans",
    title: "Empréstimos",
    description: "Somente empréstimos sem parcelamento",
    icon: DollarSign,
    iconClassName: "text-primary",
  },
  {
    key: "installment-loans",
    title: "Empréstimos Parcelados",
    description: "Somente empréstimos com duas ou mais parcelas",
    icon: Landmark,
    iconClassName: "text-primary",
  },
  {
    key: "desaparecido",
    title: "Desaparecidos",
    description: "Clientes marcados como desaparecidos",
    icon: UserX,
    iconClassName: "text-red-500",
  },
] as const

export default function BackupPage() {
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingZip, setLoadingZip] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleBackupZip = async (type: "clients" | "desaparecido" = "clients") => {
    setLoadingZip(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/backup/zip?type=${type}`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Erro ao gerar ZIP")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup-${type}-${localDateStr()}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setMessage({ type: "success", text: "Backup em pastas (ZIP) gerado e baixado com sucesso!" })
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao gerar ZIP" })
    } finally {
      setLoadingZip(false)
    }
  }

  const handleBackupPdf = async (key: string, label: string) => {
    setLoadingPdf(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/backup/pdf?type=${encodeURIComponent(key)}`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Erro ao gerar PDF")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup-${label.toLowerCase().replace(/\s+/g, "-")}-${localDateStr()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setMessage({ type: "success", text: `Backup PDF de ${label} gerado e baixado com sucesso!` })
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao gerar PDF" })
    } finally {
      setLoadingPdf(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pt-10">
      <div>
        <div className="flex items-center gap-3">
          <Download className="h-7 w-7 shrink-0 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">Backup de Dados</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">Exporte seus dados em PDF para manter um backup seguro.</p>
      </div>

      {message && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
          message.type === "success"
            ? "bg-primary/5 dark:bg-primary/15 border-primary/30 dark:border-primary/30 text-primary dark:text-primary"
            : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {backupSections.map((section) => {
          const Icon = section.icon
          return (
            <div
              key={section.title}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-zinc-800">
                  <Icon className={`h-5 w-5 ${section.iconClassName}`} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">{section.title}</h2>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">{section.description}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleBackupPdf(section.key, section.title)}
                  disabled={loadingPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <FileText className="h-4 w-4" />
                  {loadingPdf ? "..." : "PDF"}
                </button>
                {(section.key === "clients" || section.key === "desaparecido") && (
                  <button
                    type="button"
                    onClick={() => handleBackupZip(section.key as "clients" | "desaparecido")}
                    disabled={loadingZip}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <FolderArchive className="h-4 w-4" />
                    {loadingZip ? "..." : "ZIP"}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-5 w-5 text-amber-500" />
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            <span className="font-semibold text-gray-800 dark:text-zinc-200">Dica:</span> O PDF é ideal para visualização, impressão e arquivamento dos seus dados.
          </p>
        </div>
      </div>
    </div>
  )
}

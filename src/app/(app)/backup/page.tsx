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
  FileSpreadsheet,
  Landmark,
  Lightbulb,
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
] as const

export default function BackupPage() {
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleBackup = async (key: string, label: string) => {
    setLoadingXlsx(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/backup?type=${encodeURIComponent(key)}`, { method: "POST" })
      if (!res.ok) throw new Error("Erro ao gerar backup")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup-${label.toLowerCase().replace(/\s+/g, "-")}-${localDateStr()}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setMessage({ type: "success", text: `Backup Excel de ${label} gerado e baixado com sucesso!` })
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao gerar backup" })
    } finally {
      setLoadingXlsx(false)
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
    <div className="mx-auto max-w-xl space-y-6 pt-10">
      <div className="text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 dark:bg-primary/15">
          <Download className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">Backup de Dados</h1>
        <p className="mt-2 text-lg text-gray-500 dark:text-zinc-400">Exporte seus dados em CSV ou PDF para manter um backup seguro.</p>
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

      <div className="flex flex-col gap-2">
        {backupSections.map((section) => {
          const Icon = section.icon
          return (
            <div
              key={section.title}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-zinc-800">
                  <Icon className={`h-6 w-6 ${section.iconClassName}`} />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">{section.title}</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{section.description}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleBackup(section.key, section.title)}
                  disabled={loadingXlsx}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary/50 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {loadingXlsx ? "Gerando..." : "CSV"}
                </button>
                <button
                  type="button"
                  onClick={() => handleBackupPdf(section.key, section.title)}
                  disabled={loadingPdf}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <FileText className="h-4 w-4" />
                  {loadingPdf ? "Gerando..." : "PDF"}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800/50 dark:bg-yellow-950/20">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-5 w-5 text-yellow-600 dark:text-yellow-500" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Dica</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">
              Use o formato CSV para abrir no Excel ou Google Sheets. O PDF e para visualizacao e impressao.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

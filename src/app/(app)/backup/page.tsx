"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Clock, CheckCircle2, AlertCircle, FileSpreadsheet, FileText } from "lucide-react"

export default function BackupPage() {
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleBackup = async () => {
    setLoadingXlsx(true)
    setMessage(null)
    try {
      const res = await fetch("/api/backup", { method: "POST" })
      if (!res.ok) throw new Error("Erro ao gerar backup")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup-${new Date().toISOString().split("T")[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setMessage({ type: "success", text: "Backup Excel gerado e baixado com sucesso!" })
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao gerar backup" })
    } finally {
      setLoadingXlsx(false)
    }
  }

  const handleBackupPdf = async () => {
    setLoadingPdf(true)
    setMessage(null)
    try {
      const res = await fetch("/api/backup/pdf", { method: "POST" })
      if (!res.ok) throw new Error("Erro ao gerar PDF")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup-${new Date().toISOString().split("T")[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setMessage({ type: "success", text: "Backup PDF gerado e baixado com sucesso!" })
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao gerar PDF" })
    } finally {
      setLoadingPdf(false)
    }
  }

  return (
    <div className="space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Backup</h1>
        <p className="text-gray-500 dark:text-zinc-400 mt-1">Exporte seus dados em Excel ou PDF</p>
      </div>

      {message && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
          message.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
            : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {message.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Excel */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <FileSpreadsheet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Backup Excel</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Baixe seus dados em formato .xlsx</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Planilha com colunas organizadas: Cliente, CPF, Telefone, Valores, Status, Datas.
          </p>
          <Button
            onClick={handleBackup}
            disabled={loadingXlsx}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            {loadingXlsx ? "Gerando..." : "Baixar Excel (.xlsx)"}
          </Button>
        </div>

        {/* PDF */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
              <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Backup PDF</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Baixe seus dados em formato .pdf</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Relatório em PDF com tabela formatada, ideal para impressão e arquivo.
          </p>
          <Button
            onClick={handleBackupPdf}
            disabled={loadingPdf}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            {loadingPdf ? "Gerando..." : "Baixar PDF (.pdf)"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-yellow-200 dark:border-yellow-800/50 bg-yellow-50 dark:bg-yellow-950/20 p-4">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Dica importante</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">
              Recomendamos fazer backup regularmente para evitar perda de dados. Guarde os arquivos em local seguro.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

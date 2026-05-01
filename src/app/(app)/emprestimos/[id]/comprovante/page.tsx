"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Copy, Download, MessageCircle, X } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Installment {
  id: string
  number: number
  amount: number
  dueDate: string
  status: "PENDING" | "PAID" | "OVERDUE"
}

interface LoanDetails {
  id: string
  amount: number
  totalAmount: number
  interestRate: number
  installmentValue: number
  installmentCount: number
  contractDate: string
  firstInstallmentDate: string
  modality: string
  interestType: string
  profit: number
  client: {
    id: string
    name: string
    phone: string | null
  }
  installments: Installment[]
}

const modalityLabel: Record<string, string> = {
  MONTHLY: "Mensal",
  BIWEEKLY: "Quinzenal",
  WEEKLY: "Semanal",
  DAILY: "Diário",
}

const interestModeLabel: Record<string, string> = {
  PER_INSTALLMENT: "Por Parcela",
  TOTAL: "Sobre o Total",
  FIXED_AMOUNT: "Valor Fixo",
}

const loanIdPattern = /^c[a-z0-9]{24,}$/i

export default function ComprovanteEmprestimoPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const routeLoanId = params?.id
  const loanId = routeLoanId && loanIdPattern.test(routeLoanId) ? routeLoanId : null

  const [loan, setLoan] = useState<LoanDetails | null>(null)
  const [loading, setLoading] = useState(Boolean(loanId))
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchLoan = async () => {
      if (!loanId) {
        setLoading(false)
        setError(routeLoanId ? "Empréstimo não encontrado" : null)
        return
      }
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/loans/${loanId}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data?.error || "Erro ao carregar comprovante")
          return
        }
        setLoan(data)
      } catch (err: any) {
        setError(err?.message || "Erro de conexão")
      } finally {
        setLoading(false)
      }
    }

    fetchLoan()
  }, [loanId, routeLoanId])

  const receiptNumber = useMemo(() => {
    if (!loan?.id) return ""
    return `EMP-${loan.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase()}`
  }, [loan?.id])

  const receiptText = useMemo(() => {
    if (!loan) return ""

    const dueDates = loan.installments
      .sort((a, b) => a.number - b.number)
      .map((inst) => `${inst.number}ª: ${formatDate(inst.dueDate)}`)
      .join("\n")

    return [
      "COMPROVANTE DE EMPRÉSTIMO",
      `Nº: ${receiptNumber}`,
      "",
      "DADOS DO CLIENTE",
      `Nome: ${loan.client.name}`,
      "",
      "DADOS DA NEGOCIAÇÃO",
      `Valor Emprestado: ${formatCurrency(loan.amount)}`,
      `Taxa de Juros: ${loan.interestRate.toFixed(2)}%`,
      `Parcelas: ${loan.installmentCount}x de ${formatCurrency(loan.installmentValue)}`,
      `Data do Contrato: ${formatDate(loan.contractDate)}`,
      `1ª Parcela: ${formatDate(loan.firstInstallmentDate)}`,
      `Total a Receber: ${formatCurrency(loan.totalAmount)}`,
      "",
      "DATAS DE VENCIMENTO",
      dueDates,
      "",
      "SP Cobrança Fácil - Sistema de Gestão de Cobranças",
    ].join("\n")
  }, [loan, receiptNumber])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(receiptText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const handleWhatsApp = () => {
    if (!loan) return
    const digits = (loan.client.phone || "").replace(/\D/g, "")
    const text = encodeURIComponent(receiptText)

    const base = digits ? `https://wa.me/${digits}` : "https://wa.me/"
    window.open(`${base}?text=${text}`, "_blank")
  }

  const handleDownloadPdf = () => {
    window.print()
  }

  if (loading) {
    return <div className="text-gray-500 dark:text-zinc-400">Carregando comprovante...</div>
  }

  if (error || !loan) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{error || "Empréstimo não encontrado"}</p>
        <Button variant="outline" onClick={() => router.push("/emprestimos")}>Voltar</Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden print:border-0 print:rounded-none">
      <div className="flex items-center justify-between px-5 py-3 bg-emerald-50 dark:bg-emerald-950/300 text-white">
        <h1 className="text-2xl font-bold">Pré-visualização do Comprovante</h1>
        <button className="opacity-80 hover:opacity-100 print:hidden" onClick={() => router.back()}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/300 text-white p-4 text-center">
          <p className="text-4xl font-bold">SP Cobrança Fácil</p>
          <p className="text-2xl opacity-90">{loan.client.name}</p>
        </div>

        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
          <p className="text-3xl font-extrabold text-emerald-600">COMPROVANTE DE EMPRÉSTIMO</p>
          <p className="text-gray-500 dark:text-zinc-400 text-2xl mt-1">Nº: {receiptNumber}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4">
          <p className="text-emerald-600 font-bold text-3xl mb-3">DADOS DO CLIENTE</p>
          <p className="text-gray-700 dark:text-zinc-300 text-2xl">Nome:</p>
          <p className="text-gray-900 dark:text-zinc-100 text-3xl font-semibold">{loan.client.name}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4 space-y-3">
          <p className="text-emerald-600 font-bold text-3xl">DADOS DA NEGOCIAÇÃO</p>
          <div className="grid grid-cols-2 gap-2 text-2xl">
            <div>
              <p className="text-gray-500 dark:text-zinc-400">Valor Emprestado:</p>
              <p className="text-gray-900 dark:text-zinc-100 font-semibold">{formatCurrency(loan.amount)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-zinc-400">Taxa de Juros:</p>
              <p className="text-gray-900 dark:text-zinc-100 font-semibold">{loan.interestRate.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-zinc-400">Parcelas:</p>
              <p className="text-gray-900 dark:text-zinc-100 font-semibold">{loan.installmentCount}x de {formatCurrency(loan.installmentValue)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-zinc-400">Data do Contrato:</p>
              <p className="text-gray-900 dark:text-zinc-100 font-semibold">{formatDate(loan.contractDate)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-zinc-400">1ª Parcela:</p>
              <p className="text-gray-900 dark:text-zinc-100 font-semibold">{formatDate(loan.firstInstallmentDate)}</p>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center justify-between text-2xl font-bold tabular-nums tracking-tight text-emerald-600">
            <span>Total a Receber:</span>
            <span>{formatCurrency(loan.totalAmount)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4">
          <p className="text-emerald-600 font-bold text-3xl mb-3">DATAS DE VENCIMENTO</p>
          <div className="space-y-2">
            {loan.installments
              .sort((a, b) => a.number - b.number)
              .map((inst) => (
                <div key={inst.id} className="rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-gray-800 dark:text-zinc-200 text-xl">
                  ⏳ {inst.number}ª: {formatDate(inst.dueDate)}
                </div>
              ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-3">
          <div>
            <div className="border-t border-gray-300 dark:border-zinc-700 w-full mb-2" />
            <p className="text-gray-500 dark:text-zinc-400 text-2xl">Assin. Cliente</p>
          </div>
          <div className="text-right">
            <div className="border-t border-gray-300 dark:border-zinc-700 w-full mb-2" />
            <p className="text-gray-500 dark:text-zinc-400 text-2xl">Assin. Empresa</p>
          </div>
        </div>

        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/300 text-white text-center py-2.5 font-semibold text-xl">
          SP Cobrança Fácil - Sistema de Gestão de Cobranças
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-zinc-800 p-4 flex flex-wrap gap-3 justify-end print:hidden">
        <Button onClick={handleCopy} className="bg-amber-50 dark:bg-amber-950/300 hover:bg-amber-600 text-white gap-2">
          <Copy className="h-4 w-4" /> {copied ? "Copiado" : "Copiar Texto"}
        </Button>
        <Button variant="outline" onClick={handleWhatsApp} className="gap-2 text-emerald-600 border-emerald-500/40 hover:bg-emerald-50 dark:bg-emerald-950/300/10">
          <MessageCircle className="h-4 w-4" /> Conecte o WhatsApp
        </Button>
        <Button onClick={handleDownloadPdf} className="bg-emerald-50 dark:bg-emerald-950/300 hover:bg-emerald-600 text-white gap-2">
          <Download className="h-4 w-4" /> Baixar PDF
        </Button>
      </div>

      <div className="hidden print:block p-4 text-center text-sm text-gray-400 dark:text-zinc-500">
        Gerado em {new Date().toLocaleString("pt-BR")}
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
          }
        }
      `}</style>
    </div>
  )
}

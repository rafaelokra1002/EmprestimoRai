"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle2, Copy, Download, Hourglass, MessageCircle, X, XCircle } from "lucide-react"
import { formatCurrency, formatDate, localDateStr } from "@/lib/utils"
import { buildLoanData, calculateTotalAmountWithLateFee } from "@/lib/loan-logic"

interface Installment {
  id: string
  number: number
  amount: number
  paidAmount?: number
  dueDate: string
  status: "PENDING" | "PAID" | "OVERDUE"
}

interface Payment {
  id?: string
  amount: number
  date?: string
  notes?: string | null
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
  dailyInterest?: boolean
  dailyInterestAmount?: number
  dueDay?: number | null
  client: {
    id: string
    name: string
    phone: string | null
  }
  installments: Installment[]
  payments?: Payment[]
}

const loanIdPattern = /^c[a-z0-9]{24,}$/i

export function ComprovanteContent({
  presentation = "page",
  onClose,
  loanId: loanIdProp,
}: {
  presentation?: "page" | "modal"
  onClose?: () => void
  loanId?: string
}) {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const routeLoanId = loanIdProp ?? params?.id
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

  const handleClose = () => {
    if (onClose) {
      onClose()
      return
    }
    router.back()
  }

  const receiptNumber = useMemo(() => {
    if (!loan?.id) return ""
    return `EMP-${loan.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase()}`
  }, [loan?.id])

  const lateFee = useMemo(() => {
    if (!loan) return 0
    try {
      const loanData = buildLoanData({
        amount: loan.amount,
        interestRate: loan.interestRate,
        interestType: loan.interestType,
        totalAmount: loan.totalAmount,
        dailyInterest: loan.dailyInterest,
        dailyInterestAmount: loan.dailyInterestAmount ?? 0,
        dueDay: loan.dueDay || undefined,
        modality: loan.modality,
        firstInstallmentDate: loan.firstInstallmentDate,
        installments: loan.installments.map((i) => ({
          number: i.number,
          dueDate: i.dueDate,
          status: i.status,
          amount: i.amount,
          paidAmount: i.paidAmount ?? 0,
        })),
        payments: (loan.payments ?? []).map((p) => ({ amount: p.amount, notes: p.notes ?? null })),
      })
      return Math.max(0, calculateTotalAmountWithLateFee(loanData) - loan.totalAmount)
    } catch {
      return 0
    }
  }, [loan])

  const totalReceivable = useMemo(() => {
    if (!loan) return 0
    return loan.totalAmount + lateFee
  }, [loan, lateFee])

  const todayStr = localDateStr()

  const getInstallmentStatus = (inst: Installment): "PAID" | "OVERDUE" | "PENDING" => {
    if (inst.status === "PAID") return "PAID"
    const due = inst.dueDate.slice(0, 10)
    if (due < todayStr) return "OVERDUE"
    return "PENDING"
  }

  const receiptText = useMemo(() => {
    if (!loan) return ""

    const dueDates = loan.installments
      .slice()
      .sort((a, b) => a.number - b.number)
      .map((inst) => `${inst.number}ª: ${formatDate(inst.dueDate)}`)
      .join("\n")

    const lines = [
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
      `Total a Receber: ${formatCurrency(totalReceivable)}`,
    ]
    if (lateFee > 0) {
      lines.push(`(inclui ${formatCurrency(lateFee)} em multas)`)
    }
    lines.push("", "DATAS DE VENCIMENTO", dueDates, "", "SP Cobrança Fácil - Sistema de Gestão de Cobranças")
    return lines.join("\n")
  }, [loan, receiptNumber, totalReceivable, lateFee])

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
    return <div className="text-gray-500 dark:text-zinc-400 p-6">Carregando comprovante...</div>
  }

  if (!loanId && presentation === "modal") {
    return null
  }

  if (error || !loan) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-red-600">{error || "Empréstimo não encontrado"}</p>
        <Button variant="outline" onClick={handleClose}>Voltar</Button>
      </div>
    )
  }

  const containerClassName = presentation === "modal"
    ? "max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 print:border-0 print:rounded-none"
    : "max-w-4xl mx-auto rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden print:border-0 print:rounded-none"

  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between px-3 py-2 bg-primary text-primary-foreground">
        <h1 className="text-sm font-semibold mx-auto">Pré-visualização do Comprovante</h1>
        <button className="opacity-80 hover:opacity-100 print:hidden" onClick={handleClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div className="rounded-lg bg-primary text-primary-foreground px-3 py-2.5 text-center">
          <p className="text-base font-bold leading-tight">SP Cobrança Fácil</p>
          <p className="text-[11px] opacity-95">{loan.client.name}</p>
        </div>

        <div className="rounded-lg bg-primary/10 dark:bg-primary/15 border border-primary/20 dark:border-primary/30 px-3 py-2 text-center">
          <p className="text-xs font-bold text-primary tracking-wide">COMPROVANTE DE EMPRÉSTIMO</p>
          <p className="text-gray-500 dark:text-zinc-400 text-[10px] mt-0.5">Nº: {receiptNumber}</p>
        </div>

        <div className="rounded-lg border border-primary/30 dark:border-primary/30 px-3 py-2">
          <p className="text-primary font-bold text-xs mb-1">DADOS DO CLIENTE</p>
          <p className="text-gray-500 dark:text-zinc-400 text-[10px]">Nome:</p>
          <p className="text-gray-900 dark:text-zinc-100 text-xs font-medium">{loan.client.name}</p>
        </div>

        <div className="rounded-lg border border-primary/30 dark:border-primary/30 px-3 py-2 space-y-2">
          <p className="text-primary font-bold text-xs">DADOS DA NEGOCIAÇÃO</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <div>
              <p className="text-gray-500 dark:text-zinc-400 text-[10px]">Valor Emprestado:</p>
              <p className="text-gray-900 dark:text-zinc-100 font-semibold">{formatCurrency(loan.amount)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-zinc-400 text-[10px]">Taxa de Juros:</p>
              <p className="text-gray-900 dark:text-zinc-100 font-semibold">{loan.interestRate.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-zinc-400 text-[10px]">Parcelas:</p>
              <p className="text-gray-900 dark:text-zinc-100 font-semibold">{loan.installmentCount}x de {formatCurrency(loan.installmentValue)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-zinc-400 text-[10px]">Data do Contrato:</p>
              <p className="text-gray-900 dark:text-zinc-100 font-semibold">{formatDate(loan.contractDate)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-zinc-400 text-[10px]">1ª Parcela:</p>
              <p className="text-gray-900 dark:text-zinc-100 font-semibold">{formatDate(loan.firstInstallmentDate)}</p>
            </div>
          </div>

          <div className="rounded-md bg-primary/10 dark:bg-primary/15 border border-primary/20 dark:border-primary/30 px-2.5 py-1.5 text-primary">
            <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
              <span>Total a Receber:</span>
              <span>{formatCurrency(totalReceivable)}</span>
            </div>
            {lateFee > 0 && (
              <p className="mt-0.5 text-right text-[10px] font-normal text-gray-500 dark:text-zinc-400">
                (inclui {formatCurrency(lateFee)} em multas)
              </p>
            )}
          </div>
        </div>

        {lateFee > 0 && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <p className="font-bold text-amber-600 dark:text-amber-400 text-xs">MULTAS APLICADAS</p>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-zinc-300">Total de Multas:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(lateFee)}</span>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-primary/30 dark:border-primary/30 px-3 py-2">
          <p className="text-primary font-bold text-xs mb-1.5">DATAS DE VENCIMENTO</p>
          <div className="grid grid-cols-2 gap-1.5">
            {loan.installments
              .slice()
              .sort((a, b) => a.number - b.number)
              .map((inst) => {
                const status = getInstallmentStatus(inst)
                const styles =
                  status === "PAID"
                    ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                    : status === "OVERDUE"
                    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-400"
                    : "bg-gray-50 dark:bg-zinc-800/60 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"
                const Icon = status === "PAID" ? CheckCircle2 : status === "OVERDUE" ? XCircle : Hourglass
                return (
                  <div key={inst.id} className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] ${styles}`}>
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span className="font-medium">{inst.number}ª: {formatDate(inst.dueDate)}</span>
                  </div>
                )
              })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 pt-1">
          <div>
            <div className="border-t border-gray-300 dark:border-zinc-700 w-full mb-0.5" />
            <p className="text-gray-500 dark:text-zinc-400 text-[10px]">Assin. Cliente</p>
          </div>
          <div className="text-right">
            <div className="border-t border-gray-300 dark:border-zinc-700 w-full mb-0.5" />
            <p className="text-gray-500 dark:text-zinc-400 text-[10px]">Assin. Empresa</p>
          </div>
        </div>

        <div className="rounded-md bg-primary text-primary-foreground text-center py-1.5 font-semibold text-[11px]">
          SP Cobrança Fácil - Sistema de Gestão de Cobranças
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-zinc-800 px-3 py-2 grid grid-cols-3 gap-1.5 print:hidden">
        <Button size="sm" onClick={handleCopy} className="h-8 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white">
          <Copy className="h-3.5 w-3.5" /> {copied ? "Copiado" : "Copiar"}
        </Button>
        <Button size="sm" onClick={handleWhatsApp} className="h-8 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground">
          <MessageCircle className="h-3.5 w-3.5" /> Enviar
        </Button>
        <Button size="sm" onClick={handleDownloadPdf} className="h-8 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground">
          <Download className="h-3.5 w-3.5" /> PDF
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

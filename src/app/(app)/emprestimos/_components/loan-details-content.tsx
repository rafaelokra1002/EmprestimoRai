"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { buildLoanData, calculateOverdueInterest, calculateTotalAmountWithLateFee, getDaysOverdue, getOverdueDailyAmountBRL, getPaidExcludingInterest } from "@/lib/loan-logic"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Installment {
  id: string
  number: number
  amount: number
  paidAmount: number
  dueDate: string
  paidDate: string | null
  status: "PENDING" | "PAID" | "OVERDUE"
}

interface Payment {
  id: string
  amount: number
  date: string
  notes: string | null
}

interface LoanDetails {
  id: string
  amount: number
  totalAmount: number
  profit: number
  interestRate: number
  dailyInterest?: boolean
  dailyInterestAmount?: number
  dueDay?: number | null
  installmentValue: number
  installmentCount: number
  modality: string
  interestType: string
  contractDate: string
  firstInstallmentDate: string
  status: string
  notes: string | null
  client: { id: string; name: string }
  installments: Installment[]
  payments: Payment[]
}

export function LoanDetailsContent({
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
  const loanId = loanIdProp ?? params?.id

  const [loan, setLoan] = useState<LoanDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLoan = async () => {
      if (!loanId) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/loans/${loanId}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data?.error || "Erro ao carregar empréstimo")
          setLoading(false)
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
  }, [loanId])

  const handleClose = () => {
    if (onClose) {
      onClose()
      return
    }

    router.push("/emprestimos")
  }

  if (loading) {
    return <div className="text-gray-500 dark:text-zinc-400">Carregando detalhes...</div>
  }

  if (error || !loan) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{error || "Empréstimo não encontrado"}</p>
        <Button variant="outline" onClick={handleClose}>Voltar</Button>
      </div>
    )
  }

  const totalPaid = loan.payments.reduce((sum, payment) => sum + payment.amount, 0)
  const paidInstallments = loan.installments.filter((inst) => inst.status === "PAID").length
  const totalInstallments = loan.installmentCount || loan.installments.length || 1
  const progressPct = Math.round((paidInstallments / totalInstallments) * 100)
  const realizedProfit = paidInstallments > 0
    ? Math.round((paidInstallments * (loan.profit / totalInstallments)) * 100) / 100
    : 0
  const realizedProfitPct = loan.profit > 0 ? Math.round((realizedProfit / loan.profit) * 100) : 0

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

  const statusLabel: Record<Installment["status"], string> = {
    PENDING: "Pendente",
    PAID: "Pago",
    OVERDUE: "Atrasado",
  }

  const loanData = buildLoanData({
    amount: loan.amount,
    interestRate: loan.interestRate,
    interestType: loan.interestType,
    totalAmount: loan.totalAmount,
    dailyInterest: loan.dailyInterest,
    dailyInterestAmount: loan.dailyInterestAmount,
    dueDay: loan.dueDay || undefined,
    modality: loan.modality,
    firstInstallmentDate: loan.firstInstallmentDate,
    installments: loan.installments,
    payments: loan.payments,
  })
  const daysOverdue = getDaysOverdue(loanData)
  const overdueDailyAmount = getOverdueDailyAmountBRL(loanData)
  const overdueDailyTotal = daysOverdue > 0 ? overdueDailyAmount * daysOverdue : 0
  const overdueMonthlyInterest = daysOverdue >= 30
    ? calculateOverdueInterest(
        loan.totalAmount,
        loan.amount,
        loan.interestRate,
        daysOverdue,
        loan.interestType === "compound" ? "compound" : "simple"
      )
    : 0
  const overdueInterestTotal = overdueMonthlyInterest + overdueDailyTotal
  const paidExcludingInterest = getPaidExcludingInterest(loan.payments)
  const baseOutstanding = Math.max(0, loan.totalAmount - paidExcludingInterest)
  const totalPayableWithOverdue = calculateTotalAmountWithLateFee(loanData)

  const containerClassName = presentation === "modal"
    ? "max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
    : "space-y-5 pt-6"

  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{loan.client.name}</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm">Detalhes do contrato</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleClose}>{presentation === "modal" ? "Fechar" : "Voltar"}</Button>
          <Button variant="outline" onClick={() => router.push(`/emprestimos/${loan.id}/comprovante`)}>Comprovante</Button>
          <Button onClick={() => router.push(`/emprestimos/${loan.id}/editar`)}>Editar</Button>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-700 dark:text-zinc-300 text-sm">🔒 Lucro Previsto</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600">{formatCurrency(loan.profit)}</p>
          </div>
          <div>
            <p className="text-gray-700 dark:text-zinc-300 text-sm">✅ Lucro Realizado</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600">{formatCurrency(realizedProfit)}</p>
              <span className="text-gray-500 dark:text-zinc-400 text-sm">{realizedProfitPct}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 px-1">
        <p className="text-gray-700 dark:text-zinc-300 text-xl">% Juros: <span className="text-gray-900 dark:text-zinc-100 tabular-nums">{loan.interestRate.toFixed(1)}%</span></p>
        <p className="text-gray-700 dark:text-zinc-300 text-xl">📅 {loan.installmentCount}x <span className="text-gray-900 dark:text-zinc-100 tabular-nums">{formatCurrency(loan.installmentValue)}</span></p>
      </div>

      <Card className="p-4 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-zinc-100">📊 Progresso</h2>
        <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
          <div className="h-full bg-emerald-50 dark:bg-emerald-950/300" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500 dark:text-zinc-400">
            {paidInstallments} de {totalInstallments} parcela(s) paga(s) • {Math.max(0, totalInstallments - paidInstallments)} restante(s)
          </p>
          <p className="text-gray-900 dark:text-zinc-100 font-semibold">{progressPct}%</p>
        </div>
      </Card>

      {daysOverdue > 0 ? (
        <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-red-700 dark:text-red-300">Atraso atual</h2>
              <p className="text-sm text-red-600 dark:text-red-400">Resumo do juros de atraso e total atualizado para pagamento.</p>
            </div>
            <div className="rounded-lg bg-white/70 px-3 py-2 text-right dark:bg-red-950/30">
              <p className="text-xs text-red-600 dark:text-red-400">Dias em atraso</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-300">{daysOverdue}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-red-200 bg-white px-3 py-3 dark:border-red-900/40 dark:bg-zinc-900/70">
              <p className="text-xs text-gray-500 dark:text-zinc-400">Valor sem atraso</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-zinc-100">{formatCurrency(baseOutstanding)}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-white px-3 py-3 dark:border-red-900/40 dark:bg-zinc-900/70">
              <p className="text-xs text-gray-500 dark:text-zinc-400">Juros de atraso</p>
              <p className="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">{formatCurrency(overdueInterestTotal)}</p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-zinc-400">
                {overdueDailyAmount > 0 ? `${formatCurrency(overdueDailyAmount)}/dia` : "Sem multa diária"}
                {overdueMonthlyInterest > 0 ? ` • ${formatCurrency(overdueMonthlyInterest)} após 30 dias` : ""}
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-white px-3 py-3 dark:border-red-900/40 dark:bg-zinc-900/70">
              <p className="text-xs text-gray-500 dark:text-zinc-400">Cliente vai pagar</p>
              <p className="mt-1 text-lg font-semibold text-red-700 dark:text-red-300">{formatCurrency(totalPayableWithOverdue)}</p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="p-4 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <h2 className="font-semibold text-gray-900 dark:text-zinc-100 mb-3">🗓️ Cronograma de Parcelas</h2>
        <div className="space-y-2">
          {loan.installments.map((inst) => (
            <div key={inst.id} className="grid grid-cols-4 gap-2 items-center rounded-lg border border-gray-200 dark:border-zinc-800 p-3 text-sm">
              <p className="text-gray-700 dark:text-zinc-300">Parcela {inst.number}/{totalInstallments}</p>
              <p className="text-gray-900 dark:text-zinc-100 font-semibold">{formatCurrency(inst.amount)}</p>
              <p className="text-gray-700 dark:text-zinc-300">{formatDate(inst.dueDate)}</p>
              <p className={`text-right font-medium ${inst.status === "PAID" ? "text-emerald-600" : inst.status === "OVERDUE" ? "text-red-600" : "text-gray-700 dark:text-zinc-300"}`}>
                {statusLabel[inst.status]}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <h2 className="font-semibold text-gray-900 dark:text-zinc-100 mb-3">📋 Detalhes do Contrato</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-zinc-400">Data do Contrato</p>
            <p className="text-gray-900 dark:text-zinc-100 font-semibold">{formatDate(loan.contractDate)}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-zinc-400">Início</p>
            <p className="text-gray-900 dark:text-zinc-100 font-semibold">{formatDate(loan.firstInstallmentDate)}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-zinc-400">Tipo de Pagamento</p>
            <p className="text-gray-900 dark:text-zinc-100 font-semibold">{modalityLabel[loan.modality] || loan.modality}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-zinc-400">Tipo de Juros</p>
            <p className="text-gray-900 dark:text-zinc-100 font-semibold">Simples</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-zinc-400">Modo de Juros</p>
            <p className="text-gray-900 dark:text-zinc-100 font-semibold">{interestModeLabel[loan.interestType] || loan.interestType}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-zinc-400">Total de Juros</p>
            <p className="text-gray-900 dark:text-zinc-100 font-semibold">{formatCurrency(loan.profit)}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <h2 className="font-semibold text-gray-900 dark:text-zinc-100 mb-2">📝 Observações</h2>
        <p className="text-gray-700 dark:text-zinc-300 break-words">{loan.notes?.trim() ? loan.notes : "Sem observações."}</p>
      </Card>
    </div>
  )
}
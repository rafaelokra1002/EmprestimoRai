"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { X } from "lucide-react"
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
  client: { id: string; name: string; phone?: string | null }
  installments: Installment[]
  payments: Payment[]
}

const loanIdPattern = /^c[a-z0-9]{24,}$/i

export type LoanDetailsTone = "overdue" | "renegotiated" | "dueToday" | "interest" | "settled" | "default"

// Cor do título do cabeçalho por status (tom claro da cor do card)
const TONE_TITLE: Record<LoanDetailsTone, string> = {
  overdue: "#f8d7da",
  renegotiated: "#f9d6e6",
  dueToday: "#f7e6c4",
  interest: "#e6d6f9",
  settled: "#d6e4f9",
  default: "#ffffff",
}

// Fundo do modal por status, espelhando as cores dos cards de empréstimo
const TONE_MODAL_BG: Record<LoanDetailsTone, string> = {
  overdue: "border-l-[#E5484D] text-white bg-[radial-gradient(circle_at_top_left,rgba(255,92,92,0.20),transparent_55%),linear-gradient(135deg,#1F0608_0%,rgba(122,31,14,0.9)_55%,#1F0608_100%)]",
  renegotiated: "border-l-[#EC4899] text-white bg-[radial-gradient(circle_at_top_left,rgba(255,120,190,0.24),transparent_55%),linear-gradient(135deg,#3A0F24_0%,#8E2F58_55%,#3A0F24_100%)]",
  dueToday: "border-l-[#F59E0B] text-white bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.22),transparent_55%),linear-gradient(135deg,#332812_0%,#8A6E2A_55%,#332812_100%)]",
  interest: "border-l-[#a855f7] text-white bg-[radial-gradient(circle_at_top_left,rgba(190,123,255,0.30),transparent_55%),linear-gradient(135deg,#2C1544_0%,#6B399E_55%,#2C1544_100%)]",
  settled: "border-l-blue-500 text-white bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.22),transparent_55%),linear-gradient(135deg,#0B1F3A_0%,#1E3A5F_55%,#0B1F3A_100%)]",
  default: "border-l-[#29322E] text-white bg-[#191F1C]",
}

export function LoanDetailsContent({
  presentation = "page",
  onClose,
  loanId: loanIdProp,
  tone = "default",
}: {
  presentation?: "page" | "modal"
  onClose?: () => void
  loanId?: string
  tone?: LoanDetailsTone
}) {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const routeLoanId = loanIdProp ?? params?.id
  const loanId = routeLoanId && loanIdPattern.test(routeLoanId) ? routeLoanId : null

  const [loan, setLoan] = useState<LoanDetails | null>(null)
  const [loading, setLoading] = useState(Boolean(loanId))
  const [error, setError] = useState<string | null>(null)

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
  }, [loanId, routeLoanId])

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

  if (!loanId && presentation === "modal") {
    return null
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

  if (presentation === "modal") {
    const todayStart = new Date(new Date().toDateString())
    const cardClass = `rounded-xl p-3 ${tone === "default" ? "bg-[#1B231F]" : "bg-white/10"}`
    const lucroCardClass = `rounded-xl p-3 ${tone === "default" ? "bg-[#1A2720]" : "bg-white/10"}`
    const contratoFields: { label: string; value: string }[] = [
      { label: "Data do Contrato", value: formatDate(loan.contractDate) },
      { label: "Início", value: formatDate(loan.firstInstallmentDate) },
      { label: "Tipo de Juros", value: "Simples" },
      { label: "Modo de Juros", value: interestModeLabel[loan.interestType] || loan.interestType },
      { label: "Total de Juros", value: formatCurrency(loan.profit) },
      { label: "Tipo de Pagamento", value: modalityLabel[loan.modality] || loan.modality },
    ]

    return (
      <div className={`flex max-h-[92vh] flex-col overflow-hidden rounded-xl border-l-4 shadow-2xl ${TONE_MODAL_BG[tone]}`}>
        {/* Cabeçalho */}
        <div className="relative flex shrink-0 items-center gap-2 border-b border-white/20 px-6 py-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: TONE_TITLE[tone] }}>
            <span>📄</span> Detalhes do Empréstimo — {loan.client.name}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#cf3030] text-white transition-colors hover:bg-[#b82a2a]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          {/* Lucro previsto / realizado */}
          <div className={lucroCardClass}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[13px] text-white/75">💰 Lucro Previsto</div>
                <div className="text-xl font-bold text-white">{formatCurrency(loan.profit)}</div>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[13px] text-white/75">✅ Lucro Realizado</div>
                <div className="flex items-center gap-2 text-xl font-bold text-white">
                  {formatCurrency(realizedProfit)}
                  <span className="rounded-full bg-green-500/25 px-2 py-0.5 text-[11px] font-semibold text-green-300">{realizedProfitPct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Juros / parcela */}
          <div className="grid grid-cols-1 gap-5 px-0.5 py-1 sm:grid-cols-2">
            <div className="flex items-center gap-1.5 text-sm text-white/90">% Juros: {loan.interestRate.toFixed(2)}%</div>
            <div className="flex items-center gap-1.5 text-sm text-white/90">💳 {loan.installmentCount}x {formatCurrency(loan.installmentValue)}</div>
          </div>

          {/* Progresso */}
          <div className={cardClass}>
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-white">📊 Progresso</div>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/35">
                <div className="h-full rounded-full bg-white/85" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-[13px] font-semibold text-white">{progressPct}%</span>
            </div>
            <div className="mt-2 text-xs text-white/65">
              {paidInstallments} de {totalInstallments} parcela(s) paga(s) • {Math.max(0, totalInstallments - paidInstallments)} restante(s)
            </div>
          </div>

          {/* Cronograma de Parcelas */}
          <div className={cardClass}>
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-white">📅 Cronograma de Parcelas</div>
            <div className="space-y-2">
              {loan.installments.map((inst) => {
                const paid = inst.status === "PAID"
                const overdue = !paid && (inst.status === "OVERDUE" || new Date(inst.dueDate) < todayStart)
                const label = paid ? "Pago" : overdue ? "Atrasada" : "Pendente"
                const labelColor = paid ? "text-green-300" : overdue ? "text-red-300" : "text-white/75"
                return (
                  <div key={inst.id} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 text-sm text-white/90">
                    <span>Parcela {inst.number}/{totalInstallments}</span>
                    <span className="text-center font-semibold">{formatCurrency(inst.amount)}</span>
                    <span className="text-center text-white/75">{formatDate(inst.dueDate)}</span>
                    <span className={`text-right font-semibold ${labelColor}`}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Contato do Cliente */}
          <div className={cardClass}>
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-white">👤 Contato do Cliente</div>
            <div className="flex items-center gap-2 text-sm text-white/90">📞 {loan.client.phone?.trim() ? loan.client.phone : "Não informado"}</div>
          </div>

          {/* Detalhes do Contrato */}
          <div className={cardClass}>
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-white">📋 Detalhes do Contrato</div>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              {contratoFields.map((f) => (
                <div key={f.label}>
                  <div className="mb-0.5 text-xs text-white/60">{f.label}</div>
                  <div className="text-sm font-semibold text-white">{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div className={cardClass}>
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-white">📝 Observações</div>
            <div className="whitespace-pre-line text-[13px] leading-relaxed text-white/80">
              {loan.notes?.trim() ? loan.notes : "Sem observações."}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const containerClassName = "space-y-5 pt-6"

  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{loan.client.name}</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm">Detalhes do contrato</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleClose}>Voltar</Button>
          <Button variant="outline" onClick={() => router.push(`/emprestimos/${loan.id}/comprovante`)}>Comprovante</Button>
          <Button onClick={() => router.push(`/emprestimos/${loan.id}/editar`)}>Editar</Button>
        </div>
      </div>

      <div className="rounded-xl border border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/15 p-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-700 dark:text-zinc-300 text-sm">🔒 Lucro Previsto</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-primary">{formatCurrency(loan.profit)}</p>
          </div>
          <div>
            <p className="text-gray-700 dark:text-zinc-300 text-sm">✅ Lucro Realizado</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-primary">{formatCurrency(realizedProfit)}</p>
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
          <div className="h-full bg-primary/5 dark:bg-primary/150" style={{ width: `${progressPct}%` }} />
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
              <p className={`text-right font-medium ${inst.status === "PAID" ? "text-primary" : inst.status === "OVERDUE" ? "text-red-600" : "text-gray-700 dark:text-zinc-300"}`}>
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
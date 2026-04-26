import { resolveDailyInterestAmount } from "@/lib/utils"

/**
 * Lógica de empréstimos - 4 camadas de cálculo
 *
 * 1. calculateFinalAmount  → juros na criação (simples ou compostos)
 * 2. calculateOverdueInterest → juros por atraso (>= 30 dias)
 * 3. getOverdueDailyAmountBRL → multa diária fixa em R$
 * 4. calculateTotalAmountWithLateFee → junta tudo, desconta pagamentos
 */

// ─── Tipos ───────────────────────────────────────────────────────────

export interface LoanData {
  amount: number          // principal
  interestRate: number    // taxa (ex: 30 = 30%)
  interestType: string    // 'simple' | 'compound' | 'PER_INSTALLMENT' etc
  finalAmount: number     // valor final calculado na criação
  dailyInterest: boolean  // juros diário habilitado
  dailyInterestAmount: number // multa diária em R$ (0 se não configurado)
  dueDay: number          // dia fixo do vencimento
  modality: string        // MONTHLY, BIWEEKLY, WEEKLY, DAILY
  installments: { dueDate: Date | string; status: string; amount: number; paidAmount: number }[]
  payments: { amount: number; notes?: string | null }[]
}

// ─── 1. Juros na Criação ──────────────────────────────────────────────

/**
 * Calcula o finalAmount na criação do empréstimo.
 * 
 * Juros Simples: finalAmount = principal + principal × (taxa / (30 × 100)) × dias
 * Juros Compostos: finalAmount = principal × (1 + taxa/100) ^ (dias/30)
 */
export function calculateFinalAmount(
  principal: number,
  rate: number,
  days: number,
  type: string = "simple"
): number {
  if (type === "compound") {
    return Math.round(principal * Math.pow(1 + rate / 100, days / 30) * 100) / 100
  }
  // simple (padrão)
  return Math.round((principal + principal * (rate / (30 * 100)) * days) * 100) / 100
}

// ─── 2. Juros por Atraso ──────────────────────────────────────────────

/**
 * Calcula juros por atraso sobre o finalAmount.
 * Só aplica quando daysOverdue >= 30.
 *
 * Compostos: a cada mês completo → valor × (1 + taxa/100), dias restantes proporcional
 * Simples:   juros_mensal = principal × (taxa/100), soma linear por mês + proporcional
 */
export function calculateOverdueInterest(
  finalAmount: number,
  principalAmount: number,
  rate: number,
  daysOverdue: number,
  type: string = "simple"
): number {
  if (daysOverdue < 30) return 0

  const fullMonths = Math.floor(daysOverdue / 30)
  const remainingDays = daysOverdue % 30

  if (type === "compound") {
    let value = finalAmount
    for (let i = 0; i < fullMonths; i++) {
      value = value * (1 + rate / 100)
    }
    // Dias restantes: taxa diária composta
    if (remainingDays > 0) {
      const dailyRate = Math.pow(1 + rate / 100, 1 / 30)
      value = value * Math.pow(dailyRate, remainingDays)
    }
    return Math.round((value - finalAmount) * 100) / 100
  }

  // Simples: juros mensais sobre o principal original (nunca sobre acumulado)
  const monthlyInterest = principalAmount * (rate / 100)
  const proportionalDays = (monthlyInterest / 30) * remainingDays
  return Math.round((monthlyInterest * fullMonths + proportionalDays) * 100) / 100
}

// ─── 3. Multa Diária ─────────────────────────────────────────────────

/**
 * Retorna o valor da multa diária em R$.
 * Prioridade: loan.dailyInterestAmount → fallback calculado → 0
 */
export function getOverdueDailyAmountBRL(loan: Pick<LoanData, "dailyInterest" | "dailyInterestAmount" | "amount" | "interestRate" | "modality">): number {
  if (!loan.dailyInterest && (loan.dailyInterestAmount ?? 0) <= 0 && loan.interestRate > 0) {
    return resolveDailyInterestAmount(true, undefined, loan.amount, loan.interestRate, loan.modality)
  }

  return resolveDailyInterestAmount(
    loan.dailyInterest,
    loan.dailyInterestAmount,
    loan.amount,
    loan.interestRate,
    loan.modality
  )
}

// ─── 4. Cálculo Total Final ──────────────────────────────────────────

/**
 * Calcula o valor total atual da dívida:
 * 1. Base = finalAmount (juros simples/compostos iniciais)
 * 2. Se atraso >= 30 dias → aplica calculateOverdueInterest()
 * 3. Se atraso > 0 dias → soma multa diária × dias
 * 4. Subtrai pagamentos já feitos (exceto tipo 'interest' / 'só juros')
 * 5. Resultado = max(0, valor_calculado - total_pago)
 */
export function calculateTotalAmountWithLateFee(loan: LoanData): number {
  const nextDueInst = loan.installments
    .filter(i => i.status !== "PAID")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

  let total = loan.finalAmount

  if (nextDueInst) {
    const now = new Date()
    const due = new Date(nextDueInst.dueDate)
    const diffMs = now.getTime() - due.getTime()
    const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

    // Juros por atraso (>= 30 dias)
    if (daysOverdue >= 30) {
      total += calculateOverdueInterest(
        loan.finalAmount,
        loan.amount,
        loan.interestRate,
        daysOverdue,
        loan.interestType === "compound" ? "compound" : "simple"
      )
    }

    // Multa diária (> 0 dias)
    if (daysOverdue > 0) {
      total += getOverdueDailyAmountBRL(loan) * daysOverdue
    }
  }

  // Subtrair pagamentos (exceto pagamentos só de juros)
  const totalPaid = loan.payments
    .filter(p => {
      const notes = (p.notes || "").toLowerCase()
      return !notes.includes("só juros") && !notes.includes("parcial de juros")
    })
    .reduce((s, p) => s + p.amount, 0)

  return Math.max(0, Math.round((total - totalPaid) * 100) / 100)
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Calcula dias de atraso a partir da próxima parcela pendente
 */
export function getDaysOverdue(loan: LoanData): number {
  const nextDueInst = loan.installments
    .filter(i => i.status !== "PAID")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

  if (!nextDueInst) return 0

  const now = new Date()
  const due = new Date(nextDueInst.dueDate)
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
}

/**
 * Calcula o juros do período atual (sem atraso) = o juros embutido na parcela
 * = finalAmount - principal (para empréstimos de 1 parcela)
 * = profit / installmentCount (genérico)
 */
export function getInterestPerPeriod(
  finalAmount: number,
  principal: number,
  installmentCount: number
): number {
  const totalInterest = finalAmount - principal
  return Math.round((totalInterest / installmentCount) * 100) / 100
}

/**
 * Calcula a próxima data de vencimento mantendo o dia fixo
 */
export function getNextDueDate(dueDay: number, fromDate: Date = new Date()): Date {
  const now = new Date(fromDate)
  let targetMonth = now.getMonth() + 1
  let targetYear = now.getFullYear()

  if (targetMonth > 11) {
    targetMonth = 0
    targetYear++
  }

  const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  const actualDay = Math.min(dueDay, lastDayOfMonth)

  return new Date(targetYear, targetMonth, actualDay)
}

/**
 * Extrai o dueDay de uma data
 */
export function extractDueDay(date: Date | string): number {
  return new Date(date).getDate()
}

/**
 * Total de pagamentos que NÃO são "só juros"
 */
export function getPaidExcludingInterest(payments: { amount: number; notes?: string | null }[]): number {
  return payments
    .filter(p => {
      const notes = (p.notes || "").toLowerCase()
      return !notes.includes("só juros") && !notes.includes("parcial de juros")
    })
    .reduce((s, p) => s + p.amount, 0)
}

/**
 * Constrói LoanData a partir dos dados do Prisma
 */
export function buildLoanData(loan: {
  amount: number
  interestRate: number
  interestType: string
  totalAmount: number
  dailyInterest?: boolean
  dailyInterestAmount?: number
  dueDay?: number
  modality?: string
  firstInstallmentDate: Date | string
  installments: { dueDate: Date | string; status: string; amount: number; paidAmount: number }[]
  payments: { amount: number; notes?: string | null }[]
}): LoanData {
  return {
    amount: loan.amount,
    interestRate: loan.interestRate,
    interestType: loan.interestType === "compound" ? "compound" : "simple",
    finalAmount: loan.totalAmount,
    dailyInterest: loan.dailyInterest ?? false,
    dailyInterestAmount: loan.dailyInterestAmount ?? 0,
    dueDay: loan.dueDay || extractDueDay(loan.firstInstallmentDate),
    modality: loan.modality || "MONTHLY",
    installments: loan.installments.map(i => ({
      dueDate: i.dueDate,
      status: i.status,
      amount: i.amount,
      paidAmount: i.paidAmount,
    })),
    payments: loan.payments.map(p => ({
      amount: p.amount,
      notes: p.notes,
    })),
  }
}

// ─── Backward compatibility aliases ──────────────────────────────────

export interface LoanState {
  principal: number
  interestRate: number
  interestPerMonth: number
  lateCycles: number
  dueDay: number
  nextDueDate: Date
}

export function buildLoanState(loan: {
  amount: number
  interestRate: number
  lateCycles?: number
  dueDay?: number
  firstInstallmentDate: Date | string
  installments: { dueDate: Date | string; status: string }[]
  modality?: string
}): LoanState {
  const principal = loan.amount
  const interestRate = loan.interestRate
  const interestPerMonth = Math.round(principal * (interestRate / 100) * 100) / 100
  const dueDay = loan.dueDay || extractDueDay(loan.firstInstallmentDate)

  const pendingInsts = loan.installments
    .filter(i => i.status !== "PAID")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  const nextDueInst = pendingInsts[0]

  let lateCycles = 0
  let nextDueDate: Date

  if (nextDueInst) {
    nextDueDate = new Date(nextDueInst.dueDate)
    const now = new Date()
    const diffMs = now.getTime() - nextDueDate.getTime()
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
    const periodDays = loan.modality === "DAILY" ? 1 : loan.modality === "WEEKLY" ? 7 : loan.modality === "BIWEEKLY" ? 15 : 30
    lateCycles = Math.floor(diffDays / periodDays)
  } else {
    nextDueDate = new Date()
  }

  if (loan.lateCycles !== undefined && loan.lateCycles !== null) {
    lateCycles = loan.lateCycles
  }

  return { principal, interestRate, interestPerMonth, lateCycles, dueDay, nextDueDate }
}

export function calculateAccumulatedInterest(loan: LoanState): number {
  return Math.round(loan.interestPerMonth * (loan.lateCycles + 1) * 100) / 100
}

export function calculateTotal(loan: LoanState): number {
  return Math.round((loan.principal + loan.interestPerMonth * (loan.lateCycles + 1)) * 100) / 100
}

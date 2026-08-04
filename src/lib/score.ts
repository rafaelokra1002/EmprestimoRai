/**
 * Cálculo automático do Score de confiabilidade do cliente.
 *
 * Segue a referência exibida na página de Score:
 *   120-150 Excelente • 100-119 Bom • 70-99 Regular • 0-69 Crítico
 *
 * Regras (base 100):
 *   +3  por pagamento em dia
 *   -20 por atraso
 *   -30 por atraso crítico (mais de 30 dias)
 *   +15 bônus fidelidade (cliente com ao menos 1 empréstimo quitado)
 *   +2  a cada R$50 pagos em multas/juros extras (máx. +10) — bônus recuperação
 *
 * Resultado limitado a 0–150.
 */

export const SCORE_MIN = 0
export const SCORE_MAX = 150
export const SCORE_BASE = 100

const DAY_MS = 24 * 60 * 60 * 1000

export interface ScoreInstallment {
  status: string
  dueDate: string | Date
  paidDate?: string | Date | null
  amount?: number
  paidAmount?: number
}

export interface ScorePayment {
  amount: number
  notes?: string | null
}

export interface ScoreLoan {
  status: string
  profit: number
  installments?: ScoreInstallment[] | null
  payments?: ScorePayment[] | null
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

/** Pagamento apenas de juros (renova a parcela em vez de quitá-la). */
export function isInterestOnlyPayment(notes?: string | null): boolean {
  const n = (notes || "").toLowerCase()
  return n.includes("só juros") || n.includes("so juros") || n.includes("parcial de juros")
}

/** Diferença em dias-calendário (ignora horário). Positivo = a depois de b. */
function diffDays(a: Date, b: Date): number {
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((da - db) / DAY_MS)
}

/** Soma de multas/juros extras pagos (usado no bônus de recuperação e no card "Lucro Extra"). */
export function calculateExtraProfit(loan: ScoreLoan): number {
  const installmentCount = (loan.installments?.length || 0) || 1
  const interestPerPeriod = loan.profit / installmentCount
  return (loan.payments || []).reduce((sum, p) => {
    const notes = p.notes || ""
    const lateFeeMatch = notes.match(/\[lateFee:([\d.]+)\]/i) || notes.match(/\[dailyFee:([\d.]+)\]/i)
    if (lateFeeMatch) return sum + (parseFloat(lateFeeMatch[1]) || 0)
    if (isInterestOnlyPayment(notes)) return sum + Math.max(0, Number(p.amount) - interestPerPeriod)
    return sum
  }, 0)
}

/**
 * Calcula o score do cliente a partir de todos os seus empréstimos.
 * `now` é injetável para testes / consistência entre chamadas.
 */
export function calculateClientScore(loans: ScoreLoan[], now: Date = new Date()): number {
  let score = SCORE_BASE
  let hasCompleted = false
  let extraProfit = 0

  for (const loan of loans) {
    if (loan.status === "COMPLETED") hasCompleted = true

    for (const inst of loan.installments || []) {
      const due = toDate(inst.dueDate)

      if (inst.status === "PAID") {
        // Pagamento realizado: em dia (+3) ou atrasado (-20 / -30 se crítico)
        const lateDays = inst.paidDate ? diffDays(toDate(inst.paidDate), due) : 0
        if (lateDays > 30) score -= 30
        else if (lateDays > 0) score -= 20
        else score += 3
      } else {
        // Parcela em aberto: penaliza se já venceu (atraso vigente)
        const overdueDays = diffDays(now, due)
        if (overdueDays > 30) score -= 30
        else if (overdueDays > 0) score -= 20
      }
    }

    // Pagamentos apenas de juros renovam a parcela (não ficam PAID), mas
    // contam como pagamento em dia: +3 por juros pago.
    for (const p of loan.payments || []) {
      if (isInterestOnlyPayment(p.notes)) score += 3
    }

    extraProfit += calculateExtraProfit(loan)
  }

  if (hasCompleted) score += 15
  score += Math.min(10, Math.floor(extraProfit / 50) * 2) // bônus recuperação

  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(score)))
}

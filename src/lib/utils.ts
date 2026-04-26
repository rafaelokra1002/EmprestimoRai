import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export const DEFAULT_DAILY_INTEREST_AMOUNT = 15

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date))
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function calculateScore(
  baseScore: number,
  onTimePayments: number,
  latePayments: number,
  totalValue: number
): number {
  let score = baseScore
  score += onTimePayments * 10
  score -= latePayments * 15
  score += totalValue / 1000
  return Math.max(0, Math.min(1000, Math.round(score)))
}

export function calculateLoan(
  amount: number,
  interestRate: number,
  installments: number,
  interestType: string = "PER_INSTALLMENT",
  fixedInterestAmount?: number,
  customInstallmentAmounts?: number[]
) {
  let totalInterest = 0
  let totalAmount = 0
  let installmentAmount = 0

  if (interestType === "CUSTOM" && customInstallmentAmounts && customInstallmentAmounts.length > 0) {
    // Parcelas Personalizadas - cada parcela com valor definido pelo usuário
    totalAmount = customInstallmentAmounts.reduce((sum, v) => sum + (v || 0), 0)
    totalInterest = totalAmount - amount
    installmentAmount = totalAmount / installments
  } else if (interestType === "FIXED_AMOUNT" && fixedInterestAmount !== undefined) {
    totalInterest = fixedInterestAmount
    totalAmount = amount + totalInterest
    installmentAmount = totalAmount / installments
  } else if (interestType === "TOTAL") {
    // Sobre o Total
    totalInterest = amount * (interestRate / 100)
    totalAmount = amount + totalInterest
    installmentAmount = totalAmount / installments
  } else if (interestType === "COMPOUND") {
    // Juros Compostos Puros
    const rate = interestRate / 100
    totalAmount = amount * Math.pow(1 + rate, installments)
    totalInterest = totalAmount - amount
    installmentAmount = totalAmount / installments
  } else if (interestType === "SAC") {
    // SAC (Amortização Constante) - parcelas decrescentes
    const rate = interestRate / 100
    const amortization = amount / installments
    const sacInstallments: number[] = []
    totalInterest = 0
    for (let i = 0; i < installments; i++) {
      const balance = amount - amortization * i
      const interest = balance * rate
      totalInterest += interest
      sacInstallments.push(Math.round((amortization + interest) * 100) / 100)
    }
    totalAmount = amount + totalInterest
    installmentAmount = sacInstallments[0] // primeira parcela (maior)

    return {
      totalAmount: Math.round(totalAmount * 100) / 100,
      profit: Math.round(totalInterest * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      installmentAmount: Math.round(installmentAmount * 100) / 100,
      sacInstallments,
    }
  } else if (interestType === "PRICE") {
    // Tabela Price (Sistema Francês) - parcelas fixas com juros compostos embutidos
    const rate = interestRate / 100
    if (rate === 0) {
      installmentAmount = amount / installments
    } else {
      installmentAmount = amount * (rate * Math.pow(1 + rate, installments)) / (Math.pow(1 + rate, installments) - 1)
    }
    totalAmount = installmentAmount * installments
    totalInterest = totalAmount - amount
  } else {
    // PER_INSTALLMENT - juros aplicado por parcela
    totalInterest = amount * (interestRate / 100) * installments
    totalAmount = amount + totalInterest
    installmentAmount = totalAmount / installments
  }

  const profit = totalInterest

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    installmentAmount: Math.round(installmentAmount * 100) / 100,
  }
}

export function resolveDailyInterestAmount(
  enabled: boolean,
  explicitAmount: number | undefined,
  amount: number,
  interestRate: number,
  modality: string
): number {
  if (!enabled) return 0
  if (typeof explicitAmount === "number" && explicitAmount > 0) {
    return Math.round(explicitAmount * 100) / 100
  }

  return DEFAULT_DAILY_INTEREST_AMOUNT
}

export function generateInstallmentDates(
  firstDate: Date,
  count: number,
  modality: string = "MONTHLY",
  skipSaturday = false,
  skipSunday = false,
  skipHolidays = false
): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < count; i++) {
    const date = new Date(firstDate)
    if (modality === "MONTHLY") {
      date.setMonth(date.getMonth() + i)
    } else if (modality === "BIWEEKLY") {
      date.setDate(date.getDate() + i * 15)
    } else if (modality === "WEEKLY") {
      date.setDate(date.getDate() + i * 7)
    } else if (modality === "DAILY") {
      date.setDate(date.getDate() + i)
    }
    // Ajustar fins de semana
    if (skipSaturday && date.getDay() === 6) date.setDate(date.getDate() + 2)
    if (skipSunday && date.getDay() === 0) date.setDate(date.getDate() + 1)
    dates.push(date)
  }
  return dates
}

"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate, localDateStr } from "@/lib/utils"
import { getOverdueDailyAmountBRL, buildLoanData, calculateTotalAmountWithLateFee } from "@/lib/loan-logic"
import { useTheme } from "@/lib/theme-provider"
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import {
  Calendar, Download, RefreshCw, ChevronDown, ChevronUp,
  Wallet, TrendingUp, DollarSign, CheckCircle2, Clock, AlertTriangle,
  Percent, Filter,
  Users, ToggleLeft, ToggleRight, AlertOctagon, Award, HelpCircle
} from "lucide-react"

const today = () => localDateStr()
const firstOfMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
const lastOfMonth = () => {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
}

interface Loan {
  id: string
  amount: number
  interestRate: number
  interestType: string
  modality: string
  totalAmount: number
  totalInterest: number
  installmentValue: number
  profit: number
  installmentCount: number
  contractDate: string
  firstInstallmentDate: string
  startDate: string
  status: string
  dailyInterest: boolean
  notes: string | null
  createdAt: string
  client: { id: string; name: string; photo: string | null }
  installments: any[]
  payments: any[]
}

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  dueDate: string
  paidDate: string | null
  status: string
}

export default function RelatorioEmprestimosPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [deletedLoans, setDeletedLoans] = useState<Loan[]>([])
  const [clients, setClients] = useState<Array<{ id: string; phone: string | null }>>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const tooltipStyle = { backgroundColor: isDark ? "#18181b" : "#ffffff", border: `1px solid ${isDark ? "#27272a" : "#e5e7eb"}`, borderRadius: "8px", color: isDark ? "#f4f4f5" : "#374151" }
  const gridColor = isDark ? "#27272a" : "#e5e7eb"
  const axisColor = isDark ? "#71717a" : "#9ca3af"
  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate, setEndDate] = useState(lastOfMonth())
  const autoDateSet = useRef(false)
  const [paymentFilter, setPaymentFilter] = useState<"all" | "monthly" | "installment">("all")
  const [showModalityCards, setShowModalityCards] = useState(false)
  const [caixaExtra, setCaixaExtra] = useState(0)
  const [caixaInicial, setCaixaInicial] = useState(0)
  const [updatedAt, setUpdatedAt] = useState("")
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((data) => setCaixaInicial(Number(data?.caixaInicial) || 0)).catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [loansRes, allLoansRes, expensesRes, clientsRes] = await Promise.all([
        fetch("/api/loans"),
        fetch("/api/loans?includeDeleted=true"),
        fetch("/api/expenses"),
        fetch("/api/clients"),
      ])
      if (!loansRes.ok) throw new Error(`Erro ao buscar empréstimos (${loansRes.status})`)
      if (!expensesRes.ok) throw new Error(`Erro ao buscar despesas (${expensesRes.status})`)
      const loansData = await loansRes.json()
      const allLoansData = await allLoansRes.json()
      const expensesData = await expensesRes.json()
      const clientsData = await clientsRes.json()
      setLoans(Array.isArray(loansData) ? loansData : [])
      setDeletedLoans(Array.isArray(allLoansData) ? allLoansData.filter((l: any) => l.deleted === true) : [])
      setExpenses(Array.isArray(expensesData) ? expensesData : [])
      setClients(Array.isArray(clientsData) ? clientsData : [])
      setUpdatedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
    } catch (err: any) {
      setFetchError(err.message || "Erro ao carregar dados")
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // On first load, set startDate to the first day of the month of the earliest unpaid installment
  useEffect(() => {
    if (autoDateSet.current || loans.length === 0) return
    autoDateSet.current = true
    const dates: string[] = loans
      .filter(l => l.status === "ACTIVE")
      .flatMap(l => (l.installments as any[]).filter(i => i.status !== "PAID").map(i => localDateStr(new Date(i.dueDate))))
    dates.sort()
    const earliest = dates[0] ?? null
    if (earliest && earliest < firstOfMonth()) {
      setStartDate(earliest.substring(0, 7) + "-01")
    }
  }, [loans])

  const lastDayOfCurrentMonth = useMemo(() => {
    const now = new Date()
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
  }, [])

  // Loans created within the selected period (for "new capital deployed" metric)
  const newLoansInPeriod = useMemo(() => {
    return loans.filter((loan) => {
      const loanDate = localDateStr(new Date(loan.contractDate || loan.createdAt))
      if (startDate && loanDate < startDate) return false
      if (endDate && loanDate > endDate) return false
      if (paymentFilter === "monthly" && loan.installmentCount !== 1) return false
      if (paymentFilter === "installment" && loan.installmentCount <= 1) return false
      return true
    })
  }, [loans, startDate, endDate, paymentFilter])

  // All loans active during the period: active loans always included; completed only if created in period
  const filtered = useMemo(() => {
    return loans.filter((loan) => {
      const loanDate = localDateStr(new Date(loan.contractDate || loan.createdAt))
      if (endDate && loanDate > endDate) return false
      if (loan.status !== "ACTIVE" && startDate && loanDate < startDate) return false
      if (paymentFilter === "monthly" && loan.installmentCount !== 1) return false
      if (paymentFilter === "installment" && loan.installmentCount <= 1) return false
      return true
    })
  }, [loans, startDate, endDate, paymentFilter])

  const activeLoans = useMemo(() => {
    const base = loans.filter(l => l.status === "ACTIVE")
    const hasInstInPeriod = (l: typeof base[0]) =>
      l.installments.some((i: any) => {
        if (i.status === "PAID") return false
        const d = localDateStr(new Date(i.dueDate))
        if (startDate && d < startDate) return false
        if (endDate && d > endDate) return false
        return true
      })
    if (paymentFilter === "monthly") return base.filter(l => l.installmentCount === 1 && hasInstInPeriod(l))
    if (paymentFilter === "installment") return base.filter(l => l.installmentCount > 1 && hasInstInPeriod(l))
    return base.filter(hasInstInPeriod)
  }, [loans, paymentFilter, startDate, endDate])

  // Capital na rua = principal em aberto, alinhado ao dashboard (desconta parcelas
  // pagas E pagamentos parciais, proporcional ao valor da parcela)
  const remainingCapital = (l: Loan) => {
    const principal = Number(l.amount || 0)
    const instCount = l.installments.length || 1
    const principalPerInst = principal / instCount
    const capitalRepaid = l.installments.reduce((s: number, i: any) => {
      if (i.status === "PAID") return s + principalPerInst
      const partial = Number(i.paidAmount || 0)
      if (partial > 0 && Number(i.amount) > 0) return s + (partial / Number(i.amount)) * principalPerInst
      return s
    }, 0)
    return Math.max(0, principal - capitalRepaid)
  }

  // Juros extras de ciclos para MENSAL (1 parcela) em atraso > 30 dias
  const getExtraCyclesInterest = (l: Loan) => {
    if (l.installmentCount !== 1) return 0
    const overdueInst = l.installments.find((i: any) => i.status !== "PAID")
    if (!overdueInst) return 0
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const due = new Date(overdueInst.dueDate); due.setHours(0, 0, 0, 0)
    if (due >= now) return 0
    const daysOver = Math.floor((now.getTime() - due.getTime()) / 86400000)
    const extraCycles = Math.floor(daysOver / 30)
    return extraCycles * (l.profit / Math.max(1, l.installmentCount))
  }

  // Saldo devedor (total a receber − pago + multas de atraso), igual às outras telas
  const getRemaining = (l: Loan) => {
    const base = calculateTotalAmountWithLateFee(buildLoanData({
      amount: l.amount, interestRate: l.interestRate, interestType: l.interestType,
      totalAmount: l.totalAmount, dailyInterest: l.dailyInterest,
      dailyInterestAmount: Number((l as any).dailyInterestAmount || 0),
      dueDay: (l as any).dueDay ?? undefined,
      modality: l.modality, firstInstallmentDate: l.firstInstallmentDate,
      installments: l.installments, payments: l.payments,
    }))
    return base + getExtraCyclesInterest(l)
  }

  // Lucro realizado do empréstimo = juros + multa efetivamente recebidos (proporcional
  // aos pagamentos). Retorna 0 enquanto não houver pagamento.
  const getRealizedProfit = (l: Loan) => {
    const dailyRate = getOverdueDailyAmountBRL(buildLoanData({
      amount: l.amount, interestRate: l.interestRate, interestType: l.interestType,
      totalAmount: l.totalAmount, dailyInterest: l.dailyInterest,
      dailyInterestAmount: Number((l as any).dailyInterestAmount || 0),
      modality: l.modality, firstInstallmentDate: l.firstInstallmentDate,
      installments: l.installments, payments: l.payments,
    }))

    let juros = 0
    if (l.payments.length > 0) {
      const capitalIntact = l.installments.every((i: any) => (i.paidAmount || 0) === 0)
      if (capitalIntact) {
        juros = l.payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
      } else {
        const interestRatio = l.totalAmount > 0 ? l.profit / l.totalAmount : 0
        juros = l.payments.reduce((s: number, p: any) => {
          const notes = (p.notes || "").toLowerCase()
          const isSoJuros = notes.includes("só juros") || notes.includes("so juros") || notes.includes("parcial de juros")
          if (isSoJuros) return s + Number(p.amount)
          const payDate = new Date(p.date); payDate.setHours(0, 0, 0, 0)
          const multaForPayment = l.installments.reduce((acc: number, i: any) => {
            if (!i.paidDate) return acc
            const paid = new Date(i.paidDate); paid.setHours(0, 0, 0, 0)
            if (paid.getTime() !== payDate.getTime()) return acc
            const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0)
            if (paid <= due) return acc
            const daysOver = Math.max(0, Math.floor((paid.getTime() - due.getTime()) / 86400000))
            return acc + dailyRate * daysOver + Number((l as any).penaltyFee || 0)
          }, 0)
          const baseAmount = Math.max(0, Number(p.amount) - multaForPayment)
          return s + baseAmount * interestRatio
        }, 0)
      }
    }

    let multa = 0
    if (dailyRate > 0 || (l as any).penaltyFee > 0) {
      multa = l.installments.reduce((s: number, i: any) => {
        if (i.status !== "PAID" || !i.paidDate) return s
        const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0)
        const paid = new Date(i.paidDate); paid.setHours(0, 0, 0, 0)
        if (paid <= due) return s
        const daysOver = Math.max(0, Math.floor((paid.getTime() - due.getTime()) / 86400000))
        return s + dailyRate * daysOver + Number((l as any).penaltyFee || 0)
      }, 0)
    }

    return juros + multa
  }

  const modalityStats = useMemo(() => {
    const allActive = loans.filter(l => l.status === "ACTIVE")
    // Lucro realizado de empréstimos apagados (soft-delete): parcelas removidas, mas
    // recebimentos preservados. Só some quando o recebimento é excluído em Recebimentos.
    // Pagamento "só juros" = lucro cheio; parcela normal = só a parte de juros (proporção).
    const deletedProfit = (subset: Loan[]) =>
      subset.reduce((total, l) => {
        const interestRatio = l.totalAmount > 0 ? l.profit / l.totalAmount : 0
        return total + l.payments.reduce((ps: number, p: any) => {
          const notes = (p.notes || "").toLowerCase()
          const isSoJuros = notes.includes("só juros") || notes.includes("so juros") || notes.includes("parcial de juros")
          return ps + (isSoJuros ? Number(p.amount) : Number(p.amount) * interestRatio)
        }, 0)
      }, 0)
    const calc = (subset: Loan[], deletedSubset: Loan[]) => ({
      capitalNaRua: subset.reduce((s, l) => s + remainingCapital(l), 0),
      lucro: subset.reduce((s, l) => s + getRealizedProfit(l), 0) + deletedProfit(deletedSubset),
      contratos: subset.length,
    })
    return {
      all: calc(allActive, deletedLoans),
      installment: calc(allActive.filter(l => l.installmentCount > 1), deletedLoans.filter(l => l.installmentCount > 1)),
      monthly: calc(allActive.filter(l => l.installmentCount === 1), deletedLoans.filter(l => l.installmentCount === 1)),
    }
  }, [loans, deletedLoans])

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = localDateStr(new Date(e.dueDate))
      if (startDate && d < startDate) return false
      if (endDate && d > endDate) return false
      return true
    })
  }, [expenses, startDate, endDate])

  // All loans filtered by type only (no date filter) — used for charts
  const paymentFilteredLoans = useMemo(() => {
    if (paymentFilter === "monthly") return loans.filter(l => l.installmentCount === 1)
    if (paymentFilter === "installment") return loans.filter(l => l.installmentCount > 1)
    return loans
  }, [loans, paymentFilter])

  // ===== CALCULATIONS =====
  // Respeita o período do filtro: usa os ativos com VENCIMENTO dentro do período
  // (mesma base dos demais cards do relatório), não todos os ativos.
  // Capital na rua = principal em aberto de TODOS os ativos (independe do vencimento;
  // pagamento "só juros" renova o vencimento mas o principal continua na rua)
  const capitalNaRua = useMemo(() => {
    const base = loans.filter(l => l.status === "ACTIVE")
    const typeFiltered = paymentFilter === "monthly" ? base.filter(l => l.installmentCount === 1)
      : paymentFilter === "installment" ? base.filter(l => l.installmentCount > 1)
      : base
    return typeFiltered.reduce((sum, l) => sum + remainingCapital(l), 0)
  }, [loans, paymentFilter])

  const emprestimosNoPeriodo = useMemo(() => {
    return newLoansInPeriod.reduce((sum, l) => sum + l.amount, 0)
  }, [newLoansInPeriod])

  const pagamentosNoPeriodo = useMemo(() => {
    return filtered.reduce((sum, l) => {
      return sum + l.payments
        .filter((p: any) => {
          const payDate = localDateStr(new Date(p.date))
          if (startDate && payDate < startDate) return false
          if (endDate && payDate > endDate) return false
          return true
        })
        .reduce((s: number, p: any) => s + p.amount, 0)
    }, 0)
  }, [filtered, startDate, endDate])

  const jurosRecebidos = useMemo(() => {
    return filtered.reduce((total, l) => {
      const periodPayments = l.payments.filter((p: any) => {
        const payDate = localDateStr(new Date(p.date))
        if (startDate && payDate < startDate) return false
        if (endDate && payDate > endDate) return false
        return true
      })
      if (periodPayments.length === 0) return total

      const capitalIntact = l.installments.every((i: any) => (i.paidAmount || 0) === 0)
      if (capitalIntact) {
        return total + periodPayments.reduce((s: number, p: any) => s + Number(p.amount), 0)
      }

      const interestRatio = l.totalAmount > 0 ? l.profit / l.totalAmount : 0
      const dailyRate = getOverdueDailyAmountBRL(buildLoanData({
        amount: l.amount, interestRate: l.interestRate, interestType: l.interestType,
        totalAmount: l.totalAmount, dailyInterest: l.dailyInterest,
        dailyInterestAmount: Number((l as any).dailyInterestAmount || 0),
        modality: l.modality, firstInstallmentDate: l.firstInstallmentDate,
        installments: l.installments, payments: l.payments,
      }))

      return total + periodPayments.reduce((s: number, p: any) => {
        const notes = (p.notes || "").toLowerCase()
        const isSoJuros = notes.includes("só juros") || notes.includes("so juros") || notes.includes("parcial de juros")
        if (isSoJuros) return s + Number(p.amount)

        // Subtract multa from payment amount before applying ratio to avoid inflating interest
        const payDate = new Date(p.date); payDate.setHours(0, 0, 0, 0)
        const multaForPayment = l.installments.reduce((acc: number, i: any) => {
          if (!i.paidDate) return acc
          const paid = new Date(i.paidDate); paid.setHours(0, 0, 0, 0)
          if (paid.getTime() !== payDate.getTime()) return acc
          const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0)
          if (paid <= due) return acc
          const daysOver = Math.max(0, Math.floor((paid.getTime() - due.getTime()) / 86400000))
          return acc + dailyRate * daysOver + Number((l as any).penaltyFee || 0)
        }, 0)

        const baseAmount = Math.max(0, Number(p.amount) - multaForPayment)
        return s + baseAmount * interestRatio
      }, 0)
    }, 0)
  }, [filtered, startDate, endDate])

  const contasPagar = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0)
  }, [filteredExpenses])

  const contasPagarCount = filteredExpenses.length

  const jurosAReceber = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const todayStr = localDateStr(now)
    return activeLoans.reduce((sum, l) => {
      const totalInst = l.installmentCount
      if (totalInst <= 0) return sum
      const unpaidInsts = l.installments.filter((i: any) => {
        if (i.status === "PAID") return false
        const d = localDateStr(new Date(i.dueDate))
        if (endDate && d > endDate) return false
        return true
      })
      const baseInterest = l.profit * unpaidInsts.length / totalInst
      const dailyRate = getOverdueDailyAmountBRL(buildLoanData({
        amount: l.amount, interestRate: l.interestRate, interestType: l.interestType,
        totalAmount: l.totalAmount, dailyInterest: l.dailyInterest,
        dailyInterestAmount: (l as any).dailyInterestAmount || 0,
        modality: l.modality, firstInstallmentDate: l.firstInstallmentDate,
        installments: l.installments, payments: l.payments,
      }))
      const multaDiaria = unpaidInsts.reduce((acc: number, i: any) => {
        const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0)
        if (localDateStr(due) >= todayStr) return acc
        const daysOver = Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000))
        return acc + dailyRate * daysOver
      }, 0)
      // Juros extras para empréstimos mensais (1 parcela) com múltiplos ciclos vencidos
      let extraCyclesInterest = 0
      if (l.installmentCount === 1) {
        const overdueInst = unpaidInsts[0]
        if (overdueInst) {
          const due = new Date(overdueInst.dueDate); due.setHours(0, 0, 0, 0)
          if (due < now) {
            const daysOver = Math.floor((now.getTime() - due.getTime()) / 86400000)
            const extraCycles = Math.floor(daysOver / 30)
            extraCyclesInterest = extraCycles * (l.profit / totalInst)
          }
        }
      }
      return sum + baseInterest + multaDiaria + extraCyclesInterest
    }, 0)
  }, [activeLoans, endDate])

  const totalRecebidoHistorico = useMemo(() => {
    return paymentFilteredLoans.reduce((sum, l) => sum + l.payments.reduce((s: number, p: any) => s + p.amount, 0), 0)
  }, [paymentFilteredLoans])

  // Saldo restante: saldo devedor (com multas) de TODOS os ativos, ignorando o período
  const faltaReceber = useMemo(() => {
    const base = loans.filter(l => l.status === "ACTIVE")
    const typeFiltered = paymentFilter === "monthly" ? base.filter(l => l.installmentCount === 1)
      : paymentFilter === "installment" ? base.filter(l => l.installmentCount > 1)
      : base
    return typeFiltered.reduce((sum, l) => sum + getRemaining(l), 0)
  }, [loans, paymentFilter])

  const emAtraso = useMemo(() => {
    const now = new Date()
    const todayStr = localDateStr(now)
    const base = loans.filter(l => l.status === "ACTIVE")
    const typeFiltered = paymentFilter === "monthly" ? base.filter(l => l.installmentCount === 1)
      : paymentFilter === "installment" ? base.filter(l => l.installmentCount > 1)
      : base
    let total = 0
    let count = 0
    typeFiltered.forEach((l) => {
      const overdueInsts = l.installments.filter((i: any) => {
        if (i.status === "PAID") return false
        const d = localDateStr(new Date(i.dueDate))
        if (d >= todayStr) return false
        if (startDate && d < startDate) return false
        if (endDate && d > endDate) return false
        return true
      })
      if (overdueInsts.length > 0) {
        count++
        const instTotal = overdueInsts.reduce((s: number, i: any) => s + Number(i.amount), 0)
        const dailyRate = getOverdueDailyAmountBRL(buildLoanData({
          amount: l.amount, interestRate: l.interestRate, interestType: l.interestType,
          totalAmount: l.totalAmount, dailyInterest: l.dailyInterest,
          dailyInterestAmount: Number((l as any).dailyInterestAmount || 0),
          dueDay: (l as any).dueDay ?? undefined,
          modality: l.modality, firstInstallmentDate: l.firstInstallmentDate,
          installments: l.installments, payments: l.payments,
        }))
        const multas = overdueInsts.reduce((s: number, i: any) => {
          const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0)
          const daysOver = Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000))
          return s + dailyRate * daysOver + Number((l as any).penaltyFee || 0)
        }, 0)
        total += instTotal + multas
      }
    })
    return { total, count }
  }, [loans, paymentFilter, startDate, endDate])

  const jurosMultaRecebidos = useMemo(() => {
    return filtered.reduce((total, l) => {
      const dailyRate = getOverdueDailyAmountBRL(buildLoanData({
        amount: l.amount, interestRate: l.interestRate, interestType: l.interestType,
        totalAmount: l.totalAmount, dailyInterest: l.dailyInterest,
        dailyInterestAmount: Number((l as any).dailyInterestAmount || 0),
        modality: l.modality, firstInstallmentDate: l.firstInstallmentDate,
        installments: l.installments, payments: l.payments,
      }))
      if (dailyRate <= 0 && !((l as any).penaltyFee > 0)) return total

      const multa = l.installments.reduce((s: number, i: any) => {
        if (i.status !== "PAID" || !i.paidDate) return s
        const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0)
        const paid = new Date(i.paidDate); paid.setHours(0, 0, 0, 0)
        if (paid <= due) return s
        const paidStr = localDateStr(paid)
        if (startDate && paidStr < startDate) return s
        if (endDate && paidStr > endDate) return s
        const daysOver = Math.max(0, Math.floor((paid.getTime() - due.getTime()) / 86400000))
        return s + dailyRate * daysOver + Number((l as any).penaltyFee || 0)
      }, 0)
      return total + multa
    }, 0)
  }, [filtered, startDate, endDate])

  // Payments from soft-deleted loans (installments deleted but payments preserved)
  const deletedLoansLucro = useMemo(() => {
    return deletedLoans.reduce((total, l) => {
      return total + l.payments.reduce((s: number, p: any) => {
        const payDate = localDateStr(new Date(p.date))
        if (startDate && payDate < startDate) return s
        if (endDate && payDate > endDate) return s
        return s + Number(p.amount)
      }, 0)
    }, 0)
  }, [deletedLoans, startDate, endDate])

  const lucroRealizado = jurosRecebidos + jurosMultaRecebidos + deletedLoansLucro

  // Versões TOTAIS (sem filtro de período) usadas nos cards "Em Atraso" e "Lucro Realizado"
  const emAtrasoTotal = useMemo(() => {
    const now = new Date()
    const todayStr = localDateStr(now)
    const base = loans.filter(l => l.status === "ACTIVE")
    const typeFiltered = paymentFilter === "monthly" ? base.filter(l => l.installmentCount === 1)
      : paymentFilter === "installment" ? base.filter(l => l.installmentCount > 1)
      : base
    let total = 0
    let count = 0
    typeFiltered.forEach((l) => {
      const overdueInsts = l.installments.filter((i: any) => {
        if (i.status === "PAID") return false
        const d = localDateStr(new Date(i.dueDate))
        return d < todayStr
      })
      if (overdueInsts.length > 0) {
        count++
        const instTotal = overdueInsts.reduce((s: number, i: any) => s + Number(i.amount), 0)
        const dailyRate = getOverdueDailyAmountBRL(buildLoanData({
          amount: l.amount, interestRate: l.interestRate, interestType: l.interestType,
          totalAmount: l.totalAmount, dailyInterest: l.dailyInterest,
          dailyInterestAmount: Number((l as any).dailyInterestAmount || 0),
          dueDay: (l as any).dueDay ?? undefined,
          modality: l.modality, firstInstallmentDate: l.firstInstallmentDate,
          installments: l.installments, payments: l.payments,
        }))
        const multas = overdueInsts.reduce((s: number, i: any) => {
          const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0)
          const daysOver = Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000))
          return s + dailyRate * daysOver + Number((l as any).penaltyFee || 0)
        }, 0)
        total += instTotal + multas
      }
    })
    return { total, count }
  }, [loans, paymentFilter])

  const lucroRealizadoTotal = useMemo(() => {
    const base = loans.filter(l => l.status === "ACTIVE" || l.status === "COMPLETED")
    const typeFiltered = paymentFilter === "monthly" ? base.filter(l => l.installmentCount === 1)
      : paymentFilter === "installment" ? base.filter(l => l.installmentCount > 1)
      : base

    const realizadoT = typeFiltered.reduce((total, l) => total + getRealizedProfit(l), 0)

    const deletedT = deletedLoans.reduce((total, l) => {
      return total + l.payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
    }, 0)

    return realizadoT + deletedT
  }, [loans, deletedLoans, paymentFilter])

  const entradas = pagamentosNoPeriodo
  // Despesas NÃO entram em nenhum cálculo (ficam só na aba Despesas)
  const resultadoAtividade = entradas + caixaExtra - emprestimosNoPeriodo
  const resultadoPeriodo = caixaInicial + resultadoAtividade  // caixa inicial + recebido - emprestado

  // Contratos ativos table
  const contratosAtivos = useMemo(() => {
    return activeLoans
      .map((l) => {
        const paid = l.payments.reduce((s: number, p: any) => s + p.amount, 0)
        const falta = l.totalAmount - paid
        const nextInst = l.installments
          .filter((i: any) => i.status !== "PAID")
          .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
        const now = new Date()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
        const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        const isOverdue = nextInst && toDateStr(new Date(nextInst.dueDate)) < todayStr
        return {
          id: l.id,
          clientName: l.client.name,
          emprestado: l.amount,
          pago: paid,
          falta,
          status: isOverdue ? "OVERDUE" : "ON_TIME",
          vencimento: nextInst ? nextInst.dueDate : l.firstInstallmentDate,
        }
      })
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
  }, [activeLoans])

  const contratosEmAtraso = useMemo(() => {
    const todayStr = localDateStr(new Date())
    const base = loans.filter(l => l.status === "ACTIVE")
    const typeFiltered = paymentFilter === "monthly" ? base.filter(l => l.installmentCount === 1)
      : paymentFilter === "installment" ? base.filter(l => l.installmentCount > 1)
      : base

    return typeFiltered
      .map((loan) => {
        const overdueInsts = loan.installments.filter((i: any) => {
          if (i.status === "PAID") return false
          const d = localDateStr(new Date(i.dueDate))
          if (d >= todayStr) return false
          if (startDate && d < startDate) return false
          if (endDate && d > endDate) return false
          return true
        })
        if (overdueInsts.length === 0) return null

        const instTotal = overdueInsts.reduce((s: number, i: any) => s + Number(i.amount), 0)
        const now = new Date()
        const dailyRate = getOverdueDailyAmountBRL(buildLoanData({
          amount: loan.amount, interestRate: loan.interestRate, interestType: loan.interestType,
          totalAmount: loan.totalAmount, dailyInterest: loan.dailyInterest,
          dailyInterestAmount: Number((loan as any).dailyInterestAmount || 0),
          dueDay: (loan as any).dueDay ?? undefined,
          modality: loan.modality, firstInstallmentDate: loan.firstInstallmentDate,
          installments: loan.installments, payments: loan.payments,
        }))
        const multas = overdueInsts.reduce((s: number, i: any) => {
          const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0)
          const daysOver = Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000))
          return s + dailyRate * daysOver + Number((loan as any).penaltyFee || 0)
        }, 0)
        const atraso = instTotal + multas
        const firstOverdue = overdueInsts.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
        const clientPhone = clients.find((c) => c.id === loan.client.id)?.phone || null

        return {
          id: loan.id,
          clientName: loan.client.name,
          atraso,
          emprestado: loan.amount,
          vencimento: firstOverdue.dueDate,
          telefone: clientPhone,
        }
      })
      .filter((loan): loan is NonNullable<typeof loan> => loan !== null)
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
  }, [loans, paymentFilter, startDate, endDate, clients])

  // Monthly evolution chart data (last 6 months)
  const monthlyEvolution = useMemo(() => {
    const months: { label: string; naRua: number; recebido: number; lucro: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "")
      const monthLabel = label.charAt(0).toUpperCase() + label.slice(1)
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      let naRua = 0
      let recebidoAcum = 0
      let lucroAcum = 0

      paymentFilteredLoans.forEach((l) => {
        if (new Date(l.createdAt) <= endOfMonth && l.status !== "CANCELLED") {
          naRua += l.totalAmount
          l.payments.forEach((p: any) => {
            if (new Date(p.date) <= endOfMonth) {
              recebidoAcum += p.amount
              const intPerInst = l.installmentCount > 0
                ? Math.round((l.profit / l.installmentCount) * 100) / 100
                : 0
              lucroAcum += Math.min(p.amount, intPerInst)
            }
          })
        }
      })
      months.push({ label: monthLabel, naRua: naRua - recebidoAcum, recebido: recebidoAcum, lucro: lucroAcum })
    }
    return months
  }, [paymentFilteredLoans])

  // Distribution bar chart
  const distributionData = useMemo(() => {
    return [
      { name: "Na Rua", value: capitalNaRua, color: "#22c55e" },
      { name: "Recebido", value: totalRecebidoHistorico, color: "#3b82f6" },
      { name: "Pendente", value: faltaReceber, color: "#f59e0b" },
      { name: "Atraso", value: emAtraso.total, color: "#ef4444" },
    ]
  }, [capitalNaRua, totalRecebidoHistorico, faltaReceber, emAtraso])

  const clearDates = () => { setStartDate(""); setEndDate("") }

  /*
    Fluxo de caixa ocultado temporariamente.
    Mantemos a implementacao anterior aqui para poder reutilizar mais a frente.

      <Card className="border-gray-200 dark:border-zinc-800">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Fluxo de Caixa</h2>
            <Badge className="bg-primary/5 dark:bg-primary/20 text-primary border-0 text-xs">Novidade</Badge>
          </div>

          <div className="rounded-xl border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800/40 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-zinc-700/50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-zinc-100">Caixa Extra</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500">Valor informado manualmente</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ChevronDown className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
          </div>

          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-950/10 overflow-hidden">
            <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-50 dark:bg-red-950/30 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-red-600 uppercase tracking-wide">Saidas</span>
              </div>
              <span className="text-sm font-bold text-red-600">-{formatCurrency(saidas)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/15 overflow-hidden">
            <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 dark:bg-primary/15 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-primary uppercase tracking-wide">Entradas</span>
              </div>
              <span className="text-sm font-bold text-primary">+{formatCurrency(entradas)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
  */

  const FILTER_LABELS: Record<string, string> = { monthly: "Mensal", all: "Todos", installment: "Parcelado" }
  // Cor por modalidade: Todos = roxo, Parcelado = azul, Mensal = âmbar
  const FILTER_COLORS: Record<string, { active: string; idle: string; badge: string; value: string }> = {
    all: {
      active: "border-purple-500 bg-purple-500/10 dark:bg-purple-500/15 shadow-sm shadow-purple-500/20",
      idle: "border-purple-500/40 bg-purple-500/5 dark:bg-purple-500/10 hover:border-purple-500 hover:bg-purple-500/10",
      badge: "bg-purple-500 text-white",
      value: "text-purple-600 dark:text-purple-400",
    },
    installment: {
      active: "border-blue-500 bg-blue-500/10 dark:bg-blue-500/15 shadow-sm shadow-blue-500/20",
      idle: "border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10 hover:border-blue-500 hover:bg-blue-500/10",
      badge: "bg-blue-500 text-white",
      value: "text-blue-600 dark:text-blue-400",
    },
    monthly: {
      active: "border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 shadow-sm shadow-amber-500/20",
      idle: "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10 hover:border-amber-500 hover:bg-amber-500/10",
      badge: "bg-amber-500 text-white",
      value: "text-amber-600 dark:text-amber-400",
    },
  }

  return (
    <div className="space-y-6 pt-6 pb-12">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            Relatório Operacional
            <span className="group relative inline-flex">
              <HelpCircle className="h-5 w-5 text-primary cursor-help" />
              <div className="absolute left-0 top-full z-50 hidden pt-2 group-hover:block">
                <div className="w-[21rem] rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 text-left shadow-xl">
                  <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-zinc-100">Como funciona o relatório?</p>
                  <ul className="space-y-2 text-xs font-normal text-gray-600 dark:text-zinc-300">
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> Mostra seus empréstimos em tempo real, filtrados pelo período e pelo tipo (mensal/parcelado) escolhidos.</li>
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> Capital na Rua = principal ainda em aberto dos contratos ativos.</li>
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> Recebido e juros são somados a partir dos recebimentos registrados.</li>
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> "Em Atraso" e "Lucro Realizado" mostram o total (ignoram o filtro de período).</li>
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> Resultado do Período = Caixa inicial + Recebido − Emprestado no período.</li>
                  </ul>
                  <div className="mt-3 flex gap-2 border-t border-gray-100 dark:border-zinc-800 pt-2 text-[11px] font-normal text-gray-400 dark:text-zinc-500">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Despesas não entram nas somas (ficam só na aba Despesas) e empréstimos apagados saem dos totais do período.
                  </div>
                </div>
              </div>
            </span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Acompanhe seus empréstimos em tempo real</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {fetchError && <span className="text-red-500 text-xs">{fetchError}</span>}
          {updatedAt && !fetchError && <span className="text-gray-400 dark:text-zinc-500">Atualizado: {updatedAt}</span>}
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg px-3 py-1.5">
          <Calendar className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-sm text-gray-900 dark:text-zinc-100 outline-none w-[120px]"
          />
          <span className="text-gray-400 dark:text-zinc-500">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-sm text-gray-900 dark:text-zinc-100 outline-none w-[120px]"
          />
        </div>
        <button onClick={clearDates} className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200">Limpar</button>
      </div>

      {/* ===== PAYMENT TYPE FILTER ===== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/40 px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Tipo de Pagamento:</span>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">{FILTER_LABELS[paymentFilter]}</span>
            <span className="text-sm text-primary">Na Rua: {formatCurrency(capitalNaRua)}</span>
          </div>
          <button
            onClick={() => setShowModalityCards(v => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/5 dark:hover:bg-primary/10"
          >
            {showModalityCards ? "Ocultar Filtros" : "Ver Filtros"}
            {showModalityCards ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {showModalityCards && (
          <div className="grid grid-cols-3 gap-3">
            {(["all", "installment", "monthly"] as const).map((type) => {
              const isActive = paymentFilter === type
              const stats = modalityStats[type]
              return (
                <button
                  key={type}
                  onClick={() => setPaymentFilter(type)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    isActive ? FILTER_COLORS[type].active : FILTER_COLORS[type].idle
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200">{FILTER_LABELS[type]}</span>
                    {isActive && (
                      <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${FILTER_COLORS[type].badge}`}>Ativo</span>
                    )}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-zinc-400">Na Rua</span>
                      <span className={`font-semibold tabular-nums ${FILTER_COLORS[type].value}`}>{formatCurrency(stats.capitalNaRua)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-zinc-400">Lucro</span>
                      <span className="font-semibold text-gray-700 dark:text-zinc-300 tabular-nums">{formatCurrency(stats.lucro)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-zinc-400">Contratos</span>
                      <span className="font-semibold text-gray-700 dark:text-zinc-300">{stats.contratos} {stats.contratos === 1 ? "ativo" : "ativos"}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Fluxo de caixa ocultado temporariamente. Implementacao mantida em comentario no corpo do componente para reutilizacao futura. */}

      {/* ===== RESULTADO DO PERÍODO ===== */}
      <div className={`rounded-xl border p-6 text-center ${
        resultadoPeriodo >= 0
          ? "border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/15"
          : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
      }`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wallet className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
          <span className="text-sm text-gray-500 dark:text-zinc-400">Resultado do Período</span>
        </div>
        <p className={`text-3xl font-bold tabular-nums tracking-tight ${resultadoPeriodo >= 0 ? "text-primary" : "text-red-600"}`}>
          {resultadoPeriodo < 0 ? "-" : ""}{formatCurrency(Math.abs(resultadoPeriodo))}
        </p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          {resultadoPeriodo >= 0 ? "entrou mais do que saiu" : "saiu mais do que entrou"}
        </p>
        {caixaInicial > 0 && (
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            Caixa inicial: {formatCurrency(caixaInicial)}
          </p>
        )}
      </div>

      {/* 3 summary boxes */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 text-center">
          <DollarSign className="h-5 w-5 text-orange-600 mx-auto mb-1" />
          <p className="text-xs text-gray-500 dark:text-zinc-400">Na Rua</p>
          <p className="text-lg font-bold tabular-nums tracking-tight text-red-600">{formatCurrency(capitalNaRua)}</p>
        </div>
        <div className="rounded-xl border border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/15 p-4 text-center">
          <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-xs text-gray-500 dark:text-zinc-400">Lucro</p>
          <p className="text-lg font-bold tabular-nums tracking-tight text-primary">{formatCurrency(lucroRealizado)}</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${
          resultadoPeriodo >= 0
            ? "border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/15"
            : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
        }`}>
          <Wallet className="h-5 w-5 text-red-600 mx-auto mb-1" />
          <p className="text-xs text-gray-500 dark:text-zinc-400">Resultado</p>
          <p className={`text-lg font-bold tabular-nums tracking-tight ${resultadoAtividade >= 0 ? "text-primary" : "text-red-600"}`}>
            {resultadoAtividade < 0 ? "-" : "+"}{formatCurrency(Math.abs(resultadoAtividade))}
          </p>
        </div>
      </div>

      {/* ===== 6 STATS CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-primary/50 dark:border-primary/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base leading-none">💵</span>
              <span className="text-xs text-gray-500 dark:text-zinc-400">Capital na Rua</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(capitalNaRua)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{(paymentFilter === "monthly" ? modalityStats.monthly.contratos : paymentFilter === "installment" ? modalityStats.installment.contratos : modalityStats.all.contratos)} contratos ativos</p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 dark:border-primary/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base leading-none">💰</span>
              <span className="text-xs text-gray-500 dark:text-zinc-400">Juros a Receber</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(jurosAReceber)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">No período</p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 dark:border-primary/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base leading-none">✅</span>
              <span className="text-xs text-gray-500 dark:text-zinc-400">Total Recebido</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-primary">{formatCurrency(totalRecebidoHistorico)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Total histórico</p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 dark:border-primary/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base leading-none">⏳</span>
              <span className="text-xs text-gray-500 dark:text-zinc-400">Falta Receber</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(faltaReceber)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Saldo restante</p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 dark:border-primary/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertOctagon className="h-4 w-4 text-red-500" />
              <span className="text-xs text-gray-500 dark:text-zinc-400">Em Atraso</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-red-600">{formatCurrency(emAtrasoTotal.total)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{emAtrasoTotal.count} contratos no total</p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 dark:border-primary/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-gray-500 dark:text-zinc-400">Lucro Realizado</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-purple-600">{formatCurrency(lucroRealizadoTotal)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Juros já recebido</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== CHARTS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução Mensal */}
        <Card className="border-primary/50 dark:border-primary/40">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-gray-900 dark:text-zinc-100">Evolução Mensal</h3>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="label" stroke={axisColor} fontSize={12} />
                  <YAxis stroke={axisColor} fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="naRua" name="Na Rua" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="recebido" name="Recebido" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição */}
        <Card className="border-primary/50 dark:border-primary/40">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-gray-900 dark:text-zinc-100">Distribuição</h3>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="name" stroke={axisColor} fontSize={12} />
                  <YAxis stroke={axisColor} fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {distributionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== CONTRATOS ATIVOS TABLE ===== */}
      <Card className="border-primary/50 dark:border-primary/40">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
              <h3 className="font-bold text-gray-900 dark:text-zinc-100">Contratos Ativos (Na Rua)</h3>
            </div>
            <div className="h-7 w-7 rounded-full border border-gray-300 dark:border-zinc-700 flex items-center justify-center">
              <span className="text-xs text-gray-700 dark:text-zinc-300">{contratosAtivos.length}</span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-gray-400 dark:text-zinc-500 font-normal text-xs">Cliente</TableHead>
                  <TableHead className="text-gray-400 dark:text-zinc-500 font-normal text-xs text-center">Emprestado</TableHead>
                  <TableHead className="text-gray-400 dark:text-zinc-500 font-normal text-xs text-center">Pago</TableHead>
                  <TableHead className="text-gray-400 dark:text-zinc-500 font-normal text-xs text-center">Falta</TableHead>
                  <TableHead className="text-gray-400 dark:text-zinc-500 font-normal text-xs text-center">Status</TableHead>
                  <TableHead className="text-gray-400 dark:text-zinc-500 font-normal text-xs text-right">Vencimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500 dark:text-zinc-400">Carregando...</TableCell>
                  </TableRow>
                ) : contratosAtivos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500 dark:text-zinc-400">Nenhum contrato ativo</TableCell>
                  </TableRow>
                ) : (
                  contratosAtivos.map((c) => (
                    <TableRow key={c.id} className="border-gray-200 dark:border-zinc-800/50">
                      <TableCell className="font-medium text-gray-900 dark:text-zinc-100">{c.clientName}</TableCell>
                      <TableCell className="text-center text-gray-700 dark:text-zinc-300">{formatCurrency(c.emprestado)}</TableCell>
                      <TableCell className="text-center text-primary">{formatCurrency(c.pago)}</TableCell>
                      <TableCell className="text-center text-gray-900 dark:text-zinc-100">{formatCurrency(c.falta)}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={`text-xs px-3 ${
                            c.status === "ON_TIME"
                              ? "bg-primary/10 dark:bg-primary/20 text-primary border-primary/30"
                              : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-500/30"
                          }`}
                        >
                          {c.status === "ON_TIME" ? "Em Dia" : "Atrasado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-zinc-300">{formatDate(c.vencimento)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50/30 dark:border-red-900/40 dark:bg-red-950/10">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h3 className="font-bold text-red-500 dark:text-red-400">Contratos em Atraso</h3>
            </div>
            <div className="flex h-7 min-w-7 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-semibold text-white">
              {contratosEmAtraso.length}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-red-200/80 bg-white/70 dark:border-red-900/30 dark:bg-zinc-900/40">
            <Table>
              <TableHeader>
                <TableRow className="border-red-100 dark:border-red-900/20 hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-gray-500 dark:text-zinc-400">Cliente</TableHead>
                  <TableHead className="text-xs font-medium text-center text-gray-500 dark:text-zinc-400">Atraso</TableHead>
                  <TableHead className="text-xs font-medium text-center text-gray-500 dark:text-zinc-400">Emprestado</TableHead>
                  <TableHead className="text-xs font-medium text-right text-gray-500 dark:text-zinc-400">Vencimento</TableHead>
                  <TableHead className="text-xs font-medium text-left text-gray-500 dark:text-zinc-400">Telefone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-gray-500 dark:text-zinc-400">Carregando...</TableCell>
                  </TableRow>
                ) : contratosEmAtraso.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-gray-500 dark:text-zinc-400">Nenhum contrato em atraso</TableCell>
                  </TableRow>
                ) : (
                  contratosEmAtraso.map((contrato) => (
                    <TableRow key={contrato.id} className="border-red-100/80 dark:border-red-900/20">
                      <TableCell className="font-semibold text-gray-900 dark:text-zinc-100">{contrato.clientName}</TableCell>
                      <TableCell className="text-center font-semibold text-red-500 dark:text-red-400">{formatCurrency(contrato.atraso)}</TableCell>
                      <TableCell className="text-center text-gray-700 dark:text-zinc-300">{formatCurrency(contrato.emprestado)}</TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-zinc-300">{formatDate(contrato.vencimento)}</TableCell>
                      <TableCell className="text-gray-600 dark:text-zinc-400">{contrato.telefone || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
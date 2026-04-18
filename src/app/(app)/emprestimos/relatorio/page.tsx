"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useTheme } from "@/lib/theme-provider"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import {
  Calendar, Download, RefreshCw, ChevronDown, ChevronUp,
  Wallet, TrendingUp, DollarSign, CheckCircle2, Clock, AlertTriangle,
  Percent, ArrowUpRight, ArrowDownLeft, Pencil, Plus,
  Users, ToggleLeft, ToggleRight
} from "lucide-react"

const today = () => new Date().toISOString().split("T")[0]
const firstOfMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
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
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const tooltipStyle = { backgroundColor: isDark ? "#18181b" : "#ffffff", border: `1px solid ${isDark ? "#27272a" : "#e5e7eb"}`, borderRadius: "8px", color: isDark ? "#f4f4f5" : "#374151" }
  const gridColor = isDark ? "#27272a" : "#e5e7eb"
  const axisColor = isDark ? "#71717a" : "#9ca3af"
  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate, setEndDate] = useState(today())
  const [paymentFilter, setPaymentFilter] = useState<"all" | "daily" | "monthly" | "price">("all")
  const [showFilters, setShowFilters] = useState(false)
  const [caixaExtra, setCaixaExtra] = useState(0)
  const [editingCaixa, setEditingCaixa] = useState(false)
  const [caixaInput, setCaixaInput] = useState("0")
  const [showSaidas, setShowSaidas] = useState(true)
  const [showEntradas, setShowEntradas] = useState(true)
  const [includeExpenses, setIncludeExpenses] = useState(true)
  const [updatedAt, setUpdatedAt] = useState("")
  const caixaRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [loansRes, expensesRes] = await Promise.all([
        fetch("/api/loans"),
        fetch("/api/expenses"),
      ])
      const loansData = await loansRes.json()
      const expensesData = await expensesRes.json()
      setLoans(Array.isArray(loansData) ? loansData : [])
      setExpenses(Array.isArray(expensesData) ? expensesData : [])
      setUpdatedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter loans by date range & modality
  const filtered = useMemo(() => {
    return loans.filter((loan) => {
      if (startDate && new Date(loan.createdAt) < new Date(startDate + "T00:00:00")) return false
      if (endDate && new Date(loan.createdAt) > new Date(endDate + "T23:59:59")) return false
      if (paymentFilter === "daily" && loan.modality !== "DAILY") return false
      if (paymentFilter === "monthly" && loan.modality !== "MONTHLY") return false
      if (paymentFilter === "price" && loan.modality !== "PRICE") return false
      return true
    })
  }, [loans, startDate, endDate, paymentFilter])

  const activeLoans = useMemo(() => loans.filter(l => l.status === "ACTIVE"), [loans])

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (startDate && new Date(e.dueDate) < new Date(startDate + "T00:00:00")) return false
      if (endDate && new Date(e.dueDate) > new Date(endDate + "T23:59:59")) return false
      return true
    })
  }, [expenses, startDate, endDate])

  // ===== CALCULATIONS =====
  const capitalNaRua = useMemo(() => {
    return activeLoans.reduce((sum, l) => {
      const paid = l.payments.reduce((s: number, p: any) => s + p.amount, 0)
      return sum + (l.totalAmount - paid)
    }, 0)
  }, [activeLoans])

  const emprestimosNoPeriodo = useMemo(() => {
    return filtered.reduce((sum, l) => sum + l.amount, 0)
  }, [filtered])

  const pagamentosNoPeriodo = useMemo(() => {
    const start = startDate ? new Date(startDate + "T00:00:00") : null
    const end = endDate ? new Date(endDate + "T23:59:59") : null
    let total = 0
    loans.forEach((l) => {
      l.payments.forEach((p: any) => {
        const d = new Date(p.date)
        if (start && d < start) return
        if (end && d > end) return
        total += p.amount
      })
    })
    return total
  }, [loans, startDate, endDate])

  const jurosRecebidos = useMemo(() => {
    const start = startDate ? new Date(startDate + "T00:00:00") : null
    const end = endDate ? new Date(endDate + "T23:59:59") : null
    let total = 0
    loans.forEach((l) => {
      const interestPerInst = l.installmentCount > 0
        ? Math.round((l.profit / l.installmentCount) * 100) / 100
        : 0
      l.payments.forEach((p: any) => {
        const d = new Date(p.date)
        if (start && d < start) return
        if (end && d > end) return
        total += Math.min(p.amount, interestPerInst)
      })
    })
    return total
  }, [loans, startDate, endDate])

  const contasPagar = useMemo(() => {
    if (!includeExpenses) return 0
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0)
  }, [filteredExpenses, includeExpenses])

  const contasPagarCount = filteredExpenses.length

  const jurosAReceber = useMemo(() => {
    return filtered.filter(l => l.status === "ACTIVE").reduce((sum, l) => {
      const interestPerInst = l.installmentCount > 0
        ? Math.round((l.profit / l.installmentCount) * 100) / 100
        : 0
      const pendingInsts = l.installments.filter((i: any) => i.status !== "PAID").length
      return sum + (interestPerInst * pendingInsts)
    }, 0)
  }, [filtered])

  const totalRecebidoHistorico = useMemo(() => {
    return loans.reduce((sum, l) => sum + l.payments.reduce((s: number, p: any) => s + p.amount, 0), 0)
  }, [loans])

  const faltaReceber = useMemo(() => {
    return activeLoans.reduce((sum, l) => {
      const paid = l.payments.reduce((s: number, p: any) => s + p.amount, 0)
      return sum + Math.max(0, l.totalAmount - paid)
    }, 0)
  }, [activeLoans])

  const emAtraso = useMemo(() => {
    const now = new Date()
    let total = 0
    let count = 0
    activeLoans.forEach((l) => {
      const hasOverdue = l.installments.some((i: any) => i.status === "PENDING" && new Date(i.dueDate) < now)
      if (hasOverdue) {
        count++
        const paid = l.payments.reduce((s: number, p: any) => s + p.amount, 0)
        total += l.totalAmount - paid
      }
    })
    return { total, count }
  }, [activeLoans])

  const lucroRealizado = useMemo(() => {
    let total = 0
    loans.forEach((l) => {
      const interestPerInst = l.installmentCount > 0
        ? Math.round((l.profit / l.installmentCount) * 100) / 100
        : 0
      l.payments.forEach((p: any) => {
        total += Math.min(p.amount, interestPerInst)
      })
    })
    return total
  }, [loans])

  const saidas = emprestimosNoPeriodo + contasPagar
  const entradas = pagamentosNoPeriodo
  const resultadoPeriodo = entradas + caixaExtra - saidas

  // Contratos ativos table
  const contratosAtivos = useMemo(() => {
    return activeLoans
      .map((l) => {
        const paid = l.payments.reduce((s: number, p: any) => s + p.amount, 0)
        const falta = l.totalAmount - paid
        const nextInst = l.installments
          .filter((i: any) => i.status !== "PAID")
          .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
        const isOverdue = nextInst && new Date(nextInst.dueDate) < new Date()
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

      loans.forEach((l) => {
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
  }, [loans])

  // Distribution bar chart
  const distributionData = useMemo(() => {
    return [
      { name: "Na Rua", value: capitalNaRua },
      { name: "Recebido", value: totalRecebidoHistorico },
      { name: "Pendente", value: faltaReceber },
      { name: "Atraso", value: emAtraso.total },
    ]
  }, [capitalNaRua, totalRecebidoHistorico, faltaReceber, emAtraso])

  // Caixa edit
  const startEditCaixa = () => {
    setEditingCaixa(true)
    setCaixaInput(caixaExtra.toString())
    setTimeout(() => caixaRef.current?.focus(), 50)
  }
  const saveCaixa = () => {
    setCaixaExtra(Number(caixaInput) || 0)
    setEditingCaixa(false)
  }

  const clearDates = () => { setStartDate(""); setEndDate("") }

  const FILTER_LABELS: Record<string, string> = { all: "Todos", daily: "Diário", monthly: "Mensal", price: "Tabela Price" }

  return (
    <div className="space-y-6 pb-12">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Relatório Operacional</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Acompanhe seus empréstimos em tempo real</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {updatedAt && <span className="text-gray-400 dark:text-zinc-500">Atualizado: {updatedAt}</span>}
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
            Tipo de Pagamento:
          </span>
          <div className="flex gap-1.5">
            {(["all", "daily", "monthly", "price"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setPaymentFilter(f)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  paymentFilter === f
                    ? "bg-emerald-50 dark:bg-emerald-950/300 text-white"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 dark:bg-zinc-700"
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
          <span className="text-sm text-emerald-600 ml-2">Na Rua: {formatCurrency(capitalNaRua)}</span>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200 flex items-center gap-1"
        >
          Ver Filtros {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-zinc-400">Incluir contas a pagar nas saídas:</span>
            <button onClick={() => setIncludeExpenses(!includeExpenses)} className="text-emerald-600">
              {includeExpenses ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6 text-gray-400 dark:text-zinc-500" />}
            </button>
          </CardContent>
        </Card>
      )}

      {/* ===== FLUXO DE CAIXA ===== */}
      <Card className="border-gray-200 dark:border-zinc-800">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Fluxo de Caixa</h2>
            <Badge className="bg-emerald-50 dark:bg-emerald-950/300/20 text-emerald-600 border-0 text-xs">Novidade</Badge>
          </div>

          {/* Caixa Extra */}
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
            <div className="flex items-center gap-2">
              {editingCaixa ? (
                <input
                  ref={caixaRef}
                  type="number"
                  value={caixaInput}
                  onChange={(e) => setCaixaInput(e.target.value)}
                  onBlur={saveCaixa}
                  onKeyDown={(e) => e.key === "Enter" && saveCaixa()}
                  className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1 text-sm text-emerald-600 font-bold w-28 text-right outline-none"
                />
              ) : (
                <span className="text-lg font-bold text-emerald-600">{formatCurrency(caixaExtra)}</span>
              )}
              <button onClick={editingCaixa ? saveCaixa : startEditCaixa} className="text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <ChevronDown className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
          </div>

          {/* ===== SAÍDAS ===== */}
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-950/10 overflow-hidden">
            <button
              onClick={() => setShowSaidas(!showSaidas)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-50 dark:bg-red-950/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-red-600" />
                <span className="text-sm font-bold text-red-600 uppercase tracking-wide">Saídas</span>
              </div>
              <span className="text-sm font-bold text-red-600">-{formatCurrency(saidas)}</span>
            </button>
            {showSaidas && (
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-50 dark:bg-red-950/300" />
                    <span className="text-sm text-gray-700 dark:text-zinc-300">Empréstimos concedidos</span>
                  </div>
                  <span className="text-sm font-medium text-red-600">-{formatCurrency(emprestimosNoPeriodo)}</span>
                </div>
                {includeExpenses && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-50 dark:bg-red-950/300" />
                      <span className="text-sm text-gray-700 dark:text-zinc-300">Contas a pagar</span>
                      <span className="text-xs text-gray-400 dark:text-zinc-500">({contasPagarCount} contas)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-red-600">-{formatCurrency(contasPagar)}</span>
                      <button onClick={() => setIncludeExpenses(!includeExpenses)}>
                        {includeExpenses
                          ? <ToggleRight className="h-5 w-5 text-emerald-600" />
                          : <ToggleLeft className="h-5 w-5 text-gray-400 dark:text-zinc-500" />}
                      </button>
                    </div>
                  </div>
                )}
                <div className="pl-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
                    <span className="text-xs text-gray-400 dark:text-zinc-500">Custos extras</span>
                  </div>
                  <button className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300 mt-1 flex items-center gap-1 pl-5">
                    <Plus className="h-3 w-3" /> Adicionar custo extra
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-center py-1">
              <ChevronDown className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
            </div>
          </div>

          {/* ===== ENTRADAS ===== */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 overflow-hidden">
            <button
              onClick={() => setShowEntradas(!showEntradas)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 dark:bg-emerald-950/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-600 uppercase tracking-wide">Entradas</span>
              </div>
              <span className="text-sm font-bold text-emerald-600">+{formatCurrency(entradas)}</span>
            </button>
            {showEntradas && (
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-50 dark:bg-emerald-950/300" />
                    <span className="text-sm text-gray-700 dark:text-zinc-300">Pagamentos recebidos</span>
                  </div>
                  <span className="text-sm font-medium text-emerald-600">+{formatCurrency(pagamentosNoPeriodo)}</span>
                </div>
                <div className="flex items-center justify-between py-2 pl-4">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/300" />
                    <span className="text-xs text-gray-500 dark:text-zinc-400">dos quais juros</span>
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">{formatCurrency(jurosRecebidos)}</span>
                </div>
              </div>
            )}
            <div className="flex justify-center py-1">
              <ChevronDown className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== RESULTADO DO PERÍODO ===== */}
      <div className={`rounded-xl border p-6 text-center ${
        resultadoPeriodo >= 0
          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30"
          : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
      }`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wallet className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
          <span className="text-sm text-gray-500 dark:text-zinc-400">Resultado do Período</span>
        </div>
        <p className={`text-3xl font-bold tabular-nums tracking-tight ${resultadoPeriodo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {resultadoPeriodo < 0 ? "-" : ""}{formatCurrency(Math.abs(resultadoPeriodo))}
        </p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          {resultadoPeriodo >= 0 ? "entrou mais do que saiu" : "saiu mais do que entrou"}
        </p>
      </div>

      {/* 3 summary boxes */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 text-center">
          <DollarSign className="h-5 w-5 text-orange-600 mx-auto mb-1" />
          <p className="text-xs text-gray-500 dark:text-zinc-400">Na Rua</p>
          <p className="text-lg font-bold tabular-nums tracking-tight text-red-600">{formatCurrency(capitalNaRua)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center">
          <TrendingUp className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-xs text-gray-500 dark:text-zinc-400">Lucro</p>
          <p className="text-lg font-bold tabular-nums tracking-tight text-emerald-600">{formatCurrency(lucroRealizado)}</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${
          resultadoPeriodo >= 0
            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30"
            : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
        }`}>
          <Wallet className="h-5 w-5 text-red-600 mx-auto mb-1" />
          <p className="text-xs text-gray-500 dark:text-zinc-400">Resultado</p>
          <p className={`text-lg font-bold tabular-nums tracking-tight ${resultadoPeriodo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {resultadoPeriodo < 0 ? "-" : ""}{formatCurrency(Math.abs(resultadoPeriodo))}
          </p>
        </div>
      </div>

      {/* ===== 6 STATS CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-gray-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-gray-500 dark:text-zinc-400">Capital na Rua</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(capitalNaRua)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{activeLoans.length} contratos ativos</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-gray-500 dark:text-zinc-400">Juros a Receber</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(jurosAReceber)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">No período</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-gray-500 dark:text-zinc-400">Total Recebido</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600">{formatCurrency(totalRecebidoHistorico)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Histórico</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
              <span className="text-xs text-gray-500 dark:text-zinc-400">Falta Receber</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(faltaReceber)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Saldo restante</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-gray-500 dark:text-zinc-400">Em Atraso</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-red-600">{formatCurrency(emAtraso.total)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{emAtraso.count} contratos</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-gray-500 dark:text-zinc-400">Lucro Realizado</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-purple-600">{formatCurrency(lucroRealizado)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Juros já recebidos</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== CHARTS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução Mensal */}
        <Card className="border-gray-200 dark:border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
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
                  <Line type="monotone" dataKey="naRua" name="Na Rua" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="recebido" name="Recebido" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição */}
        <Card className="border-gray-200 dark:border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-5 w-5 text-emerald-600" />
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
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== CONTRATOS ATIVOS TABLE ===== */}
      <Card className="border-gray-200 dark:border-zinc-800">
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
                      <TableCell className="text-center text-emerald-600">{formatCurrency(c.pago)}</TableCell>
                      <TableCell className="text-center text-gray-900 dark:text-zinc-100">{formatCurrency(c.falta)}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={`text-xs px-3 ${
                            c.status === "ON_TIME"
                              ? "bg-emerald-50 dark:bg-emerald-950/300/20 text-emerald-600 border-emerald-500/30"
                              : "bg-red-50 dark:bg-red-950/300/20 text-red-600 border-red-500/30"
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
    </div>
  )
}
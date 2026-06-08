"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  Filter,
  Percent,
  Plus,
  Receipt,
  Shield,
  ShieldAlert,
  TrendingUp,
  UserX,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { formatCurrency, localDateStr } from "@/lib/utils"
import { useTheme } from "@/lib/theme-provider"
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LabelList,
} from "recharts"

interface DashboardData {
  totalPrincipal: number
  totalToReceive: number
  totalReceived: number
  capitalOnStreet: number
  faltaReceber: number
  faltaReceberMes: number
  monthReceived: number
  monthNewLoansCapital: number
  monthNewLoansProfit: number
  monthInstallmentsDue: { total: number; interest: number; capital: number }
  totalProfit: number
  overdueCount: number
  overdueAmount: number
  inactiveClients: number
  activeClients: number
  monthlyData: { month: string; emprestado: number; recebido: number }[]
  totalLoans: number
  weeklySummary: {
    contractsThisWeek: number
    receivedThisWeek: number
    dueToday: number
    dueTodayAmount?: number
    dueTodayClients?: number
    deltas?: {
      contractsPct: number
      receivedPct: number
    }
  }
  counters: {
    activeLoans: number
    totalContracts: number
    totalClients: number
    activeClients: number
    totalSales: number
    totalVehicles: number
  }
  financials: {
    pendingInterest: number
    monthlyExpenses: number
    monthlyReceivedInterest: number
    totalPaymentsReceived: number
  }
  charts: {
    interestTrend: { month: string; juros: number }[]
  }
  operationHealth: {
    score: number
    collectionRate: number
    defaultRate: number
  }
  alerts: { title: string; description: string; severity: "high" | "medium" | "low" }[]
  dueThisWeekCount: number
  dueThisWeekAmount: number
  overdue30DaysCount: number
  overdue30DaysAmount: number
  dueNextSevenDays: { date: string; count: number; amount: number; items: { clientName: string; installmentNumber: number; installmentCount: number; amount: number; loanId: string }[] }[]
  totalPendingLateFees: number
  overdueByLoan: { clientName: string; dailyRate: number; totalCharge: number; overdueCount: number }[]
  paymentsByDay: { day: number; amount: number }[]
  updatedAt?: string
}

// ── Area Sparkline (full-width, bottom of Row-1 cards) ───────────────────────
function AreaSparkline({ values, color, gradientId }: { values: number[]; color: string; gradientId: string }) {
  if (!values || values.length < 2) return <div className="h-16" />
  const chartData = values.map(v => ({ v }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Delta ─────────────────────────────────────────────────────────────────────
function Delta({ pct }: { pct: number | undefined }) {
  if (pct === undefined || pct === null) return null
  const up = pct >= 0
  return (
    <p className={`mt-1.5 text-xs font-medium flex items-center gap-0.5 ${up ? "text-green-500" : "text-red-500"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(2)}%{" "}
      <span className="text-gray-400 dark:text-zinc-500 font-normal">vs mês anterior</span>
    </p>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBackupAlert, setShowBackupAlert] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [filterActive, setFilterActive] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const { theme } = useTheme()
  const isDark = theme === "dark"

  const tooltipStyle = {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    border: `1px solid ${isDark ? "#27272a" : "#e5e7eb"}`,
    borderRadius: "8px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
    color: isDark ? "#f4f4f5" : "#374151",
  }
  const axisColor = isDark ? "#71717a" : "#6b7280"

  useEffect(() => {
    setLoading(true)
    const url = filterActive
      ? `/api/dashboard?month=${selectedMonth}&year=${selectedYear}`
      : `/api/dashboard?all=true`
    fetch(url)
      .then((res) => res.json())
      .then((dashboardData) => {
        if (dashboardData && !dashboardData.error) {
          setData(dashboardData)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedMonth, selectedYear, filterActive])

  const selectedMonthName = new Date(selectedYear, selectedMonth, 1).toLocaleString("pt-BR", { month: "long" })
  const periodLabel = filterActive ? selectedMonthName : "total geral"
  const currentMonthName = new Date().toLocaleString("pt-BR", { month: "long" })
  const faltaReceberMonthLabel = filterActive ? selectedMonthName : currentMonthName
  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1) }
    else setSelectedMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1) }
    else setSelectedMonth(m => m + 1)
  }


  useEffect(() => {
    const last = localStorage.getItem("backup-alert-dismissed")
    if (!last || (Date.now() - Number(last)) >= 2 * 24 * 60 * 60 * 1000) {
      setShowBackupAlert(true)
    }
  }, [])

  const handleBackup = async () => {
    setBackupLoading(true)
    try {
      const res = await fetch("/api/backup")
      if (!res.ok) throw new Error("Erro ao gerar backup")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      localStorage.setItem("backup-alert-dismissed", String(Date.now()))
      setShowBackupAlert(false)
    } finally {
      setBackupLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // Greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"
  const greetingEmoji = hour < 12 ? "☀️" : hour < 18 ? "👋" : "🌙"

  // Today's date
  const todayFormatted = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })

  // Sparkline data
  const sparkRecebido = (data?.monthlyData || []).map(d => d.recebido)
  const sparkEmprestado = (data?.monthlyData || []).map(d => d.emprestado)
  const sparkJuros = (data?.charts?.interestTrend || []).map(d => d.juros)

  // Mini bar chart data for "Recebido no Mês"
  const paymentsBardData = (data?.paymentsByDay || []).slice(-7).map(d => ({ v: d.amount }))

  // Mini bar chart data for "Saiu"
  const saiuBarData = (data?.monthlyData || []).slice(-2)

  return (
    <div className="space-y-5 pt-6">

      {/* ── Backup Alert ───────────────────────────────────────────────────── */}
      {showBackupAlert && (
        <div className="flex items-center gap-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Lembrete de backup</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">Faça backup dos seus dados a cada 2 dias para evitar perdas. Clique em "Fazer Backup" para baixar o arquivo.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => router.push("/backup")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white hover:bg-amber-50 dark:bg-zinc-900 dark:hover:bg-amber-950/20 px-4 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 transition-colors"
            >
              Ir para Backup
            </button>
            <button
              onClick={handleBackup}
              disabled={backupLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 px-4 py-1.5 text-sm font-medium text-white transition-colors"
            >
              {backupLoading ? "Baixando..." : "Fazer Backup"}
            </button>
            <button
              onClick={() => setShowBackupAlert(false)}
              className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
            {greeting}! {greetingEmoji}
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Aqui está o resumo da sua gestão financeira.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date pill */}
          <div className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-zinc-300">
            <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
            {todayFormatted}
          </div>

          {/* Novo Contrato */}
          <button
            onClick={() => router.push("/emprestimos")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Contrato
          </button>

          {/* Relatórios */}
          <button
            onClick={() => router.push("/emprestimos/relatorio")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Relatórios
          </button>

          {/* Filter */}
          {filterActive ? (
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 py-1">
              <button onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
              </button>
              <span className="min-w-[120px] text-center text-sm font-semibold text-gray-900 dark:text-zinc-100 capitalize">
                {selectedMonthName} {selectedYear}
              </span>
              <button onClick={nextMonth} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                <ChevronRight className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
              </button>
              <button
                onClick={() => setFilterActive(false)}
                className="ml-1 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setSelectedMonth(new Date().getMonth()); setSelectedYear(new Date().getFullYear()); setFilterActive(true) }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Filter className="h-3.5 w-3.5" />
              Filtrar
              <ChevronLeft className="h-3.5 w-3.5 rotate-[-90deg]" />
            </button>
          )}
        </div>
      </div>

      {/* ── Row 1 — 4 colored KPI cards ────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">

        {/* Total a Receber */}
        <div className="rounded-xl border border-green-100 dark:border-green-900/30 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="rounded-xl bg-green-100 dark:bg-green-950/50 p-2">
                <Receipt className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Total a Receber</p>
            </div>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-green-500">
              {formatCurrency(data?.monthInstallmentsDue?.total || 0)}
            </p>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-zinc-500">
              parcelas com venc. em {periodLabel}
            </p>
            <Delta pct={data?.weeklySummary?.deltas?.receivedPct} />
          </div>
          <div className="h-14">
            <AreaSparkline values={sparkRecebido} color="#22c55e" gradientId="grad-recebido" />
          </div>
        </div>

        {/* Capital na Rua */}
        <div className="rounded-xl border border-orange-100 dark:border-orange-900/30 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="rounded-xl bg-orange-100 dark:bg-orange-950/50 p-2">
                <DollarSign className="h-5 w-5 text-orange-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Capital na Rua</p>
            </div>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-orange-500">
              {formatCurrency(data?.totalPrincipal || 0)}
            </p>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-zinc-500">
              capital ativo em contratos
            </p>
          </div>
          <div className="h-14">
            <AreaSparkline values={sparkEmprestado} color="#f97316" gradientId="grad-capital" />
          </div>
        </div>

        {/* Juros do Mês */}
        <div className="rounded-xl border border-violet-100 dark:border-violet-900/30 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="rounded-xl bg-violet-100 dark:bg-violet-950/50 p-2">
                <Percent className="h-5 w-5 text-violet-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Juros do Mês</p>
            </div>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-violet-600">
              {formatCurrency(data?.monthInstallmentsDue?.interest || 0)}
            </p>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-zinc-500">
              juros das parcelas de {periodLabel}
            </p>
          </div>
          <div className="h-14">
            <AreaSparkline values={sparkJuros} color="#7c3aed" gradientId="grad-juros" />
          </div>
        </div>

        {/* Falta Receber */}
        <div className="rounded-xl border border-green-200 dark:border-green-900/30 bg-green-50 dark:bg-green-950/20 overflow-hidden relative">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="rounded-xl bg-green-100 dark:bg-green-950/50 p-2">
                <Wallet className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Falta Receber</p>
            </div>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-green-500">
              {formatCurrency(data?.faltaReceberMes || 0)}
            </p>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-zinc-500">
              juros + multas de {faltaReceberMonthLabel}
            </p>
          </div>
        </div>
      </div>

      {/* ── Row 2 — 4 white cards ──────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">

        {/* Recebido no Mês */}
        <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-xl bg-green-100 dark:bg-green-950/40 p-2">
              <Receipt className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Recebido no Mês</p>
          </div>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">
            {formatCurrency(data?.monthReceived || 0)}
          </p>
          <Delta pct={data?.weeklySummary?.deltas?.receivedPct} />
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
            pagamentos recebidos em {periodLabel}
          </p>
          {paymentsBardData.length > 0 && (
            <div className="mt-3 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentsBardData} barSize={6} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Bar dataKey="v" fill="#22c55e" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Histórico de Pagamento */}
        <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-xl bg-green-100 dark:bg-green-950/40 p-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Histórico de Pagamento</p>
          </div>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">
            {formatCurrency(data?.financials?.totalPaymentsReceived || 0)}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
            total de pagamentos recebidos
          </p>
        </div>

        {/* Gasto Mensal */}
        <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-xl bg-red-100 dark:bg-red-950/40 p-2">
              <Receipt className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Gasto Mensal</p>
          </div>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">
            {formatCurrency(data?.financials?.monthlyExpenses || 0)}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">despesas de {periodLabel}</p>
        </div>

        {/* Clientes */}
        <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-xl bg-green-100 dark:bg-green-950/40 p-2">
              <Users className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Clientes</p>
          </div>
          <p className="text-3xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">
            {data?.counters?.totalClients || 0}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">cadastrados</p>
        </div>
      </div>

      {/* ── Row 3 — 4 white cards ──────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">

        {/* Contrato Ativo */}
        <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-xl bg-blue-100 dark:bg-blue-950/40 p-2">
              <Shield className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Contrato Ativo</p>
          </div>
          <p className="text-3xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">
            {data?.counters?.activeLoans || 0}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">contratos ativos</p>
        </div>

        {/* Vencendo Hoje */}
        <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-xl bg-orange-100 dark:bg-orange-950/40 p-2">
              <Clock3 className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Vencendo Hoje</p>
          </div>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">
            {formatCurrency(data?.weeklySummary?.dueTodayAmount || 0)}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
            {data?.weeklySummary?.dueTodayClients || 0} cliente(s)
          </p>
        </div>

        {/* Em Atraso */}
        <div className="rounded-xl border border-red-100 dark:border-red-900/30 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-xl bg-red-100 dark:bg-red-950/40 p-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Em Atraso</p>
          </div>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-red-500">
            {formatCurrency(data?.overdueAmount || 0)}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
            {data?.overdueCount || 0} parcela(s) vencida(s)
          </p>
        </div>

        {/* Clientes Inativos */}
        <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-xl bg-gray-100 dark:bg-zinc-800 p-2">
              <UserX className="h-4 w-4 text-gray-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Clientes Inativos</p>
          </div>
          <p className="text-3xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">
            {data?.inactiveClients || 0}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">sem empréstimo ativo</p>
        </div>
      </div>

      {/* ── Row 4 — 2 cards side by side ───────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">

        {/* Multa de Atraso */}
        <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-xl bg-primary/10 dark:bg-primary/20 p-2">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Multa de Atraso</p>
          </div>
          <p className="text-3xl font-bold tabular-nums tracking-tight text-green-500">
            {formatCurrency(data?.totalPendingLateFees || 0)}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">a receber</p>
          {/* Decorative % badge */}
          <div className="absolute right-4 bottom-4">
            <div className="flex items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40 h-16 w-16">
              <Percent className="h-9 w-9 text-green-500" />
            </div>
          </div>
        </div>

        {/* Saiu — Empréstimos Concedidos */}
        <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-xl bg-green-100 dark:bg-green-950/40 p-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Saiu (Empréstimos Concedidos)</p>
              </div>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-green-500">
                {formatCurrency(data?.monthNewLoansCapital || 0)}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">total emprestado neste mês</p>
              <Delta pct={data?.weeklySummary?.deltas?.contractsPct} />
            </div>
            {saiuBarData.length > 0 && (
              <div className="h-24 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={saiuBarData} barSize={32} margin={{ top: 20, right: 4, bottom: 0, left: 4 }}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: axisColor }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [formatCurrency(value), "Emprestado"]}
                    />
                    <Bar dataKey="emprestado" fill="#22c55e" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="emprestado"
                        position="top"
                        formatter={(v: number) => formatCurrency(v)}
                        style={{ fontSize: 8, fill: axisColor }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

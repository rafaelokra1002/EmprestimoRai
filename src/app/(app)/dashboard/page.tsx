"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  Receipt,
  Shield,
  ShieldAlert,
  TrendingUp,
  UserX,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"
import { formatCurrency, localDateStr } from "@/lib/utils"
import { useTheme } from "@/lib/theme-provider"
import {
  BarChart,
  Bar,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
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

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  iconBgClassName,
}: {
  title: string
  value: string
  subtitle: string
  icon: LucideIcon
  iconClassName?: string
  iconBgClassName?: string
}) {
  return (
    <Card className="h-full border-primary/30 dark:border-primary/20">
      <CardContent className="p-5">
        <div className={`rounded-lg ${iconBgClassName || "bg-primary/5 dark:bg-primary/15"} p-2 w-fit mb-3`}>
          <Icon className={`h-5 w-5 ${iconClassName || "text-primary"}`} />
        </div>
        <p className="text-xs text-gray-500 dark:text-zinc-400">{title}</p>
        <p className="mt-1 text-2xl leading-none font-medium tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{value}</p>
        <p className="mt-1 text-xs font-medium text-gray-400 dark:text-zinc-500">{subtitle}</p>
      </CardContent>
    </Card>
  )
}


export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInstallBanner, setShowInstallBanner] = useState(true)
  const [showBackupAlert, setShowBackupAlert] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [hoveredDueDate, setHoveredDueDate] = useState<string | null>(null)
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
  const gridColor = isDark ? "#27272a" : "#e5e7eb"

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

  const healthScore = data?.operationHealth?.score || 0
  const collectionRate = data?.operationHealth?.collectionRate || 0
  const defaultRate = data?.operationHealth?.defaultRate || 0
  const monthlyInterest = data?.charts?.interestTrend || []
  const interestChartData = monthlyInterest.map((item, index) => {
    const accumulated = monthlyInterest
      .slice(0, index + 1)
      .reduce((sum, current) => sum + (current.juros || 0), 0)
    return {
      month: item.month,
      jurosMes: item.juros,
      jurosAcumulado: accumulated,
    }
  })

  return (
    <div className="space-y-5 pt-6">
<div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Visão geral do seu sistema financeiro</p>
      </div>

      {/* Backup Alert */}
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
          </div>
        </div>
      )}

      {/* Install Banner */}
      {showInstallBanner && (
        <div className="relative rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
            <ArrowUpRight className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Instale o SP Cobrança Fácil no seu celular</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Tenha acesso rápido direto da tela inicial, funciona offline e como um app nativo!</p>
          </div>
          <button className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors">
            Ver instruções
          </button>
          <button onClick={() => setShowInstallBanner(false)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Month filter */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          {filterActive ? "Filtrando por mês" : "Exibindo todos os meses"}
        </p>
        <div className="flex items-center gap-2">
          {filterActive ? (
            <>
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
              </div>
              <button
                onClick={() => setFilterActive(false)}
                className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-medium text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Ver todos
              </button>
            </>
          ) : (
            <button
              onClick={() => { setSelectedMonth(new Date().getMonth()); setSelectedYear(new Date().getFullYear()); setFilterActive(true) }}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" /> Filtrar por mês
            </button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-zinc-100">
            <TrendingUp className="h-5 w-5 text-primary" />
            Visão Geral
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-emerald-600" />
              <p className="text-xs text-gray-500 dark:text-zinc-400">Total a Receber</p>
            </div>
            <p className="text-2xl leading-none font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">{formatCurrency(data?.monthInstallmentsDue?.total || 0)}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">parcelas com venc. em {periodLabel}</p>
          </div>
          <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-amber-600" />
              <p className="text-xs text-gray-500 dark:text-zinc-400">Emprestado no Mês</p>
            </div>
            <p className="text-2xl leading-none font-semibold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">{formatCurrency(data?.monthNewLoansCapital || 0)}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">capital emprestado em {periodLabel}</p>
          </div>
          <div className="rounded-xl border border-violet-100 dark:border-violet-900/40 bg-violet-50/60 dark:bg-violet-950/20 p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-violet-500" />
              <p className="text-xs text-gray-500 dark:text-zinc-400">Juros do Mês</p>
            </div>
            <p className="text-2xl leading-none font-semibold tabular-nums tracking-tight text-violet-600 dark:text-violet-400">{formatCurrency(data?.monthInstallmentsDue?.interest || 0)}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">juros das parcelas de {periodLabel}</p>
          </div>
          <div className="rounded-xl border border-primary/20 dark:border-primary/20 bg-primary/5 dark:bg-primary/10 p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs text-gray-500 dark:text-zinc-400">Falta Receber</p>
            </div>
            <p className="text-2xl leading-none font-semibold tabular-nums tracking-tight text-primary">{formatCurrency(data?.faltaReceberMes || 0)}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">juros + multas de {periodLabel}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <KpiCard
          title="Recebido no Mês"
          value={formatCurrency(data?.monthReceived || 0)}
          subtitle={`pagamentos recebidos em ${periodLabel}`}
          icon={Receipt}
          iconClassName="text-primary"
          iconBgClassName="bg-primary/5 dark:bg-primary/15"
        />
        <KpiCard
          title="Juros Recebido Mensal"
          value={formatCurrency(data?.financials?.monthlyReceivedInterest || 0)}
          subtitle={`juros recebidos em ${periodLabel}`}
          icon={TrendingUp}
          iconClassName="text-primary"
          iconBgClassName="bg-primary/5 dark:bg-primary/15"
        />
        <KpiCard
          title="Gasto Mensal"
          value={formatCurrency(data?.financials?.monthlyExpenses || 0)}
          subtitle={`despesas de ${periodLabel}`}
          icon={Receipt}
          iconClassName="text-red-500"
          iconBgClassName="bg-red-50 dark:bg-red-950/30"
        />
        <KpiCard
          title="Clientes"
          value={`${data?.counters?.totalClients || 0}`}
          subtitle="cadastrados"
          icon={Users}
          iconClassName="text-primary"
          iconBgClassName="bg-primary/5 dark:bg-primary/15"
        />
        <KpiCard
          title="Contrato Ativo"
          value={`${data?.counters?.activeLoans || 0}`}
          subtitle="contratos ativos"
          icon={Shield}
          iconClassName="text-blue-600"
          iconBgClassName="bg-blue-50 dark:bg-blue-950/20"
        />
        <KpiCard
          title="Vencendo Hoje"
          value={formatCurrency(data?.weeklySummary?.dueTodayAmount || 0)}
          subtitle={`${data?.weeklySummary?.dueTodayClients || 0} cliente(s)`}
          icon={Clock3}
          iconClassName="text-orange-600"
          iconBgClassName="bg-orange-50 dark:bg-orange-950/20"
        />
        <KpiCard
          title="Em Atraso"
          value={formatCurrency(data?.overdueAmount || 0)}
          subtitle={`${data?.overdueCount || 0} parcela(s) vencida(s)`}
          icon={Clock3}
          iconClassName="text-red-500"
          iconBgClassName="bg-red-50 dark:bg-red-950/30"
        />
        <KpiCard
          title="Clientes Inativos"
          value={`${data?.inactiveClients || 0}`}
          subtitle="sem empréstimo ativo"
          icon={Users}
          iconClassName="text-gray-500"
          iconBgClassName="bg-gray-100 dark:bg-zinc-800"
        />
      </div>

      {/* Próximos Vencimentos */}
      <div className="rounded-2xl border border-primary/20 dark:border-primary/20 bg-white dark:bg-zinc-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Próximos Vencimentos</h2>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {(data?.dueNextSevenDays || []).map(({ date, count, amount, items }) => {
            const d = new Date(date + "T12:00:00")
            const isToday = date === localDateStr(new Date())
            const isHovered = hoveredDueDate === date
            const dayName = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
            const dayNum = d.getDate()
            return (
              <div
                key={date}
                className="relative"
                onMouseEnter={() => setHoveredDueDate(date)}
                onMouseLeave={() => setHoveredDueDate(null)}
              >
                <div
                  className={`flex flex-col items-center justify-center rounded-xl border py-3 gap-0.5 transition-all cursor-default ${
                    isToday
                      ? "border-primary bg-primary text-white"
                      : count > 0
                      ? "border-primary/30 bg-primary/5 dark:bg-primary/10 text-gray-800 dark:text-zinc-100"
                      : "border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-400 dark:text-zinc-500"
                  } ${isHovered && count > 0 ? "shadow-md scale-105" : ""}`}
                >
                  <span className={`text-[11px] font-medium capitalize ${isToday ? "text-white/80" : "text-gray-400 dark:text-zinc-500"}`}>
                    {dayName.charAt(0).toUpperCase() + dayName.slice(1)}
                  </span>
                  <span className="text-xl font-bold leading-tight">{dayNum}</span>
                  {count > 0 && (
                    <span className={`mt-0.5 text-[10px] font-semibold ${isToday ? "text-white/80" : "text-primary"}`}>
                      {count} parc.
                    </span>
                  )}
                </div>

                {/* Popover */}
                {isHovered && count > 0 && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-xl border border-primary/20 bg-white dark:bg-zinc-900 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-primary/10">
                      <p className="text-xs font-semibold text-primary capitalize">
                        {d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
                      </p>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                    <div className="p-2 space-y-1 max-h-52 overflow-y-auto">
                      {items.map((item, i) => (
                        <div
                          key={i}
                          onClick={() => router.push(`/emprestimos/${item.loanId}`)}
                          className="flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-zinc-100 truncate">{item.clientName}</p>
                            <p className="text-[10px] text-gray-400 dark:text-zinc-500">Parcela {item.installmentNumber}/{item.installmentCount}</p>
                          </div>
                          <span className="ml-2 shrink-0 text-xs font-bold text-primary">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Multas de Atraso */}
      <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Multas de Atraso</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Card multa total */}
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Multa de Atraso a Receber</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-primary">
                {formatCurrency(data?.totalPendingLateFees || 0)}
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500">multas ainda não recebidas</p>
            </div>
          </div>

          {/* Card em atraso por cliente */}
          <div className="rounded-xl border border-pink-200 dark:border-pink-900/40 bg-pink-50/60 dark:bg-pink-950/10 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-2.5 w-2.5 rounded-full bg-pink-400 shrink-0" />
              <p className="text-xs font-semibold text-pink-600 dark:text-pink-400">Em atraso</p>
            </div>
            {(data?.overdueByLoan || []).length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-zinc-500">Nenhum em atraso</p>
            ) : (
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {(data?.overdueByLoan || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-gray-700 dark:text-zinc-300 font-medium">{item.clientName}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-gray-400 dark:text-zinc-500">{item.overdueCount}p</span>
                      <span className="font-bold tabular-nums text-pink-600 dark:text-pink-400">{formatCurrency(item.totalCharge)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card data de pagamento */}
          <div className="flex flex-col gap-2 rounded-xl border border-green-200 dark:border-green-900/40 bg-green-500/5 dark:bg-green-950/10 p-4 h-[112px]">
            <div className="flex items-center gap-1.5 shrink-0">
              <Clock3 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Data de Pagamento</p>
            </div>
            {(data?.paymentsByDay || []).length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-zinc-500">Nenhuma parcela pendente</p>
            ) : (
              <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0">
                {(data?.paymentsByDay || []).map(({ day, amount }) => {
                  const today = new Date().getDate()
                  const isToday = day === today
                  const isOverdue = day < today
                  return (
                    <div key={day} className="flex items-center justify-between gap-2 text-xs">
                      <span className={`font-semibold ${isToday ? "text-primary" : isOverdue ? "text-red-500 dark:text-red-400" : "text-gray-700 dark:text-zinc-300"}`}>
                        Dia {day}{isToday ? " (hoje)" : ""}
                      </span>
                      <span className={`font-bold tabular-nums ${isOverdue ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Card pills por dia */}
          <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-2">Parcelas por dia</p>
            {(data?.paymentsByDay || []).length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-zinc-500">Nenhuma parcela pendente</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(data?.paymentsByDay || []).map(({ day, amount }) => {
                  const isToday = day === new Date().getDate()
                  return (
                    <div
                      key={day}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium ${
                        isToday
                          ? "bg-primary text-white"
                          : "bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"
                      }`}
                    >
                      <span className="font-bold">{day}</span>
                      <span className={isToday ? "text-white/80" : "text-gray-500 dark:text-zinc-400"}>
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Evolução Financeira (Últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="month" stroke={axisColor} />
                  <YAxis stroke={axisColor} tickFormatter={(value) => `R$${value}`} />
                  <Legend wrapperStyle={{ color: isDark ? "#d4d4d8" : "#374151", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: isDark ? "#d4d4d8" : "#374151" }}
                    formatter={(value: number) => [formatCurrency(value)]}
                  />
                  <Bar dataKey="emprestado" fill="#f59e0b" name="Emprestado" radius={[4, 4, 0, 0]} maxBarSize={42} />
                  <Bar dataKey="recebido" fill="#22c55e" name="Recebido" radius={[4, 4, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Tendência de Juros Recebidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={interestChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="month" stroke={axisColor} />
                  <YAxis stroke={axisColor} tickFormatter={(value) => `R$${value}`} />
                  <Legend wrapperStyle={{ color: isDark ? "#d4d4d8" : "#374151", fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="jurosMes"
                    stroke="#f59e0b"
                    name="Juros no Mês"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#f59e0b", stroke: "#f59e0b" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="jurosAcumulado"
                    stroke="#22c55e"
                    name="Juros Acumulado"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#22c55e", stroke: "#22c55e" }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [formatCurrency(value)]}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex h-20 w-20 items-center justify-center rounded-full border-4 border-amber-300 text-3xl font-semibold tabular-nums text-amber-500">
                {healthScore}
              </span>
              <div>
                <p>Saúde da Operação</p>
                <p className="mt-1 inline-flex rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs text-amber-700">Atenção</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, healthScore)}%` }} />
            </div>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Baseado em taxa de recebimento, inadimplência e margem de lucro</p>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Taxa de Recebimento</p>
                <p className="mt-1 text-xl leading-none font-bold tabular-nums tracking-tight text-red-500">{collectionRate.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/15 p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Inadimplência</p>
                <p className="mt-1 text-xl leading-none font-bold tabular-nums tracking-tight text-primary">{defaultRate.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/15 p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Recebido</p>
                <p className="mt-1 text-xl leading-none font-bold tabular-nums tracking-tight text-primary">{formatCurrency(data?.totalReceived || 0)}</p>
              </div>
              <div className="rounded-lg border border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/15 p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Em Atraso</p>
                <p className="mt-1 text-xl leading-none font-bold tabular-nums tracking-tight text-primary">{data?.overdueCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="h-full rounded-xl border border-primary/30 dark:border-primary/20 bg-primary/5 dark:bg-zinc-900 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-primary/20 dark:border-primary/15">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">Precisa de Atenção</span>
          </div>

          {/* Items */}
          <div className="divide-y divide-primary/10 dark:divide-primary/10">
            {/* Vencem esta semana */}
            <div className="flex items-center gap-4 px-5 py-4 bg-primary/5 dark:bg-primary/10">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 dark:bg-primary/20">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-primary">
                  {data?.dueThisWeekCount ?? 0} Vencem esta semana
                </p>
                <p className="text-xs text-primary/70 dark:text-primary/60">
                  {formatCurrency(data?.dueThisWeekAmount ?? 0)} – empréstimos
                </p>
              </div>
            </div>

            {/* Atrasados +30 dias */}
            <div className="flex items-center gap-4 px-5 py-4 bg-red-50 dark:bg-red-950/20">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <UserX className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-red-700 dark:text-red-400">
                  {data?.overdue30DaysCount ?? 0} Atrasados há +30 dias
                </p>
                <p className="text-xs text-red-500 dark:text-red-500">
                  {formatCurrency(data?.overdue30DaysAmount ?? 0)} – clientes inadimplentes
                </p>
              </div>
            </div>
          </div>

          {/* Rodapé – tudo em ordem */}
          {(data?.dueThisWeekCount ?? 0) === 0 && (data?.overdue30DaysCount ?? 0) === 0 && (
            <div className="flex items-center gap-2 px-5 py-4">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Tudo em ordem!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

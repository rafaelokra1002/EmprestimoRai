"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Package,
  DollarSign,
  MessageSquare,
  Receipt,
  Shield,
  ShieldAlert,
  TrendingUp,
  Users,
  Car,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
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
  totalToReceive: number
  totalReceived: number
  capitalOnStreet: number
  totalProfit: number
  overdueCount: number
  activeClients: number
  monthlyData: { month: string; emprestado: number; recebido: number }[]
  totalLoans: number
  weeklySummary: {
    contractsThisWeek: number
    receivedThisWeek: number
    dueToday: number
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
    <Card className="h-full border-emerald-200/80 dark:border-emerald-900/40 shadow-[0_10px_22px_-16px_rgba(16,185,129,0.5)]">
      <CardContent className="p-5">
        <div className={`rounded-lg ${iconBgClassName || "bg-emerald-50 dark:bg-emerald-950/30"} p-2 w-fit mb-3`}>
          <Icon className={`h-5 w-5 ${iconClassName || "text-emerald-600"}`} />
        </div>
        <p className="text-xs text-gray-500 dark:text-zinc-400">{title}</p>
        <p className="mt-1 text-2xl leading-none font-medium tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{value}</p>
        <p className="mt-1 text-xs font-medium text-gray-400 dark:text-zinc-500">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function DeltaBadge({ value }: { value: number }) {
  const isPositive = value >= 0
  return (
    <span className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium tabular-nums text-emerald-700">
      {isPositive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInstallBanner, setShowInstallBanner] = useState(true)
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
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((dashboardData) => {
        if (dashboardData && !dashboardData.error) {
          setData(dashboardData)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
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
  const weekContractsDelta = data?.weeklySummary?.deltas?.contractsPct || 0

  return (
    <div className="space-y-5 pt-6">
      {/* Welcome */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Bem-vindo de volta!</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Gerencie seus empréstimos</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <Shield className="h-3.5 w-3.5" />
          Dono (acesso total)
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Visão geral do seu sistema financeiro</p>
      </div>

      {/* Install Banner */}
      {showInstallBanner && (
        <div className="relative rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
            <ArrowUpRight className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Instale o EmprestimoRAI no seu celular</p>
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

      <Card className="border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/10 shadow-[0_10px_22px_-16px_rgba(16,185,129,0.5)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-zinc-100">
            <Calendar className="h-5 w-5 text-emerald-500" />
            Resumo da Semana
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-white/80 dark:bg-zinc-900/60 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs text-gray-500 dark:text-zinc-400">Contratos</p>
            </div>
            <p className="text-2xl leading-none font-semibold tabular-nums tracking-tight text-emerald-600">{data?.weeklySummary?.contractsThisWeek || 0}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">esta semana</p>
          </div>
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-white/80 dark:bg-zinc-900/60 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs text-gray-500 dark:text-zinc-400">Recebido</p>
            </div>
            <p className="text-2xl leading-none font-semibold tabular-nums tracking-tight text-emerald-600">{formatCurrency(data?.weeklySummary?.receivedThisWeek || 0)}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">esta semana</p>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-white/80 dark:bg-zinc-900/60 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs text-gray-500 dark:text-zinc-400">Vence Hoje</p>
            </div>
            <p className="text-2xl leading-none font-semibold tabular-nums tracking-tight text-orange-500">{data?.weeklySummary?.dueToday || 0}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">cobranças</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Recebido"
          value={formatCurrency(data?.totalReceived || 0)}
          subtitle="total histórico"
          icon={Receipt}
          iconClassName="text-emerald-600"
          iconBgClassName="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <KpiCard
          title="Capital na Rua"
          value={formatCurrency(data?.capitalOnStreet || 0)}
          subtitle="principal emprestado"
          icon={DollarSign}
          iconClassName="text-orange-500"
          iconBgClassName="bg-orange-50 dark:bg-orange-950/30"
        />
        <KpiCard
          title="Juros a Receber"
          value={formatCurrency(data?.financials?.pendingInterest || 0)}
          subtitle="juros pendentes"
          icon={Clock3}
          iconClassName="text-violet-500"
          iconBgClassName="bg-violet-50 dark:bg-violet-950/30"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Empréstimos"
          value={`${data?.counters?.activeLoans || 0}`}
          subtitle={`${weekContractsDelta >= 0 ? "+" : ""}${weekContractsDelta.toFixed(0)} esta semana`}
          icon={DollarSign}
          iconClassName="text-emerald-600"
          iconBgClassName="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <KpiCard
          title="Contratos"
          value={`${data?.counters?.totalContracts || data?.totalLoans || 0}`}
          subtitle={`${weekContractsDelta >= 0 ? "+" : ""}${weekContractsDelta.toFixed(0)} esta semana`}
          icon={FileText}
          iconClassName="text-violet-500"
          iconBgClassName="bg-violet-50 dark:bg-violet-950/30"
        />
        <KpiCard
          title="Total a Receber"
          value={formatCurrency(data?.totalToReceive || 0)}
          subtitle="incluindo multas e juros"
          icon={TrendingUp}
          iconClassName="text-blue-600"
          iconBgClassName="bg-blue-50 dark:bg-blue-950/30"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Clientes"
          value={`${data?.counters?.totalClients || 0}`}
          subtitle="cadastrados"
          icon={Users}
          iconClassName="text-emerald-600"
          iconBgClassName="bg-emerald-50 dark:bg-emerald-950/30"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="h-full border-emerald-200/80 dark:border-emerald-900/40 shadow-[0_10px_22px_-16px_rgba(16,185,129,0.5)]">
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

        <Card className="h-full border-emerald-200/80 dark:border-emerald-900/40 shadow-[0_10px_22px_-16px_rgba(16,185,129,0.5)]">
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
        <Card className="h-full border-emerald-200/80 dark:border-emerald-900/40 shadow-[0_10px_22px_-16px_rgba(16,185,129,0.5)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-300 text-2xl font-semibold tabular-nums text-amber-500">
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
              <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, healthScore)}%` }} />
            </div>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Baseado em taxa de recebimento, inadimplência e margem de lucro</p>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Taxa de Recebimento</p>
                <p className="mt-1 text-xl leading-none font-bold tabular-nums tracking-tight text-red-500">{collectionRate.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Inadimplência</p>
                <p className="mt-1 text-xl leading-none font-bold tabular-nums tracking-tight text-emerald-600">{defaultRate.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Recebido</p>
                <p className="mt-1 text-xl leading-none font-bold tabular-nums tracking-tight text-emerald-600">{formatCurrency(data?.totalReceived || 0)}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Em Atraso</p>
                <p className="mt-1 text-xl leading-none font-bold tabular-nums tracking-tight text-emerald-600">{data?.overdueCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/10 shadow-[0_10px_22px_-16px_rgba(16,185,129,0.5)]">
          <CardHeader>
            <CardTitle>Alertas e acompanhamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.alerts || []).length === 0 ? (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
                <p className="flex items-center gap-2 text-2xl font-semibold text-emerald-600">
                  <Shield className="h-6 w-6" />
                  Tudo em ordem!
                </p>
                <p className="text-gray-500 dark:text-zinc-400">Nenhum alerta no momento. Continue assim!</p>
              </div>
            ) : (
              (data?.alerts || []).map((alert, index) => (
                <div
                  key={`${alert.title}-${index}`}
                  className="rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 p-4"
                >
                  <p className="text-base font-semibold text-gray-900 dark:text-zinc-100">{alert.title}</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">{alert.description}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

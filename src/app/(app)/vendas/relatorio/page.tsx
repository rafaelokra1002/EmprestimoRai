"use client"

import { useEffect, useState, useMemo } from "react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useTheme } from "@/lib/theme-provider"
import {
  DollarSign, CheckCircle2, TrendingUp, AlertTriangle,
  Calendar, RefreshCw, Package, Car, FileText, Repeat,
  Percent, Clock
} from "lucide-react"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from "recharts"

type TabType = "produtos" | "veiculos" | "contratos" | "assinaturas"

export default function RelatorioVendasPage() {
  const [sales, setSales] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const [activeTab, setActiveTab] = useState<TabType>("produtos")
  const [updatedAt, setUpdatedAt] = useState("")

  // Period: 6 months back from today
  const periodEnd = useMemo(() => new Date(), [])
  const periodStart = useMemo(() => {
    const d = new Date(periodEnd)
    d.setMonth(d.getMonth() - 6)
    return d
  }, [periodEnd])

  const fetchData = async () => {
    setLoading(true)
    const [salesRes, vehiclesRes] = await Promise.all([
      fetch("/api/sales"),
      fetch("/api/vehicles"),
    ])
    const salesData = await salesRes.json()
    const vehiclesData = await vehiclesRes.json()
    setSales(Array.isArray(salesData) ? salesData : [])
    setVehicles(Array.isArray(vehiclesData) ? vehiclesData : [])
    setUpdatedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // Filter by period
  const salesInPeriod = useMemo(() =>
    sales.filter(s => {
      const d = new Date(s.createdAt)
      return d >= periodStart && d <= periodEnd
    }),
    [sales, periodStart, periodEnd]
  )

  const vehiclesInPeriod = useMemo(() =>
    vehicles.filter(v => {
      const d = new Date(v.saleDate || v.createdAt)
      return d >= periodStart && d <= periodEnd
    }),
    [vehicles, periodStart, periodEnd]
  )

  // ===== GLOBAL STATS =====
  const globalStats = useMemo(() => {
    const salesTotalVendido = salesInPeriod.reduce((s, sale) => s + (sale.totalAmount || 0), 0)
    const vehiclesTotalVendido = vehiclesInPeriod.reduce((s, v) => s + (v.salePrice || 0), 0)
    const totalVendido = salesTotalVendido + vehiclesTotalVendido
    const vendaCount = salesInPeriod.length + vehiclesInPeriod.length

    const salesRecebido = salesInPeriod.reduce((s, sale) => {
      const instPaid = sale.saleInstallments?.reduce((acc: number, i: any) => acc + (i.paidAmount || 0), 0) || 0
      return s + instPaid
    }, 0)
    const vehiclesRecebido = vehiclesInPeriod.reduce((s, v) => s + (v.paidAmount || 0), 0)
    const totalRecebido = salesRecebido + vehiclesRecebido

    const salesCusto = 0 // Sales don't have purchase cost in this model
    const vehiclesCusto = vehiclesInPeriod.reduce((s, v) => s + (v.purchasePrice || 0), 0)
    const totalCusto = salesCusto + vehiclesCusto
    const lucro = totalVendido - totalCusto

    // Em Atraso: overdue items
    const now = new Date()
    let atrasoDinheiro = 0
    let atrasoCount = 0

    salesInPeriod.forEach(sale => {
      sale.saleInstallments?.forEach((inst: any) => {
        if (inst.status === "OVERDUE" || (inst.status === "PENDING" && new Date(inst.dueDate) < now && inst.paidAmount < inst.amount)) {
          atrasoDinheiro += inst.amount - (inst.paidAmount || 0)
          atrasoCount++
        }
      })
    })

    // For vehicles, check if there is overdue balance based on schedule
    vehicles.forEach(v => {
      const salePrice = v.salePrice || 0
      const paid = v.paidAmount || 0
      const falta = salePrice - paid
      if (falta > 0 && v.firstDueDate) {
        const firstDue = new Date(v.firstDueDate)
        const instValue = salePrice / (v.installmentCount || 1)
        const monthsDiff = Math.max(0, (now.getFullYear() - firstDue.getFullYear()) * 12 + now.getMonth() - firstDue.getMonth() + (now.getDate() >= firstDue.getDate() ? 1 : 0))
        const expectedPaid = Math.min(v.installmentCount || 1, monthsDiff) * instValue + (v.downPayment || 0)
        if (paid < expectedPaid) {
          atrasoDinheiro += expectedPaid - paid
          atrasoCount++
        }
      }
    })

    return { totalVendido, vendaCount, totalRecebido, lucro, totalCusto, atrasoDinheiro, atrasoCount }
  }, [salesInPeriod, vehiclesInPeriod, vehicles])

  // ===== PIE CHART DATA =====
  const pieData = useMemo(() => {
    const produtosTotal = salesInPeriod.reduce((s, sale) => s + (sale.totalAmount || 0), 0)
    const veiculosTotal = vehiclesInPeriod.reduce((s, v) => s + (v.salePrice || 0), 0)
    // Contratos = 0 for now (could extend later)
    return [
      { name: "Produtos", value: produtosTotal, color: "#22c55e" },
      { name: "Veículos", value: veiculosTotal, color: "#10b981" },
      { name: "Contratos", value: 0, color: "#f59e0b" },
    ].filter(d => d.value > 0)
  }, [salesInPeriod, vehiclesInPeriod])

  // ===== PER-TAB STATS =====
  const tabStats = useMemo(() => {
    const now = new Date()

    // Produtos
    const pVendido = salesInPeriod.reduce((s, sale) => s + (sale.totalAmount || 0), 0)
    const pCount = salesInPeriod.length
    const pCusto = 0
    const pLucro = pVendido - pCusto
    let pPendente = 0
    sales.forEach(sale => {
      if (sale.status === "ACTIVE") {
        const totalPaid = sale.saleInstallments?.reduce((acc: number, i: any) => acc + (i.paidAmount || 0), 0) || 0
        pPendente += (sale.totalAmount || 0) - totalPaid
      }
    })

    // Veículos
    const vVendido = vehiclesInPeriod.reduce((s, v) => s + (v.salePrice || 0), 0)
    const vCount = vehiclesInPeriod.length
    const vCusto = vehiclesInPeriod.reduce((s, v) => s + (v.purchasePrice || 0), 0)
    const vLucro = vVendido - vCusto
    let vPendente = 0
    vehicles.forEach(v => {
      const falta = (v.salePrice || 0) - (v.paidAmount || 0)
      if (falta > 0) vPendente += falta
    })

    return {
      produtos: { vendido: pVendido, count: pCount, custo: pCusto, lucro: pLucro, pendente: pPendente },
      veiculos: { vendido: vVendido, count: vCount, custo: vCusto, lucro: vLucro, pendente: vPendente },
      contratos: { vendido: 0, count: 0, custo: 0, lucro: 0, pendente: 0 },
      assinaturas: { vendido: 0, count: 0, custo: 0, lucro: 0, pendente: 0 },
    }
  }, [salesInPeriod, vehiclesInPeriod, sales, vehicles])

  const currentTabStats = tabStats[activeTab]

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "produtos", label: "Produtos", icon: <Package className="h-4 w-4" /> },
    { key: "veiculos", label: "Veículos", icon: <Car className="h-4 w-4" /> },
    { key: "contratos", label: "Contratos", icon: <FileText className="h-4 w-4" /> },
    { key: "assinaturas", label: "Assinaturas", icon: <Repeat className="h-4 w-4" /> },
  ]

  const formatPeriodDate = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })

  return (
    <div className="space-y-6 pt-6 pb-12">
      {/* ===== HEADER ===== */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Relatório de Vendas</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Produtos, Veículos, Contratos e Assinaturas</p>
      </div>

      {/* ===== PERIOD BAR ===== */}
      <div className="rounded-xl border border-primary/30 dark:border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 font-medium">
              <Calendar className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
              Período:
            </div>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-gray-800 dark:text-zinc-200">
              <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
              {formatPeriodDate(periodStart)} - {formatPeriodDate(periodEnd)}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500">
            <RefreshCw className="h-3 w-3" />
            Atualizado: {updatedAt || "—"}
          </div>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ===== GLOBAL STAT CARDS ===== */}
      <div className="grid grid-cols-2 gap-3">
        {/* Vendido no Período */}
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Vendido no Período</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(globalStats.totalVendido)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{globalStats.vendaCount} vendas</p>
          </div>
        </div>

        {/* Recebido no Período */}
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Recebido no Período</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(globalStats.totalRecebido)}</p>
          </div>
        </div>

        {/* Lucro no Período */}
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-primary">Lucro no Período</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(globalStats.lucro)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Vendido - Custo</p>
          </div>
        </div>

        {/* Em Atraso */}
        <div className="rounded-xl border border-amber-500/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/300/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-amber-600">Em Atraso (Total)</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(globalStats.atrasoDinheiro)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{globalStats.atrasoCount} itens</p>
          </div>
        </div>
      </div>

      {/* ===== DONUT CHART ===== */}
      <div className="rounded-xl border border-primary/30 dark:border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-4">Distribuição de Vendas</h2>
        <div className="h-[220px]">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#18181b" : "#ffffff",
                    border: `1px solid ${isDark ? "#27272a" : "#e5e7eb"}`,
                    borderRadius: "8px",
                    color: isDark ? "#f4f4f5" : "#1f2937",
                    fontSize: "13px",
                  }}
                  formatter={(value: number) => [formatCurrency(value), ""]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 dark:text-zinc-500 text-sm">
              Nenhuma venda no período
            </div>
          )}
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-2">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-[#22c55e]" />
            <span className="text-xs text-gray-500 dark:text-zinc-400">Produtos</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-[#10b981]" />
            <span className="text-xs text-gray-500 dark:text-zinc-400">Veículos</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-[#f59e0b]" />
            <span className="text-xs text-gray-500 dark:text-zinc-400">Contratos</span>
          </div>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800">
        {tabs.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                active
                  ? "border-primary text-gray-900 dark:text-zinc-100"
                  : "border-transparent text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ===== PER-TAB STATS ===== */}
      <div className="grid grid-cols-2 gap-3">
        {/* Vendido no Período */}
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Vendido no Período</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(currentTabStats.vendido)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{currentTabStats.count} vendas</p>
          </div>
        </div>

        {/* Custo */}
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/300/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Custo</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(currentTabStats.custo)}</p>
          </div>
        </div>

        {/* Lucro */}
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <Percent className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Lucro</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(currentTabStats.lucro)}</p>
          </div>
        </div>

        {/* Pendente (Total) */}
        <div className="rounded-xl border border-amber-500/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/300/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-amber-600">Pendente (Total)</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(currentTabStats.pendente)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Todos ativos</p>
          </div>
        </div>
      </div>
    </div>
  )
}

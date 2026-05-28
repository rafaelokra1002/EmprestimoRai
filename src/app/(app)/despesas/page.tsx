"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus, Search, ChevronLeft, ChevronRight, ChevronDown,
  CheckCircle2, Pencil, Undo2, Trash2,
  TrendingUp, TrendingDown, Scale, Package, MoreVertical,
  BarChart2, ChevronUp,
} from "lucide-react"
import { formatCurrency, localDateStr } from "@/lib/utils"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts"

type StatusFilter = "todas" | "vence_hoje" | "pendentes" | "atrasadas" | "pagas"

const CATEGORIES = [
  "Aluguel", "Energia", "Água", "Internet", "Telefone/Celular",
  "Salários", "Combustível", "Material", "Marketing",
  "Impostos", "SEGURO", "Outros",
]

export default function DespesasPage() {
const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas")
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null)
  const [showAllMonths, setShowAllMonths] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortDateAsc, setSortDateAsc] = useState(false)
  const [showCharts, setShowCharts] = useState(false)

  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())

  const [fDescription, setFDescription] = useState("")
  const [fAmount, setFAmount] = useState("")
  const [fDueDate, setFDueDate] = useState(() => localDateStr())
  const [fCategory, setFCategory] = useState("Outros")
  const [fSupplier, setFSupplier] = useState("")
  const [fRecurring, setFRecurring] = useState(false)
  const [fNotes, setFNotes] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  const fetchExpenses = async () => {
    const res = await fetch("/api/expenses")
    const data = await res.json()
    setExpenses(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchExpenses() }, [])

  const resetForm = () => {
    setFDescription(""); setFAmount(""); setFDueDate(localDateStr())
    setFCategory("Outros"); setFSupplier(""); setFRecurring(false); setFNotes(""); setEditingId(null)
  }

  const openNewDialog = () => { resetForm(); setDialogOpen(true) }

  const openEditDialog = (exp: any) => {
    setEditingId(exp.id)
    setFDescription(exp.description || "")
    setFAmount(exp.amount?.toFixed(2).replace(".", ",") || "0,00")
    setFDueDate(exp.dueDate ? localDateStr(exp.dueDate) : "")
    setFCategory(exp.category || "Outros")
    setFSupplier(exp.supplier || "")
    setFRecurring(exp.recurring || false)
    setFNotes(exp.notes || "")
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const amount = parseFloat(fAmount.replace(/\./g, "").replace(",", ".")) || 0
      if (amount <= 0) return alert("Valor deve ser maior que zero")
      if (!fDescription.trim()) return alert("Descrição é obrigatória")

      const payload = {
        description: fDescription,
        accountType: "EMPRESA",
        supplier: fSupplier || undefined,
        amount,
        category: fCategory,
        dueDate: fDueDate,
        recurring: fRecurring,
        notes: fNotes || undefined,
      }

      const res = editingId
        ? await fetch(`/api/expenses/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return alert("Erro ao salvar: " + (err.error || res.statusText))
      }
      setDialogOpen(false); resetForm(); fetchExpenses()
    } catch { alert("Erro de conexão ao salvar a conta") }
  }

  const handlePay = async (id: string) => {
    await fetch(`/api/expenses/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pay" }) })
    fetchExpenses()
  }

  const handleUnpay = async (id: string) => {
    await fetch(`/api/expenses/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unpay" }) })
    fetchExpenses()
  }

  const handleDelete = async (id: string) => {
    if (confirm("Excluir esta conta?")) {
      await fetch(`/api/expenses/${id}`, { method: "DELETE" })
      fetchExpenses()
    }
  }

  const getExpenseStatus = (expense: any) => {
    if (expense.status === "PAID") return "pago"
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const due = new Date(expense.dueDate); due.setHours(0, 0, 0, 0)
    if (due < now) return "atrasado"
    return "pendente"
  }

  const isToday = (dateStr: string) => {
    const date = new Date(dateStr); const today = new Date()
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
  }

  const monthName = new Date(currentYear, currentMonth)
    .toLocaleString("pt-BR", { month: "long" })
    .replace(/^./, (c) => c.toUpperCase())

  const monthExpenses = useMemo(() => {
    if (showAllMonths) return expenses
    return expenses.filter((e) => {
      const d = new Date(e.dueDate)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
  }, [expenses, currentMonth, currentYear, showAllMonths])

  const stats = useMemo(() => {
    const pagas = monthExpenses.filter((e) => getExpenseStatus(e) === "pago")
    const pendentes = monthExpenses.filter((e) => getExpenseStatus(e) !== "pago")
    return {
      pendentes: pendentes.reduce((s, e) => s + e.amount, 0),
      pendentesCount: pendentes.length,
      pagas: pagas.reduce((s, e) => s + e.amount, 0),
      pagasCount: pagas.length,
      total: monthExpenses.reduce((s, e) => s + e.amount, 0),
      totalAno: expenses.filter((e) => new Date(e.dueDate).getFullYear() === currentYear).reduce((s, e) => s + e.amount, 0),
      totalGeral: expenses.reduce((s, e) => s + e.amount, 0),
      mediaUltimos12: (() => {
        const now = new Date()
        const total = expenses.filter((e) => {
          const d = new Date(e.dueDate)
          const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
          return diff >= 0 && diff < 12
        }).reduce((s, e) => s + e.amount, 0)
        return total / 12
      })(),
    }
  }, [monthExpenses, expenses, currentYear])

  const filteredExpenses = useMemo(() => {
    let list = monthExpenses
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((e) => e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q) || e.supplier?.toLowerCase().includes(q))
    }
    if (statusFilter === "vence_hoje") list = list.filter((e) => isToday(e.dueDate) && getExpenseStatus(e) !== "pago")
    else if (statusFilter === "pendentes") list = list.filter((e) => getExpenseStatus(e) === "pendente")
    else if (statusFilter === "atrasadas") list = list.filter((e) => getExpenseStatus(e) === "atrasado")
    else if (statusFilter === "pagas") list = list.filter((e) => getExpenseStatus(e) === "pago")

    return [...list].sort((a, b) => {
      const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      return sortDateAsc ? diff : -diff
    })
  }, [monthExpenses, search, statusFilter, sortDateAsc])

  // Group by day
  const groupedByDay = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const exp of filteredExpenses) {
      const key = new Date(exp.dueDate).toLocaleDateString("pt-BR")
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(exp)
    }
    return Array.from(map.entries())
  }, [filteredExpenses])

  const prevMonth = () => {
    setShowAllMonths(false)
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1) }
    else setCurrentMonth((m) => m - 1)
  }

  const nextMonth = () => {
    setShowAllMonths(false)
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1) }
    else setCurrentMonth((m) => m + 1)
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredExpenses.length) setSelectedIds([])
    else setSelectedIds(filteredExpenses.map((e) => e.id))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const isFormValid = fDescription.trim().length >= 2

  const CATEGORY_COLORS: Record<string, string> = {
    "Aluguel": "#7c3aed", "Energia": "#f59e0b", "Água": "#3b82f6", "Internet": "#8b5cf6",
    "Telefone/Celular": "#06b6d4", "Salários": "#10b981", "Combustível": "#f97316",
    "Material": "#84cc16", "Marketing": "#ec4899", "Impostos": "#ef4444",
    "SEGURO": "#a855f7", "Outros": "#71717a",
  }

  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of monthExpenses) {
      map[e.category] = (map[e.category] || 0) + e.amount
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || "#71717a" }))
      .sort((a, b) => b.value - a.value)
  }, [monthExpenses])

  const yearlyChartData = useMemo(() => {
    const now = new Date()
    const year = currentYear
    return Array.from({ length: 12 }, (_, i) => {
      const month = new Date(year, i)
      const label = month.toLocaleString("pt-BR", { month: "short" }).replace(".", "")
      const total = expenses
        .filter((e) => { const d = new Date(e.dueDate); return d.getFullYear() === year && d.getMonth() === i })
        .reduce((s, e) => s + e.amount, 0)
      return { label: label.charAt(0).toUpperCase() + label.slice(1), total }
    })
  }, [expenses, currentYear])

  const totalCategorySum = categoryChartData.reduce((s, d) => s + d.value, 0)

  const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
    todas: "Todas",
    vence_hoje: "Vence Hoje",
    pendentes: "Pendentes",
    atrasadas: "Atrasadas",
    pagas: "Pagas",
  }

  return (
    <div className="space-y-0 pt-6 pb-12" onClick={() => { setShowFilterMenu(false); setOpenActionMenu(null) }}>

      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Transações</h1>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowFilterMenu((v) => !v) }}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white"
            >
              <ChevronDown className="h-4 w-4" />
              {STATUS_FILTER_LABELS[statusFilter] === "Todas" ? "Despesas" : STATUS_FILTER_LABELS[statusFilter]}
            </button>
            {showFilterMenu && (
              <div onClick={(e) => e.stopPropagation()} className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
                {(["todas", "pendentes", "atrasadas", "pagas", "vence_hoje"] as StatusFilter[]).map((v) => (
                  <button key={v} onClick={() => { setStatusFilter(v); setShowFilterMenu(false) }}
                    className={`w-full px-4 py-2 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-zinc-800 ${statusFilter === v ? "font-semibold text-primary" : "text-gray-700 dark:text-zinc-300"}`}>
                    {STATUS_FILTER_LABELS[v]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtro ano/mês compacto */}
          <div className="flex items-center gap-1">
            {/* Ano */}
            <div className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 py-0.5">
              <button
                onClick={() => { setCurrentYear((y) => y - 1); setShowAllMonths(false) }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <span className="w-10 text-center text-xs font-bold text-gray-800 dark:text-zinc-200 tabular-nums">{currentYear}</span>
              <button
                onClick={() => { setCurrentYear((y) => y + 1); setShowAllMonths(false) }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            {/* Mês */}
            <button onClick={prevMonth} className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              onClick={() => setShowAllMonths((v) => !v)}
              className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition ${showAllMonths ? "border-primary bg-primary text-white" : "border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-200 hover:border-primary"}`}
            >
              {showAllMonths ? "Todos" : monthName}
            </button>
            <button onClick={nextMonth} className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setShowCharts((v) => !v) }}
            className={`flex items-center gap-1.5 rounded-lg border px-3 h-9 text-sm font-medium transition ${showCharts ? "border-primary bg-primary/10 text-primary dark:bg-primary/20" : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
          >
            <BarChart2 className="h-4 w-4" />
            {showCharts ? "Ocultar" : "Ver gráficos"}
          </button>
          <Button onClick={openNewDialog} className="bg-primary text-white hover:bg-primary/90 gap-1.5">
            <Plus className="h-4 w-4" /> Nova Despesa
          </Button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowSearch((v) => !v) }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar despesa, categoria ou conta..."
            className="pl-10 h-11 rounded-xl border-gray-200 dark:border-zinc-700"
          />
        </div>
      )}

      {/* ===== SUMMARY CARDS ===== */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">Total gasto (ano)</p>
            <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(stats.totalAno)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">em {currentYear}</p>
          </div>
        </div>

        <button
          onClick={() => setStatusFilter(statusFilter === "pagas" ? "todas" : "pagas")}
          className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${statusFilter === "pagas" ? "border-primary/40 bg-primary/5 dark:bg-primary/10" : "border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-primary/30"}`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
            <TrendingDown className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">Gastos do mês ({monthName})</p>
            <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(stats.total)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{monthExpenses.length} lançamento{monthExpenses.length !== 1 ? "s" : ""}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 dark:text-zinc-500 ml-auto shrink-0" />
        </button>

        <button
          onClick={() => setStatusFilter("todas")}
          className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${statusFilter === "todas" ? "border-primary/40 bg-primary/5 dark:bg-primary/10" : "border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-primary/30"}`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-zinc-400">Total de despesas</p>
            <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(stats.totalGeral)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{expenses.length} lançamento{expenses.length !== 1 ? "s" : ""}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 dark:text-zinc-500 ml-auto shrink-0" />
        </button>

        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
            <BarChart2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-zinc-400">Média mensal</p>
            <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(stats.mediaUltimos12)}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Média dos últimos 12 meses</p>
          </div>
        </div>
      </div>

      {showCharts && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
          {/* ── Donut — Valor gasto por categoria ── */}
          <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col">
            <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 mb-4">Valor gasto por categoria</h3>
            {categoryChartData.length === 0 ? (
              <p className="text-center text-sm text-gray-400 dark:text-zinc-500 py-8 flex-1">Sem dados no período</p>
            ) : (
              <div className="flex gap-6 flex-1">
                {/* Donut */}
                <div style={{ width: 180, height: 180 }} className="shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        dataKey="value"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={1}
                        startAngle={90}
                        endAngle={-270}
                        labelLine={false}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                          if (percent < 0.06) return null
                          const RADIAN = Math.PI / 180
                          const r = innerRadius + (outerRadius - innerRadius) * 0.5
                          const x = cx + r * Math.cos(-midAngle * RADIAN)
                          const y = cy + r * Math.sin(-midAngle * RADIAN)
                          return (
                            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
                              {(percent * 100).toFixed(1)}%
                            </text>
                          )
                        }}
                      >
                        {categoryChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [formatCurrency(v), "Gasto"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legenda */}
                <div className="flex flex-col justify-center gap-2.5 flex-1">
                  {categoryChartData.slice(0, 6).map((d) => (
                    <div key={d.name} className="grid text-sm" style={{ gridTemplateColumns: "12px 1fr auto auto", gap: "0 10px", alignItems: "center" }}>
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="font-medium text-gray-800 dark:text-zinc-200">{d.name}</span>
                      <span className="tabular-nums text-gray-600 dark:text-zinc-300 text-right">{formatCurrency(d.value)}</span>
                      <span className="tabular-nums text-gray-400 dark:text-zinc-500 text-right w-12">
                        {totalCategorySum > 0 ? ((d.value / totalCategorySum) * 100).toFixed(1) : "0"}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Area — Gastos ao longo do ano ── */}
          <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">Gastos ao longo do ano</h3>
              <span className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-zinc-700 px-3 py-1 text-xs font-medium text-gray-600 dark:text-zinc-300">
                Valor (R$) <ChevronDown className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={yearlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="expAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => v === 0 ? "R$0" : `R$${(v / 1000).toFixed(0)} mil`}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={58}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v), "Gastos"]}
                    labelFormatter={(label) => `${label}/${currentYear}`}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Gastos"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#expAreaGrad)"
                    dot={{ r: 4, fill: "#22c55e", strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#22c55e" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ===== TABLE ===== */}
      <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 dark:text-zinc-500">Carregando despesas...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-zinc-500">
            <Package className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Nenhuma despesa encontrada.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-zinc-800 text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 dark:border-zinc-600 accent-primary"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-left w-10">Sit.</th>
                <th className="px-4 py-3 font-medium text-left cursor-pointer select-none" onClick={() => setSortDateAsc((v) => !v)}>
                  <span className="flex items-center gap-1">Data {sortDateAsc ? "↑" : "↓"}</span>
                </th>
                <th className="px-4 py-3 font-medium text-left">Descrição</th>
                <th className="px-4 py-3 font-medium text-left">Categoria</th>
                <th className="px-4 py-3 font-medium text-left">Conta</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {groupedByDay.map(([dateStr, dayExps]) => {
                const dayTotal = dayExps.reduce((s, e) => s + e.amount, 0)
                return (
                  <>
                    {dayExps.map((exp) => {
                      const status = getExpenseStatus(exp)
                      const isPaid = status === "pago"
                      const isOverdue = status === "atrasado"
                      const isSelected = selectedIds.includes(exp.id)

                      return (
                        <tr
                          key={exp.id}
                          className={`border-b border-gray-50 dark:border-zinc-800/60 transition ${isSelected ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-gray-50/60 dark:hover:bg-zinc-800/40"}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(exp.id)}
                              className="rounded border-gray-300 dark:border-zinc-600 accent-primary"
                            />
                          </td>
                          <td className="px-4 py-3">
                            {isPaid ? (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            ) : isOverdue ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                              </span>
                            ) : (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30">
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-zinc-400 whitespace-nowrap">{dateStr}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">{exp.description}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isPaid
                                ? "bg-primary/10 text-primary dark:bg-primary/20"
                                : isOverdue
                                  ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                            }`}>
                              {isPaid ? "Paga" : isOverdue ? "Atrasada" : exp.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{exp.supplier || "—"}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">{formatCurrency(exp.amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="relative flex items-center justify-end">
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenActionMenu(openActionMenu === exp.id ? null : exp.id) }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-200"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              {openActionMenu === exp.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full z-50 mt-1 min-w-[150px] rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1"
                                >
                                  {isPaid ? (
                                    <button onClick={() => { handleUnpay(exp.id); setOpenActionMenu(null) }}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
                                      <Undo2 className="h-3.5 w-3.5" /> Reabrir
                                    </button>
                                  ) : (
                                    <button onClick={() => { handlePay(exp.id); setOpenActionMenu(null) }}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-primary hover:bg-primary/5 dark:hover:bg-primary/10">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Pagar
                                    </button>
                                  )}
                                  <button onClick={() => { openEditDialog(exp); setOpenActionMenu(null) }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
                                    <Pencil className="h-3.5 w-3.5" /> Editar
                                  </button>
                                  <button onClick={() => { handleDelete(exp.id); setOpenActionMenu(null) }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20">
                                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    <tr key={`day-${dateStr}`} className="bg-gray-50/80 dark:bg-zinc-800/30">
                      <td colSpan={8} className="px-4 py-2 text-xs text-gray-500 dark:text-zinc-400">
                        Neste dia você gastou <span className="font-semibold text-gray-700 dark:text-zinc-200">{formatCurrency(dayTotal)}</span>
                      </td>
                    </tr>
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== DIALOG ===== */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingId ? "Editar Conta" : "Nova Despesa"}>
        <div className="space-y-4">
          <div>
            <Label className="font-semibold">Descrição *</Label>
            <Input value={fDescription} onChange={(e) => setFDescription(e.target.value)} className="mt-1" placeholder="Ex: Luz de Janeiro, Cartão Nubank..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Valor *</Label>
              <Input value={fAmount} onChange={(e) => setFAmount(e.target.value)} className="mt-1" placeholder="0,00" />
            </div>
            <div>
              <Label className="font-semibold">Vencimento *</Label>
              <Input type="date" value={fDueDate} onChange={(e) => setFDueDate(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Categoria</Label>
              <div className="relative mt-1">
                <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}
                  className="flex h-10 w-full appearance-none rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 py-2 px-3 pr-8 text-sm text-gray-900 dark:text-zinc-100">
                  {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
              </div>
            </div>
            <div>
              <Label className="font-semibold">Conta</Label>
              <Input value={fSupplier} onChange={(e) => setFSupplier(e.target.value)} className="mt-1" placeholder="Ex: Santander, Nubank..." />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <div onClick={() => setFRecurring(!fRecurring)}
              className={`relative h-5 w-10 cursor-pointer rounded-full transition-colors ${fRecurring ? "bg-primary" : "bg-gray-200 dark:bg-zinc-700"}`}>
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${fRecurring ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-gray-800 dark:text-zinc-200">Conta recorrente (mensal)</span>
          </label>

          <div>
            <Label className="font-semibold">Observações</Label>
            <Textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} className="mt-1" placeholder="Anotações adicionais..." rows={2} />
          </div>

          <Button onClick={handleSubmit} disabled={!isFormValid} className="h-11 w-full bg-primary text-sm font-semibold hover:bg-primary/90 disabled:opacity-40">
            {editingId ? "Salvar Alterações" : "Cadastrar Conta"}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

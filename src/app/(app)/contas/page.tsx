"use client"

import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus, Trash2, Search, ChevronLeft, ChevronRight, ChevronDown,
  DollarSign, Clock, AlertTriangle, CheckCircle2, CreditCard,
  Pencil, Undo2, Copy, Calendar, Package, User, Building2,
  PieChart as PieChartIcon, TrendingUp, ArrowDownCircle, Receipt, Landmark, Settings
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { useTheme } from "@/lib/theme-provider"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label as RechartsLabel } from "recharts"

type StatusFilter = "todas" | "vence_hoje" | "pendentes" | "atrasadas" | "pagas"
type TypeFilter = "todas" | "pessoal" | "empresa"

const CATEGORIES = [
  "Aluguel", "Energia", "Água", "Internet", "Telefone/Celular",
  "Salários", "Combustível", "Material", "Marketing",
  "Impostos", "SEGURO", "Outros",
]

const CATEGORY_COLORS: Record<string, string> = {
  "Aluguel": "#ef4444",
  "Energia": "#f59e0b",
  "Água": "#3b82f6",
  "Internet": "#8b5cf6",
  "Telefone/Celular": "#22c55e",
  "Salários": "#10b981",
  "Combustível": "#f97316",
  "Material": "#06b6d4",
  "Marketing": "#84cc16",
  "Impostos": "#dc2626",
  "SEGURO": "#a855f7",
  "Outros": "#71717a",
}

export default function ContasPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todas")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [showAllMonths, setShowAllMonths] = useState(false)

  // Caixa state
  const [caixaInicial, setCaixaInicial] = useState<number | null>(null)
  const [caixaInput, setCaixaInput] = useState("")
  const [caixaDialogOpen, setCaixaDialogOpen] = useState(false)
  const [dashboardData, setDashboardData] = useState<any>(null)

  // Current month navigation
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())

  // Form state
  const [fAccountType, setFAccountType] = useState("PESSOAL")
  const [fDescription, setFDescription] = useState("")
  const [fSupplier, setFSupplier] = useState("")
  const [fPixKey, setFPixKey] = useState("")
  const [fAmount, setFAmount] = useState("0,00")
  const [fDueDate, setFDueDate] = useState(() => new Date().toISOString().split("T")[0])
  const [fCategory, setFCategory] = useState("Outros")
  const [fRecurring, setFRecurring] = useState(false)
  const [fNotes, setFNotes] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  const fetchExpenses = async () => {
    const res = await fetch("/api/expenses")
    const data = await res.json()
    setExpenses(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    fetchExpenses()
    // Load caixa inicial from localStorage
    const saved = localStorage.getItem("caixaInicial")
    if (saved) setCaixaInicial(parseFloat(saved))
    // Load dashboard data
    fetch("/api/dashboard").then(r => r.json()).then(d => setDashboardData(d)).catch(() => {})
  }, [])

  const saveCaixaInicial = () => {
    const val = parseFloat(caixaInput.replace(/\./g, "").replace(",", ".")) || 0
    setCaixaInicial(val)
    localStorage.setItem("caixaInicial", val.toString())
    setCaixaDialogOpen(false)
    setCaixaInput("")
  }

  const resetForm = () => {
    setFAccountType("PESSOAL"); setFDescription(""); setFSupplier("")
    setFPixKey(""); setFAmount("0,00"); setFDueDate(new Date().toISOString().split("T")[0])
    setFCategory("Outros"); setFRecurring(false); setFNotes(""); setEditingId(null)
  }

  const openNewDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (exp: any) => {
    setEditingId(exp.id)
    setFAccountType(exp.accountType || "PESSOAL")
    setFDescription(exp.description || "")
    setFSupplier(exp.supplier || "")
    setFPixKey(exp.pixKey || "")
    setFAmount(exp.amount?.toFixed(2).replace(".", ",") || "0,00")
    setFDueDate(exp.dueDate ? new Date(exp.dueDate).toISOString().split("T")[0] : "")
    setFCategory(exp.category || "Outros")
    setFRecurring(exp.recurring || false)
    setFNotes(exp.notes || "")
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const amount = parseFloat(fAmount.replace(/\./g, "").replace(",", ".")) || 0
      if (amount <= 0) return alert("Valor deve ser maior que zero")
      if (!fDescription.trim()) return alert("Nome da conta é obrigatório")

      const payload = {
        description: fDescription,
        supplier: fSupplier || undefined,
        pixKey: fPixKey || undefined,
        accountType: fAccountType,
        amount,
        category: fCategory,
        dueDate: fDueDate,
        recurring: fRecurring,
        notes: fNotes || undefined,
      }

      let res
      if (editingId) {
        res = await fetch(`/api/expenses/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error("Erro ao salvar conta:", err)
        return alert("Erro ao salvar: " + (err.error || res.statusText))
      }

      setDialogOpen(false)
      resetForm()
      fetchExpenses()
    } catch (err) {
      console.error("Erro ao salvar conta:", err)
      alert("Erro de conexão ao salvar a conta")
    }
  }

  const handlePay = async (id: string) => {
    await fetch(`/api/expenses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pay" }),
    })
    fetchExpenses()
  }

  const handleUnpay = async (id: string) => {
    await fetch(`/api/expenses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unpay" }),
    })
    fetchExpenses()
  }

  const handleDelete = async (id: string) => {
    if (confirm("Excluir esta conta?")) {
      await fetch(`/api/expenses/${id}`, { method: "DELETE" })
      fetchExpenses()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Helpers
  const getExpenseStatus = (e: any) => {
    if (e.status === "PAID") return "pago"
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const due = new Date(e.dueDate)
    due.setHours(0, 0, 0, 0)
    if (due < now) return "atrasado"
    return "pendente"
  }

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }

  // Month name
  const monthName = new Date(currentYear, currentMonth).toLocaleString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase())

  // Filter by month
  const monthExpenses = useMemo(() => {
    if (showAllMonths) return expenses
    return expenses.filter(e => {
      const d = new Date(e.dueDate)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
  }, [expenses, currentMonth, currentYear, showAllMonths])

  // Stats
  const stats = useMemo(() => {
    const all = monthExpenses
    const totalMes = all.reduce((s, e) => s + e.amount, 0)
    const totalCount = all.length
    const pagas = all.filter(e => getExpenseStatus(e) === "pago")
    const pagasTotal = pagas.reduce((s, e) => s + e.amount, 0)
    const pagasCount = pagas.length
    const pendentes = all.filter(e => getExpenseStatus(e) === "pendente")
    const pendentesTotal = pendentes.reduce((s, e) => s + e.amount, 0)
    const pendentesCount = pendentes.length
    const atrasadas = all.filter(e => getExpenseStatus(e) === "atrasado")
    const atradasTotal = atrasadas.reduce((s, e) => s + e.amount, 0)
    const atradasCount = atrasadas.length
    const faltaPagar = pendentesTotal + atradasTotal
    const faltaCount = pendentesCount + atradasCount
    return { totalMes, totalCount, faltaPagar, faltaCount, pendentesTotal, pendentesCount, atradasTotal: atradasTotal, atradasCount, pagasTotal, pagasCount }
  }, [monthExpenses])

  // Category chart
  const categoryData = useMemo(() => {
    return CATEGORIES.map(cat => ({
      name: cat,
      value: monthExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
      color: CATEGORY_COLORS[cat] || "#71717a",
    })).filter(d => d.value > 0)
  }, [monthExpenses])

  // Final filtered list
  const filteredExpenses = useMemo(() => {
    let list = monthExpenses

    if (categoryFilter) {
      list = list.filter(e => e.category === categoryFilter)
    }

    if (typeFilter === "pessoal") list = list.filter(e => (e.accountType || "PESSOAL") === "PESSOAL")
    else if (typeFilter === "empresa") list = list.filter(e => (e.accountType || "PESSOAL") === "EMPRESA")

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.description?.toLowerCase().includes(q) ||
        e.supplier?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q)
      )
    }

    if (statusFilter === "vence_hoje") list = list.filter(e => isToday(e.dueDate) && getExpenseStatus(e) !== "pago")
    else if (statusFilter === "pendentes") list = list.filter(e => getExpenseStatus(e) === "pendente")
    else if (statusFilter === "atrasadas") list = list.filter(e => getExpenseStatus(e) === "atrasado")
    else if (statusFilter === "pagas") list = list.filter(e => getExpenseStatus(e) === "pago")

    return list
  }, [monthExpenses, search, statusFilter, typeFilter, categoryFilter])

  const prevMonth = () => {
    setShowAllMonths(false)
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }
  const nextMonth = () => {
    setShowAllMonths(false)
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "vence_hoje", label: "Vence Hoje" },
    { key: "pendentes", label: "Pendentes" },
    { key: "atrasadas", label: "Atrasadas" },
    { key: "pagas", label: "Pagas" },
  ]

  const isFormValid = fDescription.trim().length >= 2

  const formatDueDateShort = (dateStr: string) => {
    const d = new Date(dateStr)
    const day = d.getDate()
    const month = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "")
    return `${day} de ${month}`
  }

  const saldoAtualEmCaixa = caixaInicial !== null
    ? caixaInicial
      - (dashboardData?.capitalOnStreet || 0)
      + (dashboardData?.totalReceived || 0)
      - stats.pagasTotal
    : null

  const caixaKpis = [
    {
      title: "Capital na Rua",
      value: formatCurrency(dashboardData?.capitalOnStreet || 0),
      icon: TrendingUp,
      iconClassName: "text-sky-200",
      iconBgClassName: "bg-sky-400/15",
    },
    {
      title: "Total Recebido",
      value: formatCurrency(dashboardData?.totalReceived || 0),
      icon: DollarSign,
      iconClassName: "text-emerald-200",
      iconBgClassName: "bg-emerald-400/15",
    },
    {
      title: "Saídas do Mês",
      value: formatCurrency(stats.pagasTotal),
      icon: ArrowDownCircle,
      iconClassName: "text-amber-200",
      iconBgClassName: "bg-amber-400/15",
    },
    {
      title: "Juros Recebidos",
      value: formatCurrency(dashboardData?.financials?.pendingInterest || 0),
      icon: Receipt,
      iconClassName: "text-violet-200",
      iconBgClassName: "bg-violet-400/15",
    },
  ]

  return (
    <div className="space-y-6 pb-12">
      <section className="relative overflow-hidden rounded-[32px] border border-indigo-500/30 bg-[#0f1126] px-6 py-7 shadow-[0_24px_90px_-36px_rgba(79,70,229,0.75)] md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.3),transparent_34%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_28%),linear-gradient(135deg,#181b3a_0%,#11152f_48%,#101323_100%)]" />
        <div className="pointer-events-none absolute -left-24 top-24 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Controle de Caixa</h1>
              <p className="mt-1 text-sm font-medium text-indigo-100/80">Acompanhe o saldo disponível e o fluxo de capital</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
            <div className="rounded-[24px] border border-white/12 bg-white/[0.08] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-200/10 shadow-inner shadow-white/5">
                    <Receipt className="h-5 w-5 text-slate-100" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Caixa Inicial</p>
                  </div>
                </div>
                {caixaInicial !== null ? (
                  <button
                    onClick={() => { setCaixaInput(caixaInicial.toFixed(2).replace(".", ",")); setCaixaDialogOpen(true) }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/[0.1]"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                ) : null}
              </div>

              {caixaInicial !== null ? (
                <div>
                  <p className="text-[2.15rem] font-bold tracking-tight text-white tabular-nums">{formatCurrency(caixaInicial)}</p>
                  <p className="mt-2 text-sm text-indigo-100/75">Caixa inicial</p>
                  <p className="text-sm text-indigo-100/65">Definido em {new Date().toLocaleDateString("pt-BR")}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-indigo-100/80">Não configurado</p>
                  <button
                    onClick={() => setCaixaDialogOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
                  >
                    <Plus className="h-4 w-4" /> Configurar agora
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-indigo-300/20 bg-[linear-gradient(180deg,rgba(133,92,248,0.2),rgba(72,52,145,0.12))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-300/10 shadow-inner shadow-white/5">
                  <Landmark className="h-5 w-5 text-emerald-300" />
                </div>
                <p className="text-sm font-semibold text-white">Saldo Atual em Caixa</p>
              </div>

              {caixaInicial !== null && saldoAtualEmCaixa !== null ? (
                <div>
                  <p className="mb-5 text-[2.2rem] font-bold tracking-tight text-emerald-400 tabular-nums">{formatCurrency(saldoAtualEmCaixa)}</p>
                  <div className="space-y-2.5 border-t border-white/10 pt-3.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-indigo-100/75">Caixa inicial</span>
                      <span className="font-semibold text-white tabular-nums">{formatCurrency(caixaInicial)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-indigo-100/75">Capital na rua</span>
                      <span className="font-semibold text-rose-300 tabular-nums">− {formatCurrency(dashboardData?.capitalOnStreet || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-indigo-100/75">Entradas (parcelas pagas)</span>
                      <span className="font-semibold text-emerald-300 tabular-nums">+ {formatCurrency(dashboardData?.totalReceived || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-indigo-100/75">Saídas (despesas do mês)</span>
                      <span className="font-semibold text-amber-300 tabular-nums">− {formatCurrency(stats.pagasTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                      <span className="font-semibold text-white">Saldo</span>
                      <span className="font-bold text-emerald-400 tabular-nums">{formatCurrency(saldoAtualEmCaixa)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-indigo-100/75">Configure o caixa inicial para ver o saldo</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {caixaKpis.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="rounded-[20px] border border-white/10 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-md"
                >
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBgClassName}`}>
                    <Icon className={`h-5 w-5 ${item.iconClassName}`} />
                  </div>
                  <p className="text-sm font-medium text-indigo-100/75">{item.title}</p>
                  <p className="mt-1 text-[1.7rem] font-bold tracking-tight text-white tabular-nums">{item.value}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===== EXPENSE CARDS ===== */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-zinc-400">Carregando...</div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500">
          <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-500 dark:text-zinc-400" />
          <p className="text-sm">Nenhuma conta encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExpenses.map((exp) => {
            const status = getExpenseStatus(exp)
            const isPaid = status === "pago"
            const isOverdue = status === "atrasado"
            const isEmpresa = (exp.accountType || "PESSOAL") === "EMPRESA"

            // Card gradient bg
            const cardBg = isPaid
              ? "bg-gradient-to-br from-emerald-600/90 to-emerald-700/80 border-emerald-500/50"
              : isOverdue
              ? "bg-gradient-to-br from-red-600/90 to-red-700/80 border-red-500/50"
              : "bg-gradient-to-br from-gray-100/90 to-white/80 border-gray-300 dark:border-zinc-700"

            return (
              <div key={exp.id} className={`rounded-xl border ${cardBg} p-4 space-y-3 relative overflow-hidden`}>
                {/* Header: icon + name + badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-white dark:bg-zinc-900/10 flex items-center justify-center">
                      <Package className="h-4 w-4 text-white/80" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{exp.description}</p>
                      {exp.supplier && <p className="text-xs text-white/60">{exp.supplier}</p>}
                    </div>
                  </div>
                  <Badge className={`text-xs ${
                    isPaid ? "bg-emerald-50 dark:bg-emerald-950/300/20 text-emerald-100 border-emerald-400/30"
                    : isOverdue ? "bg-red-400/20 text-red-100 border-red-400/30"
                    : "bg-amber-400/20 text-amber-100 border-amber-400/30"
                  }`}>
                    {isPaid ? "Pago" : isOverdue ? "Atrasado" : "Pendente"}
                  </Badge>
                </div>

                {/* Amount + due date */}
                <div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(exp.amount)}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-white/70">
                      <Calendar className="h-3 w-3" />
                      Vence {formatDueDateShort(exp.dueDate)}
                    </span>
                    {/* Type badges (oculto) */}
                    {exp.recurring && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-emerald-50 dark:bg-emerald-950/300/20 text-emerald-200 border-emerald-400/30">
                        ↻ Recorrente
                      </Badge>
                    )}
                  </div>
                </div>

                {/* PIX key box */}
                {exp.pixKey && (
                  <div className="rounded-lg bg-white dark:bg-zinc-900/10 p-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-white/50 uppercase tracking-wide font-medium">CHAVE PIX</p>
                      <p className="text-xs text-white/80 mt-0.5">{exp.pixKey}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(exp.pixKey)}
                      className="p-1.5 rounded-md hover:bg-white dark:bg-zinc-900/10 transition"
                    >
                      <Copy className="h-3.5 w-3.5 text-white/60" />
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {isPaid ? (
                    <>
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/300/20 text-emerald-100 text-sm font-medium hover:bg-emerald-50 dark:bg-emerald-950/300/30 transition"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pago
                      </button>
                      <button
                        onClick={() => handleUnpay(exp.id)}
                        className="h-9 w-9 rounded-lg bg-white dark:bg-zinc-900/10 flex items-center justify-center hover:bg-white dark:bg-zinc-900/20 transition"
                      >
                        <Undo2 className="h-3.5 w-3.5 text-white/60" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handlePay(exp.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition ${
                        isOverdue
                          ? "bg-white dark:bg-zinc-900/20 text-white hover:bg-white dark:bg-zinc-900/30"
                          : "bg-emerald-50 dark:bg-emerald-950/300/20 text-emerald-100 hover:bg-emerald-50 dark:bg-emerald-950/300/30"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Pagar
                    </button>
                  )}
                  <button
                    onClick={() => openEditDialog(exp)}
                    className="h-9 w-9 rounded-lg bg-white dark:bg-zinc-900/10 flex items-center justify-center hover:bg-white dark:bg-zinc-900/20 transition"
                  >
                    <Pencil className="h-3.5 w-3.5 text-white/60" />
                  </button>
                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="h-9 w-9 rounded-lg bg-white dark:bg-zinc-900/10 flex items-center justify-center hover:bg-white dark:bg-zinc-900/20 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-300" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== ADICIONAR NOVA CONTA DIALOG ===== */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingId ? "Editar Conta" : "Adicionar Nova Conta"}>
        <div className="space-y-5">
          {/* Tipo de Conta (oculto) */}

          {/* Nome da Conta */}
          <div>
            <Label className="font-semibold">Nome da Conta *</Label>
            <Input
              value={fDescription}
              onChange={(e) => setFDescription(e.target.value)}
              className="mt-1"
              placeholder="Ex: Luz de Janeiro, Cartão Nubank..."
            />
          </div>

          {/* Fornecedor */}
          <div>
            <Label className="font-semibold">Fornecedor/Empresa *</Label>
            <Input
              value={fSupplier}
              onChange={(e) => setFSupplier(e.target.value)}
              className="mt-1"
              placeholder="Ex: CEMIG, Vivo, Nubank..."
            />
          </div>

          {/* Chave PIX */}
          <div>
            <Label className="font-semibold">Chave PIX do Fornecedor (opcional)</Label>
            <Input
              value={fPixKey}
              onChange={(e) => setFPixKey(e.target.value)}
              className="mt-1"
              placeholder="CPF, CNPJ, E-mail, Telefone ou Chave Aleatória"
            />
            <p className="text-xs text-amber-600/80 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              A chave PIX será incluída nos lembretes. Verifique se está correta — a responsabilidade é sua.
            </p>
          </div>

          {/* Valor + Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Valor *</Label>
              <Input
                value={fAmount}
                onChange={(e) => setFAmount(e.target.value)}
                className="mt-1"
                placeholder="0,00"
              />
            </div>
            <div>
              <Label className="font-semibold">Vencimento *</Label>
              <Input
                type="date"
                value={fDueDate}
                onChange={(e) => setFDueDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <Label className="font-semibold">Categoria</Label>
            <div className="relative mt-1">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
              <select
                value={fCategory}
                onChange={(e) => setFCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 pl-9 pr-8 py-2 text-sm text-gray-900 dark:text-zinc-100 appearance-none"
              >
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* Recorrente */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setFRecurring(!fRecurring)}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                fRecurring ? "bg-emerald-50 dark:bg-emerald-950/300" : "bg-gray-200 dark:bg-zinc-700"
              }`}
            >
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white dark:bg-zinc-900 transition-transform ${
                fRecurring ? "translate-x-5" : "translate-x-0.5"
              }`} />
            </div>
            <span className="text-sm text-gray-800 dark:text-zinc-200">Conta recorrente (mensal)</span>
          </label>

          {/* Observações */}
          <div>
            <Label className="font-semibold">Observações</Label>
            <Textarea
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              className="mt-1"
              placeholder="Anotações adicionais..."
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 text-sm font-semibold disabled:opacity-40"
          >
            {editingId ? "Salvar Alterações" : "Cadastrar Conta"}
          </Button>
        </div>
      </Dialog>

      {/* ===== CAIXA INICIAL DIALOG ===== */}
      <Dialog open={caixaDialogOpen} onClose={() => setCaixaDialogOpen(false)} title="Configurar Caixa Inicial">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Informe o valor que você tinha em caixa ao começar. O saldo será calculado automaticamente.
          </p>
          <div>
            <Label className="font-semibold">Valor do Caixa Inicial</Label>
            <Input
              value={caixaInput}
              onChange={(e) => setCaixaInput(e.target.value)}
              className="mt-1"
              placeholder="0,00"
            />
          </div>
          <Button onClick={saveCaixaInicial} className="w-full bg-emerald-600 hover:bg-emerald-700">
            Salvar
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

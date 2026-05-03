"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus, Trash2, Search, ChevronLeft, ChevronRight, ChevronDown,
  CheckCircle2, CreditCard, Pencil, Undo2,
  Calendar, Package, Receipt,
  Filter,
} from "lucide-react"
import { formatCurrency, localDateStr } from "@/lib/utils"

type StatusFilter = "todas" | "vence_hoje" | "pendentes" | "atrasadas" | "pagas"

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

export default function DespesasPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [showAllMonths, setShowAllMonths] = useState(false)

  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())

  const [fDescription, setFDescription] = useState("")
  const [fAmount, setFAmount] = useState("0,00")
  const [fDueDate, setFDueDate] = useState(() => localDateStr())
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
  }, [])

  const resetForm = () => {
    setFDescription("")
    setFAmount("0,00"); setFDueDate(localDateStr())
    setFCategory("Outros"); setFRecurring(false); setFNotes(""); setEditingId(null)
  }

  const openNewDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (exp: any) => {
    setEditingId(exp.id)
    setFDescription(exp.description || "")
    setFAmount(exp.amount?.toFixed(2).replace(".", ",") || "0,00")
    setFDueDate(exp.dueDate ? localDateStr(exp.dueDate) : "")
    setFCategory(exp.category || "Outros")
    setFRecurring(exp.recurring || false)
    setFNotes(exp.notes || "")
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const amount = parseFloat(fAmount.replace(/\./g, "").replace(",", ".")) || 0
      if (amount <= 0) return alert("Valor deve ser maior que zero")
      if (!fDescription.trim()) return alert("Descricao e obrigatoria")

      const payload = {
        description: fDescription,
        accountType: "EMPRESA",
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

  const getExpenseStatus = (expense: any) => {
    if (expense.status === "PAID") return "pago"
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const due = new Date(expense.dueDate)
    due.setHours(0, 0, 0, 0)
    if (due < now) return "atrasado"
    return "pendente"
  }

  const isToday = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
  }

  const monthName = new Date(currentYear, currentMonth).toLocaleString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^./, (char) => char.toUpperCase())

  const monthExpenses = useMemo(() => {
    if (showAllMonths) return expenses
    return expenses.filter((expense) => {
      const date = new Date(expense.dueDate)
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear
    })
  }, [expenses, currentMonth, currentYear, showAllMonths])

  const stats = useMemo(() => {
    const all = monthExpenses
    const totalMes = all.reduce((sum, expense) => sum + expense.amount, 0)
    const totalCount = all.length
    const pagas = all.filter((expense) => getExpenseStatus(expense) === "pago")
    const pagasTotal = pagas.reduce((sum, expense) => sum + expense.amount, 0)
    const pagasCount = pagas.length
    const pendentes = all.filter((expense) => getExpenseStatus(expense) === "pendente")
    const pendentesTotal = pendentes.reduce((sum, expense) => sum + expense.amount, 0)
    const pendentesCount = pendentes.length
    const atrasadas = all.filter((expense) => getExpenseStatus(expense) === "atrasado")
    const atradasTotal = atrasadas.reduce((sum, expense) => sum + expense.amount, 0)
    const atradasCount = atrasadas.length
    const faltaPagar = pendentesTotal + atradasTotal
    const faltaCount = pendentesCount + atradasCount
    return { totalMes, totalCount, faltaPagar, faltaCount, pendentesTotal, pendentesCount, atradasTotal, atradasCount, pagasTotal, pagasCount }
  }, [monthExpenses])

  const categoryData = useMemo(() => {
    return CATEGORIES.map((category) => ({
      name: category,
      value: monthExpenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0),
      color: CATEGORY_COLORS[category] || "#71717a",
    })).filter((item) => item.value > 0)
  }, [monthExpenses])

  const filteredExpenses = useMemo(() => {
    let list = monthExpenses

    if (categoryFilter) {
      list = list.filter((expense) => expense.category === categoryFilter)
    }

    if (search.trim()) {
      const query = search.toLowerCase()
      list = list.filter((expense) =>
        expense.description?.toLowerCase().includes(query) ||
        expense.category?.toLowerCase().includes(query)
      )
    }

    if (statusFilter === "vence_hoje") list = list.filter((expense) => isToday(expense.dueDate) && getExpenseStatus(expense) !== "pago")
    else if (statusFilter === "pendentes") list = list.filter((expense) => getExpenseStatus(expense) === "pendente")
    else if (statusFilter === "atrasadas") list = list.filter((expense) => getExpenseStatus(expense) === "atrasado")
    else if (statusFilter === "pagas") list = list.filter((expense) => getExpenseStatus(expense) === "pago")

    return [...list].sort((left, right) => {
      const leftCreatedAt = left.createdAt ? new Date(left.createdAt).getTime() : 0
      const rightCreatedAt = right.createdAt ? new Date(right.createdAt).getTime() : 0

      if (leftCreatedAt !== rightCreatedAt) {
        return rightCreatedAt - leftCreatedAt
      }

      return new Date(right.dueDate).getTime() - new Date(left.dueDate).getTime()
    })
  }, [monthExpenses, search, statusFilter, categoryFilter])

  const prevMonth = () => {
    setShowAllMonths(false)
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((year) => year - 1)
    } else {
      setCurrentMonth((month) => month - 1)
    }
  }

  const nextMonth = () => {
    setShowAllMonths(false)
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((year) => year + 1)
    } else {
      setCurrentMonth((month) => month + 1)
    }
  }

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: "todas", label: "Todas" },
    { value: "vence_hoje", label: "Vence Hoje" },
    { value: "pendentes", label: "Pendentes" },
    { value: "atrasadas", label: "Atrasadas" },
    { value: "pagas", label: "Pagas" },
  ]

  const isFormValid = fDescription.trim().length >= 2
  const monthLabels = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
  const sortedCategoryData = useMemo(() => [...categoryData].sort((left, right) => right.value - left.value), [categoryData])
  const maxCategoryValue = sortedCategoryData[0]?.value || 1

  return (
    <div className="space-y-6 pt-6 pb-12">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr_0.9fr]">
        <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">Período</p>
              <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-zinc-100">Despesas</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">Controle mensal de lançamentos, categorias e contas pagas.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAllMonths((current) => !current)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                showAllMonths
                  ? "bg-fuchsia-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {showAllMonths ? "Todos os períodos" : "Mês atual"}
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={prevMonth}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">{showAllMonths ? "Todos os períodos" : monthName}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-zinc-100">{currentYear}</p>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {monthLabels.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setShowAllMonths(false)
                    setCurrentMonth(index)
                  }}
                  className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                    !showAllMonths && currentMonth === index
                      ? "bg-fuchsia-600 text-white shadow-sm"
                      : "bg-white text-gray-500 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">Resumo do período</p>
          <div className="mt-5 rounded-[24px] border border-fuchsia-100 bg-fuchsia-50/60 p-5 dark:border-fuchsia-950/40 dark:bg-fuchsia-950/10">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-fuchsia-600 shadow-sm dark:bg-zinc-900 dark:text-fuchsia-300">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">Total em despesas</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(stats.totalMes)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">Pendentes</p>
              <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(stats.faltaPagar)}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{stats.faltaCount} conta(s) aguardando pagamento</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">Pagas</p>
              <p className="mt-1 text-xl font-bold text-primary dark:text-primary">{formatCurrency(stats.pagasTotal)}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{stats.pagasCount} lançamento(s) concluídos</p>
            </div>
          </div>

          <Button onClick={openNewDialog} className="mt-5 w-full bg-primary text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Nova Despesa
          </Button>
        </section>

        <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">Distribuição</p>
              <h2 className="mt-2 text-lg font-bold text-gray-900 dark:text-zinc-100">Despesa por Categoria</h2>
            </div>
            <Badge className="border-0 bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/30 dark:text-fuchsia-300">{sortedCategoryData.length} categorias</Badge>
          </div>

          <div className="mt-5 space-y-4">
            {sortedCategoryData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                Nenhuma despesa no período para categorizar.
              </div>
            ) : (
              sortedCategoryData.map((item) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-700 dark:text-zinc-300">{item.name}</span>
                    <span className="tabular-nums text-gray-500 dark:text-zinc-400">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 dark:bg-zinc-800">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500"
                      style={{ width: `${Math.max((item.value / maxCategoryValue) * 100, 8)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-5 border-b border-gray-200 px-5 py-5 dark:border-zinc-800 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">Lançamentos</p>
            <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-zinc-100">Tabela de Despesas</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{filteredExpenses.length} resultado(s) encontrados neste filtro.</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40 xl:min-w-[640px]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar despesa"
                className="h-11 rounded-xl border-gray-200 bg-white pl-10 shadow-none dark:border-zinc-700 dark:bg-zinc-900"
              />
              </div>

              <div className="flex flex-wrap gap-3 lg:flex-nowrap lg:justify-end">
                <FilterDropdown
                  label="Filtros"
                  icon={<Filter className="h-4 w-4" />}
                  tone="emerald"
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as StatusFilter)}
                  options={statusFilters}
                  minWidthClassName="min-w-[190px]"
                />

                <FilterDropdown
                  label="Categoria"
                  icon={<Package className="h-4 w-4" />}
                  tone="orange"
                  value={categoryFilter || "__all__"}
                  onChange={(value) => setCategoryFilter(value === "__all__" ? "" : value)}
                  options={[{ value: "__all__", label: "Todas categorias" }, ...CATEGORIES.map((cat) => ({ value: cat, label: cat }))]}
                  minWidthClassName="min-w-[220px]"
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-gray-500 dark:text-zinc-400">Carregando despesas...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400 dark:text-zinc-500">
            <CreditCard className="mx-auto mb-3 h-12 w-12 text-gray-400 dark:text-zinc-500" />
            <p className="text-sm">Nenhuma despesa encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto px-5 py-5">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm text-gray-500 dark:text-zinc-400">
                  <th className="px-4 py-2 font-semibold">Data</th>
                  <th className="px-4 py-2 font-semibold">Descrição</th>
                  <th className="px-4 py-2 font-semibold">Valor</th>
                  <th className="px-4 py-2 font-semibold">Categoria</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp) => {
                  const status = getExpenseStatus(exp)
                  const isPaid = status === "pago"
                  const isOverdue = status === "atrasado"

                  return (
                    <tr key={exp.id} className="rounded-2xl bg-gray-50 text-sm shadow-sm dark:bg-zinc-950/40">
                      <td className="rounded-l-2xl px-4 py-4 text-gray-600 dark:text-zinc-300">{new Date(exp.dueDate).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/30 dark:text-fuchsia-300">
                            <Package className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-zinc-100">{exp.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-bold tabular-nums text-fuchsia-700 dark:text-fuchsia-300">{formatCurrency(exp.amount)}</td>
                      <td className="px-4 py-4 text-gray-700 dark:text-zinc-300">{exp.category}</td>
                      <td className="px-4 py-4">
                        <Badge className={`border-0 ${
                          isPaid
                            ? "bg-primary/5 text-primary dark:bg-primary/15 dark:text-primary"
                            : isOverdue
                              ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                        }`}>
                          {isPaid ? "Pago" : isOverdue ? "Atrasado" : "Pendente"}
                        </Badge>
                      </td>
                      <td className="rounded-r-2xl px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {isPaid ? (
                            <button
                              onClick={() => handleUnpay(exp.id)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              Reabrir
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePay(exp.id)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary/90"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Pagar
                            </button>
                          )}
                          <button
                            onClick={() => openEditDialog(exp)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingId ? "Editar Conta" : "Adicionar Nova Conta"}>
        <div className="space-y-5">
          <div>
            <Label className="font-semibold">Descricao *</Label>
            <Input
              value={fDescription}
              onChange={(e) => setFDescription(e.target.value)}
              className="mt-1"
              placeholder="Ex: Luz de Janeiro, Cartão Nubank..."
            />
          </div>

          <div>
            <Label className="font-semibold">Valor *</Label>
            <Input
              value={fAmount}
              onChange={(e) => setFAmount(e.target.value)}
              className="mt-1"
              placeholder="0,00"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="font-semibold">Vencimento *</Label>
              <Input
                type="date"
                value={fDueDate}
                onChange={(e) => setFDueDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-semibold">Tipo de Conta</Label>
              <div className="mt-1 flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                Empresa
              </div>
            </div>
          </div>

          <div>
            <Label className="font-semibold">Categoria</Label>
            <div className="relative mt-1">
              <Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
              <select
                value={fCategory}
                onChange={(e) => setFCategory(e.target.value)}
                className="flex h-10 w-full appearance-none rounded-md border border-gray-300 bg-gray-50 py-2 pl-9 pr-8 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <div
              onClick={() => setFRecurring(!fRecurring)}
              className={`relative h-5 w-10 cursor-pointer rounded-full transition-colors ${
                fRecurring ? "bg-primary/5 dark:bg-primary/150" : "bg-gray-200 dark:bg-zinc-700"
              }`}
            >
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform dark:bg-zinc-900 ${
                fRecurring ? "translate-x-5" : "translate-x-0.5"
              }`} />
            </div>
            <span className="text-sm text-gray-800 dark:text-zinc-200">Conta recorrente (mensal)</span>
          </label>

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

          <Button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="h-11 w-full bg-primary text-sm font-semibold hover:bg-primary/90 disabled:opacity-40"
          >
            {editingId ? "Salvar Alterações" : "Cadastrar Conta"}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
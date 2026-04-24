"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus, Trash2, Search, ChevronDown, DollarSign, AlertTriangle,
  CheckCircle2, CreditCard, Pencil, Undo2, Copy, Calendar,
  Package, TrendingUp, ArrowDownCircle, Receipt, Landmark,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type StatusFilter = "todas" | "vence_hoje" | "pendentes" | "atrasadas" | "pagas"
type TypeFilter = "todas" | "pessoal" | "empresa"

const CATEGORIES = [
  "Aluguel", "Energia", "Água", "Internet", "Telefone/Celular",
  "Salários", "Combustível", "Material", "Marketing",
  "Impostos", "SEGURO", "Outros",
]

export default function ContasPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todas")
  const [categoryFilter, setCategoryFilter] = useState("")

  const [caixaInicial, setCaixaInicial] = useState<number | null>(null)
  const [caixaInput, setCaixaInput] = useState("")
  const [caixaDialogOpen, setCaixaDialogOpen] = useState(false)
  const [dashboardData, setDashboardData] = useState<any>(null)

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

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
    const saved = localStorage.getItem("caixaInicial")
    if (saved) setCaixaInicial(parseFloat(saved))
    fetch("/api/dashboard").then((response) => response.json()).then((data) => setDashboardData(data)).catch(() => {})
  }, [])

  const saveCaixaInicial = () => {
    const value = parseFloat(caixaInput.replace(/\./g, "").replace(",", ".")) || 0
    setCaixaInicial(value)
    localStorage.setItem("caixaInicial", value.toString())
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

  const openEditDialog = (expense: any) => {
    setEditingId(expense.id)
    setFAccountType(expense.accountType || "PESSOAL")
    setFDescription(expense.description || "")
    setFSupplier(expense.supplier || "")
    setFPixKey(expense.pixKey || "")
    setFAmount(expense.amount?.toFixed(2).replace(".", ",") || "0,00")
    setFDueDate(expense.dueDate ? new Date(expense.dueDate).toISOString().split("T")[0] : "")
    setFCategory(expense.category || "Outros")
    setFRecurring(expense.recurring || false)
    setFNotes(expense.notes || "")
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

      let response
      if (editingId) {
        response = await fetch(`/api/expenses/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        console.error("Erro ao salvar conta:", err)
        return alert("Erro ao salvar: " + (err.error || response.statusText))
      }

      setDialogOpen(false)
      resetForm()
      fetchExpenses()
    } catch (error) {
      console.error("Erro ao salvar conta:", error)
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

  const monthExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const date = new Date(expense.dueDate)
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear
    })
  }, [expenses, currentMonth, currentYear])

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

  const filteredExpenses = useMemo(() => {
    let list = monthExpenses

    if (categoryFilter) {
      list = list.filter((expense) => expense.category === categoryFilter)
    }

    if (typeFilter === "pessoal") list = list.filter((expense) => (expense.accountType || "PESSOAL") === "PESSOAL")
    else if (typeFilter === "empresa") list = list.filter((expense) => (expense.accountType || "PESSOAL") === "EMPRESA")

    if (search.trim()) {
      const query = search.toLowerCase()
      list = list.filter((expense) =>
        expense.description?.toLowerCase().includes(query) ||
        expense.supplier?.toLowerCase().includes(query) ||
        expense.category?.toLowerCase().includes(query)
      )
    }

    if (statusFilter === "vence_hoje") list = list.filter((expense) => isToday(expense.dueDate) && getExpenseStatus(expense) !== "pago")
    else if (statusFilter === "pendentes") list = list.filter((expense) => getExpenseStatus(expense) === "pendente")
    else if (statusFilter === "atrasadas") list = list.filter((expense) => getExpenseStatus(expense) === "atrasado")
    else if (statusFilter === "pagas") list = list.filter((expense) => getExpenseStatus(expense) === "pago")

    return list
  }, [monthExpenses, search, statusFilter, typeFilter, categoryFilter])

  const isFormValid = fDescription.trim().length >= 2

  const formatDueDateShort = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = date.getDate()
    const month = date.toLocaleString("pt-BR", { month: "short" }).replace(".", "")
    return `${day} de ${month}`
  }

  const saldoAtualEmCaixa = caixaInicial !== null
    ? caixaInicial - (dashboardData?.capitalOnStreet || 0) + (dashboardData?.totalReceived || 0) - stats.pagasTotal
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
    <div className="space-y-8 pb-12">
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
        <section className="relative w-full max-w-6xl overflow-hidden rounded-[32px] border border-gray-200 bg-white px-6 py-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.1),transparent_34%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_28%)]" />
          <div className="pointer-events-none absolute -left-24 top-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

          <div className="relative space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">Controle de Caixa</h1>
                <p className="mt-1 text-sm font-medium text-gray-500 dark:text-zinc-400">Acompanhe o saldo disponível e o fluxo de capital</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
              <div className="rounded-[24px] border border-gray-200 bg-white/90 p-5 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                      <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Caixa Inicial</p>
                    </div>
                  </div>
                  {caixaInicial !== null ? (
                    <button
                      onClick={() => {
                        setCaixaInput(caixaInicial.toFixed(2).replace(".", ","))
                        setCaixaDialogOpen(true)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                  ) : null}
                </div>

                {caixaInicial !== null ? (
                  <div>
                    <p className="text-[2.15rem] font-bold tracking-tight text-gray-900 dark:text-zinc-100 tabular-nums">{formatCurrency(caixaInicial)}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">Caixa inicial</p>
                    <p className="text-sm text-gray-400 dark:text-zinc-500">Definido em {new Date().toLocaleDateString("pt-BR")}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">Não configurado</p>
                    <button
                      onClick={() => setCaixaDialogOpen(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                    >
                      <Plus className="h-4 w-4" /> Configurar agora
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-emerald-200/80 bg-emerald-50/50 p-5 shadow-sm backdrop-blur-md dark:border-emerald-900/40 dark:bg-emerald-950/10">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-white/80 dark:border-emerald-900/40 dark:bg-zinc-900/60">
                    <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Saldo Atual em Caixa</p>
                </div>

                {caixaInicial !== null && saldoAtualEmCaixa !== null ? (
                  <div>
                    <p className="mb-5 text-[2.2rem] font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(saldoAtualEmCaixa)}</p>
                    <div className="space-y-2.5 border-t border-gray-200 pt-3.5 text-sm dark:border-zinc-800">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-zinc-400">Caixa inicial</span>
                        <span className="font-semibold text-gray-900 dark:text-zinc-100 tabular-nums">{formatCurrency(caixaInicial)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-zinc-400">Capital na rua</span>
                        <span className="font-semibold text-orange-500 dark:text-orange-400 tabular-nums">− {formatCurrency(dashboardData?.capitalOnStreet || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-zinc-400">Entradas (parcelas pagas)</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">+ {formatCurrency(dashboardData?.totalReceived || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-zinc-400">Saídas (despesas do mês)</span>
                        <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">− {formatCurrency(stats.pagasTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-3 dark:border-zinc-800">
                        <span className="font-semibold text-gray-900 dark:text-zinc-100">Saldo</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(saldoAtualEmCaixa)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Configure o caixa inicial para ver o saldo</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {caixaKpis.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.title}
                    className="rounded-[20px] border border-gray-200 bg-white/90 p-4 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBgClassName}`}>
                      <Icon className={`h-5 w-5 ${item.iconClassName}`} />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">{item.title}</p>
                    <p className="mt-1 text-[1.7rem] font-bold tracking-tight text-gray-900 dark:text-zinc-100 tabular-nums">{item.value}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500 dark:text-zinc-400">Carregando...</div>
      ) : filteredExpenses.length === 0 ? (
        <div className="py-12 text-center text-gray-400 dark:text-zinc-500">
          <CreditCard className="mx-auto mb-3 h-12 w-12 text-gray-500 dark:text-zinc-400" />
          <p className="text-sm">Nenhuma conta encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredExpenses.map((expense) => {
            const status = getExpenseStatus(expense)
            const isPaid = status === "pago"
            const isOverdue = status === "atrasado"

            const cardBg = isPaid
              ? "bg-gradient-to-br from-emerald-600/90 to-emerald-700/80 border-emerald-500/50"
              : isOverdue
                ? "bg-gradient-to-br from-red-600/90 to-red-700/80 border-red-500/50"
                : "bg-gradient-to-br from-gray-100/90 to-white/80 border-gray-300 dark:border-zinc-700"

            return (
              <div key={expense.id} className={`relative overflow-hidden rounded-xl border ${cardBg} p-4 space-y-3`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-zinc-900/10">
                      <Package className="h-4 w-4 text-white/80" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{expense.description}</p>
                      {expense.supplier && <p className="text-xs text-white/60">{expense.supplier}</p>}
                    </div>
                  </div>
                  <Badge className={`text-xs ${
                    isPaid ? "border-emerald-400/30 bg-emerald-50 text-emerald-100 dark:bg-emerald-950/300/20"
                    : isOverdue ? "bg-red-400/20 text-red-100 border-red-400/30"
                    : "bg-amber-400/20 text-amber-100 border-amber-400/30"
                  }`}>
                    {isPaid ? "Pago" : isOverdue ? "Atrasado" : "Pendente"}
                  </Badge>
                </div>

                <div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(expense.amount)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-white/70">
                      <Calendar className="h-3 w-3" />
                      Vence {formatDueDateShort(expense.dueDate)}
                    </span>
                    {expense.recurring && (
                      <Badge className="border-emerald-400/30 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-200 dark:bg-emerald-950/300/20">
                        ↻ Recorrente
                      </Badge>
                    )}
                  </div>
                </div>

                {expense.pixKey && (
                  <div className="flex items-center justify-between rounded-lg bg-white p-2.5 dark:bg-zinc-900/10">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-white/50">CHAVE PIX</p>
                      <p className="mt-0.5 text-xs text-white/80">{expense.pixKey}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(expense.pixKey)}
                      className="rounded-md p-1.5 transition hover:bg-white dark:hover:bg-zinc-900/10"
                    >
                      <Copy className="h-3.5 w-3.5 text-white/60" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {isPaid ? (
                    <>
                      <button className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-sm font-medium text-emerald-100 transition hover:bg-emerald-50 dark:bg-emerald-950/300/20 dark:hover:bg-emerald-950/300/30">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pago
                      </button>
                      <button
                        onClick={() => handleUnpay(expense.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-white transition hover:bg-white dark:bg-zinc-900/10 dark:hover:bg-zinc-900/20"
                      >
                        <Undo2 className="h-3.5 w-3.5 text-white/60" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handlePay(expense.id)}
                      className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition ${
                        isOverdue
                          ? "bg-white text-white hover:bg-white dark:bg-zinc-900/20 dark:hover:bg-zinc-900/30"
                          : "bg-emerald-50 text-emerald-100 hover:bg-emerald-50 dark:bg-emerald-950/300/20 dark:hover:bg-emerald-950/300/30"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Pagar
                    </button>
                  )}
                  <button
                    onClick={() => openEditDialog(expense)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white transition hover:bg-white dark:bg-zinc-900/10 dark:hover:bg-zinc-900/20"
                  >
                    <Pencil className="h-3.5 w-3.5 text-white/60" />
                  </button>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white transition hover:bg-white dark:bg-zinc-900/10 dark:hover:bg-zinc-900/20"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-300" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingId ? "Editar Conta" : "Adicionar Nova Conta"}>
        <div className="space-y-5">
          <div>
            <Label className="font-semibold">Nome da Conta *</Label>
            <Input
              value={fDescription}
              onChange={(e) => setFDescription(e.target.value)}
              className="mt-1"
              placeholder="Ex: Luz de Janeiro, Cartão Nubank..."
            />
          </div>

          <div>
            <Label className="font-semibold">Fornecedor/Empresa *</Label>
            <Input
              value={fSupplier}
              onChange={(e) => setFSupplier(e.target.value)}
              className="mt-1"
              placeholder="Ex: CEMIG, Vivo, Nubank..."
            />
          </div>

          <div>
            <Label className="font-semibold">Chave PIX do Fornecedor (opcional)</Label>
            <Input
              value={fPixKey}
              onChange={(e) => setFPixKey(e.target.value)}
              className="mt-1"
              placeholder="CPF, CNPJ, E-mail, Telefone ou Chave Aleatória"
            />
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-600/80">
              <AlertTriangle className="h-3 w-3" />
              A chave PIX será incluída nos lembretes. Verifique se está correta — a responsabilidade é sua.
            </p>
          </div>

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
                fRecurring ? "bg-emerald-50 dark:bg-emerald-950/300" : "bg-gray-200 dark:bg-zinc-700"
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
            className="h-11 w-full bg-emerald-600 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40"
          >
            {editingId ? "Salvar Alterações" : "Cadastrar Conta"}
          </Button>
        </div>
      </Dialog>

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
"use client"

import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus, Trash2, Search, Calendar, Package, FileText, CreditCard,
  CheckCircle2, DollarSign, CalendarDays, ShoppingBag, User,
  ClipboardList, Pencil, Copy, ChevronDown, ChevronUp, MessageCircle,
  Receipt, Send, Download
} from "lucide-react"
import { formatCurrency, formatDate, localDateStr } from "@/lib/utils"

type TabType = "produtos" | "contratos" | "assinaturas"
type FilterType = "todos" | "em_dia" | "em_atraso" | "quitados"

export default function VendasPage() {
  const parseMoneyBR = (value: string) => {
    if (!value) return 0
    const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const formatMoneyBR = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)

  const normalizeMoneyInput = (value: string) => value.replace(/[^\d.,]/g, "")

  const formatMoneyInputOnBlur = (value: string, setter: (value: string) => void) => {
    if (!value.trim()) return
    setter(formatMoneyBR(parseMoneyBR(value)))
  }

  const [sales, setSales] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editSale, setEditSale] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>("produtos")
  const [activeFilter, setActiveFilter] = useState<FilterType>("todos")

  // New sale form extra state
  const [formProductDescription, setFormProductDescription] = useState("")
  const [formClientName, setFormClientName] = useState("")
  const [formClientPhone, setFormClientPhone] = useState("")
  const [formClientCpf, setFormClientCpf] = useState("")
  const [formClientRg, setFormClientRg] = useState("")
  const [formClientEmail, setFormClientEmail] = useState("")
  const [formClientAddress, setFormClientAddress] = useState("")
  const [formSaleDate, setFormSaleDate] = useState(localDateStr())
  const [formCostPrice, setFormCostPrice] = useState("")
  const [formSalePrice, setFormSalePrice] = useState("")
  const [formDownPayment, setFormDownPayment] = useState("0")
  const [formInstallments, setFormInstallments] = useState("1")
  const [formFrequency, setFormFrequency] = useState("MONTHLY")
  const [formFirstDueDate, setFormFirstDueDate] = useState("")
  const [formWhatsapp, setFormWhatsapp] = useState(false)
  const [formNotes, setFormNotes] = useState("")
  const [formSelectedClientId, setFormSelectedClientId] = useState("")
  const [formProductName, setFormProductName] = useState("")

  // Calculated installment value
  const calcInstallmentValue = useMemo(() => {
    const price = parseMoneyBR(formSalePrice)
    const entrada = parseMoneyBR(formDownPayment)
    const count = parseInt(formInstallments) || 1
    if (count <= 0 || price <= 0) return 0
    return Math.round(((price - entrada) / count) * 100) / 100
  }, [formSalePrice, formDownPayment, formInstallments])

  const frequencyLabel = useMemo(() => {
    const map: Record<string, string> = {
      MONTHLY: "Parcelas geradas no mesmo dia do mês",
      BIWEEKLY: "Parcelas geradas a cada 15 dias",
      WEEKLY: "Parcelas geradas semanalmente",
      DAILY: "Parcelas geradas diariamente",
    }
    return map[formFrequency] || ""
  }, [formFrequency])

  // Auto-fill client data when selecting registered client
  const handleSelectClient = (clientId: string) => {
    setFormSelectedClientId(clientId)
    if (clientId) {
      const client = clients.find((c: any) => c.id === clientId)
      if (client) {
        setFormClientName(client.name || "")
        setFormClientPhone(client.phone || "")
        setFormClientCpf(client.document || "")
        setFormClientRg(client.rg || "")
        setFormClientEmail(client.email || "")
        setFormClientAddress(
          [client.address, client.number, client.neighborhood, client.city].filter(Boolean).join(", ") || ""
        )
      }
    } else {
      setFormClientName("")
      setFormClientPhone("")
      setFormClientCpf("")
      setFormClientRg("")
      setFormClientEmail("")
      setFormClientAddress("")
    }
  }

  // Check if form is valid for submission
  const isFormValid = formProductName.trim() && formSelectedClientId && formSalePrice && parseMoneyBR(formSalePrice) > 0 && formFirstDueDate

  // Pay dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payingSale, setPayingSale] = useState<any>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState(localDateStr())

  // Payment receipt dialog
  const [paymentReceiptDialog, setPaymentReceiptDialog] = useState(false)
  const [paymentReceiptInfo, setPaymentReceiptInfo] = useState<{
    type: string
    clientName: string
    installmentLabel: string
    amount: number
    date: string
    isCompleted: boolean
    remainingBalance: number
  } | null>(null)

  // Parcelas dialog
  const [parcelasDialogOpen, setParcelasDialogOpen] = useState(false)
  const [parcelasSale, setParcelasSale] = useState<any>(null)

  const fetchSales = async () => {
    const res = await fetch("/api/sales")
    const data = await res.json()
    setSales(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    fetchSales()
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(Array.isArray(d) ? d : []))
  }, [])

  const handleNewSaleSubmit = async () => {
    const noteParts = []
    if (formProductDescription) noteParts.push(`Detalhes: ${formProductDescription}`)
    if (formCostPrice) noteParts.push(`Custo: R$ ${formatMoneyBR(parseMoneyBR(formCostPrice))}`)
    if (parseMoneyBR(formDownPayment) > 0) noteParts.push(`Entrada: R$ ${formatMoneyBR(parseMoneyBR(formDownPayment))}`)
    if (formWhatsapp) noteParts.push("[WHATSAPP:ON]")
    if (formNotes) noteParts.push(formNotes)

    const payload = {
      clientId: formSelectedClientId,
      description: formProductName,
      totalAmount: parseMoneyBR(formSalePrice),
      installmentCount: parseInt(formInstallments) || 1,
      startDate: formFirstDueDate,
      notes: noteParts.join(" | ") || undefined,
      modality: formFrequency,
      downPayment: parseMoneyBR(formDownPayment),
    }

    if (editSale) {
      await fetch(`/api/sales/${editSale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    }
    setDialogOpen(false)
    setEditSale(null)
    fetchSales()
  }

  const handleDelete = async (id: string) => {
    if (confirm("Excluir esta venda?")) {
      await fetch(`/api/sales/${id}`, { method: "DELETE" })
      fetchSales()
    }
  }

  const resetFormState = () => {
    setFormProductName("")
    setFormProductDescription("")
    setFormSelectedClientId("")
    setFormClientName("")
    setFormClientPhone("")
    setFormClientCpf("")
    setFormClientRg("")
    setFormClientEmail("")
    setFormClientAddress("")
    setFormSaleDate(localDateStr())
    setFormCostPrice("")
    setFormSalePrice("")
    setFormDownPayment("0")
    setFormInstallments("1")
    setFormFrequency("MONTHLY")
    setFormFirstDueDate("")
    setFormWhatsapp(false)
    setFormNotes("")
  }

  const openNewSale = () => {
    setEditSale(null)
    resetFormState()
    setDialogOpen(true)
  }

  const openEditSale = (sale: any) => {
    setEditSale(sale)
    setFormProductName(sale.description || "")
    setFormProductDescription("")
    setFormSelectedClientId(sale.clientId || "")
    handleSelectClient(sale.clientId || "")
    setFormSaleDate(localDateStr(sale.startDate))
    setFormCostPrice("")
    setFormSalePrice(formatMoneyBR(Number(sale.totalAmount || 0)))
    setFormDownPayment("0")
    setFormInstallments(String(sale.installmentCount))
    setFormFrequency("MONTHLY")
    setFormFirstDueDate(localDateStr(sale.startDate))
    setFormWhatsapp(false)
    setFormNotes(sale.notes || "")
    setDialogOpen(true)
  }

  const openPay = (sale: any) => {
    setPayingSale(sale)
    const nextInst = sale.saleInstallments?.find((i: any) => i.status !== "PAID")
    setPayAmount(nextInst ? String(nextInst.amount) : "")
    setPayDate(localDateStr())
    setPayDialogOpen(true)
  }

  const handlePay = async () => {
    if (!payingSale) return
    const nextInst = payingSale.saleInstallments?.find((i: any) => i.status !== "PAID")
    if (!nextInst) return

    const paidAmt = parseFloat(payAmount)
    await fetch(`/api/sales/${payingSale.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payInstallmentId: nextInst.id,
        payAmount: paidAmt,
        payDate,
      }),
    })

    // Show receipt
    const allInsts = payingSale.saleInstallments || []
    const paidCount = allInsts.filter((i: any) => i.status === "PAID").length
    const willBeCompleted = (paidCount + 1) >= allInsts.length
    const alreadyPaid = allInsts.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0)
    setPaymentReceiptInfo({
      type: "Venda",
      clientName: payingSale.client?.name || payingSale.clientName || "",
      installmentLabel: `${nextInst.number || (paidCount + 1)}/${allInsts.length}`,
      amount: paidAmt,
      date: new Date(payDate + "T12:00:00").toLocaleDateString("pt-BR"),
      isCompleted: willBeCompleted,
      remainingBalance: Math.max(0, payingSale.totalAmount - alreadyPaid - paidAmt),
    })
    setPaymentReceiptDialog(true)

    setPayDialogOpen(false)
    setPayingSale(null)
    fetchSales()
  }

  // Helpers
  const getSalePaid = (sale: any) =>
    sale.saleInstallments?.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0) || 0

  const getSalePaidCount = (sale: any) =>
    sale.saleInstallments?.filter((i: any) => i.status === "PAID").length || 0

  const getNextInstallment = (sale: any) =>
    sale.saleInstallments?.find((i: any) => i.status !== "PAID") || null

  const getSaleStatus = (sale: any) => {
    const now = new Date()
    const allPaid = sale.saleInstallments?.every((i: any) => i.status === "PAID")
    if (allPaid && sale.saleInstallments?.length > 0) return "quitado"
    const hasOverdue = sale.saleInstallments?.some((i: any) => i.status !== "PAID" && new Date(i.dueDate) < now)
    if (hasOverdue) return "atraso"
    return "em_dia"
  }

  // Stats
  const totalVendas = sales.length
  const totalValue = sales.reduce((s, sale) => s + sale.totalAmount, 0)
  const totalRecebido = sales.reduce((s, sale) => s + getSalePaid(sale), 0)
  const totalAReceber = totalValue - totalRecebido

  // Filter + search
  const filteredSales = useMemo(() => {
    let list = sales

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.description?.toLowerCase().includes(q) ||
        s.client?.name?.toLowerCase().includes(q)
      )
    }

    if (activeFilter === "em_dia") {
      list = list.filter(s => getSaleStatus(s) === "em_dia")
    } else if (activeFilter === "em_atraso") {
      list = list.filter(s => getSaleStatus(s) === "atraso")
    } else if (activeFilter === "quitados") {
      list = list.filter(s => getSaleStatus(s) === "quitado")
    }

    return list
  }, [sales, search, activeFilter])

  // Filter counts
  const countAll = sales.length
  const countEmDia = sales.filter(s => getSaleStatus(s) === "em_dia").length
  const countAtraso = sales.filter(s => getSaleStatus(s) === "atraso").length
  const countQuitados = sales.filter(s => getSaleStatus(s) === "quitado").length

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: "produtos", label: "Produtos", icon: Package },
    // { key: "contratos", label: "Contratos", icon: FileText },
    // { key: "assinaturas", label: "Assinaturas", icon: CreditCard },
  ]

  const filters: { key: FilterType; label: string; count: number; icon?: any }[] = [
    { key: "todos", label: "Todos", count: countAll },
    { key: "em_dia", label: "Em dia", count: countEmDia },
    { key: "em_atraso", label: "Em atraso", count: countAtraso, icon: "⚠" },
    { key: "quitados", label: "Quitados", count: countQuitados, icon: "✓" },
  ]

  const statusBadge = (status: string) => {
    if (status === "quitado") return { label: "Quitado", cls: "bg-primary/5 dark:bg-primary/150/20 text-primary border-primary/30" }
    if (status === "atraso") return { label: "Em Atraso", cls: "bg-red-50 dark:bg-red-950/300/20 text-red-600 border-red-500/30" }
    return { label: "Pendente", cls: "bg-amber-50 dark:bg-amber-950/300/20 text-amber-600 border-amber-500/30" }
  }

  return (
    <div className="space-y-6 pt-6 pb-12">
      {/* ===== HEADER ===== */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Vendas e Gestão Financeira</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Gerencie vendas de produtos</p>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex items-center bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-all ${
                active
                  ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:bg-zinc-800/40"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{totalVendas}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Vendas</p>
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-primary">{formatCurrency(totalValue)}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Total</p>
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-primary">{formatCurrency(totalRecebido)}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Recebido</p>
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-primary">{formatCurrency(totalAReceber)}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">A Receber</p>
          </div>
        </div>
      </div>

      {/* ===== SEARCH + ACTIONS ===== */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
          <Input
            placeholder="Buscar por produto ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" /> Calendário
        </Button>
        <Button onClick={openNewSale} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nova Venda
        </Button>
      </div>

      {/* ===== FILTERS ===== */}
      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((f) => {
          const active = activeFilter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                active
                  ? "border-primary bg-primary/5 dark:bg-primary/150/10 text-primary"
                  : "border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 text-gray-500 dark:text-zinc-400 hover:border-gray-300 dark:border-zinc-700"
              }`}
            >
              {f.icon && <span className="text-xs">{f.icon}</span>}
              {f.label} ({f.count})
            </button>
          )
        })}
      </div>

      {/* ===== SALES CARDS ===== */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-zinc-400">Carregando...</div>
      ) : filteredSales.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-gray-500 dark:text-zinc-400" />
          <p className="text-sm">Nenhuma venda encontrada</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSales.map((sale) => {
            const paid = getSalePaid(sale)
            const falta = sale.totalAmount - paid
            const paidCount = getSalePaidCount(sale)
            const nextInst = getNextInstallment(sale)
            const status = getSaleStatus(sale)
            const badge = statusBadge(status)

            return (
              <div key={sale.id} className="rounded-xl border border-primary/30 dark:border-primary/30 bg-gray-50 dark:bg-zinc-800/80 overflow-hidden">
                {/* ---- Header ---- */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 flex items-center justify-center">
                        <Package className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm">{sale.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <User className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
                          <span className="text-xs text-gray-500 dark:text-zinc-400">{sale.client?.name || "—"}</span>
                        </div>
                      </div>
                    </div>
                    <Badge className={`text-xs ${badge.cls}`}>{badge.label}</Badge>
                  </div>
                </div>

                {/* ---- Stats 2x2 ---- */}
                <div className="grid grid-cols-2 gap-px mx-4 mb-3">
                  <div className="bg-gray-100 dark:bg-zinc-800/60 rounded-tl-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-1">Venda</p>
                    <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(sale.totalAmount)}</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-zinc-800/60 rounded-tr-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Recebido</p>
                    <p className="text-sm font-bold tabular-nums text-primary">{formatCurrency(paid)}</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-zinc-800/60 rounded-bl-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-amber-500 mb-1">Falta</p>
                    <p className="text-sm font-bold tabular-nums text-amber-600">{formatCurrency(falta > 0 ? falta : 0)}</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-zinc-800/60 rounded-br-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-1">Parcelas</p>
                    <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-zinc-100">{paidCount}/{sale.installmentCount}</p>
                  </div>
                </div>

                {/* ---- Next installment ---- */}
                {nextInst && (
                  <div className="mx-4 mb-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-400">
                      <CalendarDays className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                      <span>{nextInst.number}ª parcela</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-700 dark:text-zinc-300 font-medium">{formatDate(nextInst.dueDate)}</span>
                      <span className="text-gray-400 dark:text-zinc-500 ml-2">{formatCurrency(nextInst.amount)}</span>
                    </div>
                  </div>
                )}

                {/* ---- Actions ---- */}
                <div className="flex items-center gap-2 p-4 pt-3 border-t border-gray-200 dark:border-zinc-800">
                  <Button
                    onClick={() => openPay(sale)}
                    disabled={status === "quitado"}
                    className="flex-1 bg-primary hover:bg-primary/90 gap-2 text-sm h-9"
                  >
                    <DollarSign className="h-4 w-4" /> Pagar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setParcelasSale(sale); setParcelasDialogOpen(true) }}
                    className="flex-1 gap-2 text-sm h-9"
                  >
                    <ClipboardList className="h-4 w-4" /> Parcelas
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => {
                    navigator.clipboard.writeText(
                      `${sale.description} - ${sale.client?.name} - ${formatCurrency(sale.totalAmount)}`
                    )
                  }}>
                    <Copy className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEditSale(sale)}>
                    <Pencil className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleDelete(sale.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== NOVA/EDITAR VENDA DIALOG ===== */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditSale(null) }} title={editSale ? "Editar Venda" : "Nova Venda"} className="max-w-xl">
        <div className="space-y-5">
          {/* Product Name */}
          <div>
            <Label className="font-semibold">Nome do Produto *</Label>
            <Input
              value={formProductName}
              onChange={(e) => setFormProductName(e.target.value)}
              className="mt-1"
              placeholder="Ex: iPhone 15, Geladeira, etc."
            />
          </div>

          {/* Product Description */}
          <div>
            <Label className="font-semibold">Descrição do Produto</Label>
            <Textarea
              value={formProductDescription}
              onChange={(e) => setFormProductDescription(e.target.value)}
              className="mt-1"
              placeholder="Detalhes do produto..."
              rows={3}
            />
          </div>

          {/* Client Selector */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-50 dark:bg-blue-950/300/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-600">Usar cliente cadastrado</span>
            </div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
              <select
                value={formSelectedClientId}
                onChange={(e) => handleSelectClient(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-zinc-100 appearance-none"
              >
                <option value="">Selecionar cliente...</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Selecione um cliente para preencher os dados automaticamente, ou digite manualmente abaixo.</p>
          </div>

          {/* Client Fields - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Nome do Cliente *</Label>
              <Input
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
                className="mt-1"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label className="font-semibold">Telefone</Label>
              <Input
                value={formClientPhone}
                onChange={(e) => setFormClientPhone(e.target.value)}
                className="mt-1"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">CPF</Label>
              <Input
                value={formClientCpf}
                onChange={(e) => setFormClientCpf(e.target.value)}
                className="mt-1"
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <Label className="font-semibold">RG</Label>
              <Input
                value={formClientRg}
                onChange={(e) => setFormClientRg(e.target.value)}
                className="mt-1"
                placeholder="00.000.000-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">E-mail</Label>
              <Input
                value={formClientEmail}
                onChange={(e) => setFormClientEmail(e.target.value)}
                className="mt-1"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label className="font-semibold">Endereço</Label>
              <Input
                value={formClientAddress}
                onChange={(e) => setFormClientAddress(e.target.value)}
                className="mt-1"
                placeholder="Rua, número, bairro..."
              />
            </div>
          </div>

          {/* Sale Date + Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Data da Venda *</Label>
              <Input
                type="date"
                value={formSaleDate}
                onChange={(e) => setFormSaleDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-semibold">Custo (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={formCostPrice}
                onChange={(e) => setFormCostPrice(normalizeMoneyInput(e.target.value))}
                onBlur={() => formatMoneyInputOnBlur(formCostPrice, setFormCostPrice)}
                className="mt-1"
                placeholder="Quanto você pagou"
              />
            </div>
          </div>

          {/* Sale Price */}
          <div>
            <Label className="font-semibold">Valor de Venda (R$) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={formSalePrice}
              onChange={(e) => setFormSalePrice(normalizeMoneyInput(e.target.value))}
              onBlur={() => formatMoneyInputOnBlur(formSalePrice, setFormSalePrice)}
              className="mt-1"
              placeholder="Quanto está vendendo"
            />
          </div>

          {/* Down Payment + Installments */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Entrada (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={formDownPayment}
                onChange={(e) => setFormDownPayment(normalizeMoneyInput(e.target.value))}
                onBlur={() => formatMoneyInputOnBlur(formDownPayment, setFormDownPayment)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-semibold">Nº de Parcelas *</Label>
              <Input
                type="number"
                min="1"
                value={formInstallments}
                onChange={(e) => setFormInstallments(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Frequency + First Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Frequência de Pagamento *</Label>
              <select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 mt-1"
              >
                <option value="MONTHLY">Mensal</option>
                <option value="BIWEEKLY">Quinzenal</option>
                <option value="WEEKLY">Semanal</option>
                <option value="DAILY">Diário</option>
              </select>
            </div>
            <div>
              <Label className="font-semibold">Primeiro Vencimento *</Label>
              <Input
                type="date"
                value={formFirstDueDate}
                onChange={(e) => setFormFirstDueDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Installment Value (calculated) */}
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <Label className="font-semibold">Valor da Parcela (R$)</Label>
              <Input
                type="text"
                value={calcInstallmentValue > 0 ? formatMoneyBR(calcInstallmentValue) : "0,00"}
                readOnly
                className="mt-1 opacity-70 cursor-not-allowed"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 pb-2.5">{frequencyLabel}</p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="font-semibold">Observações</Label>
            <Textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="mt-1"
              placeholder="Notas adicionais..."
              rows={3}
            />
          </div>

          {/* WhatsApp Notification */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/60 cursor-pointer">
            <input
              type="checkbox"
              checked={formWhatsapp}
              onChange={(e) => setFormWhatsapp(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-primary focus:ring-primary"
            />
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">Receber notificação WhatsApp deste contrato</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Alertas de atraso e relatórios serão enviados normalmente mesmo que você não marque essa opção</p>
            </div>
          </label>

          {/* Validation hint */}
          {!isFormValid && (
            <p className="text-xs text-red-600 text-center">
              Preencha: {!formProductName.trim() ? "Produto, " : ""}{!formSelectedClientId ? "Cliente, " : ""}{(!formSalePrice || parseFloat(formSalePrice) <= 0) ? "Valor Total, " : ""}{!formFirstDueDate ? "1º Vencimento" : ""}
            </p>
          )}

          {/* Submit */}
          <Button
            onClick={handleNewSaleSubmit}
            disabled={!isFormValid}
            className="w-full bg-primary hover:bg-primary/90 h-11 text-sm font-semibold disabled:opacity-40"
          >
            {editSale ? "Salvar Alterações" : "Cadastrar Venda"}
          </Button>
        </div>
      </Dialog>

      {/* ===== PAGAR DIALOG ===== */}
      <Dialog open={payDialogOpen} onClose={() => setPayDialogOpen(false)} title="Registrar Pagamento">
        {payingSale && (() => {
          const nextInst = getNextInstallment(payingSale)
          if (!nextInst) return <p className="text-gray-500 dark:text-zinc-400 text-sm">Todas as parcelas já foram pagas.</p>
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/30 dark:border-primary/30 bg-gray-100 dark:bg-zinc-800/40 p-4">
                <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">{payingSale.description}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500">{payingSale.client?.name}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-zinc-500">{nextInst.number}ª parcela</span>
                  <span className="text-sm font-bold tabular-nums text-primary">{formatCurrency(nextInst.amount)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400 dark:text-zinc-500">Vencimento</span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">{formatDate(nextInst.dueDate)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor Pago (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Data do Pagamento</Label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handlePay} className="bg-primary hover:bg-primary/90">
                  Confirmar Pagamento
                </Button>
              </div>
            </div>
          )
        })()}
      </Dialog>

      {/* ===== COMPROVANTE DE PAGAMENTO ===== */}
      <Dialog open={paymentReceiptDialog} onClose={() => setPaymentReceiptDialog(false)} className="max-w-md">
        {paymentReceiptInfo && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 dark:bg-primary/15">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-primary">Pagamento Registrado!</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Deseja baixar ou enviar o comprovante?</p>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-zinc-700 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Tipo:</span>
                <span className="font-semibold text-gray-900 dark:text-zinc-100">{paymentReceiptInfo.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Cliente:</span>
                <span className="font-bold text-gray-900 dark:text-zinc-100">{paymentReceiptInfo.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Parcela:</span>
                <span className="font-semibold text-gray-900 dark:text-zinc-100">{paymentReceiptInfo.installmentLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Valor Pago:</span>
                <span className="font-bold text-primary">{formatCurrency(paymentReceiptInfo.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Data:</span>
                <span className="font-semibold text-gray-900 dark:text-zinc-100">{paymentReceiptInfo.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Saldo Restante:</span>
                <span className="font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(paymentReceiptInfo.remainingBalance)}</span>
              </div>
            </div>

            {paymentReceiptInfo.isCompleted && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 dark:bg-primary/10/40 py-2.5 px-4">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="font-bold text-primary dark:text-primary">Contrato Quitado!</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Button
                className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
                onClick={() => {
                  const text = `📋 *Comprovante de Pagamento*\n\n📌 Tipo: ${paymentReceiptInfo.type}\n👤 Cliente: ${paymentReceiptInfo.clientName}\n📄 Parcela: ${paymentReceiptInfo.installmentLabel}\n💰 Valor Pago: ${formatCurrency(paymentReceiptInfo.amount)}\n📅 Data: ${paymentReceiptInfo.date}\n💵 Saldo Restante: ${formatCurrency(paymentReceiptInfo.remainingBalance)}${paymentReceiptInfo.isCompleted ? "\n\n✅ *Contrato Quitado!*" : ""}`
                  navigator.clipboard.writeText(text)
                  alert("Copiado!")
                }}
              >
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button
                className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
                onClick={() => {
                  const text = `📋 *Comprovante de Pagamento*\n\n📌 Tipo: ${paymentReceiptInfo.type}\n👤 Cliente: ${paymentReceiptInfo.clientName}\n📄 Parcela: ${paymentReceiptInfo.installmentLabel}\n💰 Valor Pago: ${formatCurrency(paymentReceiptInfo.amount)}\n📅 Data: ${paymentReceiptInfo.date}\n💵 Saldo Restante: ${formatCurrency(paymentReceiptInfo.remainingBalance)}${paymentReceiptInfo.isCompleted ? "\n\n✅ *Contrato Quitado!*" : ""}`
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
                }}
              >
                <Send className="h-4 w-4" /> Para Mim
              </Button>
              <Button
                className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
                onClick={() => {
                  const printContent = `
                    <html><head><title>Comprovante</title>
                    <style>body{font-family:sans-serif;padding:40px;max-width:400px;margin:auto}
                    h2{color:#059669;text-align:center}table{width:100%;border-collapse:collapse;margin:20px 0}
                    td{padding:8px 4px;border-bottom:1px solid #e5e7eb}td:first-child{color:#6b7280}td:last-child{text-align:right;font-weight:600}
                    .badge{background:#d1fae5;color:#047857;padding:8px 16px;border-radius:8px;text-align:center;font-weight:700;margin-top:16px}</style></head>
                    <body><h2>📋 Comprovante de Pagamento</h2>
                    <table><tr><td>Tipo:</td><td>${paymentReceiptInfo.type}</td></tr>
                    <tr><td>Cliente:</td><td>${paymentReceiptInfo.clientName}</td></tr>
                    <tr><td>Parcela:</td><td>${paymentReceiptInfo.installmentLabel}</td></tr>
                    <tr><td>Valor Pago:</td><td style="color:#059669">${formatCurrency(paymentReceiptInfo.amount)}</td></tr>
                    <tr><td>Data:</td><td>${paymentReceiptInfo.date}</td></tr>
                    <tr><td>Saldo Restante:</td><td>${formatCurrency(paymentReceiptInfo.remainingBalance)}</td></tr></table>
                    ${paymentReceiptInfo.isCompleted ? '<div class="badge">✅ Contrato Quitado!</div>' : ""}
                    </body></html>`
                  const w = window.open("", "_blank")
                  if (w) { w.document.write(printContent); w.document.close(); w.print() }
                }}
              >
                <Download className="h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ===== PARCELAS DIALOG ===== */}
      <Dialog open={parcelasDialogOpen} onClose={() => setParcelasDialogOpen(false)} title="Parcelas">
        {parcelasSale && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">{parcelasSale.description}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">{parcelasSale.client?.name}</p>
              </div>
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {getSalePaidCount(parcelasSale)}/{parcelasSale.installmentCount} pagas
              </span>
            </div>

            {parcelasSale.saleInstallments?.map((inst: any) => {
              const isPaid = inst.status === "PAID"
              const isOverdue = !isPaid && new Date(inst.dueDate) < new Date()
              return (
                <div
                  key={inst.id}
                  className={`rounded-lg border p-3 flex items-center justify-between ${
                    isPaid
                      ? "border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/150/5"
                      : isOverdue
                      ? "border-red-500/20 bg-red-50 dark:bg-red-950/300/5"
                      : "border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isPaid ? "bg-primary/5 dark:bg-primary/150/20 text-primary" : isOverdue ? "bg-red-50 dark:bg-red-950/300/20 text-red-600" : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
                    }`}>
                      {inst.number}
                    </div>
                    <div>
                      <p className="text-sm text-gray-900 dark:text-zinc-100 font-medium">{formatCurrency(inst.amount)}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500">{formatDate(inst.dueDate)}</p>
                    </div>
                  </div>
                  <Badge className={`text-xs ${
                    isPaid
                      ? "bg-primary/5 dark:bg-primary/150/20 text-primary border-primary/30"
                      : isOverdue
                      ? "bg-red-50 dark:bg-red-950/300/20 text-red-600 border-red-500/30"
                      : "bg-amber-50 dark:bg-amber-950/300/20 text-amber-600 border-amber-500/30"
                  }`}>
                    {isPaid ? "Pago" : isOverdue ? "Vencido" : "Pendente"}
                  </Badge>
                </div>
              )
            })}

            {/* Summary */}
            <div className="rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800/30 p-3 mt-2 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-zinc-400">Total</span>
                <span className="text-gray-900 dark:text-zinc-100 font-medium">{formatCurrency(parcelasSale.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-zinc-400">Recebido</span>
                <span className="text-primary">{formatCurrency(getSalePaid(parcelasSale))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-zinc-400">Restante</span>
                <span className="text-amber-600">{formatCurrency(parcelasSale.totalAmount - getSalePaid(parcelasSale))}</span>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

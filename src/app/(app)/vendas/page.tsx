"use client"

import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import {
  Plus, Trash2, Search, Calendar, Package, FileText, CreditCard,
  CheckCircle2, DollarSign, CalendarDays, ShoppingBag, User,
  ClipboardList, Pencil, Copy, ChevronDown, ChevronUp, MessageCircle,
  Receipt, Send, Download, Tag, TrendingUp, LayoutGrid, Wallet,
  Filter, Phone, X, Loader2, List, AlertTriangle
} from "lucide-react"
import { formatCurrency, formatDate, localDateStr } from "@/lib/utils"

type TabType = "produtos" | "contratos" | "assinaturas"
type FilterType = "aberto" | "todos" | "em_atraso" | "quitados"

const TAG_COLORS = ["#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#10b981","#14b8a6","#06b6d4","#3b82f6","#8b5cf6","#ec4899"]

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
  const [saleFormError, setSaleFormError] = useState<string | null>(null)
  const [savingSale, setSavingSale] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>("produtos")
  const [activeFilter, setActiveFilter] = useState<FilterType>("aberto")
  const [contractViewMode, setContractViewMode] = useState<"cards" | "lista">("cards")
  const [periodFilterEnabled, setPeriodFilterEnabled] = useState(false)
  const [periodFrom, setPeriodFrom] = useState("")
  const [periodTo, setPeriodTo] = useState("")

  // Etiquetas de venda (persistidas no campo notes via marcador [SALE_TAGS:...])
  const [tagDialogSale, setTagDialogSale] = useState<any>(null)
  const [editingTags, setEditingTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [tagColor, setTagColor] = useState(TAG_COLORS[6])
  const [savingTags, setSavingTags] = useState(false)
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null)

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
  const [formType, setFormType] = useState<"PRODUCT" | "CONTRACT">("PRODUCT")
  const [formMonthlyValue, setFormMonthlyValue] = useState("")

  // Calculated installment value
  const calcInstallmentValue = useMemo(() => {
    const price = parseMoneyBR(formSalePrice)
    const entrada = parseMoneyBR(formDownPayment)
    const count = parseInt(formInstallments) || 1
    if (count <= 0 || price <= 0) return 0
    return Math.round(((price - entrada) / count) * 100) / 100
  }, [formSalePrice, formDownPayment, formInstallments])

  // Contrato: total a receber = valor mensal x nº de parcelas
  const contractTotalValue = useMemo(() => {
    const monthly = parseMoneyBR(formMonthlyValue)
    const count = parseInt(formInstallments) || 1
    return Math.round(monthly * count * 100) / 100
  }, [formMonthlyValue, formInstallments])

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
  const isFormValid = formType === "CONTRACT"
    ? formProductName.trim() && formSelectedClientId && formMonthlyValue && parseMoneyBR(formMonthlyValue) > 0 && formFirstDueDate
    : formProductName.trim() && formSelectedClientId && formSalePrice && parseMoneyBR(formSalePrice) > 0 && formFirstDueDate

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

    // Preserva o marcador de etiquetas ([SALE_TAGS:...]) ao editar, já que ele não
    // passa pelos campos do formulário e o notes é reconstruído do zero aqui.
    const existingTags = editSale ? getSaleTags(editSale) : []
    let notes = noteParts.join(" | ") || ""
    if (existingTags.length > 0) notes = `${notes} [SALE_TAGS:${existingTags.join(";")}]`

    const isContract = formType === "CONTRACT"
    const payload = {
      clientId: formSelectedClientId,
      description: formProductName,
      totalAmount: isContract
        ? Math.round(parseMoneyBR(formMonthlyValue) * (parseInt(formInstallments) || 1) * 100) / 100
        : parseMoneyBR(formSalePrice),
      installmentCount: parseInt(formInstallments) || 1,
      startDate: formFirstDueDate,
      notes: notes || undefined,
      modality: formFrequency,
      downPayment: isContract ? 0 : parseMoneyBR(formDownPayment),
      type: formType,
    }

    setSaleFormError(null)
    setSavingSale(true)
    try {
      const res = editSale
        ? await fetch(`/api/sales/${editSale.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/sales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao salvar venda" }))
        setSaleFormError(err.error || "Erro ao salvar venda")
        return
      }

      setDialogOpen(false)
      setEditSale(null)
      fetchSales()
    } catch (err: any) {
      setSaleFormError(err?.message || "Erro de conexão ao salvar venda")
    } finally {
      setSavingSale(false)
    }
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
    setFormMonthlyValue("")
  }

  const openNewSale = (type: "PRODUCT" | "CONTRACT" = "PRODUCT") => {
    setEditSale(null)
    setSaleFormError(null)
    resetFormState()
    setFormType(type)
    setDialogOpen(true)
  }

  const openEditSale = (sale: any) => {
    const parsed = parseSaleNotes(sale)
    setEditSale(sale)
    setSaleFormError(null)
    setFormProductName(sale.description || "")
    setFormProductDescription(parsed.description)
    setFormSelectedClientId(sale.clientId || "")
    handleSelectClient(sale.clientId || "")
    setFormSaleDate(localDateStr(sale.startDate))
    setFormCostPrice(parsed.cost > 0 ? formatMoneyBR(parsed.cost) : "")
    setFormSalePrice(formatMoneyBR(Number(sale.totalAmount || 0)))
    setFormDownPayment(formatMoneyBR(parsed.downPayment))
    setFormInstallments(String(sale.installmentCount))
    setFormFrequency("MONTHLY")
    setFormFirstDueDate(localDateStr(sale.startDate))
    setFormWhatsapp(parsed.whatsapp)
    setFormNotes(parsed.freeNotes)
    setFormType(sale.type === "CONTRACT" ? "CONTRACT" : "PRODUCT")
    setFormMonthlyValue(
      sale.installmentCount > 0 ? formatMoneyBR(Number(sale.totalAmount || 0) / sale.installmentCount) : ""
    )
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
    const alreadyPaid = allInsts.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0) + getSaleDownPayment(payingSale)
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
  // Recebido = soma das parcelas pagas + entrada (a entrada já é dinheiro recebido no ato da venda)
  const getSalePaid = (sale: any) =>
    (sale.saleInstallments?.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0) || 0) + getSaleDownPayment(sale)

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

  // Etiquetas da venda: guardadas dentro de notes como [SALE_TAGS:nome|cor;nome|cor]
  const SALE_TAGS_RE = /\s*\[SALE_TAGS:([^\]]*)\]/

  // Notes guarda vários campos como texto: "Detalhes: X | Custo: R$ Y | Entrada: R$ Z | [WHATSAPP:ON] | observações livres"
  // (mais o marcador de etiquetas [SALE_TAGS:...] no final). Este parser separa tudo de volta.
  const parseSaleNotes = (sale: any) => {
    const withoutTags = (sale.notes || "").replace(SALE_TAGS_RE, "")
    const parts = withoutTags.split(" | ").map((p: string) => p.trim()).filter(Boolean)
    let description = ""
    let cost = 0
    let downPayment = 0
    let whatsapp = false
    const freeParts: string[] = []
    for (const part of parts) {
      const custoM = part.match(/^Custo:\s*R\$\s*([\d.,]+)$/)
      const entradaM = part.match(/^Entrada:\s*R\$\s*([\d.,]+)$/)
      const detalhesM = part.match(/^Detalhes:\s*(.*)$/)
      if (detalhesM) description = detalhesM[1]
      else if (custoM) cost = parseMoneyBR(custoM[1])
      else if (entradaM) downPayment = parseMoneyBR(entradaM[1])
      else if (part === "[WHATSAPP:ON]") whatsapp = true
      else freeParts.push(part)
    }
    return { description, cost, downPayment, whatsapp, freeNotes: freeParts.join(" | ") }
  }

  // Custo é guardado como texto dentro de notes (ex.: "Custo: R$ 2.500,00")
  const getSaleCost = (sale: any) => parseSaleNotes(sale).cost
  const getSaleDownPayment = (sale: any) => parseSaleNotes(sale).downPayment

  const getSaleTags = (sale: any): string[] => {
    const m = (sale.notes || "").match(SALE_TAGS_RE)
    if (!m || !m[1]) return []
    return m[1].split(";").filter(Boolean)
  }
  const buildNotesWithTags = (sale: any, tags: string[]) => {
    const baseNotes = (sale.notes || "").replace(SALE_TAGS_RE, "")
    return tags.length > 0 ? `${baseNotes} [SALE_TAGS:${tags.join(";")}]` : baseNotes
  }
  const persistSaleTags = async (sale: any, tags: string[]) => {
    setSavingTags(true)
    try {
      await fetch(`/api/sales/${sale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: buildNotesWithTags(sale, tags) }),
      })
      setEditingTags(tags)
      await fetchSales()
    } finally {
      setSavingTags(false)
    }
  }
  const openTagDialog = (sale: any) => {
    setTagDialogSale(sale)
    setEditingTags(getSaleTags(sale))
    setTagInput("")
  }

  // Exporta as vendas filtradas para CSV
  const exportSalesCsv = () => {
    const header = ["Produto", "Cliente", "Custo", "Venda", "Entrada", "Lucro", "Recebido", "Falta", "Parcelas", "Status"]
    const rows = filteredSales.map((sale) => {
      const cost = getSaleCost(sale)
      const paid = getSalePaid(sale)
      return [
        sale.description,
        sale.client?.name || "",
        formatCurrency(cost),
        formatCurrency(sale.totalAmount),
        formatCurrency(getSaleDownPayment(sale)),
        formatCurrency(sale.totalAmount - cost),
        formatCurrency(paid),
        formatCurrency(Math.max(0, sale.totalAmount - paid)),
        `${getSalePaidCount(sale)}/${sale.installmentCount}`,
        statusBadge(getSaleStatus(sale)).label,
      ]
    })
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n")
    const blob = new Blob([`?${csv}`], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vendas-${localDateStr()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Cobrar antecipado via WhatsApp direto no número do cliente
  const cobrarAntecipado = (sale: any) => {
    const phone = (sale.client?.phone || "").replace(/\D/g, "")
    const nextInst = getNextInstallment(sale)
    if (!phone) { alert("Cliente sem telefone cadastrado"); return }
    const lines = [
      `Olá ${sale.client?.name || ""}! 👋`,
      "",
      `?? Produto: ${sale.description}`,
      nextInst ? `📅 Próxima parcela: ${nextInst.number}ª — vencimento ${formatDate(nextInst.dueDate)}` : "",
      nextInst ? `?? Valor: ${formatCurrency(nextInst.amount)}` : "",
      "",
      "Gostaria de adiantar o pagamento? ??",
    ].filter(Boolean)
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank")
  }

  // Imprime um resumo/contrato da venda (mesmo padrão usado no comprovante de pagamento)
  const printSaleSummary = (sale: any) => {
    const cost = getSaleCost(sale)
    const paid = getSalePaid(sale)
    const printContent = `
      <html><head><title>Resumo da Venda</title>
      <style>body{font-family:sans-serif;padding:40px;max-width:420px;margin:auto}
      h2{color:#059669;text-align:center}table{width:100%;border-collapse:collapse;margin:20px 0}
      td{padding:8px 4px;border-bottom:1px solid #e5e7eb}td:first-child{color:#6b7280}td:last-child{text-align:right;font-weight:600}</style></head>
      <body><h2>?? Resumo da Venda</h2>
      <table>
        <tr><td>Produto:</td><td>${sale.description}</td></tr>
        <tr><td>Cliente:</td><td>${sale.client?.name || "—"}</td></tr>
        <tr><td>Custo:</td><td>${formatCurrency(cost)}</td></tr>
        <tr><td>Venda:</td><td>${formatCurrency(sale.totalAmount)}</td></tr>
        <tr><td>Entrada:</td><td>${formatCurrency(getSaleDownPayment(sale))}</td></tr>
        <tr><td>Lucro:</td><td style="color:#059669">${formatCurrency(sale.totalAmount - cost)}</td></tr>
        <tr><td>Recebido:</td><td>${formatCurrency(paid)}</td></tr>
        <tr><td>Falta:</td><td>${formatCurrency(Math.max(0, sale.totalAmount - paid))}</td></tr>
        <tr><td>Parcelas:</td><td>${getSalePaidCount(sale)}/${sale.installmentCount}</td></tr>
      </table>
      </body></html>`
    const w = window.open("", "_blank")
    if (w) { w.document.write(printContent); w.document.close(); w.print() }
  }

  // Produtos: só vendas do tipo PRODUCT (contratos ficam na aba própria, mesma tabela)
  const productSales = useMemo(() => sales.filter(s => (s.type || "PRODUCT") === "PRODUCT"), [sales])

  // Stats
  const totalVendas = productSales.length
  const totalValue = productSales.reduce((s, sale) => s + sale.totalAmount, 0)
  const totalRecebido = productSales.reduce((s, sale) => s + getSalePaid(sale), 0)
  const totalAReceber = totalValue - totalRecebido

  // Filter + search
  const filteredSales = useMemo(() => {
    let list = productSales

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.description?.toLowerCase().includes(q) ||
        s.client?.name?.toLowerCase().includes(q)
      )
    }

    if (activeFilter === "aberto") {
      list = list.filter(s => getSaleStatus(s) !== "quitado")
    } else if (activeFilter === "em_atraso") {
      list = list.filter(s => getSaleStatus(s) === "atraso")
    } else if (activeFilter === "quitados") {
      list = list.filter(s => getSaleStatus(s) === "quitado")
    }

    if (selectedTagFilter) {
      list = list.filter(s => getSaleTags(s).some(t => t.split("|")[0] === selectedTagFilter))
    }

    return list
  }, [productSales, search, activeFilter, selectedTagFilter])

  // Contratos: mesma tabela Sale, filtrando pelo tipo CONTRACT
  const contractSales = useMemo(() => sales.filter(s => s.type === "CONTRACT"), [sales])

  const filteredContracts = useMemo(() => {
    let list = contractSales

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.client?.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
      )
    }

    if (activeFilter === "aberto") {
      list = list.filter(s => getSaleStatus(s) !== "quitado")
    } else if (activeFilter === "em_atraso") {
      list = list.filter(s => getSaleStatus(s) === "atraso")
    } else if (activeFilter === "quitados") {
      list = list.filter(s => getSaleStatus(s) === "quitado")
    }

    if (selectedTagFilter) {
      list = list.filter(s => getSaleTags(s).some(t => t.split("|")[0] === selectedTagFilter))
    }

    if (periodFilterEnabled && periodFrom) {
      list = list.filter(s => localDateStr(s.startDate) >= periodFrom)
    }
    if (periodFilterEnabled && periodTo) {
      list = list.filter(s => localDateStr(s.startDate) <= periodTo)
    }

    return list
  }, [contractSales, search, activeFilter, selectedTagFilter, periodFilterEnabled, periodFrom, periodTo])

  const totalContratos = contractSales.length
  const totalRecebidoContratos = contractSales.reduce((s, sale) => s + getSalePaid(sale), 0)
  const totalAReceberContratos = contractSales.reduce((s, sale) => s + Math.max(0, sale.totalAmount - getSalePaid(sale)), 0)
  const totalEmAtrasoContratos = contractSales.reduce((sum, sale) => {
    const overdue = (sale.saleInstallments || [])
      .filter((i: any) => i.status !== "PAID" && new Date(i.dueDate) < new Date())
      .reduce((s: number, i: any) => s + (i.amount - i.paidAmount), 0)
    return sum + overdue
  }, 0)

  // Todas as etiquetas já criadas, para o filtro por etiqueta
  const allSaleTags = useMemo(() => {
    const map = new Map<string, string>()
    sales.forEach((s) => getSaleTags(s).forEach((t) => {
      const [name, color] = t.split("|")
      if (name) map.set(name, color)
    }))
    return Array.from(map.entries())
  }, [sales])

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: "produtos", label: "Produtos", icon: Package },
    { key: "contratos", label: "Contratos", icon: FileText },
    { key: "assinaturas", label: "Assinaturas", icon: CreditCard },
  ]

  const filterOptions = [
    { value: "aberto" as const, label: "Em aberto" },
    { value: "todos" as const, label: "Todos" },
    { value: "em_atraso" as const, label: "Em atraso" },
    { value: "quitados" as const, label: "Quitados" },
  ]

  const statusBadge = (status: string) => {
    if (status === "quitado") return {
      label: "Quitado",
      cls: "border-transparent",
      accent: "#3b82f6",
      style: {
        color: "#BFDBFE",
        border: "1px solid rgba(59,130,246,0.35)",
        background: "radial-gradient(circle at 0% 0%, rgba(59,130,246,0.22), rgba(0,0,0,0) 60%), linear-gradient(135deg, #0B1F3A, rgba(30,58,95,0.7))",
      } as React.CSSProperties,
    }
    if (status === "atraso") return {
      label: "Em Atraso",
      cls: "border-transparent",
      accent: "#ef4444",
      style: {
        color: "#FCA5A5",
        border: "1px solid rgba(239,68,68,0.35)",
        background: "radial-gradient(circle at 0% 0%, rgba(239,68,68,0.22), rgba(0,0,0,0) 60%), linear-gradient(135deg, #2A0A0A, rgba(127,29,29,0.7))",
      } as React.CSSProperties,
    }
    return {
      label: "Pendente",
      cls: "border-transparent",
      accent: "#D4A574",
      style: {
        color: "#A7F3D0",
        border: "1px solid rgba(16,185,129,0.3)",
        background: "radial-gradient(circle at 0% 0%, rgba(16,185,129,0.22), rgba(0,0,0,0) 60%), linear-gradient(135deg, #062418, rgba(6,95,70,0.7))",
      } as React.CSSProperties,
    }
  }

  return (
    <div className="space-y-6 pt-6 pb-12">
      {/* ===== HEADER ===== */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Vendas e Gestão Financeira</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Gerencie vendas de produtos, contratos e assinaturas</p>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex items-center bg-gray-100 dark:bg-[#191F1C] rounded-xl border border-gray-200 dark:border-[#29322E] p-1 overflow-hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-4 text-sm font-medium rounded-lg transition-all ${
                active
                  ? "bg-white dark:bg-[#121614] text-gray-900 dark:text-zinc-100"
                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === "assinaturas" ? (
        <div className="rounded-xl border border-gray-200 dark:border-[#29322E] bg-gray-50 dark:bg-[#191F1C] p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-gray-400 dark:text-zinc-500" />
          <p className="text-sm font-medium text-gray-600 dark:text-zinc-300">Assinaturas em breve</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Essa funcionalidade ainda está em desenvolvimento.</p>
        </div>
      ) : activeTab === "produtos" ? (
      <>
      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 dark:border-[#29322E] bg-gray-50 dark:bg-[#191F1C] p-3 flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-green-500/10 flex items-center justify-center">
            <ShoppingBag className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{totalVendas}</p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Vendas</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-[#29322E] bg-gray-50 dark:bg-[#191F1C] p-3 flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center">
            <DollarSign className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums tracking-tight text-blue-500">{formatCurrency(totalValue)}</p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Total</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-[#29322E] bg-gray-50 dark:bg-[#191F1C] p-3 flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums tracking-tight text-green-500">{formatCurrency(totalRecebido)}</p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Recebido</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-[#29322E] bg-gray-50 dark:bg-[#191F1C] p-3 flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-amber-500/10 flex items-center justify-center">
            <CalendarDays className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums tracking-tight text-amber-500">{formatCurrency(totalAReceber)}</p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">A Receber</p>
          </div>
        </div>
      </div>

      {/* ===== SEARCH ===== */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
        <Input
          placeholder="Buscar por produto ou cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 dark:bg-[#121614] dark:border-[#29322E]"
        />
      </div>

      {/* ===== NOVA VENDA + AÇÕES ===== */}
      <div className="flex items-center gap-2">
        <Button onClick={() => openNewSale("PRODUCT")} className="flex-1 gap-2 bg-primary hover:bg-primary/90 h-11">
          <Plus className="h-4 w-4" /> Nova Venda
        </Button>
        <div className="relative">
          <button
            type="button"
            title="Filtrar por etiqueta"
            onClick={() => setTagFilterOpen((v) => !v)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors ${selectedTagFilter ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-orange-500/50 text-orange-500 hover:bg-orange-500/10"}`}
          >
            <Tag className="h-4 w-4" />
          </button>
          {tagFilterOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setTagFilterOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-gray-200 dark:border-[#29322E] bg-white dark:bg-[#191F1C] p-2 shadow-lg">
                <p className="px-2 py-1 text-xs font-semibold text-gray-400 dark:text-zinc-500">Filtrar por etiqueta</p>
                {allSaleTags.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-gray-400 dark:text-zinc-500">Nenhuma etiqueta criada ainda</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {selectedTagFilter && (
                      <button
                        type="button"
                        onClick={() => { setSelectedTagFilter(null); setTagFilterOpen(false) }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-[#121614]"
                      >
                        <X className="h-3 w-3" /> Limpar filtro
                      </button>
                    )}
                    {allSaleTags.map(([name, color]) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => { setSelectedTagFilter(name); setTagFilterOpen(false) }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-[#121614]"
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          title="Exportar CSV"
          onClick={exportSalesCsv}
          disabled={filteredSales.length === 0}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-orange-500/50 text-orange-500 transition-colors hover:bg-orange-500/10 disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      {/* ===== FILTRO ===== */}
      <FilterDropdown
        label={filterOptions.find((f) => f.value === activeFilter)?.label || "Em aberto"}
        icon={<Filter className="h-4 w-4" />}
        tone="emerald"
        value={activeFilter}
        onChange={(value) => setActiveFilter(value as FilterType)}
        options={filterOptions}
        minWidthClassName="min-w-[180px]"
      />

      {/* ===== SALES CARDS ===== */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-zinc-400">Carregando...</div>
      ) : filteredSales.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-gray-500 dark:text-zinc-400" />
          <p className="text-sm">Nenhuma venda encontrada</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredSales.map((sale) => {
            const cost = getSaleCost(sale)
            const paid = getSalePaid(sale)
            const falta = sale.totalAmount - paid
            const lucro = sale.totalAmount - cost
            const lucroPct = cost > 0 ? Math.round((lucro / cost) * 100) : null
            const paidCount = getSalePaidCount(sale)
            const nextInst = getNextInstallment(sale)
            const status = getSaleStatus(sale)
            const badge = statusBadge(status)
            const progressPct = sale.installmentCount > 0 ? Math.round((paidCount / sale.installmentCount) * 100) : 0
            const tags = getSaleTags(sale)

            return (
              <div
                key={sale.id}
                className="rounded-2xl border border-gray-200 dark:border-[#262E2A] border-l-4 bg-gray-50 dark:bg-[#1C2532] overflow-hidden"
                style={{ borderLeftColor: badge.accent }}
              >
                {/* ---- Header ---- */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 shrink-0 rounded-2xl bg-green-500/15 flex items-center justify-center">
                        <Package className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm truncate">{sale.description}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
                            <span className="text-xs text-gray-500 dark:text-zinc-400">{sale.client?.name || "—"}</span>
                          </div>
                          {sale.client?.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
                              <span className="text-xs text-gray-500 dark:text-zinc-400">{sale.client.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge className={`text-xs shrink-0 ${badge.cls}`} style={badge.style}>{badge.label}</Badge>
                  </div>
                </div>

                {/* ---- Etiquetas ---- */}
                <div className="mx-4 mb-4 flex flex-wrap items-center gap-1.5">
                  {tags.map((t, i) => {
                    const [name, color] = t.split("|")
                    return (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}20`, color }}>
                        {name}
                      </span>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => openTagDialog(sale)}
                    className="inline-flex items-center gap-1 rounded-lg bg-gray-900 dark:bg-[#121614] border border-gray-200 dark:border-[#29322E] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-800"
                  >
                    <Plus className="h-3 w-3" /> Criar / adicionar etiqueta
                  </button>
                </div>

                {/* ---- Stats 3x2 ---- */}
                <div className="grid grid-cols-3 gap-x-3 gap-y-4 mx-4 mb-4">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400"><Tag className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500">Custo</p>
                      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(cost)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-400"><DollarSign className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500">Venda</p>
                      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(sale.totalAmount)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-400"><TrendingUp className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500">Lucro</p>
                      <p className="text-sm font-semibold tabular-nums text-green-400">
                        {formatCurrency(lucro)} {lucroPct != null && <span className="text-[10px] font-normal text-gray-400 dark:text-zinc-500">({lucroPct}%)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-400"><Wallet className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500">Recebido</p>
                      <p className="text-sm font-semibold tabular-nums text-green-400">{formatCurrency(paid)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-400"><DollarSign className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500">Falta</p>
                      <p className="text-sm font-semibold tabular-nums text-orange-400">{formatCurrency(falta > 0 ? falta : 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-500/15 text-zinc-400"><LayoutGrid className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500">Parcelas</p>
                      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{paidCount}/{sale.installmentCount}</p>
                    </div>
                  </div>
                </div>

                {/* ---- Progresso ---- */}
                <div className="mx-4 mb-3">
                  <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-[#29322E] overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="mt-1.5 text-right text-[11px] text-blue-400">{progressPct}% concluído</p>
                </div>

                {/* ---- Next installment ---- */}
                {nextInst && (
                  <div className="mx-4 mb-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-400">
                      <Calendar className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                      <span>{nextInst.number}ª parcela — {formatDate(nextInst.dueDate)}</span>
                    </div>
                    <span className="text-gray-900 dark:text-zinc-100 font-semibold">{formatCurrency(nextInst.amount)}</span>
                  </div>
                )}

                {/* ---- Cobrar Antecipado ---- */}
                {status !== "quitado" && (
                  <div className="mx-4 mb-4">
                    <button
                      type="button"
                      onClick={() => cobrarAntecipado(sale)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#10b981]/30 shadow-lg shadow-[#022c22]/40 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.35),transparent_55%),linear-gradient(135deg,#062418_0%,rgba(6,95,70,0.85)_55%,#062418_100%)] hover:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.45),transparent_55%),linear-gradient(135deg,#083324_0%,rgba(6,95,70,0.95)_55%,#083324_100%)] px-4 py-2.5 text-sm font-medium text-white transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" /> Cobrar Antecipado
                    </button>
                  </div>
                )}

                {/* ---- Actions ---- */}
                <div className="flex items-center gap-2 p-4 pt-0">
                  <Button
                    onClick={() => openPay(sale)}
                    disabled={status === "quitado"}
                    className="flex-1 rounded-xl bg-primary hover:bg-primary/90 gap-2 text-sm h-11"
                  >
                    <DollarSign className="h-4 w-4" /> Pagar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setParcelasSale(sale); setParcelasDialogOpen(true) }}
                    className="flex-1 rounded-xl gap-2 text-sm h-11 dark:bg-[#121614] dark:border-[#29322E]"
                  >
                    <ClipboardList className="h-4 w-4" /> Parcelas
                  </Button>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl dark:bg-[#121614] dark:border-[#29322E]" title="Resumo" onClick={() => printSaleSummary(sale)}>
                    <FileText className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl dark:bg-[#121614] dark:border-[#29322E]" title="Editar" onClick={() => openEditSale(sale)}>
                    <Pencil className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl dark:bg-[#121614] dark:border-[#29322E]" title="Excluir" onClick={() => handleDelete(sale.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </>
      ) : (
      <>
      {/* ===== CONTRATOS: STAT CARDS ===== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 dark:border-[#29322E] bg-gray-50 dark:bg-[#191F1C] p-3 flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-green-500/10 flex items-center justify-center">
            <ClipboardList className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{totalContratos}</p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Total</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-[#29322E] bg-gray-50 dark:bg-[#191F1C] p-3 flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center">
            <DollarSign className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums tracking-tight text-blue-500">{formatCurrency(totalAReceberContratos)}</p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">A Receber</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-[#29322E] bg-gray-50 dark:bg-[#191F1C] p-3 flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums tracking-tight text-red-500">{formatCurrency(totalEmAtrasoContratos)}</p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Em Atraso</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-[#29322E] bg-gray-50 dark:bg-[#191F1C] p-3 flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums tracking-tight text-green-500">{formatCurrency(totalRecebidoContratos)}</p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Recebido</p>
          </div>
        </div>
      </div>

      {/* ===== FILTRAR POR PERÍODO ===== */}
      <div className="rounded-xl border border-gray-200 dark:border-[#29322E] bg-gray-50 dark:bg-[#191F1C] px-4 py-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Filtrar por período</span>
          <div
            onClick={() => setPeriodFilterEnabled((v) => !v)}
            className={`relative h-5 w-10 cursor-pointer rounded-full transition-colors ${periodFilterEnabled ? "bg-primary" : "bg-gray-200 dark:bg-zinc-700"}`}
          >
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${periodFilterEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </div>
        </label>
        {periodFilterEnabled && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="mt-1" />
            </div>
          </div>
        )}
      </div>

      {/* ===== FILTRO DE STATUS ===== */}
      <FilterDropdown
        label={filterOptions.find((f) => f.value === activeFilter)?.label || "Em aberto"}
        icon={<Filter className="h-4 w-4" />}
        tone="emerald"
        value={activeFilter}
        onChange={(value) => setActiveFilter(value as FilterType)}
        options={filterOptions}
        minWidthClassName="min-w-[180px]"
      />

      {/* ===== SEARCH ===== */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
        <Input
          placeholder="Buscar por cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 dark:bg-[#121614] dark:border-[#29322E]"
        />
      </div>

      {/* ===== VIEW TOGGLE + NOVO CONTRATO ===== */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center bg-gray-100 dark:bg-[#191F1C] rounded-lg border border-gray-200 dark:border-[#29322E] p-1">
          <button
            type="button"
            onClick={() => setContractViewMode("cards")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              contractViewMode === "cards"
                ? "bg-white dark:bg-[#121614] text-gray-900 dark:text-zinc-100"
                : "text-gray-500 dark:text-zinc-400"
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Cards
          </button>
          <button
            type="button"
            onClick={() => setContractViewMode("lista")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              contractViewMode === "lista"
                ? "bg-white dark:bg-[#121614] text-gray-900 dark:text-zinc-100"
                : "text-gray-500 dark:text-zinc-400"
            }`}
          >
            <List className="h-4 w-4" /> Lista
          </button>
        </div>
        <Button onClick={() => openNewSale("CONTRACT")} className="gap-2 bg-primary hover:bg-primary/90 h-11">
          <Plus className="h-4 w-4" /> Novo Contrato
        </Button>
      </div>

      {/* ===== CONTRATOS: CARDS / LISTA ===== */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-zinc-400">Carregando...</div>
      ) : filteredContracts.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500">
          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-500 dark:text-zinc-400" />
          <p className="text-sm">Nenhum contrato encontrado</p>
        </div>
      ) : contractViewMode === "lista" ? (
        <div className="rounded-xl border border-gray-200 dark:border-[#29322E] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor Mensal</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((sale) => {
                const status = getSaleStatus(sale)
                const badge = statusBadge(status)
                const paidCount = getSalePaidCount(sale)
                const monthly = sale.installmentCount > 0 ? sale.totalAmount / sale.installmentCount : sale.totalAmount
                return (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.client?.name || "—"}</TableCell>
                    <TableCell className="text-gray-500 dark:text-zinc-400">{sale.description}</TableCell>
                    <TableCell>{formatCurrency(monthly)}</TableCell>
                    <TableCell>{paidCount}/{sale.installmentCount}</TableCell>
                    <TableCell><Badge className={`text-xs ${badge.cls}`} style={badge.style}>{badge.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" title="Pagar" disabled={status === "quitado"} onClick={() => openPay(sale)}>
                          <DollarSign className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEditSale(sale)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" title="Excluir" onClick={() => handleDelete(sale.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredContracts.map((sale) => {
            const paid = getSalePaid(sale)
            const paidCount = getSalePaidCount(sale)
            const nextInst = getNextInstallment(sale)
            const status = getSaleStatus(sale)
            const badge = statusBadge(status)
            const progressPct = sale.installmentCount > 0 ? Math.round((paidCount / sale.installmentCount) * 100) : 0
            const tags = getSaleTags(sale)
            const monthly = sale.installmentCount > 0 ? sale.totalAmount / sale.installmentCount : sale.totalAmount

            return (
              <div
                key={sale.id}
                className="rounded-2xl border border-gray-200 dark:border-[#262E2A] border-l-4 bg-gray-50 dark:bg-[#1C2532] overflow-hidden"
                style={{ borderLeftColor: badge.accent }}
              >
                {/* ---- Header ---- */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 shrink-0 rounded-2xl bg-green-500/15 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm truncate">{sale.client?.name || "—"}</p>
                          <span className="rounded-md bg-gray-200 dark:bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:text-zinc-400">{sale.installmentCount}x</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 truncate">{sale.description}</p>
                      </div>
                    </div>
                    <Badge className={`text-xs shrink-0 ${badge.cls}`} style={badge.style}>{badge.label}</Badge>
                  </div>
                </div>

                {/* ---- Etiquetas ---- */}
                <div className="mx-4 mb-4 flex flex-wrap items-center gap-1.5">
                  {tags.map((t, i) => {
                    const [name, color] = t.split("|")
                    return (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}20`, color }}>
                        {name}
                      </span>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => openTagDialog(sale)}
                    className="inline-flex items-center gap-1 rounded-lg bg-gray-900 dark:bg-[#121614] border border-gray-200 dark:border-[#29322E] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-800"
                  >
                    <Plus className="h-3 w-3" /> Criar / adicionar etiqueta
                  </button>
                </div>

                {/* ---- Valor mensal / Total a receber ---- */}
                <div className="mx-4 mb-3 space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-gray-100 dark:bg-[#121614] px-3 py-2.5">
                    <span className="text-xs text-gray-500 dark:text-zinc-400">Valor mensal</span>
                    <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(monthly)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-100 dark:bg-[#121614] px-3 py-2.5">
                    <span className="text-xs text-gray-500 dark:text-zinc-400">Total a receber</span>
                    <span className="text-sm font-semibold tabular-nums text-green-500">{formatCurrency(sale.totalAmount)}</span>
                  </div>
                </div>

                {/* ---- Progresso ---- */}
                <div className="mx-4 mb-3">
                  <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-[#29322E] overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="mt-1.5 text-right text-[11px] text-blue-400">{progressPct}% concluído</p>
                </div>

                {/* ---- Next installment ---- */}
                {nextInst && (
                  <div className="mx-4 mb-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-400">
                      <Calendar className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                      <span>{nextInst.number}ª parcela — {formatDate(nextInst.dueDate)}</span>
                    </div>
                    <span className="text-gray-900 dark:text-zinc-100 font-semibold">{formatCurrency(nextInst.amount)}</span>
                  </div>
                )}

                {/* ---- Cobrar Antecipado ---- */}
                {status !== "quitado" && (
                  <div className="mx-4 mb-4">
                    <button
                      type="button"
                      onClick={() => cobrarAntecipado(sale)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#10b981]/30 shadow-lg shadow-[#022c22]/40 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.35),transparent_55%),linear-gradient(135deg,#062418_0%,rgba(6,95,70,0.85)_55%,#062418_100%)] hover:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.45),transparent_55%),linear-gradient(135deg,#083324_0%,rgba(6,95,70,0.95)_55%,#083324_100%)] px-4 py-2.5 text-sm font-medium text-white transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" /> Cobrar Antecipado
                    </button>
                  </div>
                )}

                {/* ---- Actions ---- */}
                <div className="flex items-center gap-2 p-4 pt-0">
                  <Button
                    onClick={() => openPay(sale)}
                    disabled={status === "quitado"}
                    className="flex-1 rounded-xl bg-primary hover:bg-primary/90 gap-2 text-sm h-11"
                  >
                    <DollarSign className="h-4 w-4" /> Pagar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setParcelasSale(sale); setParcelasDialogOpen(true) }}
                    className="flex-1 rounded-xl gap-2 text-sm h-11 dark:bg-[#121614] dark:border-[#29322E]"
                  >
                    <ClipboardList className="h-4 w-4" /> Parcelas
                  </Button>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl dark:bg-[#121614] dark:border-[#29322E]" title="Resumo" onClick={() => printSaleSummary(sale)}>
                    <FileText className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl dark:bg-[#121614] dark:border-[#29322E]" title="Editar" onClick={() => openEditSale(sale)}>
                    <Pencil className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl dark:bg-[#121614] dark:border-[#29322E]" title="Excluir" onClick={() => handleDelete(sale.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </>
      )}

      {/* ===== NOVA/EDITAR VENDA DIALOG ===== */}
      <Dialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditSale(null) }}
        title={editSale ? (formType === "CONTRACT" ? "Editar Contrato" : "Editar Venda") : (formType === "CONTRACT" ? "Novo Contrato" : "Nova Venda")}
        className="max-w-xl"
      >
        <div className="space-y-5">
          {/* Product / Contract Name */}
          <div>
            <Label className="font-semibold">{formType === "CONTRACT" ? "Título do Contrato *" : "Nome do Produto *"}</Label>
            <Input
              value={formProductName}
              onChange={(e) => setFormProductName(e.target.value)}
              className="mt-1"
              placeholder={formType === "CONTRACT" ? "Ex: Aluguel de Casa" : "Ex: iPhone 15, Geladeira, etc."}
            />
          </div>

          {/* Product Description */}
          {formType === "PRODUCT" && (
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
          )}

          {/* Client Selector */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-50 dark:bg-blue-950/5 p-4 space-y-3">
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

          {formType === "CONTRACT" ? (
            <>
              {/* Contract Date */}
              <div>
                <Label className="font-semibold">Data do Contrato *</Label>
                <Input
                  type="date"
                  value={formSaleDate}
                  onChange={(e) => setFormSaleDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Monthly Value + Installments */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">Valor Mensal (R$) *</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={formMonthlyValue}
                    onChange={(e) => setFormMonthlyValue(normalizeMoneyInput(e.target.value))}
                    onBlur={() => formatMoneyInputOnBlur(formMonthlyValue, setFormMonthlyValue)}
                    className="mt-1"
                    placeholder="Ex: 500,00"
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

              {/* Total (calculated) */}
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <Label className="font-semibold">Total a Receber (R$)</Label>
                  <Input
                    type="text"
                    value={contractTotalValue > 0 ? formatMoneyBR(contractTotalValue) : "0,00"}
                    readOnly
                    className="mt-1 opacity-70 cursor-not-allowed"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 pb-2.5">{frequencyLabel}</p>
                </div>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}

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
              Preencha: {!formProductName.trim() ? (formType === "CONTRACT" ? "Título, " : "Produto, ") : ""}{!formSelectedClientId ? "Cliente, " : ""}{formType === "CONTRACT" ? ((!formMonthlyValue || parseFloat(formMonthlyValue) <= 0) ? "Valor Mensal, " : "") : ((!formSalePrice || parseFloat(formSalePrice) <= 0) ? "Valor Total, " : "")}{!formFirstDueDate ? "1º Vencimento" : ""}
            </p>
          )}

          {/* Erro ao salvar */}
          {saleFormError && (
            <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/10 border border-red-500/30 text-red-600 text-sm">
              {saleFormError}
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleNewSaleSubmit}
            disabled={!isFormValid || savingSale}
            className="w-full bg-primary hover:bg-primary/90 h-11 text-sm font-semibold disabled:opacity-40"
          >
            {savingSale ? "Salvando..." : editSale ? "Salvar Alterações" : formType === "CONTRACT" ? "Cadastrar Contrato" : "Cadastrar Venda"}
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
                  <span className="text-sm font-semibold tabular-nums text-primary">{formatCurrency(nextInst.amount)}</span>
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
                  const text = `?? *Comprovante de Pagamento*\n\n?? Tipo: ${paymentReceiptInfo.type}\n?? Cliente: ${paymentReceiptInfo.clientName}\n?? Parcela: ${paymentReceiptInfo.installmentLabel}\n?? Valor Pago: ${formatCurrency(paymentReceiptInfo.amount)}\n?? Data: ${paymentReceiptInfo.date}\n?? Saldo Restante: ${formatCurrency(paymentReceiptInfo.remainingBalance)}${paymentReceiptInfo.isCompleted ? "\n\n? *Contrato Quitado!*" : ""}`
                  navigator.clipboard.writeText(text)
                  alert("Copiado!")
                }}
              >
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button
                className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
                onClick={() => {
                  const text = `?? *Comprovante de Pagamento*\n\n?? Tipo: ${paymentReceiptInfo.type}\n?? Cliente: ${paymentReceiptInfo.clientName}\n?? Parcela: ${paymentReceiptInfo.installmentLabel}\n?? Valor Pago: ${formatCurrency(paymentReceiptInfo.amount)}\n?? Data: ${paymentReceiptInfo.date}\n?? Saldo Restante: ${formatCurrency(paymentReceiptInfo.remainingBalance)}${paymentReceiptInfo.isCompleted ? "\n\n? *Contrato Quitado!*" : ""}`
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
                    <body><h2>?? Comprovante de Pagamento</h2>
                    <table><tr><td>Tipo:</td><td>${paymentReceiptInfo.type}</td></tr>
                    <tr><td>Cliente:</td><td>${paymentReceiptInfo.clientName}</td></tr>
                    <tr><td>Parcela:</td><td>${paymentReceiptInfo.installmentLabel}</td></tr>
                    <tr><td>Valor Pago:</td><td style="color:#059669">${formatCurrency(paymentReceiptInfo.amount)}</td></tr>
                    <tr><td>Data:</td><td>${paymentReceiptInfo.date}</td></tr>
                    <tr><td>Saldo Restante:</td><td>${formatCurrency(paymentReceiptInfo.remainingBalance)}</td></tr></table>
                    ${paymentReceiptInfo.isCompleted ? '<div class="badge">? Contrato Quitado!</div>' : ""}
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
                      ? "border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/5"
                      : isOverdue
                      ? "border-red-500/20 bg-red-50 dark:bg-red-950/5"
                      : "border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isPaid ? "bg-primary/5 dark:bg-primary/20 text-primary" : isOverdue ? "bg-red-50 dark:bg-red-950/20 text-red-600" : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
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
                      ? "bg-primary/5 dark:bg-primary/20 text-primary border-primary/30"
                      : isOverdue
                      ? "bg-red-50 dark:bg-red-950/20 text-red-600 border-red-500/30"
                      : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 border-amber-500/30"
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

      {/* ===== ETIQUETAS DIALOG ===== */}
      <Dialog open={Boolean(tagDialogSale)} onClose={() => setTagDialogSale(null)} title="Gerenciar Etiquetas" className="max-w-sm">
        {tagDialogSale && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{tagDialogSale.description}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{tagDialogSale.client?.name}</p>
            </div>

            {editingTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {editingTags.map((tag, i) => {
                  const [name, color] = tag.split("|")
                  return (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: `${color}20`, color }}>
                      {name}
                      <button onClick={() => setEditingTags(editingTags.filter((_, j) => j !== i))} className="hover:opacity-70">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            <div>
              <Label className="text-xs">Nova etiqueta</Label>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Nome da etiqueta..."
                className="mt-1 text-sm dark:bg-[#121614] dark:border-[#29322E]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const val = tagInput.trim()
                    if (val && !editingTags.some((t) => t.split("|")[0] === val)) {
                      setEditingTags([...editingTags, `${val}|${tagColor}`])
                      setTagInput("")
                    }
                  }
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTagColor(c)}
                  className={`h-6 w-6 rounded-full transition-all ${tagColor === c ? "ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-zinc-900 scale-110" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setTagDialogSale(null)}>Cancelar</Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={savingTags}
                onClick={async () => {
                  const val = tagInput.trim()
                  const finalTags = val && !editingTags.some((t) => t.split("|")[0] === val)
                    ? [...editingTags, `${val}|${tagColor}`]
                    : editingTags
                  await persistSaleTags(tagDialogSale, finalTags)
                  setTagDialogSale(null)
                }}
              >
                {savingTags ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

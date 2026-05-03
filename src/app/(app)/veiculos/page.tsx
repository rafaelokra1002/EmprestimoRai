"use client"

import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus, Trash2, Search, Car, Pencil, ChevronDown, ChevronUp,
  DollarSign, CheckCircle2, TrendingUp, FileText, User, MessageCircle,
  Link as LinkIcon
} from "lucide-react"
import { formatCurrency, formatDate, localDateStr } from "@/lib/utils"

type FilterType = "todos" | "em_dia" | "em_atraso" | "quitados"

export default function VeiculosPage() {
  const INSTALLMENTS_META_TAG = "__VEHICLE_INSTALLMENTS__"

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

  const stripInstallmentsMetaFromNotes = (notes?: string | null) => {
    if (!notes) return ""
    const index = notes.indexOf(INSTALLMENTS_META_TAG)
    if (index === -1) return notes.trim()
    return notes.slice(0, index).trim()
  }

  const extractInstallmentsMeta = (notes?: string | null) => {
    if (!notes) return null
    const index = notes.indexOf(INSTALLMENTS_META_TAG)
    if (index === -1) return null
    const raw = notes.slice(index + INSTALLMENTS_META_TAG.length).trim()
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      return parsed
        .map((item: any, idx: number) => ({
          number: Number(item?.number || idx + 1),
          dueDate: String(item?.dueDate || ""),
          amount: Number(item?.amount || 0),
        }))
        .filter((item: any) => item.dueDate && Number.isFinite(item.amount))
    } catch {
      return null
    }
  }

  const buildNotesWithInstallmentsMeta = (
    notes: string,
    installments: Array<{ number: number; dueDate: string; amount: number }> | null
  ) => {
    const cleanedNotes = stripInstallmentsMetaFromNotes(notes)
    if (!installments || installments.length === 0) {
      return cleanedNotes
    }
    const serialized = JSON.stringify(
      installments.map((item) => ({
        number: item.number,
        dueDate: item.dueDate,
        amount: item.amount,
      }))
    )
    return cleanedNotes
      ? `${cleanedNotes}\n\n${INSTALLMENTS_META_TAG}${serialized}`
      : `${INSTALLMENTS_META_TAG}${serialized}`
  }

  const [vehicles, setVehicles] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [editingVehicleData, setEditingVehicleData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterType>("todos")
  const [expandedParcelas, setExpandedParcelas] = useState<string | null>(null)

  // Form state
  const [fBrand, setFBrand] = useState("")
  const [fModel, setFModel] = useState("")
  const [fYear, setFYear] = useState(String(new Date().getFullYear()))
  const [fColor, setFColor] = useState("")
  const [fPlate, setFPlate] = useState("")
  const [fChassis, setFChassis] = useState("")
  const [fSelectedClientId, setFSelectedClientId] = useState("")
  const [fBuyerName, setFBuyerName] = useState("")
  const [fBuyerPhone, setFBuyerPhone] = useState("")
  const [fBuyerEmail, setFBuyerEmail] = useState("")
  const [fBuyerCpf, setFBuyerCpf] = useState("")
  const [fBuyerRg, setFBuyerRg] = useState("")
  const [fBuyerAddress, setFBuyerAddress] = useState("")
  const [fOriginName, setFOriginName] = useState("")
  const [fSaleDate, setFSaleDate] = useState("")
  const [fPurchasePrice, setFPurchasePrice] = useState("")
  const [fSalePrice, setFSalePrice] = useState("")
  const [fDownPayment, setFDownPayment] = useState("0")
  const [fInstallments, setFInstallments] = useState("12")
  const [fFrequency, setFFrequency] = useState("MONTHLY")
  const [fFirstDueDate, setFFirstDueDate] = useState("")
  const [fWhatsapp, setFWhatsapp] = useState(false)
  const [fNotes, setFNotes] = useState("")
  const [fInstallmentRows, setFInstallmentRows] = useState<Array<{ number: number; dueDate: string; amount: string }>>([])

  // Calculated installment value
  const calcInstallmentValue = useMemo(() => {
    const price = parseMoneyBR(fSalePrice)
    const entrada = parseMoneyBR(fDownPayment)
    const count = parseInt(fInstallments) || 1
    if (count <= 0 || price <= 0) return 0
    return Math.round(((price - entrada) / count) * 100) / 100
  }, [fSalePrice, fDownPayment, fInstallments])

  const estimatedProfit = useMemo(() => {
    return parseMoneyBR(fSalePrice) - parseMoneyBR(fPurchasePrice)
  }, [fSalePrice, fPurchasePrice])

  const estimatedProfitPct = useMemo(() => {
    const cost = parseMoneyBR(fPurchasePrice)
    if (cost <= 0) return 0
    return (estimatedProfit / cost) * 100
  }, [estimatedProfit, fPurchasePrice])

  const frequencyLabel = useMemo(() => {
    const map: Record<string, string> = {
      MONTHLY: "As demais parcelas serão geradas no mesmo dia do mês",
      BIWEEKLY: "As demais parcelas serão geradas a cada 15 dias",
      WEEKLY: "As demais parcelas serão geradas semanalmente",
      DAILY: "As demais parcelas serão geradas diariamente",
    }
    return map[fFrequency] || ""
  }, [fFrequency])

  const fetchVehicles = async () => {
    const res = await fetch("/api/vehicles")
    const data = await res.json()
    setVehicles(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    fetchVehicles()
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(Array.isArray(d) ? d : []))
  }, [])

  // Select client to auto-fill buyer data
  const handleSelectClient = (clientId: string) => {
    setFSelectedClientId(clientId)
    if (clientId) {
      const c = clients.find((cl: any) => cl.id === clientId)
      if (c) {
        setFBuyerName(c.name || "")
        setFBuyerPhone(c.phone || "")
        setFBuyerEmail(c.email || "")
        setFBuyerCpf(c.document || "")
        setFBuyerRg(c.rg || "")
        setFBuyerAddress([c.address, c.number, c.neighborhood, c.city].filter(Boolean).join(", ") || "")
      }
    } else {
      setFBuyerName(""); setFBuyerPhone(""); setFBuyerEmail("")
      setFBuyerCpf(""); setFBuyerRg(""); setFBuyerAddress("")
    }
  }

  const resetForm = () => {
    setFBrand(""); setFModel(""); setFYear(String(new Date().getFullYear()))
    setFColor(""); setFPlate(""); setFChassis("")
    setFSelectedClientId(""); setFBuyerName(""); setFBuyerPhone("")
    setFBuyerEmail(""); setFBuyerCpf(""); setFBuyerRg(""); setFBuyerAddress("")
    setFOriginName(""); setFSaleDate(""); setFPurchasePrice("")
    setFSalePrice(""); setFDownPayment("0"); setFInstallments("12")
    setFFrequency("MONTHLY"); setFFirstDueDate(""); setFWhatsapp(false); setFNotes("")
    setFInstallmentRows([])
  }

  const openNewVehicle = () => {
    setEditingVehicleId(null)
    setEditingVehicleData(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEditVehicle = (vehicle: any) => {
    setEditingVehicleId(vehicle.id)
    setEditingVehicleData(vehicle)
    setFBrand(vehicle.brand || "")
    setFModel(vehicle.model || "")
    setFYear(String(vehicle.year || new Date().getFullYear()))
    setFColor(vehicle.color || "")
    setFPlate(vehicle.plate || "")
    setFChassis(vehicle.chassis || "")

    setFSelectedClientId(vehicle.clientId || "")
    setFBuyerName(vehicle.buyerName || vehicle.client?.name || "")
    setFBuyerPhone(vehicle.buyerPhone || vehicle.client?.phone || "")
    setFBuyerEmail(vehicle.buyerEmail || vehicle.client?.email || "")
    setFBuyerCpf(vehicle.buyerCpf || vehicle.client?.document || "")
    setFBuyerRg(vehicle.buyerRg || vehicle.client?.rg || "")
    setFBuyerAddress(vehicle.buyerAddress || vehicle.client?.address || "")

    setFOriginName(vehicle.originName || "")
    setFSaleDate(vehicle.saleDate ? localDateStr(vehicle.saleDate) : "")
    setFPurchasePrice(formatMoneyBR(Number(vehicle.purchasePrice || 0)))
    setFSalePrice(formatMoneyBR(Number(vehicle.salePrice || 0)))
    setFDownPayment(formatMoneyBR(Number(vehicle.downPayment || 0)))
    setFInstallments(String(vehicle.installmentCount || 1))
    setFFrequency(vehicle.modality || "MONTHLY")
    setFFirstDueDate(vehicle.firstDueDate ? localDateStr(vehicle.firstDueDate) : "")
    setFWhatsapp(Boolean(vehicle.whatsappNotify))
    setFNotes(stripInstallmentsMetaFromNotes(vehicle.notes || ""))

    const customInstallments = extractInstallmentsMeta(vehicle.notes)
    if (customInstallments && customInstallments.length > 0) {
      setFInstallmentRows(
        customInstallments.map((item: any, idx: number) => ({
          number: idx + 1,
          dueDate: localDateStr(item.dueDate),
          amount: formatMoneyBR(Number(item.amount || 0)),
        }))
      )
    } else {
      const baseRows = generateInstallments(vehicle).map((item: any) => ({
        number: item.number,
        dueDate: localDateStr(item.dueDate),
        amount: formatMoneyBR(Number(item.amount || 0)),
      }))
      setFInstallmentRows(baseRows)
    }
    setDialogOpen(true)
  }

  const handleMarkInstallmentPaid = async (amount: number) => {
    if (!editingVehicleId) return
    await fetch(`/api/vehicles/${editingVehicleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addPayment: amount }),
    })
    await fetchVehicles()
    const updatedList = await fetch("/api/vehicles").then((res) => res.json())
    const updatedVehicle = Array.isArray(updatedList)
      ? updatedList.find((vehicle: any) => vehicle.id === editingVehicleId)
      : null
    if (updatedVehicle) {
      openEditVehicle(updatedVehicle)
    }
  }

  const handleSubmitVehicle = async () => {
    const serializedInstallments = editingVehicleId
      ? fInstallmentRows.map((item) => ({
          number: item.number,
          dueDate: item.dueDate,
          amount: parseMoneyBR(item.amount),
        }))
      : null

    const payload = {
      brand: fBrand,
      model: fModel,
      year: parseInt(fYear) || new Date().getFullYear(),
      plate: fPlate || undefined,
      color: fColor || undefined,
      chassis: fChassis || undefined,
      purchasePrice: parseMoneyBR(fPurchasePrice),
      salePrice: parseMoneyBR(fSalePrice) || undefined,
      downPayment: parseMoneyBR(fDownPayment),
      installmentCount: parseInt(fInstallments) || 1,
      modality: fFrequency,
      saleDate: fSaleDate || undefined,
      firstDueDate: fFirstDueDate || undefined,
      clientId: fSelectedClientId || undefined,
      originName: fOriginName || undefined,
      buyerName: fBuyerName || undefined,
      buyerPhone: fBuyerPhone || undefined,
      buyerEmail: fBuyerEmail || undefined,
      buyerCpf: fBuyerCpf || undefined,
      buyerRg: fBuyerRg || undefined,
      buyerAddress: fBuyerAddress || undefined,
      whatsappNotify: fWhatsapp,
      notes: buildNotesWithInstallmentsMeta(fNotes, serializedInstallments) || undefined,
    }

    const url = editingVehicleId ? `/api/vehicles/${editingVehicleId}` : "/api/vehicles"
    const method = editingVehicleId ? "PUT" : "POST"

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setDialogOpen(false)
    setEditingVehicleId(null)
    setEditingVehicleData(null)
    resetForm()
    fetchVehicles()
  }

  useEffect(() => {
    if (!editingVehicleId) return
    const targetCount = Math.max(1, parseInt(fInstallments) || 1)
    setFInstallmentRows((previousRows) => {
      if (previousRows.length === targetCount) return previousRows

      if (previousRows.length > targetCount) {
        return previousRows.slice(0, targetCount).map((row, idx) => ({ ...row, number: idx + 1 }))
      }

      const nextRows = [...previousRows]
      for (let index = previousRows.length; index < targetCount; index += 1) {
        const baseDate = nextRows[index - 1]?.dueDate || fFirstDueDate || localDateStr()
        const date = new Date(baseDate)
        if (index > 0) {
          if (fFrequency === "WEEKLY") date.setDate(date.getDate() + 7)
          else if (fFrequency === "BIWEEKLY") date.setDate(date.getDate() + 15)
          else if (fFrequency === "DAILY") date.setDate(date.getDate() + 1)
          else date.setMonth(date.getMonth() + 1)
        }

        nextRows.push({
          number: index + 1,
          dueDate: localDateStr(date),
          amount: formatMoneyBR(calcInstallmentValue || 0),
        })
      }
      return nextRows
    })
  }, [editingVehicleId, fInstallments, fFrequency, fFirstDueDate, calcInstallmentValue])

  const handleDelete = async (id: string) => {
    if (confirm("Excluir este veículo?")) {
      await fetch(`/api/vehicles/${id}`, { method: "DELETE" })
      fetchVehicles()
    }
  }

  const handlePayVehicleInstallment = async (vehicleId: string, amount: number) => {
    const confirmed = confirm(`Confirmar pagamento da parcela no valor de ${formatCurrency(amount)}?`)
    if (!confirmed) return

    await fetch(`/api/vehicles/${vehicleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addPayment: amount }),
    })
    fetchVehicles()
  }

  // Helpers
  const getVehicleStatus = (v: any) => {
    const salePrice = v.salePrice || 0
    const paidAmount = v.paidAmount || 0
    if (salePrice > 0 && paidAmount >= salePrice) return "quitado"
    if (salePrice > 0) {
      // Check if overdue based on firstDueDate
      const now = new Date()
      const installmentValue = salePrice / (v.installmentCount || 1)
      const expectedPaid = Math.min(v.installmentCount || 1, Math.floor((now.getTime() - new Date(v.firstDueDate || v.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1) * installmentValue
      if (paidAmount < expectedPaid && v.firstDueDate) return "atraso"
      return "em_dia"
    }
    return "em_dia"
  }

  const getVehicleLucro = (v: any) => (v.salePrice || 0) - v.purchasePrice
  const getVehicleFalta = (v: any) => Math.max((v.salePrice || 0) - (v.paidAmount || 0), 0)

  // Stats
  const totalVehicles = vehicles.length
  const totalQuitados = vehicles.filter(v => getVehicleStatus(v) === "quitado").length
  const totalRecebido = vehicles.reduce((s, v) => s + (v.paidAmount || 0), 0)
  const totalLucro = vehicles.reduce((s, v) => s + getVehicleLucro(v), 0)

  // Filter + search
  const filteredVehicles = useMemo(() => {
    let list = vehicles
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(v =>
        v.brand?.toLowerCase().includes(q) ||
        v.model?.toLowerCase().includes(q) ||
        v.client?.name?.toLowerCase().includes(q) ||
        v.buyerName?.toLowerCase().includes(q) ||
        v.plate?.toLowerCase().includes(q)
      )
    }
    if (activeFilter === "em_dia") list = list.filter(v => getVehicleStatus(v) === "em_dia")
    else if (activeFilter === "em_atraso") list = list.filter(v => getVehicleStatus(v) === "atraso")
    else if (activeFilter === "quitados") list = list.filter(v => getVehicleStatus(v) === "quitado")
    return list
  }, [vehicles, search, activeFilter])

  const countAll = vehicles.length
  const countEmDia = vehicles.filter(v => getVehicleStatus(v) === "em_dia").length
  const countAtraso = vehicles.filter(v => getVehicleStatus(v) === "atraso").length
  const countQuitados = vehicles.filter(v => getVehicleStatus(v) === "quitado").length

  const filters: { key: FilterType; label: string; count: number; icon?: string }[] = [
    { key: "todos", label: "Todos", count: countAll },
    { key: "em_dia", label: "Em dia", count: countEmDia },
    { key: "em_atraso", label: "Em atraso", count: countAtraso, icon: "⚠" },
    { key: "quitados", label: "Quitados", count: countQuitados, icon: "✓" },
  ]

  const isFormValid = fBrand.trim() && fModel.trim() && fYear

  // Generate virtual installments for display
  const generateInstallments = (v: any) => {
    const count = v.installmentCount || 1
    const salePrice = v.salePrice || 0
    const downPayment = v.downPayment || 0
    const instValue = count > 0 ? Math.round(((salePrice - downPayment) / count) * 100) / 100 : 0
    let paid = (v.paidAmount || 0) - downPayment
    const firstDate = v.firstDueDate ? new Date(v.firstDueDate) : new Date(v.createdAt)
    const now = new Date()

    const customInstallments = extractInstallmentsMeta(v.notes)
    const baseInstallments = customInstallments && customInstallments.length > 0
      ? customInstallments.map((item: any, idx: number) => ({
          number: idx + 1,
          amount: Number(item.amount || 0),
          dueDate: localDateStr(item.dueDate),
        }))
      : Array.from({ length: count }, (_, i) => {
          const dueDate = new Date(firstDate)
          if (v.modality === "WEEKLY") dueDate.setDate(dueDate.getDate() + i * 7)
          else if (v.modality === "BIWEEKLY") dueDate.setDate(dueDate.getDate() + i * 15)
          else if (v.modality === "DAILY") dueDate.setDate(dueDate.getDate() + i)
          else dueDate.setMonth(dueDate.getMonth() + i)

          return {
            number: i + 1,
            amount: instValue,
            dueDate: localDateStr(dueDate),
          }
        })

    return baseInstallments.map((item: any) => {
      const amount = Number(item.amount || 0)
      const dueDate = new Date(item.dueDate)
      const isPaid = paid >= amount
      if (isPaid) paid -= amount
      const isOverdue = !isPaid && dueDate < now

      return {
        number: item.number,
        amount,
        dueDate: localDateStr(dueDate),
        status: isPaid ? "PAID" : isOverdue ? "OVERDUE" : "PENDING",
      }
    })
  }

  return (
    <div className="space-y-6 pt-6 pb-12">
      {/* ===== HEADER ===== */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Veículos</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Gerencie suas vendas de veículos</p>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <LinkIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Total</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{totalVehicles}</p>
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Quitados</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{totalQuitados}</p>
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-primary">Recebido</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{formatCurrency(totalRecebido)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/80 p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-primary">Lucro Total</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-primary">{formatCurrency(totalLucro)}</p>
          </div>
        </div>
      </div>

      {/* ===== SEARCH + NEW BUTTON ===== */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
          <Input
            placeholder="Buscar por marca, modelo ou comprador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={openNewVehicle} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Novo Veículo
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

      {/* ===== VEHICLE CARDS ===== */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-zinc-400">Carregando...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500">
          <Car className="h-12 w-12 mx-auto mb-3 text-gray-500 dark:text-zinc-400" />
          <p className="text-sm">Nenhum veículo encontrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVehicles.map((v) => {
            const lucro = getVehicleLucro(v)
            const falta = getVehicleFalta(v)
            const salePrice = v.salePrice || 0
            const paidAmount = v.paidAmount || 0
            const paidCount = salePrice > 0 ? Math.min(v.installmentCount || 1, Math.floor(paidAmount / (salePrice / (v.installmentCount || 1)))) : 0
            const lucroPct = v.purchasePrice > 0 ? ((lucro / v.purchasePrice) * 100).toFixed(1) : "0"
            const buyerLabel = v.buyerName || v.client?.name || "—"
            const isExpanded = expandedParcelas === v.id
            const installments = isExpanded ? generateInstallments(v) : []

            return (
              <div key={v.id} className="rounded-xl border border-primary/30 dark:border-primary/30 bg-gray-50 dark:bg-zinc-800/80 overflow-hidden">
                {/* Card Header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 flex items-center justify-center">
                        <Car className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm uppercase">{v.brand} {v.model}</p>
                          <Badge className="bg-gray-200 dark:bg-zinc-700/50 text-gray-700 dark:text-zinc-300 border-gray-300 dark:border-zinc-700 text-[10px] px-1.5 py-0">
                            <FileText className="h-3 w-3 mr-1" /> Comprovante
                          </Badge>
                          <Badge className="bg-primary/5 dark:bg-primary/150/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                            {v.installmentCount}x
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                          {v.year} {v.color ? `• ${v.color.toUpperCase()}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info rows */}
                <div className="px-4 space-y-1 pb-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-zinc-400">Comprador</span>
                    <span className="text-gray-900 dark:text-zinc-100 font-medium">{buyerLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-zinc-400">Custo</span>
                    <span className="text-gray-900 dark:text-zinc-100">{formatCurrency(v.purchasePrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-zinc-400">Valor venda</span>
                    <span className="text-gray-900 dark:text-zinc-100 font-bold">{salePrice > 0 ? formatCurrency(salePrice) : "—"}</span>
                  </div>
                </div>

                {/* Lucro / Recebido / Falta bars */}
                {salePrice > 0 && (
                  <div className="mx-4 mb-3 space-y-1.5">
                    <div className="flex items-center justify-between rounded-lg bg-primary/5 dark:bg-primary/150/10 border border-primary/30 dark:border-primary/30 px-3 py-2">
                      <span className="text-sm text-gray-700 dark:text-zinc-300">Lucro</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold tabular-nums text-primary">{formatCurrency(lucro)}</span>
                        <span className="text-xs text-gray-400 dark:text-zinc-500">({lucroPct}%)</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-primary/5 dark:bg-primary/150/10 border border-primary/30 dark:border-primary/30 px-3 py-2">
                      <span className="text-sm text-gray-700 dark:text-zinc-300">Recebido</span>
                      <span className="text-sm font-bold tabular-nums text-primary">{formatCurrency(paidAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/300/10 border border-amber-500/20 px-3 py-2">
                      <span className="text-sm text-gray-700 dark:text-zinc-300">Falta</span>
                      <span className="text-sm font-bold tabular-nums text-red-600">{formatCurrency(falta)}</span>
                    </div>
                  </div>
                )}

                {/* Parcelas expandable */}
                {isExpanded && installments.length > 0 && (
                  <div className="mx-4 mb-3 space-y-1.5">
                    {installments.map((inst) => {
                      const isPaid = inst.status === "PAID"
                      const isOverdue = inst.status === "OVERDUE"
                      return (
                        <div
                          key={inst.number}
                          className={`rounded-lg border p-2.5 flex items-center justify-between text-sm ${
                            isPaid
                              ? "border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/150/5"
                              : isOverdue
                              ? "border-red-500/20 bg-red-50 dark:bg-red-950/300/5"
                              : "border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800/30"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              isPaid ? "bg-primary/5 dark:bg-primary/150/20 text-primary" : isOverdue ? "bg-red-50 dark:bg-red-950/300/20 text-red-600" : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
                            }`}>
                              {inst.number}
                            </div>
                            <span className="text-gray-700 dark:text-zinc-300">{formatDate(inst.dueDate)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-zinc-100">{formatCurrency(inst.amount)}</span>
                            <Badge className={`text-[10px] ${
                              isPaid ? "bg-primary/5 dark:bg-primary/150/20 text-primary border-primary/30"
                              : isOverdue ? "bg-red-50 dark:bg-red-950/300/20 text-red-600 border-red-500/30"
                              : "bg-amber-50 dark:bg-amber-950/300/20 text-amber-600 border-amber-500/30"
                            }`}>
                              {isPaid ? "Pago" : isOverdue ? "Vencido" : "Pendente"}
                            </Badge>
                            {!isPaid && (
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 bg-primary px-3 text-xs hover:bg-primary/90"
                                onClick={() => handlePayVehicleInstallment(v.id, inst.amount)}
                              >
                                Pagar
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 p-4 pt-3 border-t border-gray-200 dark:border-zinc-800">
                  <Button
                    variant="outline"
                    onClick={() => setExpandedParcelas(isExpanded ? null : v.id)}
                    className="flex-1 gap-2 text-sm h-9"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Parcelas
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => openEditVehicle(v)}
                  >
                    <Pencil className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleDelete(v.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== CADASTRAR VEÍCULO DIALOG ===== */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditingVehicleId(null)
          setEditingVehicleData(null)
        }}
        title={editingVehicleId ? "Editar Veículo" : "Cadastrar Veículo"}
        className="max-w-4xl"
      >
        <div className="space-y-5">
          {/* Vehicle Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Marca *</Label>
              <Input value={fBrand} onChange={(e) => setFBrand(e.target.value)} className="mt-1" placeholder="Ex: Honda, Toyota..." />
            </div>
            <div>
              <Label className="font-semibold">Modelo *</Label>
              <Input value={fModel} onChange={(e) => setFModel(e.target.value)} className="mt-1" placeholder="Ex: Civic, Corolla..." />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="font-semibold">Ano *</Label>
              <Input type="number" value={fYear} onChange={(e) => setFYear(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="font-semibold">Cor</Label>
              <Input value={fColor} onChange={(e) => setFColor(e.target.value)} className="mt-1" placeholder="Ex: Preto, Branco..." />
            </div>
            <div>
              <Label className="font-semibold">Placa</Label>
              <Input value={fPlate} onChange={(e) => setFPlate(e.target.value)} className="mt-1" placeholder="ABC-1234" />
            </div>
          </div>

          <div>
            <Label className="font-semibold">Chassis</Label>
            <Input value={fChassis} onChange={(e) => setFChassis(e.target.value)} className="mt-1" placeholder="Número do chassis" />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-zinc-800 pt-4">
            <h3 className="text-sm font-semibold text-primary mb-4">Dados da Venda</h3>
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
                value={fSelectedClientId}
                onChange={(e) => handleSelectClient(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-zinc-100 appearance-none"
              >
                <option value="">Selecionar comprador...</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Selecione um cliente para preencher os dados do comprador automaticamente.</p>
          </div>

          {/* Buyer fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Vendido para (Comprador) *</Label>
              <Input value={fBuyerName} onChange={(e) => setFBuyerName(e.target.value)} className="mt-1" placeholder="Nome do comprador" />
            </div>
            <div>
              <Label className="font-semibold">Origem (Comprado de)</Label>
              <Input value={fOriginName} onChange={(e) => setFOriginName(e.target.value)} className="mt-1" placeholder="Nome do vendedor original" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Telefone do comprador</Label>
              <Input value={fBuyerPhone} onChange={(e) => setFBuyerPhone(e.target.value)} className="mt-1" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label className="font-semibold">E-mail do comprador</Label>
              <Input value={fBuyerEmail} onChange={(e) => setFBuyerEmail(e.target.value)} className="mt-1" placeholder="email@exemplo.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">CPF</Label>
              <Input value={fBuyerCpf} onChange={(e) => setFBuyerCpf(e.target.value)} className="mt-1" placeholder="000.000.000-00" />
            </div>
            <div>
              <Label className="font-semibold">RG</Label>
              <Input value={fBuyerRg} onChange={(e) => setFBuyerRg(e.target.value)} className="mt-1" placeholder="00.000.000-0" />
            </div>
          </div>

          <div>
            <Label className="font-semibold">Endereço</Label>
            <Input value={fBuyerAddress} onChange={(e) => setFBuyerAddress(e.target.value)} className="mt-1" placeholder="Rua, número, bairro, cidade..." />
          </div>

          {/* Sale Date + Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Data da venda</Label>
              <Input type="date" value={fSaleDate} onChange={(e) => setFSaleDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="font-semibold">Custo de aquisição (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={fPurchasePrice}
                onChange={(e) => setFPurchasePrice(normalizeMoneyInput(e.target.value))}
                onBlur={() => formatMoneyInputOnBlur(fPurchasePrice, setFPurchasePrice)}
                className="mt-1"
                placeholder="Quanto você pagou"
              />
            </div>
          </div>

          {/* Sale Price + Profit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Valor de venda (R$) *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={fSalePrice}
                onChange={(e) => setFSalePrice(normalizeMoneyInput(e.target.value))}
                onBlur={() => formatMoneyInputOnBlur(fSalePrice, setFSalePrice)}
                className="mt-1"
                placeholder="Quanto está vendendo"
              />
            </div>
            <div>
              <Label className="font-semibold">Lucro estimado</Label>
              <div className="mt-1 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/150/10 px-3 py-2">
                <p className="text-2xl font-bold tabular-nums tracking-tight text-primary">{formatCurrency(estimatedProfit)}</p>
                <p className="text-sm text-primary">({estimatedProfitPct.toFixed(1)}%)</p>
              </div>
            </div>
          </div>

          {/* Parcelamento section */}
          <div className="border-t border-gray-200 dark:border-zinc-800 pt-4">
            <h3 className="text-sm font-semibold text-primary mb-4">Parcelamento</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Frequência de Pagamento *</Label>
              <select
                value={fFrequency}
                onChange={(e) => setFFrequency(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 mt-1"
              >
                <option value="MONTHLY">Mensal</option>
                <option value="BIWEEKLY">Quinzenal</option>
                <option value="WEEKLY">Semanal</option>
                <option value="DAILY">Diário</option>
              </select>
            </div>
            <div>
              <Label className="font-semibold">Primeiro vencimento *</Label>
              <Input type="date" value={fFirstDueDate} onChange={(e) => setFFirstDueDate(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="font-semibold">Entrada (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={fDownPayment}
                onChange={(e) => setFDownPayment(normalizeMoneyInput(e.target.value))}
                onBlur={() => formatMoneyInputOnBlur(fDownPayment, setFDownPayment)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-semibold">Nº de parcelas *</Label>
              <Input type="number" min="1" value={fInstallments} onChange={(e) => setFInstallments(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="font-semibold">Valor da parcela *</Label>
              <Input
                type="text"
                value={calcInstallmentValue > 0 ? formatMoneyBR(calcInstallmentValue) : "0,00"}
                readOnly
                className="mt-1 opacity-70 cursor-not-allowed"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-zinc-500 -mt-2">{frequencyLabel}</p>

          {editingVehicleData && (() => {
            let paidBalance = (editingVehicleData.paidAmount || 0) - parseMoneyBR(fDownPayment)
            const installmentsWithStatus = fInstallmentRows.map((row) => {
              const amount = parseMoneyBR(row.amount)
              const isPaid = paidBalance >= amount && amount > 0
              if (isPaid) paidBalance -= amount
              const dueDate = new Date(row.dueDate)
              const isOverdue = !isPaid && dueDate < new Date()
              return {
                ...row,
                amountNumber: amount,
                status: isPaid ? "PAID" : isOverdue ? "OVERDUE" : "PENDING",
              }
            })

            const paidInstallments = installmentsWithStatus.filter((inst) => inst.status === "PAID").length
            const paidValue = editingVehicleData.paidAmount || 0
            return (
              <>
                <div className="rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/150/10 px-3 py-2 text-primary font-semibold">
                  {paidInstallments} parcela(s) paga(s) = {formatCurrency(paidValue)}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Datas das Parcelas ({installmentsWithStatus.length})</p>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-primary/30 bg-gray-50 dark:bg-zinc-800/60 p-3">
                    {installmentsWithStatus.map((inst, index) => {
                      const isPaid = inst.status === "PAID"
                      return (
                        <div key={inst.number} className="grid grid-cols-[40px_1fr_110px_88px] items-center gap-2 rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/80 p-2">
                          <span className="text-lg font-bold text-gray-800 dark:text-zinc-200">{inst.number}ª</span>
                          <Input
                            type="date"
                            value={inst.dueDate}
                            onChange={(event) => {
                              const nextRows = [...fInstallmentRows]
                              nextRows[index] = { ...nextRows[index], dueDate: event.target.value }
                              setFInstallmentRows(nextRows)
                            }}
                            className="h-9"
                          />
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={inst.amount}
                            onChange={(event) => {
                              const nextRows = [...fInstallmentRows]
                              nextRows[index] = {
                                ...nextRows[index],
                                amount: normalizeMoneyInput(event.target.value),
                              }
                              setFInstallmentRows(nextRows)
                            }}
                            onBlur={() => {
                              const nextRows = [...fInstallmentRows]
                              nextRows[index] = {
                                ...nextRows[index],
                                amount: formatMoneyBR(parseMoneyBR(nextRows[index].amount)),
                              }
                              setFInstallmentRows(nextRows)
                            }}
                            className="h-9"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9"
                            disabled={isPaid}
                            onClick={() => handleMarkInstallmentPaid(inst.amountNumber)}
                          >
                            {isPaid ? "Pago" : "Marcar"}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )
          })()}

          {/* Notes */}
          <div>
            <Label className="font-semibold">Observações</Label>
            <Textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} className="mt-1" placeholder="Notas adicionais sobre o veículo..." rows={3} />
          </div>

          {/* WhatsApp */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/60 cursor-pointer">
            <input
              type="checkbox"
              checked={fWhatsapp}
              onChange={(e) => setFWhatsapp(e.target.checked)}
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

          {/* Submit */}
          <Button
            onClick={handleSubmitVehicle}
            disabled={!isFormValid}
            className="w-full bg-primary hover:bg-primary/90 h-11 text-sm font-semibold disabled:opacity-40"
          >
            {editingVehicleId ? "Salvar Alterações" : "Cadastrar Veículo"}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

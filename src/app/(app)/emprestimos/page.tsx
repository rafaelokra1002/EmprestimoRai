"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/avatar"
import {
  Plus, Trash2, DollarSign, Search, Clock, Pencil, FolderOpen,
  LayoutGrid, List, Filter, ChevronDown, Receipt, Calendar, Eye, FileText, RotateCcw,
  Copy, ExternalLink, Download, CheckCircle2, User, Lock, TrendingUp, ArrowRight, MoreHorizontal, Check, Tag, X,
  MessageCircle, Send, Loader2
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatDate, calculateLoan, generateInstallmentDates, resolveDailyInterestAmount, localDateStr } from "@/lib/utils"
import { buildLoanData, calculateTotalAmountWithLateFee, calculateOverdueInterest, getDaysOverdue, getNextDueDate, getOverdueDailyAmountBRL, getPaidExcludingInterest } from "@/lib/loan-logic"

interface Loan {
  id: string
  amount: number
  interestRate: number
  interestType: string
  modality: string
  totalAmount: number
  totalInterest: number
  installmentValue: number
  profit: number
  installmentCount: number
  contractDate: string
  firstInstallmentDate: string
  startDate: string
  status: string
  dailyInterest: boolean
  dailyInterestAmount: number
  penaltyFee: number
  lateCycles: number
  dueDay: number
  whatsappNotify: boolean
  notes: string | null
  tags: string[]
  createdAt: string
  client: { id: string; name: string; photo: string | null; status?: string }
  installments: any[]
  payments: any[]
}

interface Client {
  id: string
  name: string
  phone: string | null
  document: string | null
  photo: string | null
  status?: string
}

const today = () => localDateStr()

const getTagName = (tag: string) => (tag.includes("|") ? tag.split("|")[0] : tag).trim()

export default function EmprestimosPage() {
  const router = useRouter()
  const [loans, setLoans] = useState<Loan[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [paymentDialog, setPaymentDialog] = useState<Loan | null>(null)
  const [newClientDialog, setNewClientDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"all" | "daily" | "price" | "received">("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [loanFilter, setLoanFilter] = useState<"all" | "on_time" | "due_today" | "overdue" | "installments" | "interest_only" | "monthly" | "tagged">("all")
  const [filterOpen, setFilterOpen] = useState(false)
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [payMenuOpen, setPayMenuOpen] = useState<string | null>(null)
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null)
  const [tagDialog, setTagDialog] = useState<Loan | null>(null)
  const [tagInput, setTagInput] = useState("")
  const [tagColor, setTagColor] = useState("#10b981")
  const [editingTags, setEditingTags] = useState<string[]>([])
  const [showTagForm, setShowTagForm] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // Profile PIX key & phone
  const [profilePixKey, setProfilePixKey] = useState("")
  const [profilePhone, setProfilePhone] = useState("")

  // WhatsApp cobrança state
  const [whatsappDialog, setWhatsappDialog] = useState(false)
  const [whatsappLoan, setWhatsappLoan] = useState<Loan | null>(null)
  const [whatsappMessage, setWhatsappMessage] = useState("")
  const [whatsappSending, setWhatsappSending] = useState(false)
  const [whatsappSent, setWhatsappSent] = useState(false)

  // WhatsApp bulk send state
  const [bulkSendingOverdue, setBulkSendingOverdue] = useState(false)
  const [bulkSendingDueToday, setBulkSendingDueToday] = useState(false)
  const [bulkResultDialog, setBulkResultDialog] = useState<{ type: string; sent: number; failed: number; total: number } | null>(null)

  // Payment receipt dialog state
  const [paymentReceiptDialog, setPaymentReceiptDialog] = useState(false)
  const [paymentReceiptInfo, setPaymentReceiptInfo] = useState<{
    type: string
    clientName: string
    clientPhone: string | null
    installmentLabel: string
    amount: number
    date: string
    isCompleted: boolean
    remainingBalance: number
  } | null>(null)

  // Payment dialog state
  const [paymentType, setPaymentType] = useState<"installment" | "partial" | "total" | "discount">("installment")
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<string[]>([])
  const [payAmount, setPayAmount] = useState<number>(0)
  const [payDate, setPayDate] = useState(today())
  const [payNewDueDate, setPayNewDueDate] = useState("")
  const [payDiscount, setPayDiscount] = useState<number>(0)
  const [paying, setPaying] = useState(false)

  // Renegotiate dialog state
  const [renegotiateDialog, setRenegotiateDialog] = useState<Loan | null>(null)
  const [renegotiateMode, setRenegotiateMode] = useState<"total" | "full" | "partial" | null>(null)
  const [renegotiateEntry, setRenegotiateEntry] = useState<"all" | "interest">("all")
  const [renegotiateAmount, setRenegotiateAmount] = useState<number>(0)
  const [renegotiateDate, setRenegotiateDate] = useState(today())
  const [renegotiateNewDueDate, setRenegotiateNewDueDate] = useState("")
  const [renegotiateNotes, setRenegotiateNotes] = useState("")
  const [renegotiateInstallmentId, setRenegotiateInstallmentId] = useState("")

  // Success dialog state
  const [successDialog, setSuccessDialog] = useState(false)
  const [createdLoanInfo, setCreatedLoanInfo] = useState<{
    clientName: string
    clientPhone: string | null
    amount: number
    interestRate: number
    installmentCount: number
    installmentValue: number
    totalAmount: number
    firstInstallmentDate: string
    modality: string
  } | null>(null)

  // Form state
  const [clientId, setClientId] = useState("")
  const [clientSearch, setClientSearch] = useState("")
  const [clientPickerOpen, setClientPickerOpen] = useState(true)
  const [amount, setAmount] = useState<number>(0)
  const [interestRate, setInterestRate] = useState<number>(0)
  const [interestType, setInterestType] = useState("PER_INSTALLMENT")
  const [modality, setModality] = useState("MONTHLY")
  const [installmentCount, setInstallmentCount] = useState(1)
  const [totalInterestAmount, setTotalInterestAmount] = useState<number>(0)
  const [customInstallmentAmounts, setCustomInstallmentAmounts] = useState<number[]>([])
  const [contractDate, setContractDate] = useState(today())

  // Sincronizar array de parcelas personalizadas quando nº de parcelas muda
  useEffect(() => {
    if (interestType === "CUSTOM") {
      setCustomInstallmentAmounts((prev) => {
        const arr = [...prev]
        while (arr.length < installmentCount) arr.push(0)
        return arr.slice(0, installmentCount)
      })
    }
  }, [installmentCount, interestType])

  const [firstInstallmentDate, setFirstInstallmentDate] = useState(today())
  const [skipSaturday, setSkipSaturday] = useState(false)
  const [skipSunday, setSkipSunday] = useState(false)
  const [skipHolidays, setSkipHolidays] = useState(false)
  const [dailyInterest, setDailyInterest] = useState(true)
  const [dailyInterestAmount, setDailyInterestAmount] = useState<number>(15)
  const [penaltyFee, setPenaltyFee] = useState<number>(0)
  const [whatsappNotify, setWhatsappNotify] = useState(false)
  const [notes, setNotes] = useState("")
  const [loanTags, setLoanTags] = useState<string[]>([])
  const [formTagInput, setFormTagInput] = useState("")
  const [installmentDates, setInstallmentDates] = useState<string[]>([])

  // New client form
  const [newClientName, setNewClientName] = useState("")
  const [newClientPhone, setNewClientPhone] = useState("")
  const [newClientDocument, setNewClientDocument] = useState("")

  // Cálculos ao vivo
  const preview = useMemo(() => {
    if (!amount || !installmentCount) return { totalAmount: 0, profit: 0, totalInterest: 0, installmentAmount: 0 }
    return calculateLoan(
      amount,
      interestRate,
      installmentCount,
      interestType,
      interestType === "FIXED_AMOUNT" ? totalInterestAmount : undefined,
      interestType === "CUSTOM" ? customInstallmentAmounts : undefined
    )
  }, [amount, interestRate, installmentCount, interestType, totalInterestAmount, customInstallmentAmounts])

  // Gerar datas das parcelas
  useEffect(() => {
    if (firstInstallmentDate && installmentCount > 0) {
      const dates = generateInstallmentDates(
        new Date(firstInstallmentDate + "T12:00:00"),
        installmentCount,
        modality,
        skipSaturday,
        skipSunday,
        skipHolidays
      )
      setInstallmentDates(dates.map((d) => localDateStr(d)))
    }
  }, [firstInstallmentDate, installmentCount, modality, skipSaturday, skipSunday, skipHolidays])

  // Clientes filtrados na busca
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients
    const q = clientSearch.toLowerCase()
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.document && c.document.includes(q))
    )
  }, [clients, clientSearch])

  const selectedLoanClient = useMemo(
    () => clients.find((client) => client.id === clientId) || null,
    [clients, clientId]
  )

  const fetchLoans = async () => {
    const res = await fetch("/api/loans")
    const data = await res.json()
    const visibleLoans = Array.isArray(data)
      ? data.filter((loan) => loan?.client?.status !== "DESAPARECIDO")
      : []
    setLoans(visibleLoans)
    setLoading(false)
  }

  const fetchClients = async () => {
    const res = await fetch("/api/clients")
    const data = await res.json()
    const visibleClients = Array.isArray(data)
      ? data.filter((client) => client?.status !== "DESAPARECIDO")
      : []
    setClients(visibleClients)
  }

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile")
      const data = await res.json()
      setProfilePixKey(data.pixKey || "")
      setProfilePhone(data.phone || "")
    } catch {}
  }

  useEffect(() => {
    fetchLoans()
    fetchClients()
    fetchProfile()
  }, [])

  useEffect(() => {
    const handleLoansUpdated = () => {
      fetchLoans()
    }

    window.addEventListener("loans:updated", handleLoansUpdated)

    return () => {
      window.removeEventListener("loans:updated", handleLoansUpdated)
    }
  }, [])

  const resetForm = () => {
    setClientId("")
    setClientSearch("")
    setClientPickerOpen(true)
    setAmount(0)
    setInterestRate(0)
    setInterestType("PER_INSTALLMENT")
    setModality("MONTHLY")
    setInstallmentCount(1)
    setTotalInterestAmount(0)
    setCustomInstallmentAmounts([])
    setContractDate(today())
    setFirstInstallmentDate(today())
    setSkipSaturday(false)
    setSkipSunday(false)
    setSkipHolidays(false)
    setDailyInterest(true)
    setDailyInterestAmount(15)
    setPenaltyFee(0)
    setWhatsappNotify(false)
    setNotes("")
    setLoanTags([])
    setFormTagInput("")
    setInstallmentDates([])
  }

  const onSubmit = async () => {
    if (!clientId) return alert("Selecione um cliente")
    if (!amount || amount <= 0) return alert("Informe o valor")
    if (!installmentCount || installmentCount < 1) return alert("Informe o número de parcelas")

    const calculatedDailyInterest = resolveDailyInterestAmount(
      dailyInterest,
      dailyInterestAmount,
      amount,
      interestRate,
      modality
    )

    const res = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        amount,
        interestRate,
        interestType,
        modality,
        installmentCount,
        totalInterestAmount: interestType === "FIXED_AMOUNT" ? totalInterestAmount : undefined,
        customInstallmentAmounts: interestType === "CUSTOM" ? customInstallmentAmounts : undefined,
        contractDate,
        firstInstallmentDate,
        skipSaturday,
        skipSunday,
        skipHolidays,
        dailyInterest,
        dailyInterestAmount: calculatedDailyInterest,
        penaltyFee,
        whatsappNotify,
        installmentDates,
        notes: notes || undefined,
        tags: loanTags,
      }),
    })

    if (res.ok) {
      const selectedClient = clients.find(c => c.id === clientId)
      setCreatedLoanInfo({
        clientName: selectedClient?.name || "Cliente",
        clientPhone: selectedClient?.phone || null,
        amount,
        interestRate,
        installmentCount,
        installmentValue: preview.installmentAmount,
        totalAmount: preview.totalAmount,
        firstInstallmentDate,
        modality,
      })
      setDialogOpen(false)
      resetForm()
      fetchLoans()
      setSuccessDialog(true)
    } else {
      const err = await res.json().catch(() => ({ error: "Erro desconhecido" }))
      alert("Erro ao criar empréstimo: " + (err.error || JSON.stringify(err)))
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Excluir este empréstimo?")) {
      await fetch(`/api/loans/${id}`, { method: "DELETE" })
      fetchLoans()
    }
  }

  const showPaymentReceipt = (loan: Loan, installmentIds: string[], totalPaid: number, dateStr: string) => {
    const allInsts = loan.installments
    const paidCount = allInsts.filter((i: any) => i.status === "PAID").length
    const payingCount = installmentIds.length
    const willBeCompleted = (paidCount + payingCount) >= allInsts.length

    // Build installment label e.g. "2/3"
    const firstIdx = allInsts.findIndex((i: any) => i.id === installmentIds[0])
    const label = installmentIds.length === 1
      ? `${firstIdx + 1}/${allInsts.length}`
      : `${firstIdx + 1}-${firstIdx + installmentIds.length}/${allInsts.length}`

    const alreadyPaid = loan.payments.reduce((s: number, p: any) => s + p.amount, 0)
    setPaymentReceiptInfo({
      type: "Empréstimo",
      clientName: loan.client.name,
      clientPhone: clients.find(c => c.id === loan.client.id)?.phone || null,
      installmentLabel: label,
      amount: totalPaid,
      date: new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00").toLocaleDateString("pt-BR"),
      isCompleted: willBeCompleted,
      remainingBalance: Math.max(0, loan.totalAmount - alreadyPaid - totalPaid),
    })
    setPaymentReceiptDialog(true)
  }

  const handlePayment = async (loanId: string, installmentId: string, payAmt: number, notes?: string) => {
    if (!payAmt || payAmt <= 0) return { ok: false }
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loanId,
        installmentId,
        amount: payAmt,
        date: payDate || today(),
        newDueDate: payNewDueDate || undefined,
        discount: paymentType === "discount" ? payDiscount : undefined,
        notes: notes || undefined,
      }),
    })
    return { ok: res.ok }
  }

  const handleMultiPayment = async (loanId: string, installments: { id: string; amount: number; index?: number; total?: number }[]) => {
    let allOk = true
    for (const inst of installments) {
      const notes = inst.index && inst.total ? `Parcela ${inst.index} de ${inst.total}` : "Parcela"
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId,
          installmentId: inst.id,
          amount: inst.amount,
          date: payDate || today(),
          newDueDate: payNewDueDate || undefined,
          discount: paymentType === "discount" ? payDiscount : undefined,
          notes,
        }),
      })
      if (!res.ok) allOk = false
    }
    return { ok: allOk }
  }

  const resetPaymentForm = () => {
    setPaymentType("installment")
    setSelectedInstallmentIds([])
    setPayAmount(0)
    setPayDate(today())
    setPayNewDueDate("")
    setPayDiscount(0)
  }

  const openPaymentDialog = (loan: Loan) => {
    resetPaymentForm()
    setPaymentDialog(loan)
    const pendingInst = loan.installments.find((i: any) => i.status !== "PAID")
    if (pendingInst) {
      setSelectedInstallmentIds([pendingInst.id])
      setPayAmount(getInstallmentPayableAmount(loan, pendingInst))
    }
    // Pre-fill next month due date
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    setPayNewDueDate(localDateStr(nextMonth))
  }

  const handleNewClient = async () => {
    if (!newClientName.trim()) return alert("Nome obrigatório")
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newClientName,
        phone: newClientPhone || undefined,
        document: newClientDocument || undefined,
      }),
    })
    const created = await res.json()
    if (created.id) {
      setClients((prev) => [...prev, created])
      setClientId(created.id)
      setClientSearch(created.name)
    }
    setNewClientName("")
    setNewClientPhone("")
    setNewClientDocument("")
    setNewClientDialog(false)
  }

  // --- HELPERS ---

  const MODALITY_LABELS: Record<string, string> = {
    MONTHLY: "MENSAL", BIWEEKLY: "QUINZENAL", WEEKLY: "SEMANAL", DAILY: "DIÁRIO",
  }

  const toDateStr = (d: Date) => {
    // Use local date to match how dates are displayed to the user
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }
  const todayStr = toDateStr(new Date())
  const isSameMonthYear = (value: Date, reference: Date) => (
    value.getFullYear() === reference.getFullYear() && value.getMonth() === reference.getMonth()
  )
  const hasCurrentMonthInstallmentPaid = (loan: Loan) => {
    if (loan.installmentCount <= 1) return false

    const now = new Date()

    return loan.installments.some((installment: any) => (
      installment.status === "PAID" && isSameMonthYear(new Date(installment.dueDate), now)
    ))
  }

  const getLoanStatusInfo = (loan: Loan) => {
    if (loan.status === "COMPLETED") return { label: "Quitado", color: "bg-blue-50 dark:bg-blue-950/300/20 text-blue-600" }
    if (loan.status === "DEFAULTED") return { label: "Inadimplente", color: "bg-red-50 dark:bg-red-950/300/20 text-red-600" }
    const hasInterestPayment = loan.payments.some((p: any) => {
      const notes = (p.notes || "").toLowerCase()
      return notes.includes("só juros") || notes.includes("parcial de juros")
    })
    if (hasInterestPayment) {
      const hasOverdue = loan.installments.some((i: any) => i.status !== "PAID" && toDateStr(new Date(i.dueDate)) < todayStr)
      if (!hasOverdue) return { label: "Só Juros", color: "bg-purple-50 dark:bg-purple-950/20 text-purple-600" }
    }
    const hasOverdue = loan.installments.some((i: any) => {
      if (i.status === "PAID") return false
      return toDateStr(new Date(i.dueDate)) < todayStr
    })
    if (hasOverdue) return { label: "Atrasado", color: "bg-red-50 dark:bg-red-950/300/20 text-red-600" }
    if (hasCurrentMonthInstallmentPaid(loan)) return { label: "Pago no Mês", color: "bg-purple-50 dark:bg-purple-950/20 text-purple-600" }
    return { label: "Pendente", color: "bg-orange-50 dark:bg-orange-950/300/20 text-orange-600" }
  }

  const getGroupStatusInfo = (groupLoans: Loan[]) => {
    const anyOverdue = groupLoans.some(l =>
      l.status !== "COMPLETED" && l.installments.some((i: any) => i.status !== "PAID" && toDateStr(new Date(i.dueDate)) < todayStr)
    )
    if (anyOverdue) return { label: "Atrasado", color: "bg-red-50 dark:bg-red-950/300/20 text-red-600" }
    const allCompleted = groupLoans.every(l => l.status === "COMPLETED")
    if (allCompleted) return { label: "Quitado", color: "bg-blue-50 dark:bg-blue-950/300/20 text-blue-600" }
    const anyDueToday = groupLoans.some(l =>
      l.status !== "COMPLETED" && l.installments.some((i: any) => i.status !== "PAID" && toDateStr(new Date(i.dueDate)) === todayStr)
    )
    if (anyDueToday) return { label: "Pendente", color: "bg-orange-50 dark:bg-orange-950/20 text-orange-600" }
    return { label: "Em Dia", color: "bg-green-500/20 text-green-400" }
  }

  const getPaidTotal = (loan: Loan) => loan.payments.reduce((s: number, p: any) => s + p.amount, 0)

  // Pagamentos que realmente reduzem o saldo (exclui "só juros" e "parcial de juros")
  const getPaidTotalExcludingInterest = (loan: Loan) => loan.payments
    .filter((p: any) => {
      const notes = (p.notes || "").toLowerCase()
      return !notes.includes("só juros") && !notes.includes("parcial de juros")
    })
    .reduce((s: number, p: any) => s + p.amount, 0)

  const getReceivedProfit = (loan: Loan) => {
    const paidCount = loan.installments.filter((i: any) => i.status === "PAID").length
    if (paidCount === 0) return 0
    return Math.round(paidCount * (loan.profit / loan.installmentCount) * 100) / 100
  }

  // Dias por modalidade
  const modalityDays = (modality: string) => {
    switch (modality) {
      case "DAILY": return 1
      case "WEEKLY": return 7
      case "BIWEEKLY": return 15
      case "MONTHLY": default: return 30
    }
  }

  // Juros acumulados por atraso usando as 4 camadas
  const getOverdueExtraInterest = (loan: Loan) => {
    const daysOver = getDaysOverdue(buildLoanData({
      amount: loan.amount,
      interestRate: loan.interestRate,
      interestType: loan.interestType,
      totalAmount: loan.totalAmount,
      dailyInterestAmount: loan.dailyInterestAmount || 0,
      dueDay: loan.dueDay,
      modality: loan.modality,
      firstInstallmentDate: loan.firstInstallmentDate,
      installments: loan.installments,
      payments: loan.payments,
    }))
    if (daysOver < 30) return 0
    return calculateOverdueInterest(
      loan.totalAmount,
      loan.amount,
      loan.interestRate,
      daysOver,
      loan.interestType === "compound" ? "compound" : "simple"
    )
  }

  const getCurrentOverdueDays = (loan: Loan) => getDaysOverdue(buildLoanData({
    amount: loan.amount,
    interestRate: loan.interestRate,
    interestType: loan.interestType,
    totalAmount: loan.totalAmount,
    dailyInterestAmount: loan.dailyInterestAmount || 0,
    dueDay: loan.dueDay,
    modality: loan.modality,
    firstInstallmentDate: loan.firstInstallmentDate,
    installments: loan.installments,
    payments: loan.payments,
  }))

  const getCurrentOverdueCharge = (loan: Loan) => {
    const daysOver = getCurrentOverdueDays(loan)
    if (daysOver <= 0) return 0

    const overdueInterest = daysOver >= 30
      ? calculateOverdueInterest(
          loan.totalAmount,
          loan.amount,
          loan.interestRate,
          daysOver,
          loan.interestType === "compound" ? "compound" : "simple"
        )
      : 0

    return overdueInterest + (getOverdueDailyAmountBRL(buildLoanData({
      amount: loan.amount,
      interestRate: loan.interestRate,
      interestType: loan.interestType,
      totalAmount: loan.totalAmount,
      dailyInterestAmount: loan.dailyInterestAmount || 0,
      dueDay: loan.dueDay,
      modality: loan.modality,
      firstInstallmentDate: loan.firstInstallmentDate,
      installments: loan.installments,
      payments: loan.payments,
    })) * daysOver)
  }

  const getInstallmentPayableAmount = (loan: Loan, installment: Loan["installments"][number]) => {
    const baseRemaining = Math.max(0, installment.amount - (installment.paidAmount || 0))
    const firstPendingInstallment = loan.installments
      .filter((i: any) => i.status !== "PAID")
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

    if (!firstPendingInstallment || firstPendingInstallment.id !== installment.id) {
      return baseRemaining
    }

    return baseRemaining + getCurrentOverdueCharge(loan)
  }

  const getNextDueInst = (loan: Loan) =>
    loan.installments
      .filter((i: any) => i.status !== "PAID")
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

  const getClientPhone = (loan: Loan) => {
    const client = clients.find(c => c.id === loan.client.id)
    return client?.phone || null
  }

  const getOverdueInstallments = (loan: Loan) => {
    return loan.installments.filter((i: any) => {
      if (i.status === "PAID") return false
      return toDateStr(new Date(i.dueDate)) <= todayStr
    })
  }

  const buildDefaultWhatsappMessage = (loan: Loan) => {
    const clientName = loan.client.name.split(" ")[0]
    const overdueInsts = getOverdueInstallments(loan)
    let totalOverdue = overdueInsts.reduce((s: number, i: any) => s + i.amount, 0)
    let count = overdueInsts.length
    let daysLate = overdueInsts.length > 0
      ? Math.floor((Date.now() - new Date(overdueInsts[0].dueDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    // Fallback: if no overdue installments found but loan is overdue, use loan-level data
    if (count === 0) {
      const unpaid = loan.installments.filter((i: any) => i.status !== "PAID")
      if (unpaid.length > 0) {
        count = unpaid.length
        totalOverdue = unpaid.reduce((s: number, i: any) => s + i.amount, 0)
        const oldest = unpaid.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
        daysLate = Math.max(0, Math.floor((Date.now() - new Date(oldest.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      } else {
        totalOverdue = loan.totalAmount
      }
    }

    const oldestOverdue = overdueInsts.length > 0 ? overdueInsts[0] : null
    const vencimento = oldestOverdue ? formatDate(oldestOverdue.dueDate) : ""
    const juros = loan.interestRate > 0 ? formatCurrency(totalOverdue * (loan.interestRate / 100)) : "0,00"

    return `👤 Cliente: ${clientName}\n\n🔴 PARCELA EM ATRASO\n\n📅 Data de vencimento: ${vencimento}\n\n💰 pagamento total: ${formatCurrency(totalOverdue)}\n\n🔄 Valor para regularização parcial (juros): R$ ${juros}\n\n📆 Dias em atraso: ${daysLate} dias\n\n⚠️ Multa por atraso: R$ 15,00 por dia\n\n\n💳 Chave Pix: ${profilePixKey || "Não cadastrada"}`
  }

  const openWhatsappDialog = (loan: Loan) => {
    setWhatsappLoan(loan)
    setWhatsappMessage(buildDefaultWhatsappMessage(loan))
    setWhatsappSent(false)
    setWhatsappDialog(true)
  }

  const sendWhatsappMessage = async () => {
    if (!whatsappLoan || !whatsappMessage.trim()) return
    const phone = getClientPhone(whatsappLoan)
    if (!phone) return

    setWhatsappSending(true)
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message: whatsappMessage }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Erro ao enviar mensagem")
      }
      setWhatsappSent(true)
    } catch (error: any) {
      alert(error.message || "Erro ao enviar mensagem")
    } finally {
      setWhatsappSending(false)
    }
  }

  const getOverdueLoans = () => {
    return loans.filter(l => {
      if (l.status === "COMPLETED") return false
      const st = getLoanStatusInfo(l)
      return st.label === "Atrasado" || st.label === "Inadimplente"
    })
  }

  const getDueTodayLoans = () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    return loans.filter(l => {
      if (l.status === "COMPLETED") return false
      return l.installments.some((i: any) => {
        if (i.status === "PAID") return false
        const d = new Date(i.dueDate)
        const dueStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        return dueStr === todayStr
      })
    })
  }

  const sendBulkOverdue = async () => {
    const overdueLoans = getOverdueLoans()
    if (overdueLoans.length === 0) { alert("Nenhum cliente atrasado encontrado."); return }
    if (!confirm(`Enviar cobrança para ${new Set(overdueLoans.map(l => l.client.id)).size} cliente(s) atrasado(s)?`)) return
    setBulkSendingOverdue(true)
    let sent = 0, failed = 0
    const sentClients = new Set<string>()
    for (const loan of overdueLoans) {
      if (sentClients.has(loan.client.id)) continue
      const phone = clients.find(c => c.id === loan.client.id)?.phone
      if (!phone) { failed++; sentClients.add(loan.client.id); continue }
      try {
        const msg = buildDefaultWhatsappMessage(loan)
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, message: msg }),
        })
        if (res.ok) { sent++ } else { failed++ }
      } catch { failed++ }
      sentClients.add(loan.client.id)
      // Delay between sends to avoid WhatsApp rate limiting
      await new Promise(r => setTimeout(r, 2000))
    }
    setBulkSendingOverdue(false)
    setBulkResultDialog({ type: "atrasados", sent, failed, total: sentClients.size })
  }

  const buildDueTodayMessage = (loan: Loan) => {
    const name = loan.client.name.split(" ")[0]
    const todayInsts = loan.installments.filter((i: any) => {
      if (i.status === "PAID") return false
      const now = new Date()
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
      const d = new Date(i.dueDate)
      const dueStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      return dueStr === todayStr
    })
    const total = todayInsts.reduce((s: number, i: any) => s + i.amount, 0)
    const juros = loan.interestRate > 0 ? formatCurrency(total * (loan.interestRate / 100)) : "0,00"
    const vencimento = todayInsts.length > 0 ? formatDate(todayInsts[0].dueDate) : ""

    return `👤 Cliente: ${name}\n\n  VENCIMENTO HOJE\n\n📅 Data de vencimento: ${vencimento}\n\n💰 pagamento total : ${formatCurrency(total)}\n\n🔄 Opção de renovação:\nPague R$ ${juros} (juros) e receba +30 dias de prazo.\n\n⚠️ Em caso de atraso,\nserá cobrado R$ 15,00 por dia.\n\n\n💳 Chave Pix: ${profilePixKey || "Não cadastrada"}`
  }

  const sendBulkDueToday = async () => {
    const dueTodayLoans = getDueTodayLoans()
    if (dueTodayLoans.length === 0) { alert("Nenhum cliente com vencimento hoje."); return }
    if (!confirm(`Enviar lembrete para ${new Set(dueTodayLoans.map(l => l.client.id)).size} cliente(s) com vencimento hoje?`)) return
    setBulkSendingDueToday(true)
    let sent = 0, failed = 0
    const sentClients = new Set<string>()
    for (const loan of dueTodayLoans) {
      if (sentClients.has(loan.client.id)) continue
      const phone = clients.find(c => c.id === loan.client.id)?.phone
      if (!phone) { failed++; sentClients.add(loan.client.id); continue }
      try {
        const msg = buildDueTodayMessage(loan)
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, message: msg }),
        })
        if (res.ok) { sent++ } else { failed++ }
      } catch { failed++ }
      sentClients.add(loan.client.id)
      // Delay between sends to avoid WhatsApp rate limiting
      await new Promise(r => setTimeout(r, 2000))
    }
    setBulkSendingDueToday(false)
    setBulkResultDialog({ type: "vencendo hoje", sent, failed, total: sentClients.size })
  }

  const interestPerInst = (loan: Loan) =>
    Math.round((loan.profit / loan.installmentCount) * 100) / 100

  // Saldo devedor usando calculateTotalAmountWithLateFee (4 camadas)
  const getRemaining = (loan: Loan) => {
    return calculateTotalAmountWithLateFee(buildLoanData({
      amount: loan.amount,
      interestRate: loan.interestRate,
      interestType: loan.interestType,
      totalAmount: loan.totalAmount,
      dailyInterestAmount: loan.dailyInterestAmount || 0,
      dueDay: loan.dueDay,
      modality: loan.modality,
      firstInstallmentDate: loan.firstInstallmentDate,
      installments: loan.installments,
      payments: loan.payments,
    }))
  }

  const openRenegotiateDialog = (loan: Loan) => {
    setRenegotiateEntry("all")
    setRenegotiateDialog(loan)
    setRenegotiateMode(null)
    setRenegotiateAmount(0)
    setRenegotiateDate(today())
    setRenegotiateNotes("[OVERDUE_CONFIG:fixed:15]")
    // Pre-fill next due date & installment
    const pendingInsts = loan.installments
      .filter((i: any) => i.status !== "PAID")
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    const nextInst = pendingInsts[0]
    if (nextInst) {
      setRenegotiateInstallmentId(nextInst.id)
      // Nova data = próximo vencimento mantendo dia fixo
      const dueDay = loan.dueDay || new Date(loan.firstInstallmentDate).getDate()
      const nextDue = getNextDueDate(dueDay, new Date())
      setRenegotiateNewDueDate(localDateStr(nextDue))
    } else {
      setRenegotiateInstallmentId("")
      setRenegotiateNewDueDate("")
    }
  }

  const openInterestRenegotiateDialog = (loan: Loan) => {
    setRenegotiateEntry("interest")
    setRenegotiateDialog(loan)
    setRenegotiateMode(null)
    setRenegotiateAmount(0)
    setRenegotiateDate(today())
    setRenegotiateNotes("[OVERDUE_CONFIG:fixed:15]")

    const pendingInsts = loan.installments
      .filter((i: any) => i.status !== "PAID")
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    const nextInst = pendingInsts[0]
    if (nextInst) {
      setRenegotiateInstallmentId(nextInst.id)
      const dueDay = loan.dueDay || new Date(loan.firstInstallmentDate).getDate()
      const nextDue = getNextDueDate(dueDay, new Date())
      setRenegotiateNewDueDate(localDateStr(nextDue))
    } else {
      setRenegotiateInstallmentId("")
      setRenegotiateNewDueDate("")
    }
  }

  const handleRenegotiatePayment = async () => {
    if (!renegotiateDialog || !renegotiateMode) return
    if (paying) return alert("Pagamento já está sendo processado, aguarde...")

    // For partial mode, use selected installment; for full mode, use next due
    const targetInstId = renegotiateMode === "partial"
      ? renegotiateInstallmentId
      : getNextDueInst(renegotiateDialog)?.id
    if (!targetInstId) return alert("Nenhuma parcela selecionada")

    const intAmount = interestPerInst(renegotiateDialog)
    const amount = renegotiateAmount

    if (!amount || amount <= 0) return alert("Informe o valor")
    // Para parcial, limita ao juros de 1 parcela; para full, permite juros acumulados
    if (renegotiateMode === "partial" && amount > intAmount) return alert(`Máximo: ${formatCurrency(intAmount)}`)

    // Salvar dados para o comprovante ANTES de limpar estado
    const receiptLoan = renegotiateDialog
    const receiptMode = renegotiateMode
    const receiptAmount = amount
    const receiptDate = renegotiateDate || today()
    const allInsts = receiptLoan.installments
    const instIdx = allInsts.findIndex((i: any) => i.id === targetInstId)

    setPaying(true)
    try {
      // For partial mode, check if this payment completes the interest cycle
      let sendNewDueDate: string | undefined = undefined
      if (renegotiateMode === "full") {
        sendNewDueDate = renegotiateNewDueDate || undefined
      } else if (renegotiateMode === "partial") {
        // Check if partial payments + this one complete the interest
        const partialPayments = renegotiateDialog.payments.filter((p: any) => {
          const notes = (p.notes || "").toLowerCase()
          return notes.includes("parcial de juros")
        })
        const totalPartialPaid = partialPayments.reduce((s: number, p: any) => s + p.amount, 0)
        const cicloJurosPago = intAmount > 0 ? totalPartialPaid % intAmount : 0
        const cicloJurosFaltante = intAmount > 0 ? intAmount - cicloJurosPago : intAmount
        if (amount >= cicloJurosFaltante) {
          // This payment completes the interest cycle - renew due date
          const payDateObj = new Date((renegotiateDate || today()) + "T12:00:00")
          payDateObj.setDate(payDateObj.getDate() + modalityDays(renegotiateDialog.modality))
          sendNewDueDate = localDateStr(payDateObj)
        }
      }

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: renegotiateDialog.id,
          installmentId: targetInstId,
          amount,
          date: renegotiateDate || today(),
          newDueDate: sendNewDueDate,
          notes: (renegotiateNotes ? renegotiateNotes + " | " : "") + (renegotiateMode === "full" ? "Pagamento só juros" : "Pagamento parcial de juros"),
        }),
      })
      setRenegotiateDialog(null)
      setRenegotiateMode(null)
      setRenegotiateAmount(0)
      setRenegotiateNotes("")
      setRenegotiateInstallmentId("")

      if (res.ok) {
        const paidCount = allInsts.filter((i: any) => i.status === "PAID").length
        const willBeCompleted = (paidCount + 1) >= allInsts.length
        const dateStr = receiptDate
        const alreadyPaid = receiptLoan.payments.reduce((s: number, p: any) => s + p.amount, 0)
        const info = {
          type: receiptMode === "full" ? "Só Juros" : "Pagamento Parcial de Juros",
          clientName: receiptLoan.client.name,
          clientPhone: clients.find(c => c.id === receiptLoan.client.id)?.phone || null,
          installmentLabel: `${instIdx + 1}/${allInsts.length}`,
          amount: receiptAmount,
          date: new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00").toLocaleDateString("pt-BR"),
          isCompleted: false,
          remainingBalance: receiptLoan.totalAmount,
        }
        setPaymentReceiptInfo(info)
        setPaymentReceiptDialog(true)
      } else {
        alert("Erro ao registrar pagamento de juros")
      }

      fetchLoans()
    } finally {
      setPaying(false)
    }
  }

  // --- COMPUTED ---

  const filteredLoans = useMemo(() => {
    let result = loans
    if (activeTab === "daily") result = result.filter(l => l.modality === "DAILY")
    if (activeTab === "price") result = result.filter(l => l.interestType === "TOTAL")
    if (activeTab === "received") result = result.filter(l => l.status === "COMPLETED")
    // Hide completed loans from all tabs except "received"
    if (activeTab !== "received") result = result.filter(l => l.status !== "COMPLETED")
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((loan) => {
        const matchesClient = loan.client.name.toLowerCase().includes(q)
        const matchesTag = (loan.tags || []).some((tag) => getTagName(tag).toLowerCase().includes(q))
        return matchesClient || matchesTag
      })
    }
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const getLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    if (loanFilter === "on_time") {
      result = result.filter(l => l.status !== "COMPLETED" && !l.installments.some((i: any) => i.status !== "PAID" && getLocalDateStr(new Date(i.dueDate)) < todayStr))
    } else if (loanFilter === "due_today") {
      result = result.filter(l => l.installments.some((i: any) => i.status !== "PAID" && getLocalDateStr(new Date(i.dueDate)) === todayStr))
    } else if (loanFilter === "overdue") {
      result = result.filter(l => l.status !== "COMPLETED" && l.installments.some((i: any) => i.status !== "PAID" && getLocalDateStr(new Date(i.dueDate)) < todayStr))
    } else if (loanFilter === "installments") {
      result = result.filter(l => l.installmentCount > 1)
    } else if (loanFilter === "interest_only") {
      result = result.filter(l => {
        if (l.status === "COMPLETED") return false
        const hasInterestPayment = l.payments.some((p: any) => {
          const notes = (p.notes || "").toLowerCase()
          return notes.includes("só juros") || notes.includes("parcial de juros")
        })
        if (!hasInterestPayment) return false
        const hasOverdue = l.installments.some((i: any) => i.status !== "PAID" && toDateStr(new Date(i.dueDate)) < todayStr)
        return !hasOverdue
      })
    } else if (loanFilter === "monthly") {
      result = result.filter(l => l.modality === "MONTHLY")
    } else if (loanFilter === "tagged") {
      result = result.filter(l => (l.tags || []).length > 0)
    }

    if (selectedTag) {
      result = result.filter(l => (l.tags || []).some(t => getTagName(t) === selectedTag))
    }

    const getEarliestPendingDueAt = (loan: Loan) => {
      const pendingInstallments = loan.installments
        .filter((installment: any) => installment.status !== "PAID")
        .map((installment: any) => new Date(installment.dueDate).getTime())

      if (pendingInstallments.length === 0) {
        return Number.POSITIVE_INFINITY
      }

      return Math.min(...pendingInstallments)
    }

    const getEarliestOverdueDueAt = (loan: Loan) => {
      const overdueInstallments = loan.installments
        .filter((installment: any) => installment.status !== "PAID" && getLocalDateStr(new Date(installment.dueDate)) < todayStr)
        .map((installment: any) => new Date(installment.dueDate).getTime())

      if (overdueInstallments.length === 0) {
        return null
      }

      return Math.min(...overdueInstallments)
    }

    return [...result].sort((left, right) => {
      const leftOverdueAt = getEarliestOverdueDueAt(left)
      const rightOverdueAt = getEarliestOverdueDueAt(right)

      if (leftOverdueAt !== null && rightOverdueAt !== null) {
        return leftOverdueAt - rightOverdueAt
      }

      if (leftOverdueAt !== null) return -1
      if (rightOverdueAt !== null) return 1

      const pendingDifference = getEarliestPendingDueAt(left) - getEarliestPendingDueAt(right)
      if (pendingDifference !== 0) {
        return pendingDifference
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })
  }, [loans, activeTab, search, loanFilter, selectedTag])

  const groupedByClient = useMemo(() => {
    const groups: Record<string, { clientId: string; clientName: string; clientPhoto: string | null; loans: Loan[] }> = {}
    for (const loan of filteredLoans) {
      if (!groups[loan.client.id]) {
        groups[loan.client.id] = { clientId: loan.client.id, clientName: loan.client.name, clientPhoto: loan.client.photo, loans: [] }
      }
      groups[loan.client.id].loans.push(loan)
    }
    return Object.values(groups)
  }, [filteredLoans])

  const tabCounts = useMemo(() => ({
    all: loans.length,
    daily: loans.filter(l => l.modality === "DAILY").length,
    price: loans.filter(l => l.interestType === "TOTAL").length,
    received: loans.filter(l => l.status === "COMPLETED").length,
  }), [loans])

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const selectClass = "flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100"

  const filterOptions = [
    { value: "all", label: "Todos" },
    { value: "on_time", label: "Em Dia" },
    { value: "due_today", label: "Vence Hoje" },
    { value: "overdue", label: "Atrasados" },
    { value: "installments", label: "Parcelados" },
    { value: "interest_only", label: "Só Juros" },
    { value: "monthly", label: "Mensal" },
  ] as const

  const tagOptions = [
    { value: "all", label: "Todas" },
    { value: "tagged", label: "Com etiqueta" },
  ] as const

  return (
    <div className="space-y-6 pt-6">
      {/* Title + Vence Hoje / Atrasados */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Empréstimos</h1>
        <div className="flex items-center gap-2">
          <Button onClick={sendBulkDueToday} disabled={bulkSendingDueToday} className="bg-amber-500 hover:bg-amber-600 text-white">
            {bulkSendingDueToday ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
            {bulkSendingDueToday ? "Enviando..." : "Vence Hoje"}
          </Button>
          <Button onClick={sendBulkOverdue} disabled={bulkSendingOverdue} className="bg-red-600 hover:bg-red-700 text-white">
            {bulkSendingOverdue ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
            {bulkSendingOverdue ? "Enviando..." : "Atrasados"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 rounded-xl p-1 border border-gray-200 dark:border-zinc-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "all" ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100" : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200"
          }`}
        >
          Empréstimos ({tabCounts.all})
        </button>
        <a
          href="/emprestimos/tabela-price"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "price" ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100" : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200"
          }`}
        >
          <FileText className="h-3.5 w-3.5" /> Tabela Price
        </a>
        <a
          href="/emprestimos/recebimentos"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "received" ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100" : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200"
          }`}
        >
          <DollarSign className="h-3.5 w-3.5" /> Recebimentos
        </a>
      </div>

      {/* Search + New Button */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
          <Input placeholder="Buscar cliente ou etiqueta..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-none">
          <Button onClick={() => { resetForm(); setDialogOpen(true) }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4 mr-2" /> Novo Empréstimo
          </Button>
        </div>
      </div>

      {/* Filters + View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setFilterOpen((current) => !current)
              setTagFilterOpen(false)
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500 bg-white px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Filter className="h-4 w-4" />
            Filtros
            <ChevronDown className={`h-4 w-4 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
          </button>

          {filterOpen && (
            <div className="flex items-center gap-2 flex-wrap">
              {filterOptions.map((opt) => {
                const isActive = loanFilter === opt.value
                const toneClass =
                  opt.value === "overdue"
                    ? isActive
                      ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300"
                      : "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/20"
                    : opt.value === "due_today"
                      ? isActive
                        ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-300"
                        : "border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950/20"
                      : opt.value === "interest_only"
                        ? isActive
                          ? "border-purple-500 bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300"
                          : "border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/20"
                        : opt.value === "monthly" || opt.value === "installments"
                          ? isActive
                            ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300"
                            : "border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/20"
                          : isActive
                            ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"

                return (
                  <button
                    key={opt.value}
                    onClick={() => setLoanFilter(opt.value)}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${toneClass}`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}

          <button
            onClick={() => {
              setTagFilterOpen((current) => !current)
              setFilterOpen(false)
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-orange-500 bg-white px-4 py-2 text-sm font-semibold text-orange-500 transition hover:bg-orange-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Tag className="h-4 w-4" />
            Etiqueta
            <ChevronDown className={`h-4 w-4 transition-transform ${tagFilterOpen ? "rotate-180" : ""}`} />
          </button>

          {tagFilterOpen && (
            <div className="flex items-center gap-2 flex-wrap">
              {tagOptions.map((opt) => {
                const isActive = loanFilter === opt.value

                return (
                  <button
                    key={opt.value}
                    onClick={() => setLoanFilter(opt.value)}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${isActive ? "border-orange-500 bg-orange-50 text-orange-500 dark:bg-orange-950/30 dark:text-orange-300" : "border-orange-300 text-orange-500 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950/20"}`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex bg-gray-50 dark:bg-zinc-800 rounded-lg p-1 border border-gray-200 dark:border-zinc-800">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100" : "text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100" : "text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {selectedTag && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-zinc-400">Filtrando por etiqueta:</span>
          <button onClick={() => setSelectedTag(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: (() => { const t = loans.flatMap(l => l.tags || []).find(t => getTagName(t) === selectedTag); return t?.includes("|") ? t.split("|")[1] : "#ef4444" })() }}>
            {selectedTag} <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Cards / List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-zinc-400">Carregando...</div>
      ) : groupedByClient.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-zinc-400">Nenhum empréstimo encontrado</div>
      ) : viewMode === "list" ? (
        <>
        <div className="flex items-center gap-4 mb-2">
          <div className="flex-1 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4">
            <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Total Emprestado</p>
            <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-zinc-100 mt-1">{formatCurrency(filteredLoans.reduce((s, l) => s + l.amount, 0))}</p>
          </div>
          <div className="flex-1 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4">
            <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Total a Receber</p>
            <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(filteredLoans.reduce((s, l) => s + l.totalAmount, 0))}</p>
          </div>
          <div className="flex-1 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4">
            <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Lucro a Receber</p>
            <p className="text-xl font-bold tabular-nums text-violet-600 dark:text-violet-400 mt-1">{formatCurrency(filteredLoans.reduce((s, l) => s + l.profit, 0))}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-2">{filteredLoans.length} empréstimo{filteredLoans.length !== 1 ? "s" : ""}</p>
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800/60 text-left text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Emprestado</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Parcelas</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Etiquetas</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {filteredLoans.map((loan) => {
                const status = getLoanStatusInfo(loan)
                const paid = getPaidTotal(loan)
                const remaining = getRemaining(loan)
                const nextInst = getNextDueInst(loan)
                return (
                  <tr key={loan.id} className={`${status.label === "Atrasado" ? "bg-red-50 dark:bg-red-950/20" : status.label === "Só Juros" ? "bg-purple-50 dark:bg-purple-950/20" : "bg-white dark:bg-zinc-900"} hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={loan.client.name} src={loan.client.photo} size="sm" />
                        <span className="font-medium text-gray-900 dark:text-zinc-100">{loan.client.name}</span>
                        {loans.filter(l => l.client.id === loan.client.id).length >= 2 && (
                          <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block flex-shrink-0" title={`${loans.filter(l => l.client.id === loan.client.id).length} empréstimos`} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(loan.amount)}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(loan.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="tabular-nums text-gray-700 dark:text-zinc-300">{loan.installments.filter(i => i.status === "PAID").length}/{loan.installmentCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{nextInst ? formatDate(nextInst.dueDate) : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(loan.tags || []).map((tag, i) => {
                          const [name, color] = tag.includes("|") ? tag.split("|") : [tag, "#ef4444"]
                          const isActive = selectedTag === name
                          return (
                            <button key={i} onClick={() => setSelectedTag(isActive ? null : name)} className={`px-2 py-0.5 rounded-full text-xs font-medium text-white transition-all cursor-pointer ${isActive ? "ring-2 ring-offset-1 ring-white/80 scale-105" : "hover:opacity-80"}`} style={{ backgroundColor: color }}>{name}</button>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <button onClick={() => setDropdownOpen(dropdownOpen === loan.id ? null : loan.id)} className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {dropdownOpen === loan.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(null)} />
                            <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
                              <button onClick={() => { setDropdownOpen(null); openRenegotiateDialog(loan) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
                                <Receipt className="h-4 w-4" /> Pagar
                              </button>
                              <div className="border-t border-gray-100 dark:border-zinc-800 my-1" />
                              <button onClick={() => { setDropdownOpen(null); router.push(`/emprestimos/${loan.id}`) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
                                <RotateCcw className="h-4 w-4" /> Histórico
                              </button>
                              <button onClick={() => { setDropdownOpen(null); setEditingTags(loan.tags || []); setTagInput(""); setShowTagForm(false); setTagDialog(loan) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
                                <Tag className="h-4 w-4" /> Etiquetar
                              </button>
                              <button onClick={() => { setDropdownOpen(null); router.push(`/emprestimos/${loan.id}/editar`) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
                                <Pencil className="h-4 w-4" /> Editar
                              </button>
                              <button onClick={() => { setDropdownOpen(null); openRenegotiateDialog(loan) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
                                <RotateCcw className="h-4 w-4" /> Renegociar
                              </button>
                              <div className="border-t border-gray-100 dark:border-zinc-800 my-1" />
                              <button onClick={() => { setDropdownOpen(null); handleDelete(loan.id) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20">
                                <Trash2 className="h-4 w-4" /> Excluir
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {groupedByClient.map((group) => {
            if (group.loans.length === 1) {
              /* ===== SINGLE LOAN CARD ===== */
              const loan = group.loans[0]
              const status = getLoanStatusInfo(loan)
              const paid = getPaidTotal(loan)
              const remaining = getRemaining(loan)
              const receivedProfit = getReceivedProfit(loan)
              const profitPct = loan.profit > 0 ? Math.round((receivedProfit / loan.profit) * 100) : 0
              const nextInst = getNextDueInst(loan)
              const intPerInst = interestPerInst(loan)

              const isAtrasado = status.label === "Atrasado" || status.label === "Inadimplente"
              const isSoJuros = status.label === "Só Juros"
              const isPagoNoMes = status.label === "Pago no Mês"
              const isQuitado = status.label === "Quitado"
              const isDueToday = nextInst && toDateStr(new Date(nextInst.dueDate)) === todayStr

              // Cores: Vence hoje=laranja, Atrasado=vermelho, Só Juros/Pago no mês=roxo, Quitado=azul, resto=branco
              const cardBorder = isAtrasado ? "border-red-400 dark:border-red-700" : isDueToday ? "border-orange-400 dark:border-orange-700" : (isSoJuros || isPagoNoMes) ? "border-purple-400 dark:border-purple-700" : isQuitado ? "border-blue-400 dark:border-blue-700" : "border-gray-200 dark:border-zinc-700"
              const cardBg = isAtrasado ? "bg-red-100 dark:bg-red-950/30" : isDueToday ? "bg-orange-100 dark:bg-orange-950/30" : (isSoJuros || isPagoNoMes) ? "bg-purple-100 dark:bg-purple-950/30" : isQuitado ? "bg-blue-100 dark:bg-blue-950/30" : "bg-white dark:bg-zinc-900"
              const remainingColor = isAtrasado ? "text-red-700 dark:text-red-400" : isDueToday ? "text-orange-700 dark:text-orange-400" : (isSoJuros || isPagoNoMes) ? "text-purple-700 dark:text-purple-400" : isQuitado ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-zinc-100"
              const remainingBg = isAtrasado ? "bg-red-100 dark:bg-red-900/40" : isDueToday ? "bg-orange-100 dark:bg-orange-900/40" : (isSoJuros || isPagoNoMes) ? "bg-purple-100 dark:bg-purple-900/40" : isQuitado ? "bg-blue-100 dark:bg-blue-900/40" : "bg-gray-100 dark:bg-zinc-800"
              const cellBg = isAtrasado ? "bg-red-50 dark:bg-red-950/20" : isDueToday ? "bg-orange-50 dark:bg-orange-950/20" : (isSoJuros || isPagoNoMes) ? "bg-purple-50 dark:bg-purple-950/20" : isQuitado ? "bg-blue-50 dark:bg-blue-950/20" : "bg-gray-50 dark:bg-zinc-800/50"

              return (
                <div key={group.clientId} className={`rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${cardBorder} ${cardBg}`}>
                  {/* Header - nome + etiqueta */}
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 pb-2 pt-4 dark:border-zinc-800">
                    <h3 className="truncate font-semibold text-base text-gray-900 dark:text-zinc-100">{group.clientName}</h3>
                    {(loan.tags || []).length > 0 && (() => {
                      const [name, color] = loan.tags[0].includes("|") ? loan.tags[0].split("|") : [loan.tags[0], "#ef4444"]
                      const isActive = selectedTag === name
                      return (
                        <button onClick={() => setSelectedTag(isActive ? null : name)} className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-white cursor-pointer transition-all ${isActive ? "ring-2 ring-offset-1 ring-white/80 scale-105" : "hover:opacity-80"}`} style={{ backgroundColor: color }}>
                          {name}
                        </button>
                      )
                    })()}
                  </div>

                  {/* Avatar + badges + ações */}
                  <div className="flex flex-col gap-2 px-4 pb-2 pt-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Avatar name={group.clientName} src={group.clientPhoto} size="sm" />
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                        {MODALITY_LABELS[loan.modality] || loan.modality}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                      <button
                        onClick={() => { setEditingTags(loan.tags || []); setTagInput(""); setShowTagForm(false); setTagDialog(loan) }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                        title="Etiqueta"
                      >
                        <Tag className="h-3 w-3" /> Etiqueta
                      </button>
                      <button
                        onClick={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${expandedLoan === loan.id ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"}`}
                        title="Detalhes"
                      >
                        <Eye className="h-3 w-3" /> Detalhes
                      </button>
                      <button
                        onClick={() => router.push(`/emprestimos/${loan.id}/comprovante`)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Comprovante"
                      >
                        <FileText className="h-3 w-3" /> Comprovante
                      </button>
                    </div>
                  </div>

                  {/* Valor Restante */}
                  <div className="px-4 pb-3">
                    <div className={`${remainingBg} rounded-lg px-4 py-3 text-center`}>
                      <p className={`text-lg font-bold tabular-nums tracking-tight ${remainingColor}`}>{formatCurrency(remaining)}</p>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">restante a receber</p>
                    </div>
                  </div>

                  {/* Grid de valores */}
                  <div className="mx-4 grid grid-cols-2 gap-px bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-gray-100 dark:border-zinc-800">
                    <div className={`${cellBg} px-3 py-2.5`}>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500">Emprestado</p>
                      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(loan.amount)}</p>
                    </div>
                    <div className={`${cellBg} px-3 py-2.5 text-right`}>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500">Total a Receber</p>
                      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(loan.totalAmount)}</p>
                    </div>
                    <div className={`${cellBg} px-3 py-2.5`}>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1"><Lock className="h-3 w-3" /> Lucro Previsto</p>
                      <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(loan.profit)}</p>
                    </div>
                    <div className={`${cellBg} px-3 py-2.5 text-right`}>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1 justify-end"><Check className="h-3 w-3" /> Lucro Realizado</p>
                      <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(receivedProfit)} <span className="text-gray-400 dark:text-zinc-500 text-xs">{profitPct}%</span></p>
                    </div>
                  </div>

                  {/* Info row */}
                  {isDueToday && nextInst ? (
                    <div className="mx-4 mt-3 rounded-2xl border border-orange-300 bg-orange-50/90 px-4 py-3 dark:border-orange-800 dark:bg-orange-950/20">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                            <Clock className="h-4 w-4" />
                            <span className="text-base font-semibold">Vence Hoje!</span>
                          </div>
                          <p className="mt-1 text-xs text-orange-600 dark:text-orange-300/90">Parcela {nextInst.number}/{loan.installmentCount}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold tabular-nums text-orange-700 dark:text-orange-300">{formatCurrency(nextInst.amount)}</p>
                          <p className="mt-1 text-xs text-orange-600 dark:text-orange-300/90">Vencimento: {formatDate(nextInst.dueDate)}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-orange-500 dark:text-orange-300/80">Lembre o cliente para evitar atrasos</p>
                    </div>
                  ) : (
                    <div className="mx-4 mt-3 flex flex-col gap-2 text-xs text-gray-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Venc: {nextInst ? formatDate(nextInst.dueDate) : "—"}</span>
                        <Pencil className="h-3 w-3 text-gray-300 dark:text-zinc-600" />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="font-medium text-gray-700 dark:text-zinc-300">Pago: {formatCurrency(paid)}</span>
                      </div>
                    </div>
                  )}

                  {/* Juros por parcela */}
                  {(() => {
                    const interestPayments = loan.payments.filter((p: any) => {
                      const notes = (p.notes || "").toLowerCase()
                      return notes.includes("parcial de juros")
                    })
                    const totalPartialPaid = interestPayments.reduce((s: number, p: any) => s + p.amount, 0)
                    const jurosPago = intPerInst > 0 ? totalPartialPaid % intPerInst : 0
                    const jurosPendente = intPerInst > 0 ? intPerInst - jurosPago : 0
                    const hasPartialInterest = jurosPago > 0
                    return (
                      <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800/60 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-zinc-400">Só Juros (por parcela):</span>
                          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(intPerInst)}</span>
                        </div>
                        {hasPartialInterest && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">💳 Juros já pago:</span>
                              <span className="text-sm font-semibold tabular-nums text-yellow-600 dark:text-yellow-400">{formatCurrency(jurosPago)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-red-500 dark:text-red-400">Juros pendente:</span>
                              <span className="text-sm font-semibold tabular-nums text-red-500 dark:text-red-400">{formatCurrency(jurosPendente)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })()}

                  {/* Parcelas em atraso - Breakdown */}
                  {(() => {
                    const loanData = buildLoanData({
                      amount: loan.amount, interestRate: loan.interestRate, interestType: loan.interestType,
                      totalAmount: loan.totalAmount, dailyInterestAmount: loan.dailyInterestAmount || 0,
                      dueDay: loan.dueDay, modality: loan.modality, firstInstallmentDate: loan.firstInstallmentDate,
                      installments: loan.installments, payments: loan.payments,
                    })
                    const daysOverdue = getDaysOverdue(loanData)
                    const dailyAmt = loan.dailyInterestAmount || 0

                    if (daysOverdue <= 0) return null

                    const overdueInsts = loan.installments
                      .filter((i: any) => i.status !== "PAID" && new Date(i.dueDate) < new Date())
                      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

                    return (
                      <div className="mx-4 mt-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 space-y-2">
                        {overdueInsts.map((inst: any, idx: number) => {
                          const instDue = new Date(inst.dueDate)
                          const instDays = Math.max(0, Math.floor((new Date().getTime() - instDue.getTime()) / (1000 * 60 * 60 * 24)))
                          const instPenalty = dailyAmt > 0 ? dailyAmt * instDays : 0
                          return (
                            <div key={inst.id} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-red-700 dark:text-red-400">
                                  Parcela {inst.number}/{loan.installmentCount} em atraso
                                </span>
                                <span className="text-xs font-bold text-red-700 dark:text-red-400">{instDays} dias</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 dark:text-zinc-400">Vencimento: {formatDate(inst.dueDate)}</span>
                                <span className="text-gray-700 dark:text-zinc-300 font-medium">Valor: {formatCurrency(inst.amount)}</span>
                              </div>
                              {dailyAmt > 0 && instDays > 0 && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-red-600 dark:text-red-400">% Juros ({formatCurrency(dailyAmt)}/dia)</span>
                                  <span className="text-red-600 dark:text-red-400 font-bold">+{formatCurrency(instPenalty)}</span>
                                </div>
                              )}
                              {idx < overdueInsts.length - 1 && (
                                <div className="border-b border-red-200 dark:border-red-800/40 pt-1" />
                              )}
                            </div>
                          )
                        })}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-red-200 dark:border-red-800/40">
                          <span className="font-semibold text-red-700 dark:text-red-300">Total com Atraso:</span>
                          <span className="font-bold text-red-700 dark:text-red-300">{formatCurrency(remaining)}</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Ações */}
                  <div className="px-4 pt-3 pb-4 mt-2 border-t border-gray-100 dark:border-zinc-800 space-y-3">
                    {(status.label === "Atrasado" || status.label === "Inadimplente") && (
                      <div>
                          <Button size="sm" onClick={() => openWhatsappDialog(loan)} className="w-full h-9 text-sm bg-green-600 hover:bg-green-700 text-white transition-colors">
                            <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Cobrar via WhatsApp
                          </Button>
                      </div>
                    )}
                    <div className="grid w-full min-w-0 grid-cols-[minmax(0,2.2fr)_minmax(0,2.8fr)_repeat(5,minmax(0,1fr))] gap-1.5 pb-1">
                      <Button size="sm" onClick={() => openPaymentDialog(loan)} className="min-w-0 h-10 px-2 text-xs border border-emerald-100 bg-emerald-50 font-medium text-emerald-700 shadow-none transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30 sm:text-sm">
                        <Receipt className="mr-1 h-4 w-4 shrink-0" /> <span className="truncate">Pagar</span>
                      </Button>
                      <Button size="sm" onClick={() => openInterestRenegotiateDialog(loan)} className="min-w-0 h-10 px-2 text-xs border border-emerald-100 bg-emerald-50 font-medium text-emerald-700 shadow-none transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30 sm:text-sm">
                        <DollarSign className="mr-1 h-4 w-4 shrink-0" /> <span className="truncate">Pagar Juros</span>
                      </Button>
                      <button className="flex min-w-0 w-full items-center justify-center rounded-xl bg-emerald-50 p-2 text-emerald-600 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-900/40" onClick={() => router.push(`/emprestimos/${loan.id}`)} title="Histórico">
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button className="flex min-w-0 w-full items-center justify-center rounded-xl bg-blue-50 p-2 text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/40" onClick={() => router.push(`/emprestimos/${loan.id}/editar`)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button className="flex min-w-0 w-full items-center justify-center rounded-xl bg-orange-50 p-2 text-orange-500 transition-colors hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:hover:bg-orange-900/40" onClick={() => openPaymentDialog(loan)} title="Pagamento">
                        <DollarSign className="h-4 w-4" />
                      </button>
                      <button className="flex min-w-0 w-full items-center justify-center rounded-xl bg-amber-50 p-2 text-amber-500 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-900/40" onClick={() => openInterestRenegotiateDialog(loan)} title="Pagar juros">
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button className="flex min-w-0 w-full items-center justify-center rounded-xl bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40" onClick={() => handleDelete(loan.id)} title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {expandedLoan === loan.id && (
                    <div className="mx-4 mb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                      {/* Juros e Parcelas */}
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                        <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">% Juros: {loan.interestRate}%</span>
                        <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">{loan.installmentCount}x {formatCurrency(loan.installmentValue)}</span>
                      </div>

                      {/* Progresso */}
                      <div className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Progresso</span>
                          <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{Math.round((loan.installments.filter((i: any) => i.status === "PAID").length / loan.installmentCount) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${(loan.installments.filter((i: any) => i.status === "PAID").length / loan.installmentCount) * 100}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">{loan.installments.filter((i: any) => i.status === "PAID").length} de {loan.installmentCount} parcela(s) paga(s) • {loan.installments.filter((i: any) => i.status !== "PAID").length} restante(s)</p>
                      </div>

                      {/* Cronograma de Parcelas */}
                      <div className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                        <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> Cronograma de Parcelas</p>
                        <div className="space-y-1">
                          {loan.installments
                            .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                            .map((inst: any, idx: number) => (
                            <div key={inst.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 dark:border-zinc-700/50 last:border-0">
                              <span className="text-gray-600 dark:text-zinc-400">Parcela {idx + 1}/{loan.installmentCount}</span>
                              <span className="font-medium text-gray-900 dark:text-zinc-100">{formatCurrency(inst.amount)}</span>
                              <span className="text-gray-500 dark:text-zinc-400">{formatDate(inst.dueDate)}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${inst.status === "PAID" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400"}`}>
                                {inst.status === "PAID" ? "Pago" : "Pendente"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Detalhes do Contrato */}
                      <div className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                        <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2 flex items-center gap-1"><FileText className="h-3 w-3" /> Detalhes do Contrato</p>
                        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                          <div>
                            <p className="text-gray-400 dark:text-zinc-500">Data do Contrato</p>
                            <p className="font-medium text-gray-900 dark:text-zinc-100">{formatDate(loan.contractDate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 dark:text-zinc-500">Início</p>
                            <p className="font-medium text-gray-900 dark:text-zinc-100">{formatDate(loan.firstInstallmentDate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 dark:text-zinc-500">Tipo de Juros</p>
                            <p className="font-medium text-gray-900 dark:text-zinc-100">{loan.interestType === "COMPOUND" ? "Composto" : loan.interestType === "TOTAL" ? "Price" : "Simples"}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 dark:text-zinc-500">Tipo de Pagamento</p>
                            <p className="font-medium text-gray-900 dark:text-zinc-100">{MODALITY_LABELS[loan.modality] || loan.modality}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 dark:text-zinc-500">Total de Juros</p>
                            <p className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(loan.totalInterest || loan.profit)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Observações */}
                      {loan.notes && (
                        <div className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                          <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><FileText className="h-3 w-3" /> Observações</p>
                          <p className="text-xs text-gray-600 dark:text-zinc-400">{loan.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            } else {
              /* ===== FOLDER CARD (multiple loans) ===== */
              const totalAmount = group.loans.reduce((s, l) => s + l.amount, 0)
              const totalReceivable = group.loans.reduce((s, l) => s + l.totalAmount, 0)
              const totalPaid = group.loans.reduce((s, l) => s + getPaidTotal(l), 0)
              const remaining = group.loans.reduce((s, l) => s + getRemaining(l), 0)
              const totalProfit = group.loans.reduce((s, l) => s + l.profit, 0)
              const totalReceivedProfit = group.loans.reduce((s, l) => s + getReceivedProfit(l), 0)
              const groupStatus = getGroupStatusInfo(group.loans)
              const isGroupOrange = groupStatus.label === "Pendente"
              const isGroupRed = groupStatus.label === "Atrasado" || groupStatus.label === "Inadimplente"

              const fCardBorder = isGroupOrange ? "border-orange-300 dark:border-orange-800" : isGroupRed ? "border-red-300 dark:border-red-800" : "border-emerald-300 dark:border-emerald-800"
              const fCardBg = isGroupOrange ? "bg-orange-50 dark:bg-orange-950/20" : isGroupRed ? "bg-red-50 dark:bg-red-950/20" : "bg-white dark:bg-zinc-900"
              const fRemainingColor = isGroupRed ? "text-red-600 dark:text-red-400" : isGroupOrange ? "text-orange-600 dark:text-orange-400" : groupStatus.label === "Quitado" ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"
              const fRemainingBg = isGroupOrange ? "bg-orange-50 dark:bg-orange-950/30" : isGroupRed ? "bg-red-50 dark:bg-red-950/30" : "bg-emerald-50 dark:bg-emerald-950/30"

              return (
                <div key={group.clientId} className={`rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${fCardBorder} ${fCardBg}`}>
                  {/* Header - nome centralizado */}
                  <div className="px-4 pt-4 pb-2 text-center border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="font-semibold text-base text-gray-900 dark:text-zinc-100">{group.clientName}</h3>
                  </div>

                  {/* Avatar + badges */}
                  <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-3">
                    <Avatar name={group.clientName} src={group.clientPhoto} size="sm" />
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-600 dark:bg-zinc-600 text-white flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      {group.loans.length >= 2 && (
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block flex-shrink-0" />
                      )}
                      {group.loans.length} empréstimos
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${groupStatus.color}`}>
                      {groupStatus.label}
                    </span>
                  </div>

                  {/* Valor Restante */}
                  <div className="px-4 pb-3">
                    <div className={`${fRemainingBg} rounded-lg px-4 py-3 text-center`}>
                      <p className={`text-lg font-bold tabular-nums tracking-tight ${fRemainingColor}`}>{formatCurrency(remaining)}</p>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">restante a receber</p>
                    </div>
                  </div>

                  {/* Grid de valores */}
                  <div className="mx-4 grid grid-cols-2 gap-px bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-gray-100 dark:border-zinc-800">
                    <div className="bg-white dark:bg-zinc-900 px-3 py-2.5">
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500">Emprestado</p>
                      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(totalAmount)}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 px-3 py-2.5 text-right">
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500">Total a Receber</p>
                      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(totalReceivable)}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 px-3 py-2.5">
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1"><Lock className="h-3 w-3" /> Lucro Previsto</p>
                      <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(totalProfit)}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 px-3 py-2.5 text-right">
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1 justify-end"><Check className="h-3 w-3" /> Recebido</p>
                      <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(totalReceivedProfit)}</p>
                    </div>
                  </div>

                  {/* Lista de empréstimos */}
                  <div className="px-4 py-3 mt-2">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Empréstimos na Pasta</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                      {group.loans.map((loan) => {
                        const nextI = getNextDueInst(loan)
                        const loanStatus = getLoanStatusInfo(loan)
                        return (
                          <div key={loan.id} className="rounded-xl border border-gray-200 bg-white/90 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-[0.08em] text-gray-400 dark:text-zinc-500">Emprestado</p>
                                <p className="mt-1 text-base font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(loan.amount)}</p>
                              </div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${loanStatus.color}`}>
                                {loanStatus.label}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                              <div className="rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-zinc-800/70">
                                <p className="text-[10px] uppercase tracking-[0.08em] text-gray-400 dark:text-zinc-500">Vencimento</p>
                                <p className="mt-1 font-medium text-gray-700 dark:text-zinc-300">{nextI ? formatDate(nextI.dueDate) : "—"}</p>
                              </div>
                              <div className="rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-zinc-800/70">
                                <p className="text-[10px] uppercase tracking-[0.08em] text-gray-400 dark:text-zinc-500">Total</p>
                                <p className="mt-1 font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(loan.totalAmount)}</p>
                              </div>
                            </div>

                            <Button size="sm" onClick={() => openRenegotiateDialog(loan)} className="mt-3 h-8 w-full rounded-xl border border-emerald-100 bg-emerald-50 text-xs font-medium text-emerald-700 shadow-none hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30">
                              <Receipt className="mr-1.5 h-3.5 w-3.5" /> Pagar
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Botão */}
                  <div className="px-4 pb-4 pt-1 space-y-2">
                    {(groupStatus.label === "Atrasado" || groupStatus.label === "Inadimplente") && (() => {
                      const overdueLoan = group.loans.find(l => {
                        const st = getLoanStatusInfo(l)
                        return st.label === "Atrasado" || st.label === "Inadimplente"
                      })
                      return overdueLoan ? (
                        <Button size="sm" onClick={() => openWhatsappDialog(overdueLoan)} className="w-full h-9 text-sm bg-green-600 hover:bg-green-700 text-white transition-colors">
                          <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Cobrar via WhatsApp
                        </Button>
                      ) : null
                    })()}
                    <button
                      onClick={() => router.push(`/emprestimos/cliente/${group.clientId}`)}
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <FolderOpen className="h-4 w-4" />
                      Abrir Pasta
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            }
          })}
        </div>
      )}

      {/* ===== NOVO EMPRÉSTIMO DIALOG ===== */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Novo Empréstimo" className="max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="space-y-5">
          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <button
              type="button"
              onClick={() => setNewClientDialog(true)}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-md border-2 border-dashed border-emerald-600 text-emerald-600 text-sm font-medium hover:bg-emerald-100 dark:bg-emerald-900/30 transition"
            >
              <Plus className="h-4 w-4" /> Cadastrar novo cliente
            </button>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setClientPickerOpen((open) => !open)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 text-left text-sm text-gray-900 transition hover:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <span className={`${selectedLoanClient ? "text-gray-900 dark:text-zinc-100" : "text-gray-500 dark:text-zinc-400"}`}>
                  {selectedLoanClient
                    ? `${selectedLoanClient.name}${selectedLoanClient.phone ? ` - ${selectedLoanClient.phone}` : selectedLoanClient.document ? ` - ${selectedLoanClient.document}` : ""}`
                    : "Buscar cliente por nome, telefone ou CPF..."}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform dark:text-zinc-500 ${clientPickerOpen ? "rotate-180" : ""}`} />
              </button>

              {clientPickerOpen && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="border-b border-gray-100 p-3 dark:border-zinc-800">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                      <Input
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Buscar cliente..."
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto p-2">
                    {filteredClients.length === 0 ? (
                      <div className="rounded-lg px-3 py-6 text-center text-sm text-gray-500 dark:text-zinc-400">
                        Nenhum cliente encontrado.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredClients.map((client) => {
                          const isSelected = client.id === clientId
                          return (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => {
                                setClientId(client.id)
                                setClientSearch(client.name)
                                setClientPickerOpen(false)
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${isSelected ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "hover:bg-gray-50 dark:hover:bg-zinc-800/70"}`}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <Avatar name={client.name} src={client.photo} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">{client.name}</p>
                                  <p className="truncate text-xs text-gray-500 dark:text-zinc-400">
                                    {client.phone || client.document || "Sem telefone ou CPF"}
                                  </p>
                                </div>
                              </div>
                              {isSelected && <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Valor + Taxa */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1"
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Taxa de Juros (%) *</Label>
              <Input
                type="number"
                step="0.1"
                value={interestRate || ""}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="mt-1"
                placeholder="0"
              />
            </div>
          </div>

          {/* Juros Aplicado + Modalidade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Juros Aplicado</Label>
              <select value={interestType} onChange={(e) => { setInterestType(e.target.value); if (e.target.value === "CUSTOM") { setCustomInstallmentAmounts(Array(installmentCount).fill(0)) } }} className={`${selectClass} mt-1`}>
                <option value="PER_INSTALLMENT">Por Parcela</option>
                <option value="PRICE">Tabela Price</option>
                <option value="CUSTOM">Parcelas Personalizadas</option>
              </select>
            </div>
            <div>
              <Label>Modalidade</Label>
              <select value={modality} onChange={(e) => setModality(e.target.value)} className={`${selectClass} mt-1`}>
                <option value="MONTHLY">Parcelado (Mensal)</option>
                <option value="BIWEEKLY">Quinzenal</option>
                <option value="WEEKLY">Semanal</option>
              </select>
            </div>
          </div>

          {/* Nº Parcelas + Juros Total (R$) */}
          <div className={interestType === "CUSTOM" ? "" : "grid grid-cols-2 gap-4"}>
            <div>
              <Label>{modality === "BIWEEKLY" ? "Nº de Quinzenas" : modality === "WEEKLY" ? "Nº de Semanas" : modality === "DAILY" ? "Nº de Dias" : "Nº de Parcelas"} *</Label>
              <Input
                type="number"
                min={1}
                value={installmentCount}
                onChange={(e) => setInstallmentCount(Number(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
            {interestType !== "CUSTOM" && (
              <div>
                <Label>Juros Total (R$)</Label>
                {interestType === "FIXED_AMOUNT" ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={totalInterestAmount || ""}
                    onChange={(e) => setTotalInterestAmount(Number(e.target.value))}
                    className="mt-1"
                    placeholder="Ex: 160.00"
                  />
                ) : (
                  <Input
                    type="text"
                    readOnly
                    value={formatCurrency(preview.totalInterest)}
                    className="mt-1 bg-gray-100 dark:bg-zinc-800/50 cursor-default"
                  />
                )}
              </div>
            )}
          </div>

          {/* Parcelas Personalizadas */}
          {interestType === "CUSTOM" && (
            <div className="rounded-lg border border-gray-200 dark:border-zinc-700 p-4 bg-gray-50 dark:bg-zinc-800/40 space-y-3">
              <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">Valores das Parcelas</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {customInstallmentAmounts.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">Parcela {idx + 1}:</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={val || ""}
                      onChange={(e) => {
                        const updated = [...customInstallmentAmounts]
                        updated[idx] = Number(e.target.value) || 0
                        setCustomInstallmentAmounts(updated)
                      }}
                      className="flex-1"
                      placeholder="R$ 0,00"
                    />
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 dark:border-zinc-700 pt-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-zinc-400">Soma das parcelas:</span>
                  <span className="font-bold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(customInstallmentAmounts.reduce((s, v) => s + (v || 0), 0))}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-zinc-400">Lucro (juros):</span>
                  <span className={`font-bold tabular-nums ${preview.totalInterest >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(preview.totalInterest)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Valor da Parcela + Total a Receber */}
          {interestType !== "CUSTOM" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{interestType === "SAC" ? "1ª Parcela (R$)" : modality === "BIWEEKLY" ? "Valor da Quinzena (R$)" : modality === "WEEKLY" ? "Valor da Semana (R$)" : modality === "DAILY" ? "Valor do Dia (R$)" : "Valor da Parcela (R$)"}</Label>
              <Input
                type="text"
                readOnly
                value={formatCurrency(preview.installmentAmount)}
                className="mt-1 bg-gray-100 dark:bg-zinc-800/50 cursor-default"
              />
            </div>
            <div>
              <Label>Total a Receber</Label>
              <div className="mt-1 flex h-10 w-full items-center rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 text-sm font-bold tabular-nums text-emerald-600">
                {formatCurrency(preview.totalAmount)}
              </div>
            </div>
          </div>
          )}

          {/* Data do Contrato + 1ª Parcela */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data do Contrato</Label>
              <Input
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Quando foi fechado</p>
            </div>
            <div>
              <Label>1ª Parcela *</Label>
              <Input
                type="date"
                value={firstInstallmentDate}
                onChange={(e) => setFirstInstallmentDate(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Quando começa a pagar</p>
            </div>
          </div>

          {/* Não cobrar nos seguintes dias */}
          <div>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-2">Não cobra nos seguintes dias:</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={skipSaturday} onChange={(e) => setSkipSaturday(e.target.checked)} className="rounded border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-emerald-500 focus:ring-emerald-500" />
                Sábado
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={skipSunday} onChange={(e) => setSkipSunday(e.target.checked)} className="rounded border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-emerald-500 focus:ring-emerald-500" />
                Domingo
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} className="rounded border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-emerald-500 focus:ring-emerald-500" />
                Feriados
              </label>
            </div>
          </div>

          {/* Vencimento das Parcelas */}
          <div>
            <Label>{modality === "BIWEEKLY" ? "Vencimento das Quinzenas" : modality === "WEEKLY" ? "Vencimento das Semanas" : modality === "DAILY" ? "Vencimento dos Dias" : "Vencimento das Parcelas"}</Label>
            <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-800 p-3">
              {installmentDates.map((date, i) => {
                const sacAmounts = (preview as any).sacInstallments as number[] | undefined
                const prefix = modality === "BIWEEKLY" ? "Quinz." : modality === "WEEKLY" ? "Sem." : modality === "DAILY" ? "Dia" : "Parc."
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-zinc-400 w-16 shrink-0">{prefix} {i + 1}</span>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        const updated = [...installmentDates]
                        updated[i] = e.target.value
                        setInstallmentDates(updated)
                      }}
                      className="flex-1"
                    />
                    {interestType === "SAC" && sacAmounts && sacAmounts[i] !== undefined && (
                      <span className="text-sm font-semibold tabular-nums text-emerald-600 w-24 text-right shrink-0">{formatCurrency(sacAmounts[i])}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label>Observações</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 flex w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Observações sobre o empréstimo..."
            />
          </div>

          {/* Etiquetas */}
          <div>
            <Label>Etiquetas</Label>
            <div className="flex flex-wrap gap-1 mt-1 mb-2">
              {loanTags.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  {tag}
                  <button type="button" onClick={() => setLoanTags(loanTags.filter((_, idx) => idx !== i))} className="hover:text-red-800 dark:hover:text-red-300">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={formTagInput}
                onChange={(e) => setFormTagInput(e.target.value)}
                placeholder="Digite uma etiqueta..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const val = formTagInput.trim()
                    if (val && !loanTags.includes(val)) {
                      setLoanTags([...loanTags, val])
                    }
                    setFormTagInput("")
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const val = formTagInput.trim()
                  if (val && !loanTags.includes(val)) {
                    setLoanTags([...loanTags, val])
                  }
                  setFormTagInput("")
                }}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Juros diários */}
          <div
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition ${
              dailyInterest ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            }`}
            onClick={() => setDailyInterest(!dailyInterest)}
          >
            <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${dailyInterest ? "border-emerald-500" : "border-gray-300 dark:border-zinc-700"}`}>
              {dailyInterest && <div className="h-2 w-2 rounded-full bg-emerald-50 dark:bg-emerald-950/300" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={dailyInterest} readOnly className="rounded border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-emerald-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">Aplicar juros diários em caso de atraso</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Se marcado, juros serão aplicados automaticamente por dia de atraso</p>
            </div>
          </div>

          {/* Valor do Juros Diário */}
          {dailyInterest && (
            <div>
              <Label className="text-sm font-medium">Valor do Juros Diário (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={dailyInterestAmount}
                onChange={(e) => setDailyInterestAmount(Number(e.target.value) || 0)}
                className="mt-1"
                placeholder="Ex: 15.00"
              />
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Valor cobrado por dia de atraso (padrão: R$ 15,00)</p>
            </div>
          )}

          {/* WhatsApp */}
          <div
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition ${
              whatsappNotify ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            }`}
            onClick={() => setWhatsappNotify(!whatsappNotify)}
          >
            <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${whatsappNotify ? "border-emerald-500" : "border-gray-300 dark:border-zinc-700"}`}>
              {whatsappNotify && <div className="h-2 w-2 rounded-full bg-emerald-50 dark:bg-emerald-950/300" />}
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">Receber notificação WhatsApp deste contrato</span>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Alertas de atraso e relatórios serão enviados normalmente mesmo que você não marque essa opção</p>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={onSubmit}>Criar</Button>
          </div>
        </div>
      </Dialog>

      {/* ===== NOVO CLIENTE RÁPIDO DIALOG ===== */}
      <Dialog open={newClientDialog} onClose={() => setNewClientDialog(false)} title="Cadastrar Cliente">
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="mt-1" placeholder="Nome completo" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} className="mt-1" placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label>CPF / CNPJ</Label>
            <Input value={newClientDocument} onChange={(e) => setNewClientDocument(e.target.value)} className="mt-1" placeholder="000.000.000-00" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setNewClientDialog(false)}>Cancelar</Button>
            <Button onClick={handleNewClient}>Cadastrar</Button>
          </div>
        </div>
      </Dialog>

      {/* ===== REGISTRAR PAGAMENTO DIALOG ===== */}
      <Dialog
        open={!!paymentDialog}
        onClose={() => { setPaymentDialog(null); resetPaymentForm() }}
        title="Registrar Pagamento"
        className="max-w-lg"
      >
        {paymentDialog && (() => {
          const pendingInstallments = paymentDialog.installments.filter((i: any) => i.status !== "PAID")
          const selectedInsts = paymentDialog.installments.filter((i: any) => selectedInstallmentIds.includes(i.id))
          const paid = paymentDialog.payments.reduce((s: number, p: any) => s + p.amount, 0)
          const remaining = getRemaining(paymentDialog)
          const interestPerInst = paymentDialog.profit / paymentDialog.installmentCount
          const principalPerInst = paymentDialog.amount / paymentDialog.installmentCount
          const firstInst = pendingInstallments[0]
          const totalOfInst = firstInst ? firstInst.amount : 0
          const firstSelectedInst = selectedInsts[0]
          const firstInstPayable = firstInst ? getInstallmentPayableAmount(paymentDialog, firstInst) : 0
          const firstSelectedInstPayable = firstSelectedInst ? getInstallmentPayableAmount(paymentDialog, firstSelectedInst) : 0
          const firstSelectedInstCharge = firstSelectedInst ? Math.max(0, firstSelectedInstPayable - firstSelectedInst.amount) : 0
          const overdueCharge = getCurrentOverdueCharge(paymentDialog)
          const overdueDays = getCurrentOverdueDays(paymentDialog)

          // Quitação inteligente: calcula multa se atrasado
          const now = new Date()
          const hasOverdueInst = pendingInstallments.some((i: any) => new Date(i.dueDate) < now)
          const penalty = hasOverdueInst ? (paymentDialog.penaltyFee || 0) : 0
          const totalWithPenalty = remaining + penalty

          return (
            <div className="space-y-5">
              {/* Client info card */}
              <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800/40 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={paymentDialog.client.name} src={paymentDialog.client.photo} size="sm" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-zinc-100">{paymentDialog.client.name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">Restante: {formatCurrency(remaining)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-2">
                  Parcela: {formatCurrency(firstInstPayable || totalOfInst)} ({formatCurrency(principalPerInst)} + {formatCurrency(interestPerInst)} juros)
                </p>
                {overdueCharge > 0 && (
                  <p className="text-xs text-red-500 mt-1 font-medium">
                    ⚠ Parcela em atraso — juros de {formatCurrency(overdueCharge)} serão aplicados na parcela vencida
                  </p>
                )}
              </div>

              {/* Tipo de Pagamento */}
              <div>
                <Label className="text-sm font-medium">Tipo de Pagamento</Label>
                <div className="flex gap-2 mt-2">
                  {([
                    { key: "installment", label: "Parcela" },
                    { key: "partial", label: "Parcial" },
                    { key: "total", label: "Total" },
                    { key: "discount", label: "Desconto" },
                  ] as const).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setPaymentType(t.key)
                        if (t.key === "total") {
                          setPayAmount(totalWithPenalty)
                          setSelectedInstallmentIds([])
                        } else if (t.key === "installment") {
                          const total = selectedInsts.reduce((sum: number, installment: any) => sum + getInstallmentPayableAmount(paymentDialog, installment), 0)
                          setPayAmount(total)
                        } else if (t.key === "partial") {
                          setPayAmount(0)
                          if (selectedInstallmentIds.length > 1) {
                            setSelectedInstallmentIds(selectedInstallmentIds.slice(0, 1))
                          }
                        } else if (t.key === "discount") {
                          setPayAmount(0)
                          setPayDiscount(0)
                          setSelectedInstallmentIds([])
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        paymentType === t.key
                          ? t.key === "discount"
                            ? "bg-white dark:bg-zinc-900 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                            : "bg-emerald-600 border-emerald-600 text-white"
                          : "border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-gray-400 dark:hover:border-zinc-600"
                      }`}
                    >
                      {t.key === "discount" && <span className="mr-1">%</span>}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selecione a(s) Parcela(s) - card-based for installment mode */}
              {paymentType === "installment" && (
                <div>
                  <Label className="text-sm font-medium">Selecione a(s) Parcela(s)</Label>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 mb-2">
                    Clique para selecionar múltiplas parcelas
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pendingInstallments.map((inst: any) => {
                      const isSelected = selectedInstallmentIds.includes(inst.id)
                      const instOverdue = new Date(inst.dueDate) < now
                      const payableAmount = getInstallmentPayableAmount(paymentDialog, inst)
                      const installmentCharge = Math.max(0, payableAmount - Math.max(0, inst.amount - (inst.paidAmount || 0)))
                      return (
                        <button
                          key={inst.id}
                          type="button"
                          onClick={() => {
                            let newIds: string[]
                            if (isSelected) {
                              newIds = selectedInstallmentIds.filter((id: string) => id !== inst.id)
                            } else {
                              newIds = [...selectedInstallmentIds, inst.id]
                            }
                            setSelectedInstallmentIds(newIds)
                            const total = paymentDialog.installments
                              .filter((i: any) => newIds.includes(i.id))
                              .reduce((sum: number, installment: any) => sum + getInstallmentPayableAmount(paymentDialog, installment), 0)
                            setPayAmount(total)
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                              : "border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600"
                          }`}
                        >
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                              Parcela {inst.number}/{paymentDialog.installmentCount}
                            </span>
                            {instOverdue && installmentCharge > 0 && (
                              <p className="text-[10px] text-red-500 mt-0.5">+ juros {formatCurrency(installmentCharge)}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500 dark:text-zinc-400">{formatDate(inst.dueDate)}</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                              {formatCurrency(payableAmount)}
                            </p>
                            {instOverdue && <p className="text-[10px] text-red-500">Atrasada</p>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Referente a qual Parcela? - dropdown for partial mode */}
              {paymentType === "partial" && (
                <div>
                  <Label className="text-sm font-medium">Referente a qual Parcela?</Label>
                  <select
                    value={selectedInstallmentIds[0] || ""}
                    onChange={(e) => {
                      setSelectedInstallmentIds([e.target.value])
                      const inst = paymentDialog.installments.find((i: any) => i.id === e.target.value)
                      if (inst) {
                        setPayAmount(0)
                      }
                    }}
                    className="mt-2 flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100"
                  >
                    {pendingInstallments.map((inst: any) => (
                      <option key={inst.id} value={inst.id}>
                        Parcela {inst.number}/{paymentDialog.installmentCount} - {formatDate(inst.dueDate)}
                      </option>
                    ))}
                  </select>

                  {/* Values info */}
                  {firstSelectedInst && (
                    <div className="rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800/30 p-3 space-y-1 mt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-zinc-400">Valor base:</span>
                        <span className="text-gray-900 dark:text-zinc-100 font-medium">{formatCurrency(firstSelectedInst.amount)}</span>
                      </div>
                      {firstSelectedInstCharge > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-red-500">Juros atraso ({overdueDays} dias):</span>
                          <span className="text-red-500 font-medium">+{formatCurrency(firstSelectedInstCharge)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-zinc-400">Total da parcela:</span>
                        <span className="text-gray-900 dark:text-zinc-100 font-medium">{formatCurrency(firstSelectedInstPayable || firstSelectedInst.amount)}</span>
                      </div>
                      {firstSelectedInst.paidAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-zinc-400">Já pago:</span>
                          <span className="text-emerald-600 font-medium">{formatCurrency(firstSelectedInst.paidAmount)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Quitação com Desconto */}
              {paymentType === "discount" && (
                <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-3">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <span>%</span> Quitação com Desconto
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-zinc-400">Saldo Devedor:</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(remaining)}</span>
                  </div>
                  {penalty > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-500">Multa por Atraso:</span>
                      <span className="text-sm font-bold text-red-500">+ {formatCurrency(penalty)}</span>
                    </div>
                  )}
                  {penalty > 0 && (
                    <div className="flex items-center justify-between border-t border-emerald-200 dark:border-emerald-800 pt-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Total com Multa:</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(totalWithPenalty)}</span>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium">Valor Recebido *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={remaining}
                      value={payAmount || ""}
                      onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                      className="mt-1 bg-white dark:bg-zinc-900"
                      placeholder={`Máximo: ${formatCurrency(remaining)}`}
                    />
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Quanto o cliente efetivamente pagou para quitar</p>
                  </div>
                </div>
              )}

              {/* Resumo Quitação Total */}
              {paymentType === "total" && penalty > 0 && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-zinc-400">Saldo Devedor:</span>
                    <span className="font-medium text-gray-900 dark:text-zinc-100">{formatCurrency(remaining)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-500">Multa por Atraso:</span>
                    <span className="font-bold text-red-500">+ {formatCurrency(penalty)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t border-red-200 dark:border-red-800 pt-2">
                    <span className="font-semibold text-gray-700 dark:text-zinc-300">Total a Cobrar:</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(totalWithPenalty)}</span>
                  </div>
                </div>
              )}

              {/* Valor Pago - only for partial */}
              {paymentType === "partial" && firstSelectedInst && (
                <div>
                  <Label className="text-sm font-medium">Valor Pago *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={firstSelectedInstPayable}
                    value={payAmount || ""}
                    onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                    className="mt-1"
                    placeholder={`Máx: ${formatCurrency(firstSelectedInstPayable)}`}
                  />
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                    {`Digite qualquer valor até ${formatCurrency(firstSelectedInstPayable)}`}
                  </p>
                </div>
              )}

              {/* Data do Pagamento */}
              <div>
                <Label className="text-sm font-medium">Data do Pagamento</Label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Quando o cliente efetivamente pagou</p>
              </div>

              {/* Nova Data de Vencimento */}
              {paymentType !== "discount" && (
                <div>
                  <Label className="text-sm font-medium">Nova Data de Vencimento</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="date"
                      value={payNewDueDate}
                      onChange={(e) => setPayNewDueDate(e.target.value)}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        d.setDate(d.getDate() + 30)
                        setPayNewDueDate(localDateStr(d))
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-medium border border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/30 transition whitespace-nowrap"
                    >
                      +30 dias
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        d.setDate(d.getDate() + 15)
                        setPayNewDueDate(localDateStr(d))
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-medium border border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30 transition whitespace-nowrap"
                    >
                      +15 dias
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Pré-preenchido com próximo mês. Use os botões para renovar rápido.</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setPaymentDialog(null); resetPaymentForm() }}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (paying) return alert("Pagamento já está sendo processado, aguarde...")
                    if (!payAmount || payAmount <= 0) return alert("Informe o valor")

                    // Salvar info do comprovante ANTES de qualquer mudança de estado
                    const receiptLoan = { ...paymentDialog, client: { ...paymentDialog.client }, installments: [...paymentDialog.installments] }
                    let receiptInstIds: string[] = []
                    let receiptAmount = payAmount
                    let success = false

                    setPaying(true)
                    try {
                      if (paymentType === "total") {
                        const pendingInsts = paymentDialog.installments.filter((i: any) => i.status !== "PAID")
                        if (pendingInsts.length > 0) {
                          const paidCount = paymentDialog.installments.filter((i: any) => i.status === "PAID").length
                          let remainingToPay = payAmount
                          let allOk = true
                          for (let pi = 0; pi < pendingInsts.length; pi++) {
                            const inst = pendingInsts[pi]
                            const instRemaining = inst.amount - (inst.paidAmount || 0)
                            const payThis = Math.min(remainingToPay, instRemaining)
                            if (payThis <= 0) break
                            const notes = `Parcela ${paidCount + pi + 1} de ${paymentDialog.installmentCount}`
                            const result = await handlePayment(paymentDialog.id, inst.id, payThis, notes)
                            if (!result.ok) { allOk = false; break }
                            remainingToPay -= payThis
                          }
                          receiptInstIds = pendingInsts.map((i: any) => i.id)
                          success = allOk
                        }
                      } else if (paymentType === "discount") {
                        const pendingInsts = paymentDialog.installments.filter((i: any) => i.status !== "PAID")
                        if (pendingInsts.length > 0) {
                          const discount = remaining - payAmount
                          const res = await fetch("/api/payments", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              loanId: paymentDialog.id,
                              installmentId: pendingInsts[0].id,
                              amount: payAmount,
                                date: payDate || today(),
                              discount: discount > 0 ? discount : undefined,
                            }),
                          })
                          receiptInstIds = [pendingInsts[0].id]
                          success = res.ok
                        }
                      } else if (paymentType === "installment" && selectedInstallmentIds.length > 0) {
                        const allInsts = paymentDialog.installments
                        let allOk = true
                        const paidInstIds: string[] = []
                        let totalReceiptAmount = 0

                        for (const i of selectedInsts) {
                          const idx = allInsts.findIndex((inst: any) => inst.id === i.id)
                          const payableAmount = getInstallmentPayableAmount(paymentDialog, i)
                          const baseAmount = Math.max(0, i.amount - (i.paidAmount || 0))
                          const lateFeeForInst = Math.round((payableAmount - baseAmount) * 100) / 100
                          const baseNotes = `Parcela ${idx + 1} de ${paymentDialog.installmentCount}`
                          const notes = lateFeeForInst > 0
                            ? `${baseNotes} [lateFee:${lateFeeForInst.toFixed(2)}]`
                            : baseNotes
                          const result = await handlePayment(paymentDialog.id, i.id, payableAmount, notes)
                          if (!result.ok) { allOk = false; break }
                          paidInstIds.push(i.id)
                          totalReceiptAmount += payableAmount
                        }

                        receiptInstIds = paidInstIds
                        receiptAmount = totalReceiptAmount
                        success = allOk
                      } else if (selectedInstallmentIds.length > 0) {
                        const allInsts = paymentDialog.installments
                        const idx = allInsts.findIndex((inst: any) => inst.id === selectedInstallmentIds[0])
                        const notes = `Parcela ${idx + 1} de ${paymentDialog.installmentCount}`
                        const result = await handlePayment(paymentDialog.id, selectedInstallmentIds[0], payAmount, notes)
                        receiptInstIds = [selectedInstallmentIds[0]]
                        success = result.ok
                      }

                      // Fechar dialog de pagamento
                      setPaymentDialog(null)
                      resetPaymentForm()
                      setPaying(false)

                      // Mostrar comprovante
                      if (success && receiptInstIds.length > 0) {
                        const allInsts = receiptLoan.installments
                        const paidCount = allInsts.filter((i: any) => i.status === "PAID").length
                        const payingCount = receiptInstIds.length
                        const willBeCompleted = (paidCount + payingCount) >= allInsts.length
                        const firstIdx = allInsts.findIndex((i: any) => i.id === receiptInstIds[0])
                        const label = receiptInstIds.length === 1
                          ? `${firstIdx + 1}/${allInsts.length}`
                          : `${firstIdx + 1}-${firstIdx + receiptInstIds.length}/${allInsts.length}`
                        const dateStr = payDate || today()

                        const alreadyPaid = receiptLoan.payments.reduce((s: number, p: any) => s + p.amount, 0)
                        const isTotal = paymentType === "total" || paymentType === "discount"
                        const info = {
                          type: "Empréstimo",
                          clientName: receiptLoan.client.name,
                          clientPhone: clients.find(c => c.id === receiptLoan.client.id)?.phone || null,
                          installmentLabel: label,
                          amount: receiptAmount,
                          date: new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00").toLocaleDateString("pt-BR"),
                          isCompleted: willBeCompleted,
                          remainingBalance: isTotal ? 0 : Math.max(0, receiptLoan.totalAmount - alreadyPaid - receiptAmount),
                        }
                        setPaymentReceiptInfo(info)
                        setPaymentReceiptDialog(true)
                      }

                      // Atualizar lista em background
                      fetchLoans()
                    } catch (err) {
                      setPaying(false)
                      alert("Erro ao registrar pagamento")
                    }
                  }}
                  disabled={!payAmount || payAmount <= 0 || paying}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {paying ? "Processando..." : paymentType === "discount" ? "Quitar com Desconto" : "Registrar Pagamento"}
                </Button>
              </div>
            </div>
          )
        })()}
      </Dialog>

      {/* ===== ETIQUETAR DIALOG ===== */}
      <Dialog
        open={!!tagDialog}
        onClose={() => { setTagDialog(null); setShowTagForm(false); setTagInput(""); }}
        title="Gerenciar Etiquetas"
        className="max-w-sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-700 dark:text-zinc-300">
            <Tag className="h-4 w-4" />
            <span className="font-medium text-sm">Etiquetas</span>
          </div>

          {/* Tags existentes */}
          <div className="flex flex-wrap gap-1.5">
            {editingTags.map((tag, i) => {
              const [name, color] = tag.includes("|") ? tag.split("|") : [tag, "#ef4444"]
              return (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: color }}>
                  {name}
                  <button type="button" onClick={() => setEditingTags(editingTags.filter((_, idx) => idx !== i))} className="hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            })}
          </div>

          {!showTagForm ? (
            <button
              type="button"
              onClick={() => setShowTagForm(true)}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-400 border border-dashed border-gray-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          ) : (
            <div className="space-y-3 border border-gray-200 dark:border-zinc-700 rounded-lg p-3">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Nome da etiqueta..."
                className="text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const val = tagInput.trim()
                    if (val) {
                      const newTag = `${val}|${tagColor}`
                      if (!editingTags.some(t => t.split("|")[0] === val)) {
                        setEditingTags([...editingTags, newTag])
                      }
                      setTagInput("")
                      setShowTagForm(false)
                    }
                  }
                }}
              />
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">Criar nova etiqueta:</p>
                <div className="flex flex-wrap gap-2">
                  {["#3b82f6", "#ef4444", "#f97316", "#10b981", "#eab308", "#a855f7", "#ec4899", "#6366f1", "#14b8a6", "#f59e0b", "#8b5cf6", "#06b6d4"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTagColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${tagColor === c ? "ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-zinc-900 scale-110" : "hover:scale-110"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              {tagInput.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    const val = tagInput.trim()
                    if (val) {
                      const newTag = `${val}|${tagColor}`
                      if (!editingTags.some(t => t.split("|")[0] === val)) {
                        setEditingTags([...editingTags, newTag])
                      }
                      setTagInput("")
                      setShowTagForm(false)
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                  style={{ backgroundColor: tagColor }}
                >
                  <Plus className="h-4 w-4" /> Criar &ldquo;{tagInput.trim()}&rdquo;
                </button>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
            <Button variant="outline" size="sm" onClick={() => { setTagDialog(null); setShowTagForm(false); setTagInput(""); }}>Cancelar</Button>
            <Button size="sm" onClick={async () => {
              if (!tagDialog) return
              await fetch(`/api/loans/${tagDialog.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tags: editingTags }),
              })
              setTagDialog(null)
              setShowTagForm(false)
              setTagInput("")
              fetchLoans()
            }}>Salvar</Button>
          </div>
        </div>
      </Dialog>

      {/* ===== RENEGOCIAR DÍVIDA DIALOG ===== */}
      <Dialog
        open={!!renegotiateDialog}
        onClose={() => { setRenegotiateDialog(null); setRenegotiateMode(null); setRenegotiateEntry("all"); setRenegotiateAmount(0); setRenegotiateNotes("") }}
        title="Renegociar Dívida"
        className="max-w-lg"
      >
        {renegotiateDialog && (() => {
          const paid = renegotiateDialog.payments.reduce((s: number, p: any) => s + p.amount, 0)
          const remaining = getRemaining(renegotiateDialog)
          const instValue = renegotiateDialog.installmentValue
          const intPerInst = interestPerInst(renegotiateDialog)
          const nextInst = getNextDueInst(renegotiateDialog)

          // Juros acumulados: juros da parcela + juros por atraso (>= 30 dias) + multa diária
          const nextInstOverdue = (() => {
            if (!nextInst) return 0
            const now = new Date()
            const due = new Date(nextInst.dueDate)
            const diffDays = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
            if (diffDays <= 0) return 0
            let extra = 0
            // Juros por atraso (>= 30 dias)
            if (diffDays >= 30) {
              extra += calculateOverdueInterest(
                renegotiateDialog.totalAmount,
                renegotiateDialog.amount,
                renegotiateDialog.interestRate,
                diffDays,
                renegotiateDialog.interestType === "compound" ? "compound" : "simple"
              )
            }
            // Multa diária
            extra += (renegotiateDialog.dailyInterestAmount || 0) * diffDays
            return extra
          })()
          const totalJuros = intPerInst + nextInstOverdue
          const totalAfterJuros = remaining - renegotiateAmount

          return (
            <div className="space-y-5">
              {/* Client info */}
              <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800/40 p-4 flex items-center gap-3">
                <Avatar name={renegotiateDialog.client.name} src={renegotiateDialog.client.photo} size="sm" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-zinc-100">{renegotiateDialog.client.name}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Saldo devedor: {formatCurrency(remaining)}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Valor por parcela: {formatCurrency(instValue)}</p>
                </div>
              </div>

              {/* Mode not selected - show options */}
              {!renegotiateMode && (
                <>
                  {renegotiateEntry === "all" && (
                    <button
                      onClick={() => { setRenegotiateMode("total"); setRenegotiateDialog(null); setRenegotiateEntry("all"); openPaymentDialog(renegotiateDialog) }}
                      className="w-full text-left rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-emerald-500 p-4 transition-colors flex items-center gap-4"
                    >
                      <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center shrink-0">
                        <Receipt className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-600">Pagamento Total</p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Registrar pagamento completo da parcela</p>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => { setRenegotiateMode("full"); setRenegotiateAmount(totalJuros) }}
                    className="w-full text-left rounded-2xl border-2 border-emerald-600 bg-emerald-50/70 p-4 transition-colors flex items-center gap-4 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/20"
                  >
                    <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-600">Cliente pagou só os juros</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Registrar pagamento apenas dos juros da parcela</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setRenegotiateMode("partial"); setRenegotiateAmount(0) }}
                    className="w-full text-left rounded-2xl border-2 border-cyan-500 bg-cyan-50/70 p-4 transition-colors flex items-center gap-4 shadow-sm dark:border-cyan-500 dark:bg-cyan-950/20"
                  >
                    <div className="h-12 w-12 rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-cyan-600">Pagamento parcial de juros</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Registrar pagamento de parte dos juros de uma parcela</p>
                    </div>
                  </button>
                </>
              )}

              {/* ===== FULL JUROS MODE ===== */}
              {renegotiateMode === "full" && (
                <div className="rounded-xl border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-5">
                  {/* Header with back */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                      <span className="font-semibold text-emerald-600">Cliente pagou só os juros</span>
                    </div>
                    <button
                      onClick={() => setRenegotiateMode(null)}
                      className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200 flex items-center gap-1"
                    >
                      ← Voltar
                    </button>
                  </div>

                  {/* Summary box */}
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                    <p className="text-sm text-gray-800 dark:text-zinc-200">
                      <strong>Resumo:</strong> Cliente paga <span className="text-emerald-600 font-bold">{formatCurrency(renegotiateAmount)}</span> de juros agora.
                    </p>
                    <p className="text-sm text-gray-800 dark:text-zinc-200">
                      No próximo mês, o valor a cobrar será: <strong>{formatCurrency(totalAfterJuros)}</strong>
                    </p>
                  </div>

                  {/* Valor Pago + Valor Total que Falta */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Valor Pago (Juros) (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={renegotiateAmount || ""}
                        onChange={(e) => setRenegotiateAmount(Number(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Valor calculado automaticamente, editável</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Valor Total que Falta (R$)</Label>
                      <Input
                        type="number"
                        readOnly
                        value={totalAfterJuros.toFixed(2)}
                        className="mt-1 bg-gray-100 dark:bg-zinc-800/50 cursor-default"
                      />
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Só diminui se pagar mais que o juros</p>
                    </div>
                  </div>

                  {/* Data do Pagamento + Nova Data de Vencimento */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Data do Pagamento *</Label>
                      <Input
                        type="date"
                        value={renegotiateDate}
                        onChange={(e) => {
                          setRenegotiateDate(e.target.value)
                          // Atualiza vencimento: data do pagamento + dias conforme modalidade
                          if (e.target.value && renegotiateDialog) {
                            const d = new Date(e.target.value + "T12:00:00")
                            d.setDate(d.getDate() + modalityDays(renegotiateDialog.modality))
                            setRenegotiateNewDueDate(localDateStr(d))
                          }
                        }}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Quando o cliente pagou os juros</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Nova Data de Vencimento *</Label>
                      <Input
                        type="date"
                        value={renegotiateNewDueDate}
                        onChange={(e) => setRenegotiateNewDueDate(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Próxima data de cobrança</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== PARTIAL JUROS MODE ===== */}
              {renegotiateMode === "partial" && (() => {
                const pendingInsts = renegotiateDialog.installments
                  .filter((i: any) => i.status !== "PAID")
                  .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                const selInst = pendingInsts.find((i: any) => i.id === renegotiateInstallmentId)
                
                // Calculate already paid partial interest in current cycle
                const partialPayments = renegotiateDialog.payments.filter((p: any) => {
                  const notes = (p.notes || "").toLowerCase()
                  return notes.includes("parcial de juros")
                })
                const totalPartialPaid = partialPayments.reduce((s: number, p: any) => s + p.amount, 0)
                const cicloJurosPago = intPerInst > 0 ? totalPartialPaid % intPerInst : 0
                const cicloJurosFaltante = intPerInst > 0 ? intPerInst - cicloJurosPago : intPerInst
                const jurosPendente = Math.max(0, cicloJurosFaltante - renegotiateAmount)

                return (
                  <div className="rounded-xl border border-cyan-500 bg-cyan-950/20 p-5 space-y-5">
                    {/* Header with back */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-cyan-600" />
                        <span className="font-semibold text-cyan-600">Pagamento Parcial de Juros</span>
                      </div>
                      <button
                        onClick={() => setRenegotiateMode(null)}
                        className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200 flex items-center gap-1"
                      >
                        ← Voltar
                      </button>
                    </div>

                    {/* Parcela selector */}
                    <div>
                      <Label className="text-sm font-medium">Parcela referente:</Label>
                      <select
                        value={renegotiateInstallmentId}
                        onChange={(e) => setRenegotiateInstallmentId(e.target.value)}
                        className="mt-1 flex w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {pendingInsts.map((inst: any) => (
                          <option key={inst.id} value={inst.id}>
                            Parcela {inst.number} - {formatDate(inst.dueDate)} - Juros: {formatCurrency(intPerInst)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Valor pago + Data do pagamento */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Valor pago agora (R$) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={cicloJurosFaltante}
                          value={renegotiateAmount || ""}
                          onChange={(e) => setRenegotiateAmount(Number(e.target.value) || 0)}
                          className="mt-1"
                          placeholder={`Ex: ${cicloJurosFaltante.toFixed(2).replace(".", ",")}`}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Data do pagamento *</Label>
                        <Input
                          type="date"
                          value={renegotiateDate}
                          onChange={(e) => setRenegotiateDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* Calculation summary */}
                    <div className="rounded-lg border border-cyan-700/40 bg-gray-50 dark:bg-zinc-800/60 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-zinc-300">Juros total da parcela:</span>
                        <span className="font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(intPerInst)}</span>
                      </div>
                      {cicloJurosPago > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-yellow-600 dark:text-yellow-400">💳 Já pago neste ciclo:</span>
                          <span className="font-bold text-yellow-600 dark:text-yellow-400">- {formatCurrency(cicloJurosPago)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-zinc-300">Valor pago agora:</span>
                        <span className="font-bold text-gray-900 dark:text-zinc-100">- {formatCurrency(renegotiateAmount)}</span>
                      </div>
                      <div className="border-t border-gray-300 dark:border-zinc-700 my-1" />
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-zinc-300 font-semibold">Juros pendente final:</span>
                        <span className="font-bold text-cyan-600 text-base">{formatCurrency(jurosPendente)}</span>
                      </div>
                      {jurosPendente === 0 && renegotiateAmount > 0 && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">✅ Juros completo! A dívida renovará para o próximo mês.</p>
                      )}
                    </div>

                    {/* Explanatory note */}
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      O saldo devedor e datas de vencimento não serão alterados. Apenas será registrado o pagamento parcial dos juros.
                    </p>
                  </div>
                )
              })()}

              {/* Observações (outside colored box) */}
              {renegotiateMode && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Observações</Label>
                    <textarea
                      value={renegotiateNotes}
                      onChange={(e) => setRenegotiateNotes(e.target.value)}
                      className="mt-1 flex w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Observações sobre o pagamento..."
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => { setRenegotiateDialog(null); setRenegotiateMode(null); setRenegotiateAmount(0); setRenegotiateNotes("") }}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleRenegotiatePayment}
                      disabled={!renegotiateAmount || renegotiateAmount <= 0 || paying}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {paying ? "Processando..." : renegotiateMode === "partial" ? "Registrar Pagamento Parcial" : "Registrar Pagamento de Juros"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </Dialog>

      {/* Dialog de Sucesso - Empréstimo Criado */}
      <Dialog open={successDialog} onClose={() => setSuccessDialog(false)} className="max-w-md">
        <div className="space-y-5">
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-emerald-600">Empréstimo Criado!</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Deseja enviar comprovante ao cliente?</p>
          </div>

          {createdLoanInfo && (
            <div className="rounded-lg border border-gray-200 dark:border-zinc-700 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-bold text-gray-900 dark:text-zinc-100">{createdLoanInfo.clientName}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-zinc-300">
                <div className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-gray-400" /> Valor: {formatCurrency(createdLoanInfo.amount)}</div>
                <div className="flex items-center gap-1.5"><span className="text-gray-400 text-xs font-bold">%</span> Juros: {createdLoanInfo.interestRate}%</div>
                <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-gray-400" /> {createdLoanInfo.installmentCount}x {formatCurrency(createdLoanInfo.installmentValue)}</div>
                <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gray-400" /> Venc: {new Date(createdLoanInfo.firstInstallmentDate + "T12:00:00").toLocaleDateString("pt-BR")}</div>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-zinc-700 pt-3">
                <span className="text-sm text-gray-500 dark:text-zinc-400">Total a Receber:</span>
                <span className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(createdLoanInfo.totalAmount)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button
              className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => {
                if (!createdLoanInfo) return
                const text = `📋 *Comprovante de Empréstimo*\n\n👤 Cliente: ${createdLoanInfo.clientName}\n💰 Valor: ${formatCurrency(createdLoanInfo.amount)}\n📊 Juros: ${createdLoanInfo.interestRate}%\n📄 ${createdLoanInfo.installmentCount}x ${formatCurrency(createdLoanInfo.installmentValue)}\n📅 1º Vencimento: ${new Date(createdLoanInfo.firstInstallmentDate + "T12:00:00").toLocaleDateString("pt-BR")}\n\n💵 *Total a Receber: ${formatCurrency(createdLoanInfo.totalAmount)}*`
                navigator.clipboard.writeText(text)
                alert("Texto copiado!")
              }}
            >
              <Copy className="h-4 w-4" /> Copiar Texto
            </Button>
            <Button
              className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => {
                if (!createdLoanInfo) return
                const text = `📋 *Comprovante de Empréstimo*\n\n👤 Cliente: ${createdLoanInfo.clientName}\n💰 Valor: ${formatCurrency(createdLoanInfo.amount)}\n📊 Juros: ${createdLoanInfo.interestRate}%\n📄 ${createdLoanInfo.installmentCount}x ${formatCurrency(createdLoanInfo.installmentValue)}\n📅 1º Vencimento: ${new Date(createdLoanInfo.firstInstallmentDate + "T12:00:00").toLocaleDateString("pt-BR")}\n\n💵 *Total a Receber: ${formatCurrency(createdLoanInfo.totalAmount)}*`
                const phone = createdLoanInfo.clientPhone?.replace(/\D/g, "") || ""
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")
              }}
            >
              <ExternalLink className="h-4 w-4" /> Enviar via WhatsApp
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                setSuccessDialog(false)
              }}
            >
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog Comprovante de Pagamento */}
      <Dialog open={paymentReceiptDialog} onClose={() => setPaymentReceiptDialog(false)} className="max-w-md">
        {paymentReceiptInfo && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                <Receipt className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-emerald-600">Pagamento Registrado!</h2>
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
                <span className="font-bold text-emerald-600">{formatCurrency(paymentReceiptInfo.amount)}</span>
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
              <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 py-2.5 px-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Contrato Quitado!</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Button
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  const text = `📋 *Comprovante de Pagamento*\n\n📌 Tipo: ${paymentReceiptInfo.type}\n👤 Cliente: ${paymentReceiptInfo.clientName}\n📄 Parcela: ${paymentReceiptInfo.installmentLabel}\n💰 Valor Pago: ${formatCurrency(paymentReceiptInfo.amount)}\n📅 Data: ${paymentReceiptInfo.date}\n💵 Saldo Restante: ${formatCurrency(paymentReceiptInfo.remainingBalance)}${paymentReceiptInfo.isCompleted ? "\n\n✅ *Contrato Quitado!*" : ""}`
                  navigator.clipboard.writeText(text)
                  alert("Copiado!")
                }}
              >
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button
                className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  const text = `📋 *Comprovante de Pagamento*\n\n📌 Tipo: ${paymentReceiptInfo.type}\n👤 Cliente: ${paymentReceiptInfo.clientName}\n📄 Parcela: ${paymentReceiptInfo.installmentLabel}\n💰 Valor Pago: ${formatCurrency(paymentReceiptInfo.amount)}\n📅 Data: ${paymentReceiptInfo.date}\n💵 Saldo Restante: ${formatCurrency(paymentReceiptInfo.remainingBalance)}${paymentReceiptInfo.isCompleted ? "\n\n✅ *Contrato Quitado!*" : ""}`
                  const phone = profilePhone?.replace(/\D/g, "") || ""
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")
                }}
              >
                <Send className="h-4 w-4" /> Para Mim
              </Button>
              <Button
                className="gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white"
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

      {/* Dialog Resultado Envio em Massa */}
      <Dialog
        open={!!bulkResultDialog}
        onClose={() => setBulkResultDialog(null)}
        title="Resultado do Envio"
        className="max-w-sm"
      >
        {bulkResultDialog && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <p className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
              Envio para clientes {bulkResultDialog.type} concluído
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-gray-50 dark:bg-zinc-800 p-3">
                <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{bulkResultDialog.total}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Total</p>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <p className="text-2xl font-bold text-emerald-600">{bulkResultDialog.sent}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Enviados</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3">
                <p className="text-2xl font-bold text-red-600">{bulkResultDialog.failed}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Falhas</p>
              </div>
            </div>
            <Button onClick={() => setBulkResultDialog(null)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              Fechar
            </Button>
          </div>
        )}
      </Dialog>

      {/* Dialog WhatsApp Cobrança */}
      <Dialog
        open={whatsappDialog}
        onClose={() => { setWhatsappDialog(false); setWhatsappSent(false) }}
        title="Cobrar via WhatsApp"
        className="max-w-lg"
      >
        <div className="space-y-4">
          {whatsappLoan && (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-zinc-700 p-3">
                <Avatar name={whatsappLoan.client.name} src={whatsappLoan.client.photo} size="sm" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-zinc-100">{whatsappLoan.client.name}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{getClientPhone(whatsappLoan) || "Sem telefone"}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-400 dark:text-zinc-500">Parcelas em atraso</p>
                  <p className="text-sm font-bold text-red-600">{getOverdueInstallments(whatsappLoan).length}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Mensagem de Cobrança</Label>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Edite a mensagem antes de enviar</p>
                <Textarea
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  className="min-h-[200px] text-sm"
                  placeholder="Digite a mensagem..."
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500">
                <button
                  type="button"
                  onClick={() => setWhatsappMessage(buildDefaultWhatsappMessage(whatsappLoan))}
                  className="text-emerald-600 hover:underline"
                >
                  Restaurar mensagem padrão
                </button>
              </div>

              {whatsappSent ? (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">Mensagem enviada com sucesso!</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">A cobrança foi enviada para {whatsappLoan.client.name}</p>
                </div>
              ) : !getClientPhone(whatsappLoan) ? (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
                  <MessageCircle className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Cliente sem telefone cadastrado</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">Cadastre o telefone do cliente para enviar cobranças via WhatsApp.</p>
                  <Button variant="outline" className="mt-3" onClick={() => setWhatsappDialog(false)}>Fechar</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setWhatsappDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                    onClick={sendWhatsappMessage}
                    disabled={whatsappSending || !whatsappMessage.trim()}
                  >
                    {whatsappSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {whatsappSending ? "Enviando..." : "Enviar Cobrança"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Dialog>
    </div>
  )
}

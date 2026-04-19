"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar } from "@/components/avatar"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Calendar, Check, CheckCircle2, Copy, DollarSign, Download, Eye, FileText, Lock, Loader2, MessageCircle, Pencil, Receipt, RotateCcw, Send, Tag, Trash2, X, Plus } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatDate } from "@/lib/utils"
import { buildLoanData, calculateTotalAmountWithLateFee, calculateOverdueInterest, getDaysOverdue, getNextDueDate as getNextDueDateFn } from "@/lib/loan-logic"

interface Loan {
  id: string
  amount: number
  interestRate: number
  interestType: string
  totalAmount: number
  profit: number
  installmentCount: number
  installmentValue: number
  penaltyFee: number
  dailyInterestAmount: number
  dueDay: number
  modality: string
  firstInstallmentDate: string
  status: string
  tags: string[]
  client: { id: string; name: string; photo: string | null }
  installments: { id: string; number: number; dueDate: string; status: string; amount: number; paidAmount: number }[]
  payments: { id: string; amount: number; date: string; notes?: string }[]
}

const MODALITY_LABELS: Record<string, string> = {
  MONTHLY: "MENSAL",
  BIWEEKLY: "QUINZENAL",
  WEEKLY: "SEMANAL",
  DAILY: "DIÁRIO",
}

export default function ClienteEmprestimosPage() {
  const params = useParams<{ clientId: string }>()
  const router = useRouter()
  const clientId = params?.clientId

  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [tagDialog, setTagDialog] = useState<Loan | null>(null)
  const [editingTags, setEditingTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [tagColor, setTagColor] = useState("#10b981")
  const [showTagForm, setShowTagForm] = useState(false)

  // Profile PIX key
  const [profilePixKey, setProfilePixKey] = useState("")

  // WhatsApp state
  const [whatsappDialog, setWhatsappDialog] = useState(false)
  const [whatsappLoan, setWhatsappLoan] = useState<Loan | null>(null)
  const [whatsappMessage, setWhatsappMessage] = useState("")
  const [whatsappSending, setWhatsappSending] = useState(false)
  const [whatsappSent, setWhatsappSent] = useState(false)
  const [clientPhone, setClientPhone] = useState<string | null>(null)

  // Renegotiate dialog state
  const [renegotiateDialog, setRenegotiateDialog] = useState<Loan | null>(null)
  const [renegotiateMode, setRenegotiateMode] = useState<"total" | "full" | "partial" | null>(null)
  const [renegotiateAmount, setRenegotiateAmount] = useState<number>(0)
  const [renegotiateDate, setRenegotiateDate] = useState("")
  const [renegotiateNewDueDate, setRenegotiateNewDueDate] = useState("")
  const [renegotiateNotes, setRenegotiateNotes] = useState("")
  const [renegotiateInstallmentId, setRenegotiateInstallmentId] = useState("")

  // Payment dialog state
  const [paymentDialog, setPaymentDialog] = useState<Loan | null>(null)
  const [paymentType, setPaymentType] = useState<"installment" | "partial" | "total" | "discount">("installment")
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<string[]>([])
  const [payAmount, setPayAmount] = useState<number>(0)
  const [payDate, setPayDate] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [payNewDueDate, setPayNewDueDate] = useState("")
  const [payDiscount, setPayDiscount] = useState<number>(0)
  const [paying, setPaying] = useState(false)

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

  const TAG_COLORS = ["#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#10b981","#14b8a6","#06b6d4","#3b82f6","#8b5cf6","#ec4899"]

  const fetchLoans = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const res = await fetch("/api/loans")
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setLoans(list.filter((loan: Loan) => loan.client?.id === clientId && loan.status !== "COMPLETED"))
    } finally {
      setLoading(false)
    }
  }

  const fetchClientPhone = async () => {
    if (!clientId) return
    try {
      const res = await fetch("/api/clients")
      const data = await res.json()
      const client = (Array.isArray(data) ? data : []).find((c: any) => c.id === clientId)
      setClientPhone(client?.phone || null)
    } catch {}
  }

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile")
      const data = await res.json()
      setProfilePixKey(data.pixKey || "")
    } catch {}
  }

  useEffect(() => {
    fetchLoans()
    fetchClientPhone()
    fetchProfile()
  }, [clientId])

  const clientName = loans[0]?.client?.name || "Cliente"
  const clientPhoto = loans[0]?.client?.photo || null

  const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const todayStr = toDateStr(new Date())

  const getOverdueInstallments = (loan: Loan) => {
    return loan.installments.filter((i: any) => {
      if (i.status === "PAID") return false
      return toDateStr(new Date(i.dueDate)) <= todayStr
    })
  }

  const buildDefaultWhatsappMessage = (loan: Loan) => {
    const name = loan.client.name.split(" ")[0]
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

    return `👤 Cliente: ${name}\n\n🔴 PARCELA EM ATRASO\n\n📅 Data de vencimento: ${vencimento}\n\n💰 pagamento total: ${formatCurrency(totalOverdue)}\n\n🔄 Valor para regularização parcial (juros): R$ ${juros}\n\n📆 Dias em atraso: ${daysLate} dias\n\n⚠️ Multa por atraso: R$ 15,00 por dia\n\n\n💳 Chave Pix: ${profilePixKey || "Não cadastrada"}`
  }

  const openWhatsappDialog = (loan: Loan) => {
    setWhatsappLoan(loan)
    setWhatsappMessage(buildDefaultWhatsappMessage(loan))
    setWhatsappSent(false)
    setWhatsappDialog(true)
  }

  const sendWhatsappMessage = async () => {
    if (!whatsappLoan || !whatsappMessage.trim() || !clientPhone) return
    setWhatsappSending(true)
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clientPhone, message: whatsappMessage }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) throw new Error(data?.error || "Erro ao enviar mensagem")
      setWhatsappSent(true)
    } catch (error: any) {
      alert(error.message || "Erro ao enviar mensagem")
    } finally {
      setWhatsappSending(false)
    }
  }

  // Saldo devedor: usa sistema de 4 camadas
  const getRemaining = (loan: Loan) => {
    const loanData = buildLoanData({
      amount: loan.amount,
      interestRate: loan.interestRate,
      interestType: loan.interestType || "SIMPLE",
      totalAmount: loan.totalAmount,
      dailyInterestAmount: loan.dailyInterestAmount || 0,
      dueDay: loan.dueDay || new Date(loan.installments[0]?.dueDate || Date.now()).getDate(),
      modality: loan.modality,
      firstInstallmentDate: loan.firstInstallmentDate || loan.installments[0]?.dueDate || new Date().toISOString(),
      installments: loan.installments,
      payments: loan.payments,
    })
    return Math.max(0, calculateTotalAmountWithLateFee(loanData))
  }

  const totals = useMemo(() => {
    const totalAmount = loans.reduce((sum, loan) => sum + loan.amount, 0)
    const totalReceivable = loans.reduce((sum, loan) => sum + loan.totalAmount, 0)
    const totalPaid = loans.reduce((sum, loan) => sum + loan.payments.reduce((s, p) => s + p.amount, 0), 0)
    return { totalAmount, totalReceivable, totalPaid, remaining: loans.reduce((s, l) => s + getRemaining(l), 0) }
  }, [loans])

  // --- HELPERS ---
  const getLoanStatusInfo = (loan: Loan) => {
    if (loan.status === "COMPLETED") return { label: "Quitado", color: "bg-blue-50 dark:bg-blue-950/20 text-blue-600" }
    if (loan.status === "DEFAULTED") return { label: "Inadimplente", color: "bg-red-50 dark:bg-red-950/20 text-red-600" }
    const paid = loan.payments.reduce((s: number, p: any) => s + p.amount, 0)
    const interest = loan.totalAmount - loan.amount
    if (interest > 0 && paid >= interest && paid < loan.totalAmount) return { label: "Só Juros", color: "bg-purple-50 dark:bg-purple-950/20 text-purple-600" }
    const hasOverdue = loan.installments.some((i: any) => i.status !== "PAID" && toDateStr(new Date(i.dueDate)) < todayStr)
    if (hasOverdue) return { label: "Atrasado", color: "bg-red-50 dark:bg-red-950/20 text-red-600" }
    return { label: "Pendente", color: "bg-orange-50 dark:bg-orange-950/20 text-orange-600" }
  }

  const getPaidTotal = (loan: Loan) => loan.payments.reduce((s: number, p: any) => s + p.amount, 0)
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

  // Juros acumulados por atraso usando loan-logic
  const getOverdueExtraInterest = (loan: Loan) => {
    const loanData = buildLoanData({
      amount: loan.amount,
      interestRate: loan.interestRate,
      interestType: loan.interestType || "SIMPLE",
      totalAmount: loan.totalAmount,
      dailyInterestAmount: loan.dailyInterestAmount || 0,
      dueDay: loan.dueDay || new Date(loan.installments[0]?.dueDate || Date.now()).getDate(),
      modality: loan.modality,
      firstInstallmentDate: loan.firstInstallmentDate || loan.installments[0]?.dueDate || new Date().toISOString(),
      installments: loan.installments,
      payments: loan.payments,
    })
    const daysOverdue = getDaysOverdue(loanData)
    if (daysOverdue < 30) return 0
    return calculateOverdueInterest(
      loan.totalAmount,
      loan.amount,
      loan.interestRate,
      daysOverdue,
      (loan.interestType || "SIMPLE") as "SIMPLE" | "COMPOUND"
    )
  }
  const getNextDueInst = (loan: Loan) =>
    loan.installments
      .filter((i: any) => i.status !== "PAID")
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
  const interestPerInst = (loan: Loan) =>
    Math.round((loan.profit / loan.installmentCount) * 100) / 100

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este empréstimo?")) return
    await fetch(`/api/loans/${id}`, { method: "DELETE" })
    fetchLoans()
  }

  const today = () => new Date().toISOString().split("T")[0]

  const openRenegotiateDialog = (loan: Loan) => {
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
      const dueDay = new Date(loan.installments[0]?.dueDate || loan.installments[0]?.dueDate).getDate()
      const nextDue = getNextDueDateFn(dueDay, new Date())
      setRenegotiateNewDueDate(nextDue.toISOString().split("T")[0])
    } else {
      setRenegotiateInstallmentId("")
      setRenegotiateNewDueDate("")
    }
  }

  const handleRenegotiatePayment = async () => {
    if (!renegotiateDialog || !renegotiateMode) return
    if (paying) return alert("Pagamento já está sendo processado, aguarde...")
    const targetInstId = renegotiateMode === "partial"
      ? renegotiateInstallmentId
      : getNextDueInst(renegotiateDialog)?.id
    if (!targetInstId) return alert("Nenhuma parcela selecionada")
    const intAmount = interestPerInst(renegotiateDialog)
    const amount = renegotiateAmount
    if (!amount || amount <= 0) return alert("Informe o valor")
    if (renegotiateMode === "partial" && amount > intAmount) return alert(`Máximo: ${formatCurrency(intAmount)}`)
    const receiptLoan = renegotiateDialog
    const receiptMode = renegotiateMode
    const receiptAmount = amount
    const receiptDate = renegotiateDate || new Date().toISOString().split("T")[0]
    const allInsts = receiptLoan.installments
    const instIdx = allInsts.findIndex((i: any) => i.id === targetInstId)

    setPaying(true)
    try {
      // For partial mode, check if this payment completes the interest cycle
      let sendNewDueDate: string | undefined = undefined
      if (renegotiateMode === "full") {
        sendNewDueDate = renegotiateNewDueDate || undefined
      } else if (renegotiateMode === "partial") {
        const partialPayments = renegotiateDialog.payments.filter((p: any) => {
          const notes = (p.notes || "").toLowerCase()
          return notes.includes("parcial de juros")
        })
        const totalPartialPaid = partialPayments.reduce((s: number, p: any) => s + p.amount, 0)
        const cicloJurosPago = intAmount > 0 ? totalPartialPaid % intAmount : 0
        const cicloJurosFaltante = intAmount > 0 ? intAmount - cicloJurosPago : intAmount
        if (amount >= cicloJurosFaltante) {
          const payDateObj = new Date((renegotiateDate || new Date().toISOString().split("T")[0]) + "T12:00:00")
          payDateObj.setDate(payDateObj.getDate() + modalityDays(renegotiateDialog.modality))
          sendNewDueDate = payDateObj.toISOString().split("T")[0]
        }
      }

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: renegotiateDialog.id,
          installmentId: targetInstId,
          amount,
          date: renegotiateDate || new Date().toISOString(),
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
        setPaymentReceiptInfo({
          type: receiptMode === "full" ? "Só Juros" : "Pagamento Parcial de Juros",
          clientName: receiptLoan.client.name,
          clientPhone: clientPhone,
          installmentLabel: `${instIdx + 1}/${allInsts.length}`,
          amount: receiptAmount,
          date: new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00").toLocaleDateString("pt-BR"),
          isCompleted: false,
          remainingBalance: receiptLoan.totalAmount,
        })
        setPaymentReceiptDialog(true)
      }

      fetchLoans()
    } finally {
      setPaying(false)
    }
  }

  const resetPaymentForm = () => {
    setPaymentType("installment")
    setSelectedInstallmentIds([])
    setPayAmount(0)
    setPayDate(today())
    setPayNotes("")
    setPayNewDueDate("")
    setPayDiscount(0)
  }

  const openPaymentDialog = (loan: Loan) => {
    resetPaymentForm()
    setPaymentDialog(loan)
    const pendingInst = loan.installments.find((i: any) => i.status !== "PAID")
    if (pendingInst) {
      setSelectedInstallmentIds([pendingInst.id])
      setPayAmount(pendingInst.amount - pendingInst.paidAmount)
    }
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    setPayNewDueDate(nextMonth.toISOString().split("T")[0])
  }

  const handlePayment = async () => {
    if (!paymentDialog) return
    if (paying) return alert("Pagamento já está sendo processado, aguarde...")
    const receiptLoan = paymentDialog
    const receiptAmount = payAmount
    const receiptDate = payDate || new Date().toISOString().split("T")[0]

    setPaying(true)
    try {
      if (paymentType === "total") {
        // Pay all pending installments
        const pendingInsts = paymentDialog.installments.filter((i: any) => i.status !== "PAID")
        const paidCount = paymentDialog.installments.filter((i: any) => i.status === "PAID").length
        let remainingToPay = payAmount
        let allOk = true
        for (let pi = 0; pi < pendingInsts.length; pi++) {
          const inst = pendingInsts[pi]
          const instRemaining = inst.amount - (inst.paidAmount || 0)
          const payThis = Math.min(remainingToPay, instRemaining)
          if (payThis <= 0) break
          const notes = `Parcela ${paidCount + pi + 1} de ${paymentDialog.installmentCount}`
          const res = await fetch("/api/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              loanId: paymentDialog.id,
              installmentId: inst.id,
              amount: payThis,
              date: payDate || new Date().toISOString(),
              notes,
            }),
          })
          if (!res.ok) { allOk = false; break }
          remainingToPay -= payThis
        }
        setPaymentDialog(null)
        resetPaymentForm()

        if (allOk && pendingInsts.length > 0) {
          const allInsts = receiptLoan.installments
          const alreadyPaid = receiptLoan.payments.reduce((s: number, p: any) => s + p.amount, 0)
          setPaymentReceiptInfo({
            type: "Empréstimo",
            clientName: receiptLoan.client.name,
            clientPhone: clientPhone,
            installmentLabel: `${paidCount + 1}/${allInsts.length}`,
            amount: receiptAmount,
            date: new Date(receiptDate.includes("T") ? receiptDate : receiptDate + "T12:00:00").toLocaleDateString("pt-BR"),
            isCompleted: true,
            remainingBalance: 0,
          })
          setPaymentReceiptDialog(true)
        }
      } else {
        const body: any = {
          loanId: paymentDialog.id,
          amount: payAmount,
          date: payDate || new Date().toISOString(),
          notes: payNotes,
        }
        if (paymentType === "installment" && selectedInstallmentIds.length > 0) {
          body.installmentId = selectedInstallmentIds[0]
        } else if (paymentType === "partial" && selectedInstallmentIds.length > 0) {
          body.installmentId = selectedInstallmentIds[0]
        } else if (paymentType === "discount") {
          body.discount = payDiscount
          const pendingInst = paymentDialog.installments.find((i: any) => i.status !== "PAID")
          if (pendingInst) body.installmentId = pendingInst.id
        }
        const receiptInstId = body.installmentId

        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        setPaymentDialog(null)
        resetPaymentForm()

        if (res.ok && receiptInstId) {
          const allInsts = receiptLoan.installments
          const paidCount = allInsts.filter((i: any) => i.status === "PAID").length
          const willBeCompleted = (paidCount + 1) >= allInsts.length
          const instIdx = allInsts.findIndex((i: any) => i.id === receiptInstId)
          const dateStr = receiptDate
          const alreadyPaid = receiptLoan.payments.reduce((s: number, p: any) => s + p.amount, 0)
          setPaymentReceiptInfo({
            type: "Empréstimo",
            clientName: receiptLoan.client.name,
            clientPhone: clientPhone,
            installmentLabel: `${instIdx + 1}/${allInsts.length}`,
            amount: receiptAmount,
            date: new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00").toLocaleDateString("pt-BR"),
            isCompleted: willBeCompleted,
            remainingBalance: Math.max(0, receiptLoan.totalAmount - alreadyPaid - receiptAmount),
          })
          setPaymentReceiptDialog(true)
        }
      }

      fetchLoans()
    } finally {
      setPaying(false)
    }
  }

  const handleSaveTags = async () => {
    if (!tagDialog) return
    try {
      await fetch(`/api/loans/${tagDialog.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: editingTags }),
      })
      setTagDialog(null)
      fetchLoans()
    } catch {}
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/emprestimos")} className="flex items-center gap-2 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors">
          <X className="h-4 w-4" />
          <span className="text-sm">Voltar</span>
        </button>
        <Avatar name={clientName} src={clientPhoto} size="sm" />
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">{clientName}</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">{loans.length} empréstimos • Restante: {formatCurrency(totals.remaining)}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 dark:text-zinc-400">Carregando empréstimos...</div>
      ) : loans.length === 0 ? (
        <div className="text-gray-400 dark:text-zinc-500">Nenhum empréstimo encontrado para este cliente.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {loans.map((loan) => {
            const status = getLoanStatusInfo(loan)
            const paid = getPaidTotal(loan)
            const remaining = getRemaining(loan)
            const receivedProfit = getReceivedProfit(loan)
            const profitPct = loan.profit > 0 ? Math.round((receivedProfit / loan.profit) * 100) : 0
            const nextInst = getNextDueInst(loan)
            const intPerInst = interestPerInst(loan)

            const cardBorder = status.label === "Atrasado" || status.label === "Inadimplente" ? "border-red-400 dark:border-red-700" : status.label === "Só Juros" ? "border-purple-400 dark:border-purple-700" : status.label === "Quitado" ? "border-blue-400 dark:border-blue-700" : "border-emerald-400 dark:border-emerald-700"
            const cardBg = status.label === "Atrasado" || status.label === "Inadimplente" ? "bg-red-100 dark:bg-red-950/30" : status.label === "Só Juros" ? "bg-purple-100 dark:bg-purple-950/30" : status.label === "Quitado" ? "bg-blue-100 dark:bg-blue-950/30" : "bg-emerald-100 dark:bg-emerald-950/30"
            const remainingColor = status.label === "Atrasado" || status.label === "Inadimplente" ? "text-red-700 dark:text-red-400" : status.label === "Só Juros" ? "text-purple-700 dark:text-purple-400" : status.label === "Quitado" ? "text-blue-700 dark:text-blue-400" : "text-emerald-700 dark:text-emerald-400"
            const remainingBg = status.label === "Atrasado" || status.label === "Inadimplente" ? "bg-red-100 dark:bg-red-900/40" : status.label === "Só Juros" ? "bg-purple-100 dark:bg-purple-900/40" : status.label === "Quitado" ? "bg-blue-100 dark:bg-blue-900/40" : "bg-emerald-100 dark:bg-emerald-900/40"
            const cellBg = status.label === "Atrasado" || status.label === "Inadimplente" ? "bg-red-50 dark:bg-red-950/20" : status.label === "Só Juros" ? "bg-purple-50 dark:bg-purple-950/20" : status.label === "Quitado" ? "bg-blue-50 dark:bg-blue-950/20" : "bg-emerald-50 dark:bg-emerald-950/20"

            return (
              <div key={loan.id} className={`rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${cardBorder} ${cardBg}`}>
                {/* Header - nome centralizado */}
                <div className="px-4 pt-4 pb-2 text-center border-b border-gray-100 dark:border-zinc-800">
                  <h3 className="font-semibold text-base text-gray-900 dark:text-zinc-100">{clientName}</h3>
                </div>

                {/* Avatar + badges + ações */}
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={clientName} src={clientPhoto} size="sm" />
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    {loan.modality === "INTEREST_ONLY" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">
                        J. Compostos
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                      {MODALITY_LABELS[loan.modality] || loan.modality}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingTags(loan.tags || []); setTagInput(""); setShowTagForm(false); setTagDialog(loan) }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                    >
                      <Tag className="h-3 w-3" /> Etiqueta
                    </button>
                    <button
                      onClick={() => router.push(`/emprestimos/${loan.id}`)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Eye className="h-3 w-3" /> Detalhes
                    </button>
                    <button
                      onClick={() => router.push(`/emprestimos/${loan.id}/comprovante`)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <FileText className="h-3 w-3" /> Comprovante
                    </button>
                  </div>
                </div>

                {/* Etiquetas */}
                {(loan.tags || []).length > 0 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-1">
                    {loan.tags.map((tag, i) => {
                      const [name, color] = tag.includes("|") ? tag.split("|") : [tag, "#ef4444"]
                      return (
                        <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: color }}>{name}</span>
                      )
                    })}
                  </div>
                )}

                {/* Valor Restante */}
                <div className="px-4 pb-3">
                  <div className={`${remainingBg} rounded-lg px-4 py-3 text-center`}>
                    <p className={`text-lg font-bold tabular-nums tracking-tight ${remainingColor}`}>{formatCurrency(remaining)}</p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">restante a receber</p>
                    {(() => {
                      const loanData = buildLoanData({
                        amount: loan.amount, interestRate: loan.interestRate, interestType: loan.interestType || "SIMPLE",
                        totalAmount: loan.totalAmount, dailyInterestAmount: loan.dailyInterestAmount || 0,
                        dueDay: loan.dueDay || new Date(loan.installments[0]?.dueDate || Date.now()).getDate(),
                        modality: loan.modality, firstInstallmentDate: loan.firstInstallmentDate || loan.installments[0]?.dueDate || new Date().toISOString(),
                        installments: loan.installments, payments: loan.payments,
                      })
                      const daysOverdue = getDaysOverdue(loanData)
                      const overdueExtra = remaining - loan.totalAmount + paid
                      if (daysOverdue > 0 && overdueExtra > 0) {
                        return <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">contém {formatCurrency(overdueExtra)} de juros por atraso</p>
                      }
                      return null
                    })()}
                  </div>
                </div>

                {/* Parcelas em atraso - Breakdown */}
                {(() => {
                  const loanData = buildLoanData({
                    amount: loan.amount, interestRate: loan.interestRate, interestType: loan.interestType || "SIMPLE",
                    totalAmount: loan.totalAmount, dailyInterestAmount: loan.dailyInterestAmount || 0,
                    dueDay: loan.dueDay || new Date(loan.installments[0]?.dueDate || Date.now()).getDate(),
                    modality: loan.modality, firstInstallmentDate: loan.firstInstallmentDate || loan.installments[0]?.dueDate || new Date().toISOString(),
                    installments: loan.installments, payments: loan.payments,
                  })
                  const daysOverdue = getDaysOverdue(loanData)
                  const dailyAmt = loan.dailyInterestAmount || 0

                  if (daysOverdue <= 0) return null

                  const overdueInsts = loan.installments
                    .filter((i: any) => i.status !== "PAID" && new Date(i.dueDate) < new Date())
                    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                  const dailyPenalty = dailyAmt * daysOverdue

                  return (
                    <div className="mx-4 mb-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 space-y-2">
                      {overdueInsts.map((inst: any) => {
                        const instDays = Math.max(0, Math.floor((new Date().getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
                        return (
                          <div key={inst.id}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-red-700 dark:text-red-400">Parcela {inst.number}/{loan.installmentCount} em atraso</span>
                              <span className="text-xs font-bold text-red-700 dark:text-red-400">{instDays} dias</span>
                            </div>
                            <div className="flex items-center justify-between text-xs mt-0.5">
                              <span className="text-gray-600 dark:text-zinc-400">Vencimento: {formatDate(inst.dueDate)}</span>
                              <span className="text-gray-700 dark:text-zinc-300 font-medium">Valor: {formatCurrency(inst.amount)}</span>
                            </div>
                          </div>
                        )
                      })}
                      {dailyAmt > 0 && (
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-red-200 dark:border-red-800/40">
                          <span className="text-red-600 dark:text-red-400">% Juros ({formatCurrency(dailyAmt)}/dia)</span>
                          <span className="text-red-600 dark:text-red-400 font-bold">+{formatCurrency(dailyPenalty)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-red-200 dark:border-red-800/40">
                        <span className="font-semibold text-red-700 dark:text-red-300">Total com Atraso:</span>
                        <span className="font-bold text-red-700 dark:text-red-300">{formatCurrency(remaining)}</span>
                      </div>
                    </div>
                  )
                })()}

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
                <div className="mx-4 mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Venc: {nextInst ? formatDate(nextInst.dueDate) : "—"}</span>
                    <Pencil className="h-3 w-3 text-gray-300 dark:text-zinc-600" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="font-medium text-gray-700 dark:text-zinc-300">Pago: {formatCurrency(paid)}</span>
                  </div>
                </div>

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

                {/* Ações */}
                <div className="px-4 pt-3 pb-4 mt-2 border-t border-gray-100 dark:border-zinc-800 space-y-3">
                  <div>
                    <Button size="sm" variant="outline" onClick={() => openRenegotiateDialog(loan)} className="w-full h-9 text-sm border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 transition-colors">
                      <Receipt className="h-3.5 w-3.5 mr-1.5" /> Pagar
                    </Button>
                  </div>
                  {(status.label === "Atrasado" || status.label === "Inadimplente") && (
                    <div>
                      <Button size="sm" onClick={() => openWhatsappDialog(loan)} className="w-full h-9 text-sm bg-green-600 hover:bg-green-700 text-white transition-colors">
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Cobrar via WhatsApp
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-2">
                    <button className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors" onClick={() => router.push(`/emprestimos/${loan.id}`)} title="Histórico">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors" onClick={() => router.push(`/emprestimos/${loan.id}/editar`)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors" onClick={() => router.push(`/emprestimos/${loan.id}`)} title="Pagar Juros">
                      <DollarSign className="h-4 w-4" />
                    </button>
                    <button className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors" onClick={() => router.push(`/emprestimos/${loan.id}`)} title="Renovar">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors" onClick={() => handleDelete(loan.id)} title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tag Dialog */}
      <Dialog open={!!tagDialog} onClose={() => setTagDialog(null)} title="Gerenciar Etiquetas" className="max-w-sm">
        <div className="space-y-3">
          {editingTags.map((tag, i) => {
            const [name, color] = tag.includes("|") ? tag.split("|") : [tag, "#ef4444"]
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-sm font-medium text-white" style={{ backgroundColor: color }}>{name}</span>
                <button onClick={() => setEditingTags(editingTags.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })}
          {showTagForm ? (
            <div className="space-y-2 border-t border-gray-100 dark:border-zinc-800 pt-3">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Nome da etiqueta" />
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((c) => (
                  <button key={c} onClick={() => setTagColor(c)} className={`w-7 h-7 rounded-full border-2 transition-all ${tagColor === c ? "border-gray-900 dark:border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <Button size="sm" onClick={() => {
                if (!tagInput.trim()) return
                setEditingTags([...editingTags, `${tagInput.trim()}|${tagColor}`])
                setTagInput("")
                setShowTagForm(false)
              }} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          ) : (
            <button onClick={() => setShowTagForm(true)} className="w-full py-2 text-sm text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-300 dark:border-emerald-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors">
              + Nova Etiqueta
            </button>
          )}
          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
            <Button variant="outline" className="flex-1" onClick={() => setTagDialog(null)}>Cancelar</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveTags}>Salvar</Button>
          </div>
        </div>
      </Dialog>

      {/* ===== RENEGOCIAR DÍVIDA DIALOG ===== */}
      <Dialog
        open={!!renegotiateDialog}
        onClose={() => { setRenegotiateDialog(null); setRenegotiateMode(null); setRenegotiateAmount(0); setRenegotiateNotes("") }}
        title="Renegociar Dívida"
        className="max-w-lg"
      >
        {renegotiateDialog && (() => {
          const remaining = getRemaining(renegotiateDialog)
          const instValue = renegotiateDialog.installmentValue
          const intPerInst = interestPerInst(renegotiateDialog)
          const nextInst = getNextDueInst(renegotiateDialog)

          // Juros acumulados do próximo vencimento (original + atraso)
          const nextInstOverdue = (() => {
            if (!nextInst) return 0
            const loanData = buildLoanData({
              amount: renegotiateDialog.amount,
              interestRate: renegotiateDialog.interestRate,
              interestType: renegotiateDialog.interestType || "SIMPLE",
              totalAmount: renegotiateDialog.totalAmount,
              dailyInterestAmount: renegotiateDialog.dailyInterestAmount || 0,
              dueDay: renegotiateDialog.dueDay || new Date(renegotiateDialog.installments[0]?.dueDate || Date.now()).getDate(),
              modality: renegotiateDialog.modality,
              firstInstallmentDate: renegotiateDialog.firstInstallmentDate || renegotiateDialog.installments[0]?.dueDate || new Date().toISOString(),
              installments: renegotiateDialog.installments,
              payments: renegotiateDialog.payments,
            })
            const daysOverdue = getDaysOverdue(loanData)
            if (daysOverdue < 30) return 0
            const overdueInterest = calculateOverdueInterest(
              renegotiateDialog.totalAmount,
              renegotiateDialog.amount,
              renegotiateDialog.interestRate,
              daysOverdue,
              (renegotiateDialog.interestType || "SIMPLE") as "SIMPLE" | "COMPOUND"
            )
            const dailyPenalty = (renegotiateDialog.dailyInterestAmount || 0) * daysOverdue
            return overdueInterest + dailyPenalty
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
                  <button
                    onClick={() => { setRenegotiateMode("total"); setRenegotiateDialog(null); openPaymentDialog(renegotiateDialog) }}
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

                  <button
                    onClick={() => { setRenegotiateMode("full"); setRenegotiateAmount(totalJuros) }}
                    className="w-full text-left rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-emerald-500 p-4 transition-colors flex items-center gap-4"
                  >
                    <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-600">Cliente pagou só os juros</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Registrar pagamento apenas dos juros da parcela</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setRenegotiateMode("partial"); setRenegotiateAmount(0) }}
                    className="w-full text-left rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-cyan-500 p-4 transition-colors flex items-center gap-4"
                  >
                    <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-zinc-700/50 flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5 text-gray-700 dark:text-zinc-300" />
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                      <span className="font-semibold text-emerald-600">Cliente pagou só os juros</span>
                    </div>
                    <button onClick={() => setRenegotiateMode(null)} className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 flex items-center gap-1">← Voltar</button>
                  </div>

                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                    <p className="text-sm text-gray-800 dark:text-zinc-200">
                      <strong>Resumo:</strong> Cliente paga <span className="text-emerald-600 font-bold">{formatCurrency(renegotiateAmount)}</span> de juros agora.
                    </p>
                    <p className="text-sm text-gray-800 dark:text-zinc-200">
                      No próximo mês, o valor a cobrar será: <strong>{formatCurrency(totalAfterJuros)}</strong>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Valor Pago (Juros) (R$) *</Label>
                      <Input type="number" step="0.01" min={0} value={renegotiateAmount || ""} onChange={(e) => setRenegotiateAmount(Number(e.target.value) || 0)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Valor Total que Falta (R$)</Label>
                      <Input type="number" readOnly value={totalAfterJuros.toFixed(2)} className="mt-1 bg-gray-100 dark:bg-zinc-800/50 cursor-default" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Data do Pagamento *</Label>
                      <Input type="date" value={renegotiateDate} onChange={(e) => {
                        setRenegotiateDate(e.target.value)
                        if (e.target.value && renegotiateDialog) {
                          const d = new Date(e.target.value + "T12:00:00")
                          d.setDate(d.getDate() + modalityDays(renegotiateDialog.modality))
                          setRenegotiateNewDueDate(d.toISOString().split("T")[0])
                        }
                      }} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Nova Data de Vencimento *</Label>
                      <Input type="date" value={renegotiateNewDueDate} onChange={(e) => setRenegotiateNewDueDate(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                </div>
              )}

              {/* ===== PARTIAL JUROS MODE ===== */}
              {renegotiateMode === "partial" && (() => {
                const pendingInsts = renegotiateDialog.installments
                  .filter((i: any) => i.status !== "PAID")
                  .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-cyan-600" />
                        <span className="font-semibold text-cyan-600">Pagamento Parcial de Juros</span>
                      </div>
                      <button onClick={() => setRenegotiateMode(null)} className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 flex items-center gap-1">← Voltar</button>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Parcela referente:</Label>
                      <select value={renegotiateInstallmentId} onChange={(e) => setRenegotiateInstallmentId(e.target.value)}
                        className="mt-1 flex w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500">
                        {pendingInsts.map((inst: any) => (
                          <option key={inst.id} value={inst.id}>Parcela {inst.number} - {formatDate(inst.dueDate)} - Juros: {formatCurrency(intPerInst)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Valor pago agora (R$) *</Label>
                        <Input type="number" step="0.01" min={0} max={cicloJurosFaltante} value={renegotiateAmount || ""} onChange={(e) => setRenegotiateAmount(Number(e.target.value) || 0)} className="mt-1" placeholder={`Ex: ${cicloJurosFaltante.toFixed(2).replace(".", ",")}`} />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Data do pagamento *</Label>
                        <Input type="date" value={renegotiateDate} onChange={(e) => setRenegotiateDate(e.target.value)} className="mt-1" />
                      </div>
                    </div>

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
                  </div>
                )
              })()}

              {/* Observações + Buttons */}
              {renegotiateMode && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Observações</Label>
                    <textarea value={renegotiateNotes} onChange={(e) => setRenegotiateNotes(e.target.value)}
                      className="mt-1 flex w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Observações sobre o pagamento..." />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => { setRenegotiateDialog(null); setRenegotiateMode(null); setRenegotiateAmount(0); setRenegotiateNotes("") }}>Cancelar</Button>
                    <Button onClick={handleRenegotiatePayment} disabled={!renegotiateAmount || renegotiateAmount <= 0 || paying} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      {paying ? "Processando..." : renegotiateMode === "partial" ? "Registrar Pagamento Parcial" : "Registrar Pagamento de Juros"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
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
          const remaining = getRemaining(paymentDialog)
          const interestPI = paymentDialog.profit / paymentDialog.installmentCount
          const principalPerInst = paymentDialog.amount / paymentDialog.installmentCount
          const firstInst = pendingInstallments[0]
          const totalOfInst = firstInst ? firstInst.amount : 0
          const now = new Date()
          const hasOverdueInst = pendingInstallments.some((i: any) => new Date(i.dueDate) < now)
          const penalty = hasOverdueInst ? (paymentDialog.penaltyFee || 0) : 0
          const totalWithPenalty = remaining + penalty

          return (
            <div className="space-y-5">
              <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800/40 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={paymentDialog.client.name} src={paymentDialog.client.photo} size="sm" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-zinc-100">{paymentDialog.client.name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">Restante: {formatCurrency(remaining)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-2">
                  Parcela: {formatCurrency(totalOfInst)} ({formatCurrency(principalPerInst)} + {formatCurrency(interestPI)} juros)
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">Tipo de Pagamento</Label>
                <div className="flex gap-2 mt-2">
                  {([
                    { key: "installment", label: "Parcela" },
                    { key: "partial", label: "Parcial" },
                    { key: "total", label: "Total" },
                    { key: "discount", label: "Desconto" },
                  ] as const).map((t) => (
                    <button key={t.key} onClick={() => {
                      setPaymentType(t.key)
                      if (t.key === "total") { setPayAmount(totalWithPenalty); setSelectedInstallmentIds([]) }
                      else if (t.key === "installment") {
                        const total = selectedInsts.reduce((s: number, i: any) => s + (i.amount - i.paidAmount), 0)
                        setPayAmount(total)
                      } else if (t.key === "partial") { setPayAmount(0); if (selectedInstallmentIds.length > 1) setSelectedInstallmentIds(selectedInstallmentIds.slice(0, 1)) }
                      else if (t.key === "discount") { setPayAmount(0); setPayDiscount(0); setSelectedInstallmentIds([]) }
                    }} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${paymentType === t.key ? "bg-emerald-600 border-emerald-600 text-white" : "border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-gray-400"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentType === "installment" && (
                <div>
                  <Label className="text-sm font-medium">Selecione a(s) Parcela(s)</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto mt-2">
                    {pendingInstallments.map((inst: any) => {
                      const isSelected = selectedInstallmentIds.includes(inst.id)
                      return (
                        <button key={inst.id} type="button" onClick={() => {
                          let newIds = isSelected ? selectedInstallmentIds.filter((id: string) => id !== inst.id) : [...selectedInstallmentIds, inst.id]
                          setSelectedInstallmentIds(newIds)
                          setPayAmount(paymentDialog.installments.filter((i: any) => newIds.includes(i.id)).reduce((s: number, i: any) => s + (i.amount - i.paidAmount), 0))
                        }} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${isSelected ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-gray-200 dark:border-zinc-700"}`}>
                          <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">Parcela {inst.number}/{paymentDialog.installmentCount}</span>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(inst.amount - inst.paidAmount)}</p>
                            <p className="text-[10px] text-gray-400">{formatDate(inst.dueDate)}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Valor (R$) *</Label>
                  <Input type="number" step="0.01" min={0} value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Data *</Label>
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="mt-1" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setPaymentDialog(null); resetPaymentForm() }}>Cancelar</Button>
                <Button onClick={handlePayment} disabled={!payAmount || payAmount <= 0 || paying} className="bg-emerald-600 hover:bg-emerald-700 text-white">{paying ? "Processando..." : "Registrar Pagamento"}</Button>
              </div>
            </div>
          )
        })()}
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
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{clientPhone || "Sem telefone"}</p>
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
              ) : !clientPhone ? (
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
                  const encoded = encodeURIComponent(text)
                  window.open(`https://wa.me/?text=${encoded}`, "_blank")
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
    </div>
  )
}

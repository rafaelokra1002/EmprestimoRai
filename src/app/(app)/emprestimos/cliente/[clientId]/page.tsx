"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar } from "@/components/avatar"
import { Dialog } from "@/components/ui/dialog"
import { LoanDetailsContent, type LoanDetailsTone } from "@/app/(app)/emprestimos/_components/loan-details-content"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Calendar, Check, CheckCircle2, ChevronDown, Clock, Copy, DollarSign, Download, Eye, FileText, Lock, Loader2, MessageCircle, Pencil, Percent, Receipt, RotateCcw, Send, Tag, Trash2, X, Plus, AlertTriangle } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { LoanRenegotiationContent } from "../../_components/loan-renegotiation-content"
import { InterestRenegotiateBody } from "../../_components/interest-renegotiate-body"
import { ComprovanteContent } from "../../_components/comprovante-content"
import { formatCurrency, formatDate, localDateStr, buildLoanReportMessage } from "@/lib/utils"
import { buildLoanData, calculateEffectivePaidAmountFromPayments, calculateRealizedProfitFromPayments, calculateTotalAmountWithLateFee, calculateOverdueInterest, getDaysOverdue, getNextDueDate as getNextDueDateFn, getOverdueDailyAmountBRL, getPaidExcludingInterest } from "@/lib/loan-logic"
import { showToast } from "@/lib/toast"

// Tooltip estilizado que aparece ao passar o mouse no botão (usar com "group relative" no botão)
const tooltipCls = "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max whitespace-nowrap -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-center text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
// Variante alinhada à esquerda (p/ botões na borda esquerda, evita corte pelo overflow do card)
const tooltipClsLeft = "pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-max whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-left text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
// Variante alinhada à direita (p/ botões na borda direita, evita corte pelo overflow do card)
const tooltipClsRight = "pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-max whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-right text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"

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
  dailyInterest: boolean
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

  // Edição inline da data de vencimento
  const [editingDateLoanId, setEditingDateLoanId] = useState<string | null>(null)
  const [dateDraft, setDateDraft] = useState("")
  const [savingDate, setSavingDate] = useState(false)

  // Aplicar / excluir multa de atraso
  const [multaDialog, setMultaDialog] = useState<Loan | null>(null)
  const [multaType, setMultaType] = useState<"fixedOnce" | "percent" | "fixedDay">("fixedOnce")
  const [multaValue, setMultaValue] = useState("")
  const [savingMulta, setSavingMulta] = useState(false)

  // Configurar juros por atraso → grava em dailyInterestAmount R$/dia
  const [jurosDialog, setJurosDialog] = useState<Loan | null>(null)
  const [jurosType, setJurosType] = useState<"percent" | "percent30" | "fixed">("percent")
  const [jurosPct, setJurosPct] = useState("")
  const [savingJuros, setSavingJuros] = useState(false)

  // Profile PIX key
  const [profilePixKey, setProfilePixKey] = useState("")
  const [profileChargeName, setProfileChargeName] = useState("")

  // WhatsApp state
  const [whatsappDialog, setWhatsappDialog] = useState(false)
  const [whatsappLoan, setWhatsappLoan] = useState<Loan | null>(null)
  const [whatsappMessage, setWhatsappMessage] = useState("")
  const [whatsappSending, setWhatsappSending] = useState(false)
  const [whatsappSent, setWhatsappSent] = useState(false)
  const [clientPhone, setClientPhone] = useState<string | null>(null)

  // Renegotiate dialog state
  const [renegotiateDialog, setRenegotiateDialog] = useState<Loan | null>(null)
  const [renegotiateEntry, setRenegotiateEntry] = useState<"all" | "interest">("all")
  const [renegotiateMode, setRenegotiateMode] = useState<"total" | "full" | "partial" | null>(null)
  const [renegotiateAmount, setRenegotiateAmount] = useState<number>(0)
  const [renegotiateDate, setRenegotiateDate] = useState("")
  const [renegotiateNewDueDate, setRenegotiateNewDueDate] = useState("")
  const [renegotiateNotes, setRenegotiateNotes] = useState("")
  const [renegotiateInstallmentId, setRenegotiateInstallmentId] = useState("")
  const [renegotiateLateFee, setRenegotiateLateFee] = useState<number>(0)
  const [renegotiatePayMethod, setRenegotiatePayMethod] = useState<"Dinheiro" | "Pix" | "Cartão">("Dinheiro")

  // Payment dialog state
  const [paymentDialog, setPaymentDialog] = useState<Loan | null>(null)
  const [paymentType, setPaymentType] = useState<"installment" | "partial" | "total" | "discount">("installment")
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<string[]>([])
  const [payAmount, setPayAmount] = useState<number>(0)
  const [payDate, setPayDate] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [payNewDueDate, setPayNewDueDate] = useState("")
  const [payDiscount, setPayDiscount] = useState<number>(0)
  const [payMethod, setPayMethod] = useState<"Dinheiro" | "Pix" | "Cartão">("Dinheiro")
  const [partialParcelaOpen, setPartialParcelaOpen] = useState(false)
  const [paying, setPaying] = useState(false)

  // Loan comprovante (preview) dialog state
  const [comprovanteLoanId, setComprovanteLoanId] = useState<string | null>(null)

  // Payment receipt dialog state
  const [paymentReceiptDialog, setPaymentReceiptDialog] = useState(false)
  const [detailsLoanId, setDetailsLoanId] = useState<string | null>(null)
  const [detailsTone, setDetailsTone] = useState<LoanDetailsTone>("default")
  const [paymentReceiptInfo, setPaymentReceiptInfo] = useState<{
    type: string
    clientName: string
    clientPhone: string | null
    installmentLabel: string
    amount: number
    principalAmount: number
    lateFeeAmount: number
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
      setProfileChargeName(data.chargeName || "")
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

  // Salva nova data de vencimento de uma parcela (edição inline no card)
  const saveInstallmentDate = async (loan: Loan, targetInstId: string) => {
    if (!dateDraft) return
    setSavingDate(true)
    try {
      const sorted = [...loan.installments].sort((a: any, b: any) => a.number - b.number)
      const installmentDates = sorted.map((i: any) => (i.id === targetInstId ? dateDraft : toDateStr(new Date(i.dueDate))))
      const res = await fetch(`/api/loans/${loan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installmentDates }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) throw new Error(data?.error || "Erro ao alterar data")
      showToast("Data de vencimento alterada!")
      setEditingDateLoanId(null)
      await fetchLoans()
    } catch (e: any) {
      showToast(e?.message || "Erro ao alterar data", "error")
    } finally {
      setSavingDate(false)
    }
  }

  const openMultaDialog = (loan: Loan) => {
    setMultaDialog(loan)
    setMultaType("fixedOnce")
    setMultaValue(loan.penaltyFee > 0 ? String(loan.penaltyFee) : "")
  }

  const overdueInstallmentsOf = (loan: Loan) => {
    const now = new Date()
    return loan.installments
      .filter((i: any) => i.status !== "PAID" && new Date(i.dueDate) < now)
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }

  // "Valor da parcela" usado no cálculo "% da parcela por dia" (parcelas iguais)
  const parcelaValueOf = (loan: Loan) => (loan.installmentCount > 0 ? loan.totalAmount / loan.installmentCount : loan.totalAmount)

  // Aplica a multa conforme o tipo: "único por parcela" grava em penaltyFee; os tipos "por dia"
  // gravam em dailyInterestAmount (campo já usado pelo cálculo em todas as telas).
  const saveMulta = async () => {
    if (!multaDialog) return
    const value = parseFloat(multaValue)
    if (!Number.isFinite(value) || value < 0) { showToast("Informe um valor válido", "error"); return }
    const body =
      multaType === "percent" ? { dailyInterest: true, dailyInterestAmount: Math.round(((value / 100) * parcelaValueOf(multaDialog)) * 100) / 100 }
      : multaType === "fixedDay" ? { dailyInterest: true, dailyInterestAmount: Math.round(value * 100) / 100 }
      : { penaltyFee: Math.round(value * 100) / 100 }
    setSavingMulta(true)
    try {
      const res = await fetch(`/api/loans/${multaDialog.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        showToast("Multa aplicada!")
        setMultaDialog(null)
        setMultaValue("")
        fetchLoans()
      } else {
        showToast("Erro ao aplicar multa", "error")
      }
    } catch {
      showToast("Erro ao aplicar multa", "error")
    } finally {
      setSavingMulta(false)
    }
  }

  // Remove a multa/juros de atraso aplicados (zera penaltyFee e o juros por dia configurado).
  const excluirMulta = async (loan: Loan) => {
    try {
      const res = await fetch(`/api/loans/${loan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ penaltyFee: 0, dailyInterest: false, dailyInterestAmount: 0 }),
      })
      if (res.ok) {
        showToast("Multa removida!")
        fetchLoans()
      } else {
        showToast("Erro ao remover multa", "error")
      }
    } catch {
      showToast("Erro ao remover multa", "error")
    }
  }

  const openJurosDialog = (loan: Loan) => {
    // Não pré-preenche: só guardamos o R$/dia final (não a % nem o tipo), então reconstruir
    // uma % geraria um número confuso. Abre limpo para o usuário informar o valor desejado.
    setJurosDialog(loan)
    setJurosType("percent")
    setJurosPct("")
  }

  // Converte o tipo escolhido em R$/dia e grava em dailyInterestAmount (campo já usado por
  // getOverdueDailyAmountBRL em todas as telas — não muda o cálculo central).
  const saveJuros = async () => {
    if (!jurosDialog) return
    const raw = parseFloat(jurosPct)
    if (!Number.isFinite(raw) || raw < 0) { showToast("Informe um valor válido", "error"); return }
    const dailyRs =
      jurosType === "fixed" ? raw
      : jurosType === "percent30" ? (raw / 100) * jurosDialog.totalAmount / 30
      : (raw / 100) * parcelaValueOf(jurosDialog)
    setSavingJuros(true)
    try {
      const res = await fetch(`/api/loans/${jurosDialog.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyInterest: true, dailyInterestAmount: Math.round(dailyRs * 100) / 100 }),
      })
      if (res.ok) {
        showToast("Juros por atraso salvos!")
        setJurosDialog(null)
        setJurosPct("")
        fetchLoans()
      } else {
        showToast("Erro ao salvar juros", "error")
      }
    } catch {
      showToast("Erro ao salvar juros", "error")
    } finally {
      setSavingJuros(false)
    }
  }

  const isSameMonthYear = (value: Date, reference: Date) => (
    value.getFullYear() === reference.getFullYear() && value.getMonth() === reference.getMonth()
  )
  const hasCurrentMonthPrincipalPayment = (loan: Loan) => {
    if (loan.installmentCount <= 1) return false

    const now = new Date()

    return loan.payments.some((payment: any) => {
      const notes = (payment.notes || "").toLowerCase()
      if (notes.includes("só juros") || notes.includes("parcial de juros")) return false

      const paymentDate = payment.date || payment.createdAt
      if (!paymentDate) return false

      return isSameMonthYear(new Date(paymentDate), now)
    })
  }

  const getOverdueInstallments = (loan: Loan) => {
    return loan.installments.filter((i: any) => {
      if (i.status === "PAID") return false
      return toDateStr(new Date(i.dueDate)) < todayStr
    })
  }

  const buildDefaultWhatsappMessage = (loan: Loan) => {
    const name = loan.client.name.split(" ")[0]
    const isParcelado = loan.installmentCount > 1
    const overdueInsts = getOverdueInstallments(loan)

    // Build loan data to compute daily late fee rate
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
    const dailyRate = getOverdueDailyAmountBRL(loanData)

    const nowTs = Date.now()
    const penaltyOnce = loan.penaltyFee || 0
    const numEmojis = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"]
    const pix = profilePixKey || "Não cadastrada"
    const titular = profileChargeName || "Titular"

    if (overdueInsts.length === 0) {
      const nextInst = getNextDueInst(loan)
      if (!nextInst) return `👤 Cliente: ${name}\n\n📋 Olá! Passando para lembrar do seu compromisso.\n\n💳 Chave PIX: ${pix}`

      if (isParcelado) {
        const daysLeft = Math.max(0, Math.ceil((new Date(nextInst.dueDate).getTime() - nowTs) / 86400000))
        const allInsts: any[] = [...loan.installments].sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        const statusLines = allInsts.map((i: any, idx: number) => {
          const isPaid = i.status === "PAID"
          const emoji = numEmojis[idx] || `${idx + 1}.`
          const dateStr = formatDate(i.dueDate)
          if (isPaid) return `${emoji} ✅ ${dateStr} - Paga`
          return `${emoji} ⏳ ${dateStr} - Em Aberto`
        })
        return `👤 Cliente: ${name}\n\n────────────────\n📋 LEMBRETE DE PAGAMENTO\n\n📌 Parcela: ${nextInst.number}/${loan.installmentCount}\n💵 Valor: ${formatCurrency(nextInst.amount)}\n📅 Vencimento: ${formatDate(nextInst.dueDate)}\n⏳ Faltam: ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}\n\n📊 STATUS DAS PARCELAS:\n${statusLines.join("\n")}\n\n────────────────\n👤 Titular: ${titular}\n\n💳 Chave PIX: ${pix}`
      }

      return `👤 Cliente: ${name}\n\n📋 Parcela\n📅 Vencimento: ${formatDate(nextInst.dueDate)}\n💰 Valor: ${formatCurrency(nextInst.amount)}\n\n💳 Chave PIX: ${pix}`
    }

    if (isParcelado) {
      let grandTotal = 0
      const parcelasAtrasoLines: string[] = []
      overdueInsts.forEach((inst: any) => {
        const days = Math.max(0, Math.floor((nowTs - new Date(inst.dueDate).getTime()) / 86400000))
        const base = Math.max(0, inst.amount - (inst.paidAmount || 0))
        const fee = Math.round((dailyRate * days + penaltyOnce) * 100) / 100
        grandTotal += base + fee
        parcelasAtrasoLines.push(
          `📌 Parcela ${inst.number}/${loan.installmentCount} • ${days} dia${days !== 1 ? "s" : ""}\n💰 ${formatCurrency(base)}${fee > 0 ? ` + ${formatCurrency(fee)} (multa)` : ""}`
        )
      })
      grandTotal = Math.round(grandTotal * 100) / 100

      const allInsts: any[] = [...loan.installments].sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      const statusLines = allInsts.map((i: any, idx: number) => {
        const days = Math.max(0, Math.floor((nowTs - new Date(i.dueDate).getTime()) / 86400000))
        const isPaid = i.status === "PAID"
        const isOverdue = !isPaid && new Date(i.dueDate).getTime() < nowTs
        const emoji = numEmojis[idx] || `${idx + 1}.`
        const dateStr = formatDate(i.dueDate)
        if (isPaid) return `${emoji} ✅ ${dateStr} — Pago`
        if (isOverdue) return `${emoji} ❌ ${dateStr} — Em atraso (${days}d)`
        return `${emoji} ⏳ ${dateStr} — Em aberto`
      })

      return `👤 Cliente: ${name}\n\n────────────────\n🚨 ${overdueInsts.length} PARCELA${overdueInsts.length > 1 ? "S" : ""} EM ATRASO\n\n${parcelasAtrasoLines.join("\n\n")}\n\n💵 TOTAL A PAGAR: ${formatCurrency(grandTotal)}\n────────────────\n\n📊 STATUS DAS PARCELAS\n${statusLines.join("\n")}\n\n────────────────\n👤 Titular: ${titular}\n\n💳 Chave PIX: ${pix}`
    }

    // Simples (não parcelado)
    const oldestOverdue = overdueInsts[0]
    const daysLate = Math.max(0, Math.floor((nowTs - new Date(oldestOverdue.dueDate).getTime()) / 86400000))
    const baseAmount = Math.max(0, oldestOverdue.amount - (oldestOverdue.paidAmount || 0))
    const lateFee = Math.round((dailyRate * daysLate + penaltyOnce) * 100) / 100
    const totalToPay = Math.round((baseAmount + lateFee) * 100) / 100
    const jurosRegularizacao = Math.round(loan.profit / loan.installmentCount * 100) / 100

    return `Cliente: ${name}\n\n────────────────\n🚨 PAGAMENTO EM ATRASO\n\n📅 Vencimento: ${formatDate(oldestOverdue.dueDate)}\n📆 Atraso: ${daysLate} dia${daysLate !== 1 ? "s" : ""}\n\n💰 Pagamento Total: ${formatCurrency(totalToPay)}\n🔄 Regularização (juros): ${formatCurrency(jurosRegularizacao)}\n\n⚠️ Atraso:\n${formatCurrency(dailyRate > 0 ? dailyRate : 15)} por dia até regularização.\n\n────────────────\n👤 Titular: ${titular}\n\n💠 Chave Pix: ${pix}`
  }

  const openWhatsappDialog = (loan: Loan) => {
    const freshLoan = loans.find(l => l.id === loan.id) || loan
    setWhatsappLoan(freshLoan)
    setWhatsappMessage(buildDefaultWhatsappMessage(freshLoan))
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
      dailyInterest: loan.dailyInterest,
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
    const isInstallmentLoan = loan.installmentCount > 1
    const hasOverdue = loan.installments.some((i: any) => i.status !== "PAID" && toDateStr(new Date(i.dueDate)) < todayStr)
    const paid = loan.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0)
    const contractInterest = loan.totalAmount - loan.amount
    const hasCoveredContractInterest = contractInterest > 0 && paid >= contractInterest && paid < loan.totalAmount
    const hasInterestPayment = loan.payments.some((payment: any) => {
      const notes = (payment.notes || "").toLowerCase()
      return notes.includes("só juros") || notes.includes("parcial de juros")
    })
    if (!hasOverdue && (hasInterestPayment || hasCoveredContractInterest)) {
      return { label: "Só Juros", color: "bg-purple-50 dark:bg-purple-950/20 text-purple-600" }
    }
    if (hasOverdue) return { label: "Atrasado", color: "bg-red-50 dark:bg-red-950/20 text-red-600" }
    if (isInstallmentLoan && hasCurrentMonthPrincipalPayment(loan)) {
      return { label: "Pago no Mês", color: "bg-purple-50 dark:bg-purple-950/20 text-purple-600" }
    }
    if (isInstallmentLoan) {
      return { label: "Em Dia", color: "bg-blue-50 dark:bg-blue-950/20 text-blue-600" }
    }
    return { label: "Pendente", color: "bg-orange-50 dark:bg-orange-950/20 text-orange-600" }
  }

  // Badge com fundo/borda visíveis (usado nos cards escuros, onde as cores pálidas de status.color ficam invisíveis).
  const vividBadgeColor = (label: string) => {
    switch (label) {
      case "Atrasado":
      case "Inadimplente":
        return "bg-destructive/10 text-destructive border border-destructive/20"
      case "Quitado":
        return "bg-primary/10 text-primary border border-primary/20"
      case "Só Juros":
      case "Pago no Mês":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20"
      case "Em Dia":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20"
      case "Pendente":
        return "bg-orange-500/10 text-orange-600 dark:text-orange-300 border border-orange-500/20"
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-300 border border-gray-500/20"
    }
  }

  const getPaidTotal = (loan: Loan) => calculateEffectivePaidAmountFromPayments(loan.payments, loan.installments)
  const getPaidTotalExcludingInterest = (loan: Loan) => loan.payments
    .filter((p: any) => {
      const notes = (p.notes || "").toLowerCase()
      return !notes.includes("só juros") && !notes.includes("parcial de juros")
    })
    .reduce((s: number, p: any) => s + p.amount, 0)
  const getReceivedProfit = (loan: Loan) => {
    const capitalIntact = loan.installments.every((i: any) => (i.paidAmount || 0) === 0)
    if (capitalIntact && loan.payments.length > 0) {
      return loan.payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
    }
    return calculateRealizedProfitFromPayments(loan.totalAmount, loan.profit, loan.payments, loan.installments, {
      principalAmount: loan.amount,
      interestType: loan.interestType,
    })
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
      dailyInterest: loan.dailyInterest,
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
  const getCurrentOverdueCharge = (loan: Loan) => {
    const loanData = buildLoanData({
      amount: loan.amount,
      interestRate: loan.interestRate,
      interestType: loan.interestType || "SIMPLE",
      totalAmount: loan.totalAmount,
      dailyInterest: loan.dailyInterest,
      dailyInterestAmount: loan.dailyInterestAmount || 0,
      dueDay: loan.dueDay || new Date(loan.installments[0]?.dueDate || Date.now()).getDate(),
      modality: loan.modality,
      firstInstallmentDate: loan.firstInstallmentDate || loan.installments[0]?.dueDate || new Date().toISOString(),
      installments: loan.installments,
      payments: loan.payments,
    })
    const daysOverdue = getDaysOverdue(loanData)
    if (daysOverdue <= 0) return 0

    const overdueInterest = daysOverdue >= 30
      ? calculateOverdueInterest(
          loan.totalAmount,
          loan.amount,
          loan.interestRate,
          daysOverdue,
          (loan.interestType || "SIMPLE") as "SIMPLE" | "COMPOUND"
        )
      : 0

    return overdueInterest + (getOverdueDailyAmountBRL(loanData) * daysOverdue)
  }
  const persistLoanTags = async (loanId: string, tags: string[]) => {
    setEditingTags(tags)
    try {
      await fetch(`/api/loans/${loanId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags }) })
      fetchLoans()
    } catch {}
  }
  const getCurrentOverdueDays = (loan: Loan) => getDaysOverdue(buildLoanData({
    amount: loan.amount,
    interestRate: loan.interestRate,
    interestType: loan.interestType || "SIMPLE",
    totalAmount: loan.totalAmount,
    dailyInterest: loan.dailyInterest,
    dailyInterestAmount: loan.dailyInterestAmount || 0,
    dueDay: loan.dueDay || new Date(loan.installments[0]?.dueDate || Date.now()).getDate(),
    modality: loan.modality,
    firstInstallmentDate: loan.firstInstallmentDate || loan.installments[0]?.dueDate || new Date().toISOString(),
    installments: loan.installments,
    payments: loan.payments,
  }))
  const getCurrentOverdueChargeDetails = (loan: Loan) => {
    const loanData = buildLoanData({
      amount: loan.amount,
      interestRate: loan.interestRate,
      interestType: loan.interestType || "SIMPLE",
      totalAmount: loan.totalAmount,
      dailyInterest: loan.dailyInterest,
      dailyInterestAmount: loan.dailyInterestAmount || 0,
      dueDay: loan.dueDay || new Date(loan.installments[0]?.dueDate || Date.now()).getDate(),
      modality: loan.modality,
      firstInstallmentDate: loan.firstInstallmentDate || loan.installments[0]?.dueDate || new Date().toISOString(),
      installments: loan.installments,
      payments: loan.payments,
    })
    const daysOverdue = getDaysOverdue(loanData)
    const dailyFee = daysOverdue > 0 ? getOverdueDailyAmountBRL(loanData) * daysOverdue : 0

    return { dailyFee }
  }
  const getInstallmentOverdueDetails = (loan: Loan, installment: Loan["installments"][number]) => {
    if (installment.status === "PAID") return { daysOver: 0, juros: 0, multa: 0 }
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const dueStart = new Date(installment.dueDate); dueStart.setHours(0, 0, 0, 0)
    const daysOver = Math.max(0, Math.floor((todayStart.getTime() - dueStart.getTime()) / 86400000))
    if (daysOver === 0) return { daysOver: 0, juros: 0, multa: 0 }
    const loanData = buildLoanData({
      amount: loan.amount,
      interestRate: loan.interestRate,
      interestType: loan.interestType || "SIMPLE",
      totalAmount: loan.totalAmount,
      dailyInterest: loan.dailyInterest,
      dailyInterestAmount: loan.dailyInterestAmount || 0,
      dueDay: loan.dueDay || new Date(loan.installments[0]?.dueDate || Date.now()).getDate(),
      modality: loan.modality,
      firstInstallmentDate: loan.firstInstallmentDate || loan.installments[0]?.dueDate || new Date().toISOString(),
      installments: loan.installments,
      payments: loan.payments,
    })
    return { daysOver, juros: getOverdueDailyAmountBRL(loanData) * daysOver, multa: loan.penaltyFee || 0 }
  }

  const getInstallmentOverdueCharge = (loan: Loan, installment: Loan["installments"][number]) => {
    const d = getInstallmentOverdueDetails(loan, installment)
    return d.juros + d.multa
  }

  const getInstallmentPayableAmount = (loan: Loan, installment: Loan["installments"][number]) => {
    const baseRemaining = Math.max(0, installment.amount - (installment.paidAmount || 0))
    return baseRemaining + getInstallmentOverdueCharge(loan, installment)
  }

  // Juros extras para empréstimos MENSAL (1 parcela) com múltiplos ciclos vencidos
  const getExtraCyclesInterest = (loan: Loan) => {
    if (loan.installmentCount !== 1) return 0
    const overdueInst = loan.installments.find((i: any) => i.status !== "PAID")
    if (!overdueInst) return 0
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const due = new Date(overdueInst.dueDate); due.setHours(0, 0, 0, 0)
    if (due >= now) return 0
    const daysOver = Math.floor((now.getTime() - due.getTime()) / 86400000)
    const extraCycles = Math.floor(daysOver / 30)
    return extraCycles * interestPerInst(loan)
  }

  const getPaymentBreakdown = (
    loan: Loan,
    amount: number,
    installmentId?: string,
    type: "installment" | "partial" | "total" | "discount" | "interest" = "installment"
  ) => {
    if (type === "interest") {
      return { principalAmount: 0, lateFeeAmount: 0 }
    }

    if (type === "total") {
      const totalLateFee = loan.installments
        .filter((installment) => installment.status !== "PAID")
        .reduce((sum, installment) => {
          const baseAmount = Math.max(0, installment.amount - (installment.paidAmount || 0))
          const payableAmount = getInstallmentPayableAmount(loan, installment)
          return sum + Math.max(0, payableAmount - baseAmount)
        }, 0)

      const lateFeeAmount = Math.min(amount, Math.round(totalLateFee * 100) / 100)
      return {
        principalAmount: Math.max(0, Math.round((amount - lateFeeAmount) * 100) / 100),
        lateFeeAmount,
      }
    }

    const installment = installmentId
      ? loan.installments.find((item) => item.id === installmentId)
      : loan.installments.find((item) => item.status !== "PAID")

    if (!installment) {
      return { principalAmount: amount, lateFeeAmount: 0 }
    }

    const baseAmount = Math.max(0, installment.amount - (installment.paidAmount || 0))
    const payableAmount = getInstallmentPayableAmount(loan, installment)
    const lateFeeTotal = Math.max(0, Math.round((payableAmount - baseAmount) * 100) / 100)
    const lateFeeAmount = Math.min(amount, lateFeeTotal)

    return {
      principalAmount: Math.max(0, Math.round((amount - lateFeeAmount) * 100) / 100),
      lateFeeAmount,
    }
  }
  const buildPaymentReceiptText = (receipt: NonNullable<typeof paymentReceiptInfo>) => {
    const breakdownLines = receipt.lateFeeAmount > 0
      ? `\n🧾 Valor da Parcela: ${formatCurrency(receipt.principalAmount)}\n⚠️ Multa/Juros: ${formatCurrency(receipt.lateFeeAmount)}`
      : ""

    return `📋 *Comprovante de Pagamento*\n\n📌 Tipo: ${receipt.type}\n👤 Cliente: ${receipt.clientName}\n📄 Parcela: ${receipt.installmentLabel}\n💰 Valor Pago: ${formatCurrency(receipt.amount)}${breakdownLines}\n📅 Data: ${receipt.date}\n💵 Saldo Restante: ${formatCurrency(receipt.remainingBalance)}${receipt.isCompleted ? "\n\n✅ *Contrato Quitado!*" : ""}`
  }
  const getNextDueInst = (loan: Loan) =>
    loan.installments
      .filter((i: any) => i.status !== "PAID")
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
  const interestPerInst = (loan: Loan) =>
    Math.round((loan.profit / loan.installmentCount) * 100) / 100

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const handleDelete = (id: string) => setDeleteConfirmId(id)
  const confirmDelete = async () => {
    if (!deleteConfirmId) return
    setDeleting(true)
    try {
      await fetch(`/api/loans/${deleteConfirmId}`, { method: "DELETE" })
      setDeleteConfirmId(null)
      fetchLoans()
    } finally {
      setDeleting(false)
    }
  }

  const today = () => localDateStr()

  const openRenegotiateDialog = (loan: Loan) => {
    setRenegotiateEntry("all")
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
      setRenegotiateNewDueDate(localDateStr(nextDue))
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
    const receiptDate = renegotiateDate || today()
    const allInsts = receiptLoan.installments
    const instIdx = allInsts.findIndex((i: any) => i.id === targetInstId)

    setPaying(true)
    try {
      // For partial mode, check if this payment completes the interest cycle
      let sendNewDueDate: string | undefined = undefined
      if (renegotiateMode === "full") {
        if (renegotiateNewDueDate) {
          sendNewDueDate = renegotiateNewDueDate
        } else {
          const targetInst = renegotiateDialog.installments.find((i: any) => i.id === targetInstId)
          if (targetInst) {
            const nextDue = new Date(targetInst.dueDate)
            if (renegotiateDialog.modality === "MONTHLY") {
              nextDue.setMonth(nextDue.getMonth() + 1)
            } else {
              nextDue.setDate(nextDue.getDate() + modalityDays(renegotiateDialog.modality))
            }
            sendNewDueDate = localDateStr(nextDue)
          }
        }
      } else if (renegotiateMode === "partial") {
        const partialPayments = renegotiateDialog.payments.filter((p: any) => {
          const notes = (p.notes || "").toLowerCase()
          return notes.includes("parcial de juros")
        })
        const totalPartialPaid = partialPayments.reduce((s: number, p: any) => s + p.amount, 0)
        const cicloJurosPago = intAmount > 0 ? totalPartialPaid % intAmount : 0
        const cicloJurosFaltante = intAmount > 0 ? intAmount - cicloJurosPago : intAmount
        if (amount >= cicloJurosFaltante) {
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
          date: renegotiateDate || new Date().toISOString(),
          newDueDate: sendNewDueDate,
          notes: (renegotiateNotes ? renegotiateNotes + " | " : "") + (renegotiateMode === "full" ? "Pagamento só juros" : "Pagamento parcial de juros") + (renegotiateMode === "full" ? ` [forma:${renegotiatePayMethod}]` : "") + (renegotiateMode === "full" && renegotiateLateFee > 0 ? ` [lateFee:${renegotiateLateFee.toFixed(2)}]` : ""),
        }),
      })
      setRenegotiateDialog(null)
      setRenegotiateMode(null)
      setRenegotiateAmount(0)
      setRenegotiateNotes("")
      setRenegotiateInstallmentId("")
      setRenegotiateLateFee(0)

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
          principalAmount: 0,
          lateFeeAmount: 0,
          date: new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00").toLocaleDateString("pt-BR"),
          isCompleted: false,
          remainingBalance: receiptLoan.totalAmount,
        })
        setPaymentReceiptDialog(true)
        showToast("Pagamento de juros registrado com sucesso!")
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
    setPartialParcelaOpen(false)
  }

  const openPaymentDialog = (loan: Loan) => {
    resetPaymentForm()
    setPaymentDialog(loan)
    setEditingTags(loan.tags || [])
    setShowTagForm(false)
    setTagInput("")
    setPayMethod("Dinheiro")
    const pendingInst = loan.installments.find((i: any) => i.status !== "PAID")
    if (pendingInst) {
      setSelectedInstallmentIds([pendingInst.id])
      setPayAmount(getInstallmentPayableAmount(loan, pendingInst))
    }
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    setPayNewDueDate(localDateStr(nextMonth))
  }

  const handlePayment = async () => {
    if (!paymentDialog) return
    if (paying) return alert("Pagamento já está sendo processado, aguarde...")
    const receiptLoan = paymentDialog
    const receiptAmount = payAmount
    const receiptDate = payDate || today()

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
          const breakdown = getPaymentBreakdown(receiptLoan, receiptAmount, undefined, "total")
          setPaymentReceiptInfo({
            type: "Empréstimo",
            clientName: receiptLoan.client.name,
            clientPhone: clientPhone,
            installmentLabel: `${paidCount + 1}/${allInsts.length}`,
            amount: receiptAmount,
            principalAmount: breakdown.principalAmount,
            lateFeeAmount: breakdown.lateFeeAmount,
            date: new Date(receiptDate.includes("T") ? receiptDate : receiptDate + "T12:00:00").toLocaleDateString("pt-BR"),
            isCompleted: true,
            remainingBalance: 0,
          })
          setPaymentReceiptDialog(true)
          showToast("Pagamento registrado com sucesso!")
        }
      } else {
        const body: any = {
          loanId: paymentDialog.id,
          amount: payAmount,
          date: payDate || new Date().toISOString(),
          notes: payNotes,
        }
        if (paymentType === "installment" && selectedInstallmentIds.length > 0) {
          const selectedInstallment = paymentDialog.installments.find((i: any) => i.id === selectedInstallmentIds[0])
          body.installmentId = selectedInstallmentIds[0]
          if (selectedInstallment) {
            const installmentIndex = paymentDialog.installments.findIndex((i: any) => i.id === selectedInstallment.id)
            const baseAmount = Math.max(0, selectedInstallment.amount - (selectedInstallment.paidAmount || 0))
            const payableAmount = getInstallmentPayableAmount(paymentDialog, selectedInstallment)
            const lateFeeForInstallment = Math.max(0, Math.round((payableAmount - baseAmount) * 100) / 100)
            const noteParts = [`Parcela ${installmentIndex + 1} de ${paymentDialog.installmentCount}`]

            if (lateFeeForInstallment > 0) {
              noteParts.push(`[lateFee:${lateFeeForInstallment.toFixed(2)}]`)
            }

            if (payNotes.trim()) {
              noteParts.push(payNotes.trim())
            }

            body.notes = noteParts.join(" ")
          }
        } else if (paymentType === "partial" && selectedInstallmentIds.length > 0) {
          body.installmentId = selectedInstallmentIds[0]
          const selectedInstallment = paymentDialog.installments.find((i: any) => i.id === selectedInstallmentIds[0])
          if (selectedInstallment) {
            const installmentIndex = paymentDialog.installments.findIndex((i: any) => i.id === selectedInstallment.id)
            const baseAmount = Math.max(0, selectedInstallment.amount - (selectedInstallment.paidAmount || 0))
            const payableAmount = getInstallmentPayableAmount(paymentDialog, selectedInstallment)
            const lateFeeForInstallment = Math.max(0, Math.round((payableAmount - baseAmount) * 100) / 100)
            const noteParts = [`Parcela ${installmentIndex + 1} de ${paymentDialog.installmentCount}`]

            if (lateFeeForInstallment > 0) {
              noteParts.push(`[lateFee:${lateFeeForInstallment.toFixed(2)}]`)
            }

            if (payNotes.trim()) {
              noteParts.push(payNotes.trim())
            }

            body.notes = noteParts.join(" ")
          }
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
          const breakdown = getPaymentBreakdown(
            receiptLoan,
            receiptAmount,
            receiptInstId,
            paymentType === "discount" ? "discount" : paymentType
          )
          setPaymentReceiptInfo({
            type: "Empréstimo",
            clientName: receiptLoan.client.name,
            clientPhone: clientPhone,
            installmentLabel: `${instIdx + 1}/${allInsts.length}`,
            amount: receiptAmount,
            principalAmount: breakdown.principalAmount,
            lateFeeAmount: breakdown.lateFeeAmount,
            date: new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00").toLocaleDateString("pt-BR"),
            isCompleted: willBeCompleted,
            remainingBalance: Math.max(0, receiptLoan.totalAmount - alreadyPaid - receiptAmount),
          })
          setPaymentReceiptDialog(true)
          showToast("Pagamento registrado com sucesso!")
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
    <div className="space-y-6 pt-6">
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
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loans.map((loan) => {
            const status = getLoanStatusInfo(loan)
            const paid = getPaidTotal(loan)
            const remaining = getRemaining(loan)
            const currentTotalReceivable = remaining
            const receivedProfit = getReceivedProfit(loan)
            const profitPct = loan.profit > 0 ? Math.round((receivedProfit / loan.profit) * 100) : 0
            // Multa de atraso acumulada (juros diários + penalidade) das parcelas vencidas.
            const multaAtraso = loan.installments
              .filter((i: any) => i.status !== "PAID" && new Date(i.dueDate) < new Date())
              .reduce((s: number, i: any) => s + getInstallmentOverdueCharge(loan, i), 0)
            const lucroPrevistoTotal = loan.profit + multaAtraso
            const nextInst = getNextDueInst(loan)
            const intPerInst = interestPerInst(loan)

            const isAtrasado = status.label === "Atrasado" || status.label === "Inadimplente"
            const isSoJuros = status.label === "Só Juros"
            const isPagoNoMes = status.label === "Pago no Mês"
            const isQuitado = status.label === "Quitado"
            const isDueToday = nextInst
              ? (() => {
                  const dueDate = new Date(nextInst.dueDate)
                  const today = new Date()
                  return dueDate.getDate() === today.getDate() && dueDate.getMonth() === today.getMonth() && dueDate.getFullYear() === today.getFullYear()
                })()
              : false
            const isDueTodayHighlight = Boolean(isDueToday)
            const isParcelado = loan.installmentCount > 1
            const isParceladoCardBlue = isParcelado && !isAtrasado && !isQuitado && !isSoJuros && !isPagoNoMes
            const isSpecialModality = loan.interestType === "CUSTOM" || isParcelado
            const isCustomInterest = loan.interestType === "CUSTOM" || isParceladoCardBlue

            const isRenegotiada = (loan.tags || []).some((t: string) => t.split("|")[0] === "Renegociacao")
            const isDarkCard = isRenegotiada || isAtrasado || isSoJuros || isPagoNoMes || isDueToday || isDueTodayHighlight || isQuitado || isCustomInterest
            const cardBorder = isRenegotiada ? "border-pink-500/20 border-l-4 border-l-[#EC4899] shadow-lg shadow-pink-950/40" : isAtrasado ? "border-red-500/20 border-l-4 border-l-[#E5484D] shadow-lg shadow-red-950/40" : isDueTodayHighlight ? "border-amber-500/20 border-l-4 border-l-[#F59E0B] shadow-lg shadow-amber-950/40" : (isSoJuros || isPagoNoMes) ? "border-purple-500/20 border-l-4 border-l-[#a855f7] shadow-lg shadow-purple-950/40" : isQuitado ? "border-primary" : isCustomInterest ? "border-cyan-500/20 border-l-4 border-l-[#22D3EE] shadow-lg shadow-cyan-950/40" : "border-gray-200 dark:border-zinc-700"
            const cardBg = isRenegotiada ? "bg-[radial-gradient(circle_at_top_left,rgba(255,120,190,0.22),transparent_55%),linear-gradient(135deg,#3A0F24_0%,#8E2F58_55%,#3A0F24_100%)]" : isAtrasado ? "bg-[radial-gradient(circle_at_top_left,rgba(255,92,92,0.18),transparent_55%),linear-gradient(135deg,#1F0608_0%,rgba(122,31,14,0.85)_55%,#1F0608_100%)]" : isDueTodayHighlight ? "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.20),transparent_55%),linear-gradient(135deg,#332812_0%,#8A6E2A_55%,#332812_100%)]" : (isSoJuros || isPagoNoMes) ? "bg-[radial-gradient(circle_at_top_left,rgba(190,123,255,0.28),transparent_55%),linear-gradient(135deg,#2C1544_0%,#6B399E_55%,#2C1544_100%)]" : isQuitado ? "bg-primary" : isCustomInterest ? "bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_55%),linear-gradient(135deg,#06141A_0%,rgba(14,85,102,0.85)_55%,#06141A_100%)]" : "bg-white dark:bg-zinc-900"
            const remainingColor = isQuitado ? "text-white" : "text-[#16a34a] dark:text-green-400"
            const profitValueColor = isQuitado ? "text-white" : "text-primary"
            const fText = isDarkCard ? "text-white" : "text-gray-900 dark:text-zinc-100"
            const fMuted = isDarkCard ? "text-white/70" : "text-gray-400 dark:text-zinc-500"
            const detailTone: LoanDetailsTone = isRenegotiada ? "renegotiated" : isAtrasado ? "overdue" : isDueTodayHighlight ? "dueToday" : (isSoJuros || isPagoNoMes) ? "interest" : (isQuitado || isParceladoCardBlue) ? "settled" : "default"

            return (
              <div key={loan.id} className={`rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${cardBorder} ${cardBg}`}>
                {/* Header - nome centralizado */}
                <div className={`px-4 pt-4 pb-2 text-center border-b ${isDarkCard ? "border-white/10" : "border-gray-100 dark:border-zinc-800"}`}>
                  <h3 className={`font-semibold text-base ${isDarkCard ? "text-white" : "text-gray-900 dark:text-zinc-100"}`}>{clientName}</h3>
                </div>

                {/* Avatar + badges + ações */}
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={clientName} src={clientPhoto} size="sm" />
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isQuitado ? "bg-white/20 text-white" : vividBadgeColor(status.label)}`}>
                      {status.label}
                    </span>
                    {loan.modality === "INTEREST_ONLY" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">
                        J. Compostos
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isQuitado ? "bg-white/20 text-white" : isSpecialModality ? "bg-purple-500/20 text-purple-700 dark:text-purple-300" : "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary"}`}>
                      {loan.interestType === "CUSTOM" ? "PERSONALIZADO" : isParcelado ? "PARCELADO" : (MODALITY_LABELS[loan.modality] || loan.modality)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingTags(loan.tags || []); setTagInput(""); setShowTagForm(false); setTagDialog(loan) }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-primary dark:text-primary border border-primary/30 dark:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
                    >
                      <Tag className="h-3 w-3" /> Etiqueta
                    </button>
                    <button
                      onClick={() => { setDetailsTone(detailTone); setDetailsLoanId(loan.id) }}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${isDarkCard ? "text-green-300 bg-green-500/15 border border-[#22c55e]/30 hover:bg-green-500/25" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"}`}
                    >
                      <Eye className="h-3 w-3" /> Detalhes
                    </button>
                    <button
                      onClick={() => setComprovanteLoanId(loan.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${isDarkCard ? "text-green-300 bg-green-500/15 border border-[#22c55e]/30 hover:bg-green-500/25" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"}`}
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

                {/* Valor Restante (sem caixa, igual card único) */}
                <div className="px-4 pb-3 text-center">
                  <p className={`text-2xl sm:text-3xl font-bold tabular-nums leading-none tracking-tight ${remainingColor}`}>{formatCurrency(remaining)}</p>
                  <p className={`mt-1 text-[11px] ${isDarkCard ? "text-white/60" : "text-gray-500 dark:text-zinc-400"}`}>restante a receber</p>
                </div>

                {/* Emprestado / Total a Receber (caixa neutra) */}
                <div className={`mx-4 grid grid-cols-2 gap-3 p-3 rounded-lg ${isDarkCard ? "bg-white/5" : "bg-muted/30"}`}>
                  <div>
                    <p className={`text-[11px] ${isDarkCard ? "text-white/60" : "text-muted-foreground"}`}>Emprestado</p>
                    <p className={`text-sm font-bold tabular-nums truncate ${isDarkCard ? "text-white" : "text-foreground"}`}>{formatCurrency(loan.amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[11px] ${isDarkCard ? "text-white/60" : "text-muted-foreground"}`}>Total a Receber</p>
                    <p className={`text-sm font-bold tabular-nums truncate ${isDarkCard ? "text-white" : "text-foreground"}`}>{formatCurrency(currentTotalReceivable)}</p>
                  </div>
                </div>

                {/* Lucro Previsto / Realizado (caixa própria) */}
                <div className={`mx-4 mt-2 p-2 rounded-lg ${isDarkCard ? "bg-white/5 border border-white/10" : "bg-primary/5 border border-primary/20"}`}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className={`text-[11px] flex items-center gap-1 ${isDarkCard ? "text-white/60" : "text-muted-foreground"}`}><Lock className="h-3 w-3" /> Lucro Previsto</p>
                      <p className={`text-sm font-bold tabular-nums ${profitValueColor}`}>{formatCurrency(lucroPrevistoTotal)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[11px] flex items-center gap-1 justify-end ${isDarkCard ? "text-white/60" : "text-muted-foreground"}`}><Check className="h-3 w-3" /> Lucro Realizado</p>
                      <p className={`text-sm font-bold tabular-nums ${profitValueColor}`}>{formatCurrency(receivedProfit)} <span className={`text-xs ${isDarkCard ? "text-white/50" : "text-muted-foreground"}`}>{profitPct}%</span></p>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                      <DollarSign className="h-2.5 w-2.5" /> Juros: {formatCurrency(loan.profit)}
                    </span>
                    {multaAtraso > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-yellow-50 dark:bg-yellow-950/30 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-500">
                        <AlertTriangle className="h-2.5 w-2.5" /> Multas: {formatCurrency(multaAtraso)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info row — vencimento e pago (sempre visível) */}
                <div className={`mx-4 mt-3 flex items-center justify-between text-sm ${isDarkCard ? "text-white/70" : "text-gray-500 dark:text-zinc-400"}`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {editingDateLoanId === loan.id && nextInst ? (
                      <>
                        <input
                          type="date"
                          value={dateDraft}
                          onChange={(e) => setDateDraft(e.target.value)}
                          className="rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-0.5 text-xs text-gray-700 dark:text-zinc-200"
                        />
                        <button onClick={() => saveInstallmentDate(loan, nextInst.id)} disabled={savingDate} className="text-primary hover:opacity-80 disabled:opacity-50" title="Salvar">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingDateLoanId(null)} className="text-gray-400 hover:opacity-80" title="Cancelar">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        {nextInst ? (
                          <button
                            type="button"
                            onClick={() => { setEditingDateLoanId(loan.id); setDateDraft(toDateStr(new Date(nextInst.dueDate))) }}
                            className="transition-colors hover:text-primary hover:underline"
                          >
                            Venc: {formatDate(nextInst.dueDate)}
                          </button>
                        ) : (
                          <span>Venc: —</span>
                        )}
                        {(loan.installmentCount > 1 || loan.interestType === "CUSTOM") && nextInst && (
                          <>
                            <span className="text-gray-300 dark:text-zinc-600">•</span>
                            <span>Parcela {nextInst.number}/{loan.installmentCount}</span>
                          </>
                        )}
                        {nextInst && (
                          <button
                            onClick={() => { setEditingDateLoanId(loan.id); setDateDraft(toDateStr(new Date(nextInst.dueDate))) }}
                            className="text-gray-400 hover:text-primary transition-colors"
                            title="Alterar data de vencimento"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-medium ${isQuitado ? "bg-white/20 text-white" : "bg-primary/10 dark:bg-primary/20 text-primary"}`}>
                      <DollarSign className="h-3.5 w-3.5" /> Pago: {formatCurrency(paid)}
                    </span>
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
                  const overdueMonths = Math.floor(getCurrentOverdueDays(loan) / 30)
                  const jurosMultiplier = overdueMonths >= 1 ? overdueMonths : 0
                  return (
                    <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-purple-500/15 border border-purple-400/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${isDarkCard ? "text-purple-200" : "text-purple-700 dark:text-purple-200"}`}>Só Juros (por parcela):</span>
                        <span className={`text-sm font-bold tabular-nums ${isDarkCard ? "text-purple-100" : "text-purple-800 dark:text-purple-100"}`}>
                          {jurosMultiplier >= 1 && loan.installmentCount === 1 && (
                            <span className="mr-1 relative -top-0.5 text-[9px] font-medium text-orange-500 dark:text-orange-400">{jurosMultiplier + 1}x</span>
                          )}
                          {formatCurrency(intPerInst)}
                        </span>
                      </div>
                      {hasPartialInterest && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className={`text-xs flex items-center gap-1 ${isDarkCard ? "text-yellow-200" : "text-yellow-700 dark:text-yellow-300"}`}>💳 Juros já pago:</span>
                            <span className={`text-sm font-bold tabular-nums ${isDarkCard ? "text-yellow-200" : "text-yellow-700 dark:text-yellow-300"}`}>{formatCurrency(jurosPago)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-xs ${isDarkCard ? "text-red-200" : "text-red-600 dark:text-red-300"}`}>Juros pendente:</span>
                            <span className={`text-sm font-bold tabular-nums ${isDarkCard ? "text-red-200" : "text-red-600 dark:text-red-300"}`}>{formatCurrency(jurosPendente)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })()}

                {/* Vence Hoje — lembrete + cobrar (abaixo do Só Juros) */}
                {isDueToday && nextInst && (
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
                    <Button
                      size="sm"
                      onClick={() => openWhatsappDialog(loan)}
                      className="w-full mt-3 h-9 text-sm bg-orange-500 hover:bg-orange-600 text-white transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Cobrar hoje
                    </Button>
                  </div>
                )}

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

                  if (daysOverdue <= 0) return null

                  const overdueInsts = loan.installments
                    .filter((i: any) => i.status !== "PAID" && new Date(i.dueDate) < new Date())
                    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                  const visibleOverdueInsts = loan.installmentCount > 1
                    ? overdueInsts.slice(0, 1)
                    : overdueInsts
                  return (
                    <div className="mx-4 mt-3 p-3 rounded-lg bg-red-50 border-2 border-red-300 dark:bg-red-500/20 dark:border-red-400/30 space-y-2">
                      {visibleOverdueInsts.map((inst: any, idx: number) => {
                        const todayStartInst = new Date(); todayStartInst.setHours(0, 0, 0, 0)
                        const dueStartInst = new Date(inst.dueDate); dueStartInst.setHours(0, 0, 0, 0)
                        const instDays = Math.max(0, Math.floor((todayStartInst.getTime() - dueStartInst.getTime()) / (1000 * 60 * 60 * 24)))
                        const baseAmount = Math.max(0, inst.amount - (inst.paidAmount || 0))
                        const instOverdueCharge = getInstallmentOverdueCharge(loan, inst)
                        const extraCycles = getExtraCyclesInterest(loan)
                        const payableAmount = baseAmount + instOverdueCharge + extraCycles
                        return (
                          <div key={inst.id} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                                Parcela {inst.number}/{loan.installmentCount} em atraso
                              </span>
                              <span className="text-sm font-bold text-red-800 dark:text-red-200">{instDays} dias</span>
                            </div>
                            <div className="flex items-center justify-between text-sm mt-1 text-red-600 dark:text-red-300/70">
                              <span>Vencimento: {formatDate(inst.dueDate)}</span>
                              <span className="font-medium">Valor: {formatCurrency(baseAmount)}</span>
                            </div>
                            {instOverdueCharge > 0 && (
                              <div className="flex items-center justify-between text-sm mt-1">
                                <span className="flex items-center gap-1.5 text-red-600 dark:text-red-300">
                                  Multa Aplicada:
                                  {(loan.penaltyFee > 0 || (loan.dailyInterest && (loan.dailyInterestAmount || 0) > 0)) && (
                                    <button
                                      type="button"
                                      onClick={() => excluirMulta(loan)}
                                      title="Excluir multa"
                                      className="inline-flex items-center gap-1 rounded-md border border-green-600/40 px-1.5 py-0.5 text-[10px] font-medium text-green-800 dark:text-green-400 hover:bg-green-500/10 transition-colors"
                                    >
                                      <Trash2 className="h-2.5 w-2.5" /> Excluir
                                    </button>
                                  )}
                                </span>
                                <span className="text-red-600 dark:text-red-300 font-bold">+{formatCurrency(instOverdueCharge)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-sm mt-2 border-t border-red-300 dark:border-red-400/30 pt-2">
                              <span className="text-red-600 dark:text-red-300/80">Total com Atraso:</span>
                              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(payableAmount)}</span>
                            </div>
                            {idx < visibleOverdueInsts.length - 1 && (
                              <div className="border-b border-red-200 dark:border-red-800/40 pt-1" />
                            )}
                          </div>
                        )
                      })}
                      {/* Configurar juros por atraso / aplicar multa */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => openJurosDialog(loan)}
                          className="inline-flex flex-1 min-w-0 basis-[45%] items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition-colors border-blue-500/50 text-blue-700 bg-white hover:bg-blue-500/10 dark:border-blue-400/50 dark:text-blue-300 dark:bg-[#121614] dark:hover:bg-blue-500/20"
                        >
                          <Percent className="h-3.5 w-3.5" /> Juros por Atraso
                        </button>
                        <button
                          type="button"
                          onClick={() => openMultaDialog(loan)}
                          className="inline-flex flex-1 min-w-0 basis-[45%] items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition-colors border-orange-500/50 text-orange-700 bg-white hover:bg-orange-500/10 dark:border-orange-400/50 dark:text-orange-300 dark:bg-[#121614] dark:hover:bg-orange-500/20"
                        >
                          <DollarSign className="h-3.5 w-3.5" /> Aplicar Multa
                        </button>
                      </div>
                      <p className="text-[10px] text-red-600 dark:text-red-300/60 mt-2">Pague a parcela em atraso para regularizar o empréstimo</p>
                      <Button
                        size="sm"
                        onClick={() => openWhatsappDialog(loan)}
                        className="w-full h-10 mt-3 text-sm bg-red-600 hover:bg-red-700 text-white transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Cobrar atraso
                      </Button>
                    </div>
                  )
                })()}

                {/* Cobrar antecipado — cards sem atraso e que não vencem hoje */}
                {!isAtrasado && !isDueToday && !isQuitado && (
                  <div className="mx-4 mt-3">
                    <Button
                      size="sm"
                      onClick={() => openWhatsappDialog(loan)}
                      className="w-full h-10 text-sm bg-primary hover:bg-primary/90 text-white transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Cobrar antecipado
                    </Button>
                  </div>
                )}

                {/* Ações */}
                <div className={`px-4 pt-3 pb-4 mt-2 border-t space-y-3 ${isDarkCard ? "border-white/30" : "border-gray-100 dark:border-zinc-800"}`}>
                  <div className="grid w-full min-w-0 gap-1.5 pb-1 grid-cols-[minmax(0,1.6fr)_minmax(0,2.4fr)_repeat(5,minmax(0,1fr))]">
                    <button onClick={() => openPaymentDialog(loan)} className={`group relative inline-flex min-w-0 h-10 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors ${isDarkCard ? "border border-black/5 bg-white text-[#15803d] hover:bg-gray-100 dark:border-primary/20 dark:bg-primary/15 dark:text-primary dark:hover:bg-primary/20" : "border border-primary/15 bg-primary/10 text-primary hover:bg-primary/15 dark:border-primary/20 dark:bg-primary/15 dark:text-primary dark:hover:bg-primary/20"}`}>
                      <Receipt className="mr-1 h-4 w-4 shrink-0" /> <span className="whitespace-nowrap">Pagar</span>
                      <span className={tooltipClsLeft}>Registre pagamentos: parcela, valor parcial ou quitação total</span>
                    </button>
                    <button onClick={() => openInterestRenegotiateDialog(loan)} className={`group relative inline-flex min-w-0 h-10 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors ${isDarkCard ? "border border-black/5 bg-white text-[#15803d] hover:bg-gray-100 dark:border-primary/20 dark:bg-primary/15 dark:text-primary dark:hover:bg-primary/20" : "border border-primary/15 bg-primary/10 text-primary hover:bg-primary/15 dark:border-primary/20 dark:bg-primary/15 dark:text-primary dark:hover:bg-primary/20"}`}>
                      <DollarSign className="mr-1 h-4 w-4 shrink-0" /> <span className="whitespace-nowrap">Pagar Juros</span>
                      <span className={tooltipClsLeft}>Pague apenas os juros e renove o prazo (+30 dias)</span>
                    </button>
                    <button
                      onClick={() => {
                        const phone = (clientPhone || "").replace(/\D/g, "")
                        if (!phone) { showToast("Cliente sem telefone cadastrado", "error"); return }
                        const text = buildLoanReportMessage(loan, clientName, remaining)
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")
                      }}
                      className={`group relative flex min-w-0 w-full items-center justify-center rounded-xl h-10 transition-colors ${isDarkCard ? "bg-white text-[#16a34a] hover:bg-gray-100 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900/70" : "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-900/40"}`}
                    >
                      <Send className="h-4 w-4" />
                      <span className={tooltipCls}>Enviar relatório ao cliente pelo WhatsApp</span>
                    </button>
                    <button className={`group relative flex min-w-0 w-full items-center justify-center rounded-xl h-10 transition-colors ${isDarkCard ? "bg-white text-violet-600 hover:bg-gray-100 dark:bg-violet-900/50 dark:text-violet-300 dark:hover:bg-violet-900/70" : "border border-violet-100 bg-violet-50/80 text-primary shadow-sm hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-primary dark:hover:bg-violet-900/40"}`} onClick={() => router.push(`/emprestimos/${loan.id}`)}>
                      <RotateCcw className="h-4 w-4" />
                      <span className={tooltipCls}>Ver histórico de pagamentos</span>
                    </button>
                    <button className={`group relative flex min-w-0 w-full items-center justify-center rounded-xl h-10 transition-colors ${isDarkCard ? "bg-white text-blue-600 hover:bg-gray-100 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/70" : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/40"}`} onClick={() => router.push(`/emprestimos/${loan.id}/editar`)}>
                      <Pencil className="h-4 w-4" />
                      <span className={tooltipCls}>Editar empréstimo</span>
                    </button>
                    <button className={`group relative flex min-w-0 w-full items-center justify-center rounded-xl h-10 transition-colors ${isDarkCard ? "bg-white text-amber-500 hover:bg-gray-100 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70" : "bg-amber-50 text-amber-500 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-900/40"}`} onClick={() => openRenegotiateDialog(loan)}>
                      <RotateCcw className="h-4 w-4" />
                      <span className={tooltipClsRight}>Renegociar empréstimo / atraso</span>
                    </button>
                    <button className={`group relative flex min-w-0 w-full items-center justify-center rounded-xl h-10 transition-colors ${isDarkCard ? "bg-red-500 text-white hover:bg-red-600" : "bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40"}`} onClick={() => handleDelete(loan.id)}>
                      <Trash2 className="h-4 w-4" />
                      <span className={tooltipClsRight}>Excluir empréstimo</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== APLICAR MULTA DIALOG ===== */}
      <Dialog open={!!multaDialog} onClose={() => { setMultaDialog(null); setMultaValue("") }} className="w-full rounded-2xl">
        {multaDialog && (() => {
          const overdue = overdueInstallmentsOf(multaDialog)
          const val = parseFloat(multaValue) || 0
          const total = val * overdue.length
          const dailyRs = multaType === "percent" ? (val / 100) * parcelaValueOf(multaDialog) : val
          const now = new Date()
          const valueLabel = multaType === "percent" ? "Porcentagem por dia (%)" : multaType === "fixedDay" ? "Valor por dia (R$)" : "Valor da multa por parcela (R$)"
          return (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Aplicar Multa</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">Escolha o tipo de cálculo da multa e aplique às parcelas em atraso.</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setMultaDialog(null); setMultaValue("") }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-400 bg-red-500 text-white transition-colors hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de cálculo</Label>
                <div className="relative">
                  <select
                    value={multaType}
                    onChange={(e) => setMultaType(e.target.value as "fixedOnce" | "percent" | "fixedDay")}
                    className="h-11 w-full appearance-none rounded-lg border border-green-500 bg-gray-50 dark:bg-zinc-800 px-3 pr-9 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                  >
                    <option value="percent">% do valor da parcela por dia</option>
                    <option value="fixedDay">Valor fixo (R$) por dia</option>
                    <option value="fixedOnce">Valor fixo único por parcela</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-400" />
                </div>
              </div>
              {multaType !== "fixedOnce" && (
                <div className="space-y-1.5">
                  <Label>{valueLabel}</Label>
                  <Input type="number" min={0} step={multaType === "percent" ? "0.1" : "1"} value={multaValue} onChange={(e) => setMultaValue(e.target.value)} placeholder={multaType === "percent" ? "Ex: 1.5" : "Ex: 40"} className="h-11 rounded-lg" />
                </div>
              )}
              {multaType === "fixedOnce" ? (
                <>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">Parcelas em atraso ({overdue.length})</p>
                    {overdue.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-zinc-500">Nenhuma parcela em atraso.</p>
                    ) : overdue.map((i: any) => {
                      const dias = Math.max(0, Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000))
                      return (
                        <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2 text-gray-700 dark:text-zinc-200">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                            <span className="shrink-0 font-medium">Parcela {i.number}</span>
                            <span className="truncate text-gray-400 dark:text-zinc-500">Venc: {formatDate(i.dueDate)} • {dias} dias atraso</span>
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={multaValue}
                              onChange={(e) => setMultaValue(e.target.value)}
                              onFocus={(e) => e.currentTarget.select()}
                              placeholder="0"
                              className="w-24 rounded-md border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                            <span className="w-16 text-right font-semibold text-red-500 dark:text-red-400">+{formatCurrency(val)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400">Total de multas: {formatCurrency(total)}</div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">Selecione as parcelas e revise o cálculo</p>
                  {overdue.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-zinc-500">Nenhuma parcela em atraso.</p>
                  ) : overdue.map((i: any) => {
                    const dias = Math.max(0, Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000))
                    const charge = dailyRs * dias
                    return (
                      <div key={i.id} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 text-xs">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                        <span className="shrink-0 font-medium text-gray-700 dark:text-zinc-200">Parcela {i.number}:</span>
                        <span className="truncate text-gray-500 dark:text-zinc-400">{formatCurrency(dailyRs)} × {dias} dias</span>
                        <span className="ml-auto shrink-0 font-semibold text-red-500 dark:text-red-400">= {formatCurrency(charge)}</span>
                      </div>
                    )
                  })}
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400">
                    Total de multas: {formatCurrency(overdue.reduce((s: number, i: any) => s + dailyRs * Math.max(0, Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000)), 0))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setMultaDialog(null); setMultaValue("") }}
                  className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveMulta}
                  disabled={savingMulta || !multaValue}
                  className="rounded-lg bg-green-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-60"
                >
                  {savingMulta ? "Salvando..." : "Aplicar Multa"}
                </button>
              </div>
            </div>
          )
        })()}
      </Dialog>

      {/* ===== CONFIGURAR JUROS POR ATRASO DIALOG ===== */}
      <Dialog open={!!jurosDialog} onClose={() => { setJurosDialog(null); setJurosPct("") }} className="w-full rounded-2xl">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Configurar Juros por Atraso</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">Configure o cálculo automático de juros por dia de atraso.</p>
            </div>
            <button
              type="button"
              onClick={() => { setJurosDialog(null); setJurosPct("") }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-400 bg-red-500 text-white transition-colors hover:bg-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de cálculo</Label>
            <div className="relative">
              <select
                value={jurosType}
                onChange={(e) => setJurosType(e.target.value as "percent" | "percent30" | "fixed")}
                className="h-11 w-full appearance-none rounded-lg border border-green-500 bg-gray-50 dark:bg-zinc-800 px-3 pr-9 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500/40"
              >
                <option value="percent">% da parcela por dia</option>
                <option value="percent30">% do valor total / 30 dias</option>
                <option value="fixed">Valor fixo (R$ por dia)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-400" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{jurosType === "fixed" ? "Valor por dia de atraso (R$)" : "Porcentagem por dia de atraso (%)"}</Label>
            <Input type="number" min={0} step={jurosType === "fixed" ? "1" : "0.1"} value={jurosPct} onChange={(e) => setJurosPct(e.target.value)} placeholder={jurosType === "fixed" ? "Ex: 10" : "Ex: 1.5"} className="h-11 rounded-lg" />
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              {jurosType === "fixed"
                ? "Os juros serão calculados: R$ por dia × dias em atraso"
                : jurosType === "percent30"
                  ? "Os juros serão calculados: (% × valor total ÷ 30) × dias em atraso"
                  : "Os juros serão calculados: % × valor da parcela × dias em atraso"}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setJurosDialog(null); setJurosPct("") }}
              className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveJuros}
              disabled={savingJuros || !jurosPct}
              className="rounded-lg bg-green-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-60"
            >
              {savingJuros ? "Salvando..." : "Salvar Juros"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={!!tagDialog} onClose={() => setTagDialog(null)} title="Gerenciar Etiquetas" className="w-full max-w-sm">
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
            <button onClick={() => setShowTagForm(true)} className="w-full py-2 text-sm text-primary dark:text-primary border border-dashed border-emerald-300 dark:border-emerald-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors">
              + Nova Etiqueta
            </button>
          )}
          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
            <Button variant="outline" className="flex-1" onClick={() => setTagDialog(null)}>Cancelar</Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90 text-white" onClick={handleSaveTags}>Salvar</Button>
          </div>
        </div>
      </Dialog>

      {/* ===== RENEGOCIAR CONTRATO DIALOG ===== */}
      <Dialog
        open={!!renegotiateDialog}
        onClose={() => { setRenegotiateDialog(null); setRenegotiateMode(null); setRenegotiateEntry("all"); setRenegotiateAmount(0); setRenegotiateNotes("") }}
        className="w-full max-w-lg dark:bg-[#121614] dark:border-[#29322E]"
      >
        {renegotiateDialog && (
          <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-700 dark:text-zinc-100">{renegotiateEntry === "interest" ? "Renegociar Dívida" : "Renegociação de Contrato"}</h2>
            <button
              type="button"
              onClick={() => { setRenegotiateDialog(null); setRenegotiateMode(null); setRenegotiateEntry("all"); setRenegotiateAmount(0); setRenegotiateNotes("") }}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500 text-white transition hover:bg-red-600"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {renegotiateEntry === "interest" ? (
            <InterestRenegotiateBody
              loan={renegotiateDialog}
              mode={renegotiateMode}
              setMode={setRenegotiateMode}
              amount={renegotiateAmount}
              setAmount={setRenegotiateAmount}
              notes={renegotiateNotes}
              setNotes={setRenegotiateNotes}
              date={renegotiateDate}
              setDate={setRenegotiateDate}
              newDueDate={renegotiateNewDueDate}
              setNewDueDate={setRenegotiateNewDueDate}
              installmentId={renegotiateInstallmentId}
              setInstallmentId={setRenegotiateInstallmentId}
              payMethod={renegotiatePayMethod}
              setPayMethod={setRenegotiatePayMethod}
              paying={paying}
              onSubmit={handleRenegotiatePayment}
              onCancel={() => { setRenegotiateDialog(null); setRenegotiateMode(null); setRenegotiateEntry("all"); setRenegotiateAmount(0); setRenegotiateNotes("") }}
              getNextDueInst={getNextDueInst}
              interestPerInst={interestPerInst}
              getRemaining={getRemaining}
              getCurrentOverdueCharge={getCurrentOverdueCharge}
              getCurrentOverdueDays={getCurrentOverdueDays}
            />
          ) : (
            <LoanRenegotiationContent
              loan={renegotiateDialog}
              remainingAmount={getRemaining(renegotiateDialog)}
              onClose={() => {
                setRenegotiateDialog(null)
                setRenegotiateMode(null)
                setRenegotiateEntry("all")
                setRenegotiateAmount(0)
                setRenegotiateNotes("")
              }}
              onSuccess={fetchLoans}
            />
          )}
          </>
        )}
      </Dialog>

      {/* ===== REGISTRAR PAGAMENTO DIALOG ===== */}
      <Dialog
        open={!!paymentDialog}
        onClose={() => { setPaymentDialog(null); resetPaymentForm() }}
        className="w-full max-w-lg scrollbar-visible dark:bg-[#121614] dark:border-[#29322E]"
      >
        {paymentDialog && (() => {
          const pendingInstallments = paymentDialog.installments.filter((i: any) => i.status !== "PAID")
          const selectedInsts = paymentDialog.installments.filter((i: any) => selectedInstallmentIds.includes(i.id))
          const remaining = getRemaining(paymentDialog)
          const interestPI = paymentDialog.profit / paymentDialog.installmentCount
          const principalPerInst = paymentDialog.amount / paymentDialog.installmentCount
          const firstInst = pendingInstallments[0]
          const totalOfInst = firstInst ? firstInst.amount : 0
          const firstInstPayable = firstInst ? getInstallmentPayableAmount(paymentDialog, firstInst) : 0
          const now = new Date()
          const hasOverdueInst = pendingInstallments.some((i: any) => new Date(i.dueDate) < now)
          const penalty = hasOverdueInst ? (paymentDialog.penaltyFee || 0) : 0
          const totalWithPenalty = remaining + penalty
          const partInst = pendingInstallments.find((i: any) => i.id === selectedInstallmentIds[0]) || pendingInstallments[0]
          return (
            <div className="space-y-4">
              {/* Cabecalho com X vermelho */}
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-zinc-100">Registrar Pagamento</h2>
                <button type="button" onClick={() => { setPaymentDialog(null); resetPaymentForm() }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Etiquetas */}
              <div className="-mt-3.5">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-zinc-200"><Tag className="h-4 w-4" /> Etiquetas</p>
                {editingTags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {editingTags.map((tag, i) => {
                      const [name, color] = tag.includes("|") ? tag.split("|") : [tag, "#ef4444"]
                      return (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ backgroundColor: color }}>
                          {name}
                          <button type="button" onClick={() => persistLoanTags(paymentDialog.id, editingTags.filter((_, idx) => idx !== i))} className="hover:opacity-70"><X className="h-3 w-3" /></button>
                        </span>
                      )
                    })}
                  </div>
                )}
                {!showTagForm ? (
                  <button type="button" onClick={() => setShowTagForm(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 transition-colors hover:border-gray-400 dark:border-[#29322E] dark:text-zinc-400 dark:hover:border-zinc-600">
                    <Plus className="h-3.5 w-3.5" /> Criar / adicionar etiqueta
                  </button>
                ) : (
                  <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-[#29322E]">
                    <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Nome da etiqueta..." className="text-sm dark:bg-[#121614]" autoFocus onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const val = tagInput.trim(); if (val && !editingTags.some(t => t.split("|")[0] === val)) { persistLoanTags(paymentDialog.id, [...editingTags, `${val}|${tagColor}`]) } setTagInput(""); setShowTagForm(false) } }} />
                    <div className="flex flex-wrap gap-2">
                      {["#3b82f6", "#ef4444", "#f97316", "#10b981", "#eab308", "#a855f7", "#ec4899", "#6366f1", "#14b8a6", "#f59e0b", "#8b5cf6", "#06b6d4"].map((c) => (
                        <button key={c} type="button" onClick={() => setTagColor(c)} className={`h-7 w-7 rounded-full transition-all ${tagColor === c ? "ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-zinc-900 scale-110" : "hover:scale-110"}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    {tagInput.trim() && (
                      <button type="button" onClick={() => { const val = tagInput.trim(); if (val && !editingTags.some(t => t.split("|")[0] === val)) { persistLoanTags(paymentDialog.id, [...editingTags, `${val}|${tagColor}`]) } setTagInput(""); setShowTagForm(false) }} className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors" style={{ backgroundColor: tagColor }}>
                        <Plus className="h-4 w-4" /> Criar &ldquo;{tagInput.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                )}
              </div>
              <hr className="border-t border-gray-100 dark:border-[#29322E]" />

              {/* Card do cliente */}
              <div className="rounded-xl bg-gray-100 dark:bg-[#222A26]/50 p-4">
                <div className="flex items-center gap-3.5">
                  <Avatar name={paymentDialog.client.name} src={paymentDialog.client.photo} size="md" />
                  <div>
                    <p className="text-base font-semibold text-gray-900 dark:text-[#FAFAFA]">{paymentDialog.client.name}</p>
                    <p className="text-[13px] text-gray-500 dark:text-[#9DAFA6]">Restante: {formatCurrency(remaining)}</p>
                  </div>
                </div>
                <p className="text-[13px] text-gray-400 dark:text-[#9DAFA6] mt-2">
                  Parcela: {formatCurrency(firstInstPayable || totalOfInst)} ({formatCurrency(principalPerInst)} + {formatCurrency(interestPI)} juros)
                </p>
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
                    <button key={t.key} onClick={() => {
                      setPaymentType(t.key)
                      if (t.key === "total") { setPayAmount(totalWithPenalty); setSelectedInstallmentIds([]) }
                      else if (t.key === "installment") { setPayAmount(selectedInsts.reduce((sum: number, installment: any) => sum + getInstallmentPayableAmount(paymentDialog, installment), 0)) }
                      else if (t.key === "partial") { setPayAmount(0); setSelectedInstallmentIds(selectedInstallmentIds.length >= 1 ? [selectedInstallmentIds[0]] : (pendingInstallments[0] ? [pendingInstallments[0].id] : [])) }
                      else if (t.key === "discount") { setPayAmount(0); setPayDiscount(0); setSelectedInstallmentIds([]) }
                    }} className={`h-10 px-4 rounded-[10px] text-sm font-medium border transition-colors ${
                      t.key === "discount"
                        ? "border-[#10B981] text-[#059669] dark:text-[#10B981] bg-white dark:bg-[#121614] hover:bg-gray-50 dark:hover:bg-zinc-800"
                        : paymentType === t.key
                          ? "bg-[#22C35D] border-transparent text-white"
                          : "border-gray-300 dark:border-[#29322E] bg-white dark:bg-[#121614] text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}>
                      {t.key === "discount" && <span className="mr-1">%</span>}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parcial: escolher parcela + valores */}
              {paymentType === "partial" && partInst && (() => {
                const base = Math.max(0, partInst.amount - (partInst.paidAmount || 0))
                const payable = getInstallmentPayableAmount(paymentDialog, partInst)
                return (
                  <div>
                    <Label className="text-sm font-medium">Referente a qual Parcela?</Label>
                    <div className="relative mt-2">
                      <button type="button" onClick={() => setPartialParcelaOpen((o) => !o)} className="flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-left text-sm text-gray-900 dark:border-[#29322E] dark:bg-[#121614] dark:text-zinc-100">
                        <span>Parcela {partInst.number}/{paymentDialog.installmentCount} <span className="text-gray-400 dark:text-zinc-500">- {formatDate(partInst.dueDate)}</span></span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 dark:text-zinc-500" />
                      </button>
                      {partialParcelaOpen && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-[#29322E] dark:bg-[#121614]">
                          {pendingInstallments.map((inst: any) => {
                            const sel = inst.id === partInst.id
                            return (
                              <button key={inst.id} type="button" onClick={() => { setSelectedInstallmentIds([inst.id]); setPayAmount(0); setPartialParcelaOpen(false) }} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${sel ? "bg-[#22C35D]/10 text-[#22C35D]" : "text-gray-900 hover:bg-gray-50 dark:text-zinc-100 dark:hover:bg-[#1A201D]"}`}>
                                {sel ? <Check className="h-4 w-4 shrink-0 text-[#22C35D]" /> : <span className="w-4 shrink-0" />}
                                <span>Parcela {inst.number}/{paymentDialog.installmentCount} <span className={sel ? "text-[#22C35D]/70" : "text-gray-400 dark:text-zinc-500"}>- {formatDate(inst.dueDate)}</span></span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className="mt-2.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-[#29322E] dark:bg-[#1A201D]">
                      <div className="flex justify-between py-1 text-sm">
                        <span className="text-gray-500 dark:text-[#9DAFA6]">Valor base:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(base)}</span>
                      </div>
                      <div className="mt-1 flex justify-between border-t border-gray-200 py-1 pt-2 text-sm dark:border-[#29322E]">
                        <span className="text-gray-500 dark:text-[#9DAFA6]">Total da parcela:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(payable)}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label className="text-sm font-medium">Valor Pago *</Label>
                      <Input type="number" step="0.01" min={0} max={payable} value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value) || 0)} className="mt-1 dark:bg-[#121614]" placeholder={`Máx: ${formatCurrency(payable)}`} />
                      <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">Digite qualquer valor até {formatCurrency(payable)}</p>
                    </div>
                  </div>
                )
              })()}

              {/* Selecione a(s) Parcela(s) */}
              {paymentType === "installment" && (
                <div>
                  <Label className="text-sm font-medium">Selecione a(s) Parcela(s)</Label>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 mb-2">Clique para selecionar múltiplas parcelas</p>
                  <div className="space-y-2 h-48 overflow-y-auto scrollbar-visible rounded-lg border border-gray-200 p-2 dark:border-[#29322E]">
                    {pendingInstallments.map((inst: any) => {
                      const isSelected = selectedInstallmentIds.includes(inst.id)
                      const instDueDate = new Date(inst.dueDate); instDueDate.setHours(0, 0, 0, 0)
                      const todayDate = new Date(now); todayDate.setHours(0, 0, 0, 0)
                      const instOverdue = instDueDate.getTime() < todayDate.getTime()
                      const payableAmount = getInstallmentPayableAmount(paymentDialog, inst)
                      const overdueDetails = getInstallmentOverdueDetails(paymentDialog, inst)
                      return (
                        <button key={inst.id} type="button" onClick={() => {
                          const newIds = isSelected ? selectedInstallmentIds.filter((id: string) => id !== inst.id) : [...selectedInstallmentIds, inst.id]
                          setSelectedInstallmentIds(newIds)
                          setPayAmount(paymentDialog.installments.filter((i: any) => newIds.includes(i.id)).reduce((sum: number, installment: any) => sum + getInstallmentPayableAmount(paymentDialog, installment), 0))
                        }} className={`group w-full rounded-lg border p-3 transition-colors text-left ${
                          isSelected
                            ? "border-green-600 bg-green-500 hover:bg-green-600 dark:border-green-700 dark:bg-green-600 dark:hover:bg-green-700"
                            : instOverdue
                              ? "border-red-400 bg-red-50 hover:border-red-500 hover:bg-green-50 dark:border-red-700 dark:bg-red-950/20 dark:hover:border-red-600 dark:hover:bg-green-950/20"
                              : "border-gray-200 bg-gray-50/80 hover:bg-gray-100 dark:border-[#29322E] dark:bg-[#121614] dark:hover:bg-[#1A201D]"
                        }`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex flex-1 items-center self-center">
                              <p className={`text-left text-sm font-medium ${isSelected ? "text-white" : instOverdue ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-zinc-100"}`}>
                                {isSelected && <span className="mr-1">✓</span>}
                                Parcela {inst.number}/{paymentDialog.installmentCount}{instOverdue ? " (Atrasada)" : ""}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`text-xs ${isSelected ? "text-white/90" : instOverdue ? "text-red-500 dark:text-red-400" : "text-gray-500 dark:text-zinc-400"}`}>{formatDate(inst.dueDate)}</p>
                              {instOverdue && overdueDetails.juros > 0 && (<p className="mt-0.5 text-xs font-medium text-orange-500 dark:text-orange-400">+{formatCurrency(overdueDetails.juros)} multa</p>)}
                              {instOverdue && overdueDetails.multa > 0 && (<p className="mt-0.5 text-xs font-medium text-red-500">+{formatCurrency(overdueDetails.multa)} multa</p>)}
                              <p className={`mt-0.5 text-[15px] font-semibold leading-none ${isSelected ? "text-white" : instOverdue ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-zinc-100"}`}>{formatCurrency(payableAmount)}</p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {selectedInstallmentIds.length > 1 && (
                    <div className="mt-3 rounded-lg border border-yellow-300 dark:border-yellow-700/50 bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2.5 text-sm">
                      <p className="font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-1.5"><span>⚠</span> Atenção: Você selecionou {selectedInstallmentIds.length} parcelas</p>
                      <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-400">O valor total será de {formatCurrency(payAmount)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Valor Recebido (total/desconto) */}
              {(paymentType === "total" || paymentType === "discount") && (
                <div>
                  <Label className="text-sm font-medium">Valor Recebido *</Label>
                  <Input type="number" step="0.01" min={0} max={remaining} value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value) || 0)} className="mt-1 dark:bg-[#121614]" placeholder={`Máximo: ${formatCurrency(remaining)}`} />
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Quanto o cliente efetivamente pagou</p>
                </div>
              )}

              {/* Data do Pagamento */}
              <div>
                <Label className="text-sm font-medium">Data do Pagamento</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="mt-1 cal-green dark:bg-[#121614]" />
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Quando o cliente efetivamente pagou</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" className="rounded-[10px] dark:bg-[#121614] dark:border-[#29322E]" onClick={() => { setPaymentDialog(null); resetPaymentForm() }}>Cancelar</Button>
                <Button onClick={handlePayment} disabled={!payAmount || payAmount <= 0 || paying} className="rounded-[10px] bg-[#22C35D] hover:bg-[#22C35D]/90 text-white">{paying ? "Processando..." : "Registrar Pagamento"}</Button>
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
        className="w-full max-w-lg"
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
                  onClick={() => {
                    const freshLoan = whatsappLoan ? (loans.find(l => l.id === whatsappLoan.id) || whatsappLoan) : whatsappLoan
                    if (freshLoan) { setWhatsappLoan(freshLoan); setWhatsappMessage(buildDefaultWhatsappMessage(freshLoan)) }
                  }}
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
                    className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-white"
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
      <Dialog open={paymentReceiptDialog} onClose={() => setPaymentReceiptDialog(false)} className="w-full max-w-md">
        {paymentReceiptInfo && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/15">
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
              {paymentReceiptInfo.lateFeeAmount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-zinc-400">Valor da Parcela:</span>
                    <span className="font-semibold text-gray-900 dark:text-zinc-100">{formatCurrency(paymentReceiptInfo.principalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-500 dark:text-red-400">Multa/Juros:</span>
                    <span className="font-bold text-red-500 dark:text-red-400">{formatCurrency(paymentReceiptInfo.lateFeeAmount)}</span>
                  </div>
                </>
              )}
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
                className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
                onClick={() => {
                  const text = buildPaymentReceiptText(paymentReceiptInfo)
                  navigator.clipboard.writeText(text)
                  alert("Copiado!")
                }}
              >
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button
                className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
                onClick={() => {
                  const text = buildPaymentReceiptText(paymentReceiptInfo)
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
                    ${paymentReceiptInfo.lateFeeAmount > 0 ? `<tr><td>Valor da Parcela:</td><td>${formatCurrency(paymentReceiptInfo.principalAmount)}</td></tr>
                    <tr><td>Multa/Juros:</td><td style="color:#dc2626">${formatCurrency(paymentReceiptInfo.lateFeeAmount)}</td></tr>` : ""}
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

      {/* Modal Detalhes do Empréstimo (suspenso) */}
      <Dialog
        open={Boolean(detailsLoanId)}
        onClose={() => setDetailsLoanId(null)}
        className="w-full max-w-3xl border-none bg-transparent p-0 shadow-none"
      >
        {detailsLoanId ? (
          <LoanDetailsContent
            loanId={detailsLoanId}
            presentation="modal"
            tone={detailsTone}
            onClose={() => setDetailsLoanId(null)}
          />
        ) : null}
      </Dialog>

      {/* Modal Comprovante de Empréstimo (suspenso) */}
      {comprovanteLoanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-2 sm:p-4">
          <button
            type="button"
            aria-label="Fechar comprovante"
            className="absolute inset-0 cursor-default"
            onClick={() => setComprovanteLoanId(null)}
          />
          <div className="relative z-10 w-full max-w-md">
            <ComprovanteContent
              presentation="modal"
              loanId={comprovanteLoanId}
              onClose={() => setComprovanteLoanId(null)}
            />
          </div>
        </div>
      )}

      {/* Confirmação de exclusão (centralizado) */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4">
          <button type="button" aria-label="Fechar" className="absolute inset-0 cursor-default" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-300 dark:border-red-800/60 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
                <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Excluir empréstimo?</h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              O empréstimo será removido do dashboard. Os <span className="font-semibold text-gray-800 dark:text-zinc-200">recebimentos serão mantidos</span> no histórico.
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-zinc-300 transition hover:bg-gray-50 dark:hover:bg-zinc-700">Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, HelpCircle, Calendar, RefreshCw, DollarSign, Percent, Hash, TrendingUp, Table2, Trash2, Pencil, MessageCircle, AlertTriangle, X } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import { formatCurrency, formatDate, localDateStr } from "@/lib/utils"

interface Loan {
  id: string
  amount: number
  totalAmount: number
  profit: number
  installmentCount: number
  status: string
  modality: string
  client: { id: string; name: string }
  payments: { id: string; amount: number; date: string; notes?: string | null }[]
}

type PeriodType = "today" | "week" | "month" | "custom"

const todayISO = () => localDateStr()

function getWeekRange() {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: monday, end: sunday }
}

function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start, end }
}

export default function RecebimentosPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  const [allLoansCount, setAllLoansCount] = useState(0)

  const [period, setPeriod] = useState<PeriodType>("today")
  const [customStart, setCustomStart] = useState(todayISO())
  const [customEnd, setCustomEnd] = useState(todayISO())

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editingAmount, setEditingAmount] = useState("")
  const [editingOriginalAmount, setEditingOriginalAmount] = useState(0)
  const [savingAmount, setSavingAmount] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/loans?includeHidden=true")
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setLoans(list)
      setAllLoansCount(list.length)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const range = useMemo(() => {
    const now = new Date()
    if (period === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      return { start, end, label: "Hoje" }
    }
    if (period === "week") {
      const { start } = getWeekRange()
      start.setHours(0, 0, 0, 0)
      const saturday = new Date(start)
      saturday.setDate(start.getDate() + 5)
      saturday.setHours(23, 59, 59, 999)
      return { start, end: saturday, label: "Semana" }
    }
    if (period === "month") {
      const { start, end } = getMonthRange()
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end, label: "Mês" }
    }

    const start = new Date(customStart + "T00:00:00")
    const end = new Date(customEnd + "T23:59:59")
    return { start, end, label: "Período" }
  }, [period, customStart, customEnd])

  const paymentsInRange = useMemo(() => {
    const rows: Array<{
      id: string
      loanId: string
      clientName: string
      amount: number
      date: string
      principal: number
      interest: number
      pureInterest: number
      lateFee: number
      dailyFee: number
      notes: string | null
      type: "Pagamento" | "Parcela" | "Só Juros"
      installmentInfo: string | null
    }> = []

    loans.forEach((loan) => {
      loan.payments.forEach((payment) => {
        const d = new Date(payment.date)
        if (d < range.start || d > range.end) return

        // Determine type from notes first
        let type: "Pagamento" | "Parcela" | "Só Juros" = "Pagamento"
        let installmentInfo: string | null = null
        let installmentNumber: number | null = null
        const n = payment.notes || ""
        if (n.includes("[OVERDUE_CONFIG") || n.toLowerCase().includes("juros") || n.toLowerCase().includes("só juros") || n.toLowerCase().includes("parcial de juros")) {
          type = "Só Juros"
        } else if (n.includes("Parcela") || n.includes("parcela")) {
          type = "Parcela"
          const match = n.match(/Parcela\s+(\d+)\s+de\s+(\d+)/i)
          if (match) {
            installmentInfo = `Parcela ${match[1]} de ${match[2]}`
            installmentNumber = parseInt(match[1], 10)
          }
        }

        // For "Só Juros" payments, base is interest; any excess = daily late fee
        let principal: number
        let interest: number
        let pureInterest: number
        let soJurosDailyFee = 0
        if (type === "Só Juros") {
          principal = 0
          const dailyFeeMatch = n.match(/\[dailyFee:([\d.]+)\]/)
          if (dailyFeeMatch) {
            soJurosDailyFee = parseFloat(dailyFeeMatch[1])
          } else {
            // Fallback: excess above base interest per installment = daily late fee portion
            const baseInterest = Math.round((loan.profit / Math.max(1, loan.installmentCount)) * 100) / 100
            soJurosDailyFee = Math.max(0, Math.round((payment.amount - baseInterest) * 100) / 100)
          }
          pureInterest = Math.max(0, Math.round((payment.amount - soJurosDailyFee) * 100) / 100)
          interest = payment.amount
        } else {
          const numInstallments = Math.max(1, loan.installmentCount || 1)
          const principalPerInstallment = Math.round((loan.amount / numInstallments) * 100) / 100
          const pureInterestPerInstallment = Math.round((loan.profit / numInstallments) * 100) / 100
          // A última parcela absorve o arredondamento (mesma regra da criação),
          // para que a soma do principal bata com o capital emprestado.
          if (installmentNumber === numInstallments) {
            principal = Math.round((loan.amount - principalPerInstallment * (numInstallments - 1)) * 100) / 100
            pureInterest = Math.round((loan.profit - pureInterestPerInstallment * (numInstallments - 1)) * 100) / 100
          } else {
            principal = principalPerInstallment
            pureInterest = pureInterestPerInstallment
          }
          interest = Math.max(0, Math.round((payment.amount - principal) * 100) / 100)
        }

        rows.push({
          id: payment.id,
          loanId: loan.id,
          clientName: loan.client?.name || "Cliente",
          amount: payment.amount,
          date: payment.date,
          principal,
          interest,
          pureInterest,
          lateFee: type === "Só Juros" ? 0 : (n.match(/\[lateFee:([\d.]+)\]/) ? parseFloat(n.match(/\[lateFee:([\d.]+)\]/)![1]) : 0),
          dailyFee: type === "Só Juros" ? soJurosDailyFee : (n.match(/\[dailyFee:([\d.]+)\]/) ? parseFloat(n.match(/\[dailyFee:([\d.]+)\]/)![1]) : 0),
          notes: payment.notes || null,
          type,
          installmentInfo,
        })
      })
    })

    return rows.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
      if (dateDiff !== 0) return dateDiff
      return b.id > a.id ? 1 : -1
    })
  }, [loans, range.start, range.end])

  const stats = useMemo(() => {
    const totalReceived = paymentsInRange.reduce((sum, p) => sum + p.amount, 0)
    const interestReceived = paymentsInRange.reduce((sum, p) => sum + p.interest, 0)
    const principalPaid = paymentsInRange.reduce((sum, p) => sum + p.principal, 0)
    const fine = paymentsInRange.reduce((sum, p) => sum + p.lateFee + p.dailyFee, 0)
    const count = paymentsInRange.length

    return { totalReceived, interestReceived, principalPaid, fine, count }
  }, [paymentsInRange])

  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)
  const [deletingPayment, setDeletingPayment] = useState(false)
  const deletePayment = (paymentId: string) => setDeletePaymentId(paymentId)
  const confirmDeletePayment = async () => {
    if (!deletePaymentId) return
    setDeletingPayment(true)
    try {
      const res = await fetch(`/api/payments?id=${deletePaymentId}`, { method: "DELETE" })
      if (res.ok) {
        setDeletePaymentId(null)
        loadData()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setDeletingPayment(false)
    }
  }

  const handleSaveEditAmount = async () => {
    if (!editingPaymentId || !editingAmount) return
    const parsed = parseFloat(editingAmount.replace(",", "."))
    if (isNaN(parsed) || parsed <= 0) return
    setSavingAmount(true)
    try {
      const res = await fetch("/api/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingPaymentId, amount: parsed }),
      })
      if (res.ok) {
        setEditingPaymentId(null)
        setEditingAmount("")
        loadData()
      } else {
        const data = await res.json().catch(() => null)
        alert(data?.error || "Erro ao atualizar valor")
      }
    } finally {
      setSavingAmount(false)
    }
  }

  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const M = 8

    const rows = paymentsInRange
    const totalRecebido = rows.reduce((s, p) => s + p.amount, 0)
    const principalPago = rows.reduce((s, p) => s + p.principal, 0)
    const jurosRecebidos = rows.reduce((s, p) => s + p.pureInterest, 0)
    const multaRecebida = rows.reduce((s, p) => s + Math.max(0, Math.round((p.amount - p.principal - p.pureInterest) * 100) / 100), 0)
    const qtd = rows.length

    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
    const periodoLabel = period === "month"
      ? `${meses[range.start.getMonth()]} de ${range.start.getFullYear()}`
      : `${formatDate(localDateStr(range.start))} a ${formatDate(localDateStr(range.end))}`

    // Gradiente horizontal (roxo -> azul)
    const gradient = (x: number, y: number, w: number, h: number, c1: number[], c2: number[], steps = 80) => {
      const sw = w / steps
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1)
        doc.setFillColor(
          Math.round(c1[0] + (c2[0] - c1[0]) * t),
          Math.round(c1[1] + (c2[1] - c1[1]) * t),
          Math.round(c1[2] + (c2[2] - c1[2]) * t),
        )
        doc.rect(x + i * sw, y, sw + 0.4, h, "F")
      }
    }

    // ===== Header =====
    const headH = 26
    gradient(M, M, pageW - 2 * M, headH, [76, 29, 149], [37, 99, 235])
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold"); doc.setFontSize(15)
    doc.text("CredGestor", M + 6, M + 12)
    doc.text("RELATÓRIO DE RECEBIMENTOS", pageW / 2, M + 11, { align: "center" })
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5)
    doc.text(periodoLabel, pageW / 2, M + 18, { align: "center" })
    doc.setFontSize(9)
    doc.text(formatDate(todayISO()), pageW - M - 6, M + 12, { align: "right" })

    // ===== Cards de resumo =====
    const cards = [
      { label: "TOTAL RECEBIDO", value: formatCurrency(totalRecebido), color: [22, 163, 74] },
      { label: "JUROS RECEBIDOS", value: formatCurrency(jurosRecebidos), color: [22, 163, 74] },
      { label: "PRINCIPAL PAGO", value: formatCurrency(principalPago), color: [147, 51, 234] },
      { label: "MULTA RECEBIDA", value: formatCurrency(multaRecebida), color: [239, 68, 68] },
      { label: "QTD. PAGAMENTOS", value: String(qtd), color: [249, 115, 22] },
    ]
    const gap = 3
    const cardW = (pageW - 2 * M - gap * (cards.length - 1)) / cards.length
    const cardY = M + headH + 6, cardH = 20
    cards.forEach((c, i) => {
      const x = M + i * (cardW + gap)
      doc.setDrawColor(c.color[0], c.color[1], c.color[2])
      doc.setFillColor(255, 255, 255)
      doc.setLineWidth(0.5)
      doc.roundedRect(x, cardY, cardW, cardH, 2.5, 2.5, "FD")
      doc.setTextColor(120, 120, 120)
      doc.setFont("helvetica", "bold"); doc.setFontSize(6)
      doc.text(c.label, x + cardW / 2, cardY + 7, { align: "center" })
      doc.setTextColor(c.color[0], c.color[1], c.color[2])
      doc.setFontSize(9.5)
      doc.text(c.value, x + cardW / 2, cardY + 14, { align: "center" })
    })

    // ===== Barra de resumo =====
    const sumY = cardY + cardH + 5, sumH = 9
    doc.setFillColor(238, 242, 255)
    doc.roundedRect(M, sumY, pageW - 2 * M, sumH, 1.5, 1.5, "F")
    doc.setTextColor(37, 99, 235)
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5)
    doc.text(`PAGAMENTOS (${qtd})`, M + 4, sumY + 6)
    doc.setTextColor(80, 80, 80)
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)
    doc.text(
      `Total: ${formatCurrency(totalRecebido)}   |   Juros: ${formatCurrency(jurosRecebidos)}   |   Principal: ${formatCurrency(principalPago)}   |   Multa: ${formatCurrency(multaRecebida)}`,
      pageW - M - 4, sumY + 6, { align: "right" },
    )

    // ===== Tabela =====
    autoTable(doc, {
      startY: sumY + sumH + 4,
      margin: { top: 14, left: M, right: M, bottom: 14 },
      head: [["DATA", "CLIENTE", "PARCELA", "TIPO", "VALOR"]],
      body: rows.map((p) => {
        const parcela = p.installmentInfo ? p.installmentInfo.replace(/Parcela\s+/i, "").trim() : "-"
        return [formatDate(p.date), p.clientName, parcela, p.type, formatCurrency(p.amount)]
      }),
      styles: { fontSize: 8, cellPadding: 2, textColor: [40, 40, 40], lineColor: [235, 235, 235], lineWidth: 0.1 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 249, 251] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 26, halign: "center", fontStyle: "bold" },
        4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 3) {
          data.cell.styles.textColor = data.cell.raw === "Só Juros" ? [37, 99, 235] : [90, 90, 90]
        }
      },
    })

    // ===== Rodapé (todas as páginas) =====
    const total = doc.getNumberOfPages()
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, "0")
    const mi = String(now.getMinutes()).padStart(2, "0")
    for (let i = 1; i <= total; i++) {
      doc.setPage(i)
      const fy = pageH - 10
      gradient(M, fy, pageW - 2 * M, 7, [76, 29, 149], [37, 99, 235])
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)
      doc.text(`Emitido em ${formatDate(todayISO())} às ${hh}:${mi}`, M + 4, fy + 4.6)
      doc.text(`${i} / ${total}`, pageW / 2, fy + 4.6, { align: "center" })
      doc.text("CredGestor", pageW - M - 4, fy + 4.6, { align: "right" })
    }

    doc.save(`recebimentos-${todayISO()}.pdf`)
  }

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Empréstimos</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">Gerencie seus empréstimos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Download className="h-4 w-4" />
            Baixar Relatório
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = "/emprestimos" }}
            className="inline-flex items-center gap-2 rounded-xl border border-green-600 bg-white px-4 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-500/10 dark:border-green-700 dark:bg-zinc-900 dark:text-green-400 dark:hover:bg-zinc-800"
          >
            <MessageCircle className="h-4 w-4" />
            Cobrança em Lote
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-fit max-w-full items-center gap-1 bg-white dark:bg-[#222A26] rounded-xl p-1 border border-gray-200 dark:border-zinc-800 overflow-x-auto">
        <a href="/emprestimos" className="px-4 py-1.5 rounded-md text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors whitespace-nowrap">Empréstimos <span className="font-medium opacity-70">({allLoansCount})</span></a>
        <a href="/emprestimos/tabela-price" className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors whitespace-nowrap"><Table2 className="h-3.5 w-3.5" /> Tabela Price</a>
        <button type="button" className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium bg-green-500 text-white whitespace-nowrap"><RefreshCw className="h-3.5 w-3.5" /> Recebimentos</button>
      </div>

      <div className="rounded-xl border border-primary/30 bg-white dark:bg-[#191F1C] p-3 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="text-gray-700 dark:text-zinc-300 text-sm flex items-center gap-1"><Calendar className="h-4 w-4 text-primary" /> Período:</span>
          <button type="button" onClick={() => setPeriod("today")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${period === "today" ? "bg-primary text-white" : "bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"}`}>Hoje</button>
          <button type="button" onClick={() => setPeriod("week")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${period === "week" ? "bg-primary text-white" : "bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"}`}>Semana</button>
          <button type="button" onClick={() => setPeriod("month")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${period === "month" ? "bg-primary text-white" : "bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"}`}>Mês</button>
          <button type="button" onClick={() => setPeriod("custom")} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 ${period === "custom" ? "bg-primary text-white" : "bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"}`}><Calendar className="h-3.5 w-3.5" /> Período</button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportPdf} className="p-2 rounded-md border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:bg-zinc-800" title="Exportar CSV">
            <Download className="h-4 w-4" />
          </button>
          <button type="button" onClick={loadData} className="p-2 rounded-md border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:bg-zinc-800" title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {period === "custom" && (
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          </div>
          <div>
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-primary/30 bg-white dark:bg-[#191F1C] p-4">
          <p className="text-gray-500 dark:text-zinc-400 text-sm flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> Total Recebido</p>
          <p className="text-xl font-bold tabular-nums tracking-tight text-[#16a34a] dark:text-green-400 mt-1">{formatCurrency(stats.totalReceived)}</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-white dark:bg-[#191F1C] p-4">
          <p className="text-gray-500 dark:text-zinc-400 text-sm flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> Juros Recebido</p>
          <p className="text-xl font-bold tabular-nums tracking-tight text-purple-600 dark:text-purple-400 mt-1">{formatCurrency(stats.interestReceived)}</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-white dark:bg-[#191F1C] p-4">
          <p className="text-gray-500 dark:text-zinc-400 text-sm flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Multa</p>
          <p className="text-xl font-bold tabular-nums tracking-tight text-orange-500 dark:text-orange-400 mt-1">{formatCurrency(stats.fine)}</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-white dark:bg-[#191F1C] p-4">
          <p className="text-gray-500 dark:text-zinc-400 text-sm flex items-center gap-1.5"><Percent className="h-4 w-4" /> Principal Pago</p>
          <p className="text-xl font-bold tabular-nums tracking-tight text-blue-600 dark:text-blue-400 mt-1">{formatCurrency(stats.principalPaid)}</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-white dark:bg-[#191F1C] p-4">
          <p className="text-gray-500 dark:text-zinc-400 text-sm flex items-center gap-1.5"><Hash className="h-4 w-4" /> Qtd. Pagamentos</p>
          <p className="text-xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100 mt-1">{stats.count}</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/30 bg-white dark:bg-[#191F1C] p-5 min-h-[220px]">
        <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-4">Pagamentos – {range.label}</h2>
        {loading ? (
          <div className="text-gray-500 dark:text-zinc-400">Carregando...</div>
        ) : paymentsInRange.length === 0 ? (
          <div className="h-[140px] flex flex-col items-center justify-center text-gray-400 dark:text-zinc-500">
            <DollarSign className="h-10 w-10 opacity-30" />
            <p>Nenhum pagamento registrado neste período.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                <th className="pb-3 font-medium">Data</th>
                <th className="pb-3 font-medium">Cliente</th>
                <th className="pb-3 font-medium text-right pr-8">Valor</th>
                <th className="pb-3 font-medium pl-8">Tipo</th>
                <th className="pb-3 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {paymentsInRange.map((payment) => {
                const dateObj = new Date(payment.date)
                const dd = String(dateObj.getDate()).padStart(2, "0")
                const mm = String(dateObj.getMonth() + 1).padStart(2, "0")
                const typeBadge = payment.type === "Só Juros"
                  ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400"
                  : payment.type === "Parcela"
                  ? "bg-primary/10 dark:bg-primary/20 text-green-500 dark:text-green-400"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"

                return (
                  <tr key={payment.id} className="text-sm">
                    <td className="py-4 text-gray-500 dark:text-zinc-400">{dd}/{mm}</td>
                    <td className="py-4">
                      <p className="font-medium text-gray-900 dark:text-zinc-100">{payment.clientName}</p>
                      {payment.installmentInfo && (
                        <p className="text-xs text-gray-400 dark:text-zinc-500">{payment.installmentInfo}</p>
                      )}
                    </td>
                    <td className="py-4 text-right pr-8">
                      <div className="relative inline-block group">
                        <span className="inline-flex items-center gap-1 font-semibold text-green-500 dark:text-green-400 cursor-help">
                          <DollarSign className="h-3.5 w-3.5 text-green-500" />
                          {formatCurrency(payment.amount)}
                        </span>
                        <div className="absolute right-0 bottom-full mb-2 z-20 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl p-3 min-w-[190px] text-xs pointer-events-none">
                          <p className="font-semibold text-gray-700 dark:text-zinc-200 mb-2 text-center text-[11px] uppercase tracking-wide">Composição</p>
                          {(() => {
                            const combinedLateFee = Math.max(0, Math.round((payment.amount - payment.principal - payment.pureInterest) * 100) / 100)
                            const hasSplitFees = payment.dailyFee > 0
                            return (
                              <div className="space-y-1.5">
                                {payment.principal > 0 && (
                                  <div className="flex justify-between gap-6">
                                    <span className="text-gray-500 dark:text-zinc-400">Capital</span>
                                    <span className="font-medium text-gray-900 dark:text-zinc-100">{formatCurrency(payment.principal)}</span>
                                  </div>
                                )}
                                {payment.pureInterest > 0.001 && (
                                  <div className="flex justify-between gap-6">
                                    <span className="text-gray-500 dark:text-zinc-400">Juros</span>
                                    <span className="font-medium text-gray-900 dark:text-zinc-100">{formatCurrency(payment.pureInterest)}</span>
                                  </div>
                                )}
                                {(hasSplitFees ? payment.dailyFee : combinedLateFee) > 0.01 && (
                                  <div className="flex justify-between gap-6">
                                    <span className="text-red-500 dark:text-red-400">Multa/Atraso</span>
                                    <span className="font-medium text-red-500 dark:text-red-400">{formatCurrency(hasSplitFees ? payment.dailyFee : combinedLateFee)}</span>
                                  </div>
                                )}
                                <div className="pt-1.5 border-t border-gray-100 dark:border-zinc-700 flex justify-between gap-6">
                                  <span className="font-semibold text-gray-700 dark:text-zinc-300">Total</span>
                                  <span className="font-bold text-green-500 dark:text-green-400">{formatCurrency(payment.amount)}</span>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pl-8">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeBadge}`}>
                        {payment.type}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditingPaymentId(payment.id); setEditingAmount(String(payment.amount)); setEditingOriginalAmount(payment.amount) }}
                          className="p-1.5 rounded-md text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                          title="Editar valor"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePayment(payment.id)}
                          className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Excluir pagamento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={!!editingPaymentId}
        onClose={() => { if (!savingAmount) { setEditingPaymentId(null); setEditingAmount("") } }}
        className="w-full max-w-md dark:border-[#29322E] dark:bg-[#121614]"
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Editar pagamento</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">Altere o valor do pagamento deste empréstimo.</p>
            </div>
            <button
              type="button"
              onClick={() => { if (!savingAmount) { setEditingPaymentId(null); setEditingAmount("") } }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition hover:bg-red-600"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-[#29322E] bg-gray-50 dark:bg-[#1A201D] px-4 py-3">
            <p className="text-sm text-gray-500 dark:text-zinc-400">Pagamento atual</p>
            <p className="mt-1 text-xl font-bold text-primary">{formatCurrency(editingOriginalAmount)}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-900 dark:text-zinc-100">Novo valor</p>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={editingAmount}
              onChange={(e) => { const v = e.target.value; if (/^\d*[,.]?\d*$/.test(v)) setEditingAmount(v) }}
              className="dark:bg-[#121614]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { setEditingPaymentId(null); setEditingAmount("") }} disabled={savingAmount}>Cancelar</Button>
            <Button onClick={handleSaveEditAmount} disabled={!editingAmount || savingAmount} className="bg-green-500 hover:bg-green-600 text-white">{savingAmount ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>
      </Dialog>

      {/* Confirmação de exclusão de pagamento (centralizado) */}
      <Dialog open={!!deletePaymentId} onClose={() => { if (!deletingPayment) setDeletePaymentId(null) }} className="w-full max-w-md dark:border-[#29322E] dark:bg-[#121614]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Excluir pagamento?</h2>
            <button
              type="button"
              onClick={() => { if (!deletingPayment) setDeletePaymentId(null) }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition hover:bg-red-600"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Tem certeza que deseja excluir este pagamento? Esta ação não poderá ser desfeita.
          </p>

          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm font-medium text-amber-500">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Esta ação não poderá ser desfeita.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeletePaymentId(null)} disabled={deletingPayment}>Cancelar</Button>
            <Button onClick={confirmDeletePayment} disabled={deletingPayment} className="bg-red-500 hover:bg-red-600 text-white">
              {deletingPayment ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

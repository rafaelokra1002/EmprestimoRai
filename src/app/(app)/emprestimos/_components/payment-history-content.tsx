"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { CalendarDays, Copy, Download, Eye, FileText, Pencil, Trash2, User, X } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { buildLoanData, calculateEffectivePaidAmountFromPayments, calculateTotalAmountWithLateFee, normalizeInstallmentsFromPayments } from "@/lib/loan-logic"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Payment {
  id: string
  amount: number
  date: string
  notes: string | null
}

interface Installment {
  id: string
  number: number
  amount: number
  dueDate: string
  paidAmount: number
  status: string
}

interface LoanHistory {
  id: string
  amount: number
  interestRate: number
  interestType: string
  modality: string
  totalAmount: number
  dueDay?: number
  firstInstallmentDate: string
  installmentCount: number
  client: {
    id: string
    name: string
  }
  user?: {
    pixKey?: string | null
  }
  installments: Installment[]
  payments: Payment[]
}

const loanIdPattern = /^c[a-z0-9]{24,}$/i

function cleanPaymentNotes(notes: string | null) {
  if (!notes) return "Pagamento registrado"

  return notes
    .replace(/\[(lateFee|dailyFee):[\d.]+\]/gi, "")
    .replace(/\s+\|\s+/g, " | ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function getInstallmentLabel(notes: string | null) {
  const match = notes?.match(/Parcela\s+(\d+)\s+de\s+(\d+)/i)
  if (!match) return null

  return `${match[1]}/${match[2]}`
}

function getInstallmentNumber(notes: string | null) {
  const match = notes?.match(/Parcela\s+(\d+)\s+de\s+(\d+)/i)
  if (!match) return null

  return parseInt(match[1], 10)
}

function getLateFee(notes: string | null) {
  const lateFeeMatch = notes?.match(/\[lateFee:([\d.]+)\]/i)
  if (lateFeeMatch) return parseFloat(lateFeeMatch[1]) || 0

  const dailyFeeMatch = notes?.match(/\[dailyFee:([\d.]+)\]/i)
  return dailyFeeMatch ? parseFloat(dailyFeeMatch[1]) || 0 : 0
}

function buildPaymentPreviewTexts(loan: LoanHistory, payment: Payment) {
  const currentInstallments = normalizeInstallmentsFromPayments(loan.installments, loan.payments)

  const loanData = buildLoanData({
    amount: loan.amount,
    interestRate: loan.interestRate,
    interestType: loan.interestType,
    totalAmount: loan.totalAmount,
    dueDay: loan.dueDay,
    modality: loan.modality,
    firstInstallmentDate: loan.firstInstallmentDate,
    installments: currentInstallments,
    payments: loan.payments,
  })

  const remainingBalance = calculateTotalAmountWithLateFee(loanData)
  const nextPendingInstallment = currentInstallments
    .filter((installment) => installment.status !== "PAID")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

  const installmentNumber = getInstallmentNumber(payment.notes)
  const installmentLabel = getInstallmentLabel(payment.notes)
  const installment = installmentNumber
    ? loan.installments.find((entry) => entry.number === installmentNumber)
    : null
  const lateFeeAmount = getLateFee(payment.notes)
  const principalPerInstallment = loan.installmentCount > 0 ? loan.amount / loan.installmentCount : loan.amount
  const principalAmount = Math.min(principalPerInstallment, Math.max(0, payment.amount - lateFeeAmount))
  const interestAmount = Math.max(0, payment.amount - lateFeeAmount - principalAmount)
  const cleanNotes = cleanPaymentNotes(payment.notes)

  const completeText = [
    `Olá *${loan.client.name}*!`,
    "----------------",
    "",
    "✅ *COMPROVANTE DE PAGAMENTO*",
    installmentLabel ? `🧾 *Parcela:* ${installmentLabel}` : null,
    `💵 *Valor Pago:* ${formatCurrency(payment.amount)}`,
    `📅 *Data:* ${formatDate(payment.date)}`,
    "💳 *Forma:* Dinheiro",
    lateFeeAmount > 0 ? `📌 *Atraso Pago:* ${formatCurrency(lateFeeAmount)}` : null,
    `📈 *Juros:* ${formatCurrency(interestAmount)}`,
    `💰 *Principal:* ${formatCurrency(principalAmount)}`,
    "",
    `📊 *Saldo Restante:* ${formatCurrency(remainingBalance)}`,
    nextPendingInstallment ? `📅 *Próximo Vencimento:* ${formatDate(nextPendingInstallment.dueDate)}` : null,
    loan.user?.pixKey ? "" : null,
    loan.user?.pixKey ? `💳 *PIX:* ${loan.user.pixKey}` : null,
    "",
    cleanNotes ? `📝 *Observação:* ${cleanNotes}` : null,
  ].filter(Boolean).join("\n")

  const simpleText = [
    "*COMPROVANTE DE PAGAMENTO*",
    `Cliente: ${loan.client.name}`,
    installmentLabel ? `Parcela: ${installmentLabel}` : null,
    `Valor Pago: ${formatCurrency(payment.amount)}`,
    `Data: ${formatDate(payment.date)}`,
    nextPendingInstallment ? `Saldo Restante: ${formatCurrency(remainingBalance)}` : null,
    nextPendingInstallment ? `Próximo Vencimento: ${formatDate(nextPendingInstallment.dueDate)}` : null,
  ].filter(Boolean).join("\n")

  return {
    completeText,
    simpleText,
  }
}

function buildReceiptText(loan: LoanHistory, payment: Payment) {
  const installmentLabel = getInstallmentLabel(payment.notes)
  const cleanNotes = cleanPaymentNotes(payment.notes)

  return [
    "COMPROVANTE DE PAGAMENTO",
    "",
    `Cliente: ${loan.client.name}`,
    installmentLabel ? `Parcela: ${installmentLabel}` : null,
    `Valor: ${formatCurrency(payment.amount)}`,
    `Data: ${formatDate(payment.date)}`,
    `Observação: ${cleanNotes}`,
  ]
    .filter(Boolean)
    .join("\n")
}

function buildPaymentPrintHtml(loan: LoanHistory, payment: Payment) {
  const currentInstallments = normalizeInstallmentsFromPayments(loan.installments, loan.payments)
  const loanData = buildLoanData({
    amount: loan.amount,
    interestRate: loan.interestRate,
    interestType: loan.interestType,
    totalAmount: loan.totalAmount,
    dueDay: loan.dueDay,
    modality: loan.modality,
    firstInstallmentDate: loan.firstInstallmentDate,
    installments: currentInstallments,
    payments: loan.payments,
  })

  const installmentNumber = getInstallmentNumber(payment.notes)
  const installmentLabel = installmentNumber ? `${installmentNumber}ª de ${loan.installmentCount}` : "Pagamento avulso"
  const totalPaid = calculateEffectivePaidAmountFromPayments(loan.payments, loan.installments)
  const remainingBalance = calculateTotalAmountWithLateFee(loanData)
  const contractCode = `EMP-${loan.id.slice(-8).toUpperCase()}`

  return `
    <html>
      <head>
        <title>Comprovante de Pagamento</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #ffffff;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
            padding: 32px 24px 40px;
          }
          .sheet {
            max-width: 760px;
            margin: 0 auto;
          }
          .banner {
            background: #d8f7e4;
            color: #10b141;
            border-radius: 14px;
            text-align: center;
            padding: 18px 24px;
            margin-bottom: 38px;
          }
          .banner h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.02em;
          }
          .banner p {
            margin: 8px 0 0;
            font-size: 14px;
          }
          .card {
            border: 2px solid #22c55e;
            border-radius: 12px;
            padding: 18px 18px 16px;
          }
          .card h2 {
            margin: 0 0 18px;
            color: #10b141;
            font-size: 16px;
            font-weight: 800;
          }
          .row {
            display: grid;
            grid-template-columns: 180px 1fr;
            gap: 12px;
            align-items: center;
            margin-bottom: 16px;
            font-size: 15px;
          }
          .label {
            font-weight: 700;
          }
          .value-box {
            margin: 22px 0 10px;
            background: #d8f7e4;
            border-radius: 4px;
            color: #10b141;
            display: grid;
            grid-template-columns: 160px 1fr;
            align-items: center;
            padding: 10px 14px;
            width: 380px;
            font-weight: 800;
            font-size: 17px;
          }
          .summary {
            margin-top: 12px;
            width: 360px;
          }
          .summary-row {
            display: grid;
            grid-template-columns: 180px 1fr;
            margin-bottom: 14px;
            font-size: 15px;
          }
          .summary-row .label {
            font-weight: 700;
          }
          .footer-banner {
            margin: 38px 0 54px;
            background: #d8f7e4;
            border-radius: 10px;
            padding: 26px 24px;
            text-align: center;
            color: #10b141;
            font-size: 16px;
            font-weight: 800;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 36px;
            margin-top: 44px;
          }
          .signature {
            text-align: center;
            color: #4b5563;
            font-size: 14px;
            font-weight: 700;
          }
          .signature .line {
            border-top: 1px solid #6b7280;
            margin-bottom: 8px;
          }
          @media print {
            body { padding: 24px 16px; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="banner">
            <h1>COMPROVANTE DE PAGAMENTO</h1>
            <p>Contrato: ${contractCode}</p>
          </div>

          <div class="card">
            <h2>DADOS DO PAGAMENTO</h2>

            <div class="row"><div class="label">Cliente:</div><div>${loan.client.name}</div></div>
            <div class="row"><div class="label">Parcela:</div><div>${installmentLabel}</div></div>
            <div class="row"><div class="label">Data do Pagamento:</div><div>${formatDate(payment.date)}</div></div>
            <div class="row"><div class="label">Forma de Pagamento:</div><div>Dinheiro</div></div>

            <div class="value-box">
              <div>Valor Pago:</div>
              <div>${formatCurrency(payment.amount)}</div>
            </div>

            <div class="summary">
              <div class="summary-row"><div class="label">Total do Contrato:</div><div>${formatCurrency(loan.totalAmount)}</div></div>
              <div class="summary-row"><div class="label">Total Pago:</div><div>${formatCurrency(totalPaid)}</div></div>
              <div class="summary-row"><div class="label">Saldo Restante:</div><div>${formatCurrency(remainingBalance)}</div></div>
            </div>
          </div>

          <div class="footer-banner">Pagamento da ${installmentLabel} confirmado</div>

          <div class="signatures">
            <div class="signature">
              <div class="line"></div>
              <div>Assinatura do Cliente</div>
            </div>
            <div class="signature">
              <div class="line"></div>
              <div>Assinatura da Empresa</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `
}

export function PaymentHistoryContent({
  onClose,
  loanId: loanIdProp,
}: {
  onClose: () => void
  loanId?: string
}) {
  const params = useParams<{ id: string }>()
  const routeLoanId = loanIdProp ?? params?.id
  const loanId = routeLoanId && loanIdPattern.test(routeLoanId) ? routeLoanId : null

  const [loan, setLoan] = useState<LoanHistory | null>(null)
  const [loading, setLoading] = useState(Boolean(loanId))
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null)
  const [previewMode, setPreviewMode] = useState<"complete" | "simple">("complete")
  const [previewText, setPreviewText] = useState("")
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [editingDate, setEditingDate] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    const fetchLoan = async () => {
      if (!loanId) {
        setLoading(false)
        setError(routeLoanId ? "Empréstimo não encontrado" : null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/loans/${loanId}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data?.error || "Erro ao carregar histórico")
          return
        }

        setLoan(data)
      } catch (fetchError: any) {
        setError(fetchError?.message || "Erro de conexão")
      } finally {
        setLoading(false)
      }
    }

    fetchLoan()
  }, [loanId, routeLoanId])

  const payments = useMemo(() => loan?.payments ?? [], [loan])

  const openPreview = (payment: Payment) => {
    if (!loan) return

    const preview = buildPaymentPreviewTexts(loan, payment)
    setPreviewPayment(payment)
    setPreviewMode("complete")
    setPreviewText(preview.completeText)
  }

  const handleCopyPreview = async () => {
    await navigator.clipboard.writeText(previewText)
  }

  const previewTexts = useMemo(() => {
    if (!loan || !previewPayment) return null
    return buildPaymentPreviewTexts(loan, previewPayment)
  }, [loan, previewPayment])

  useEffect(() => {
    if (!previewTexts) return
    setPreviewText(previewMode === "complete" ? previewTexts.completeText : previewTexts.simpleText)
  }, [previewMode, previewTexts])

  const handleDownload = (payment: Payment) => {
    if (!loan) return
    const printWindow = window.open("", "_blank")

    if (!printWindow) return

    printWindow.document.write(buildPaymentPrintHtml(loan, payment))
    printWindow.document.close()
    printWindow.print()
  }

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Excluir este pagamento?")) return

    setDeletingId(paymentId)
    try {
      const res = await fetch(`/api/payments?id=${paymentId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        alert(data?.error || "Erro ao excluir pagamento")
        return
      }

      setLoan((current) => current ? {
        ...current,
        payments: current.payments.filter((payment) => payment.id !== paymentId),
      } : current)
    } finally {
      setDeletingId(null)
    }
  }

  const openEditDate = (payment: Payment) => {
    const date = new Date(payment.date)
    const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    setEditingPayment(payment)
    setEditingDate(localDate)
  }

  const handleSaveEditDate = async () => {
    if (!editingPayment || !editingDate) return

    setSavingEdit(true)
    try {
      const res = await fetch("/api/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPayment.id,
          date: editingDate,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        alert(data?.error || "Erro ao atualizar data do pagamento")
        return
      }

      const updated = await res.json()
      setLoan((current) => current ? {
        ...current,
        payments: current.payments
          .map((payment) => payment.id === editingPayment.id ? { ...payment, date: updated.date } : payment)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      } : current)
      setEditingPayment(null)
      setEditingDate("")
    } finally {
      setSavingEdit(false)
    }
  }

  if (loading) {
    return <div className="rounded-[28px] bg-white p-6 text-sm text-gray-500">Carregando histórico...</div>
  }

  if (error || !loan) {
    return (
      <div className="rounded-[28px] bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold text-slate-800">Histórico de Pagamentos</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300 text-emerald-500 transition-colors hover:bg-emerald-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-6 text-sm text-red-600">{error || "Empréstimo não encontrado"}</p>
      </div>
    )
  }

  return (
    <div className="rounded-[28px] bg-white p-6 shadow-2xl dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-800 dark:text-zinc-100">Histórico de Pagamentos</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300 text-emerald-500 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
          aria-label="Fechar histórico"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {payments.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
            Nenhum pagamento registrado.
          </div>
        ) : payments.map((payment) => {
          const installmentLabel = getInstallmentLabel(payment.notes)
          const cleanNotes = cleanPaymentNotes(payment.notes)

          return (
            <div
              key={payment.id}
              className="rounded-3xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-zinc-400">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span>{formatDate(payment.date)}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-primary">$</span>
                    <span className="text-[18px] font-bold tracking-tight text-primary">{formatCurrency(payment.amount)}</span>
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[12px] font-medium text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Dinheiro
                    </span>
                  </div>

                  <p className="mt-2 truncate text-[14px] text-gray-500 dark:text-zinc-400">
                    {installmentLabel ? `Parcela ${installmentLabel} quitada` : cleanNotes}
                    {cleanNotes && installmentLabel ? ` ${cleanNotes.replace(/Parcela\s+\d+\s+de\s+\d+/i, "").trim()}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-1 self-center">
                  <button
                    type="button"
                    onClick={() => openPreview(payment)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-primary transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    title="Copiar comprovante"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(payment)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-primary transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    title="Baixar comprovante"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditDate(payment)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    title="Editar data do pagamento"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(payment.id)}
                    disabled={deletingId === payment.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950/20"
                    title="Excluir pagamento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog
        open={!!previewPayment}
        onClose={() => setPreviewPayment(null)}
        className="max-w-2xl rounded-[28px] p-0"
      >
        {previewPayment && (
          <div className="overflow-hidden rounded-[28px] bg-white dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
              <div>
                <div className="flex items-center gap-2 text-[18px] font-semibold text-slate-800 dark:text-zinc-100">
                  <Eye className="h-5 w-5 text-primary" />
                  <span>Visualizar Mensagem</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                  <User className="h-4 w-4" />
                  <span>Cliente: {loan.client.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPayment(null)}
                className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-zinc-200"
                aria-label="Fechar visualização"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 pb-4">
              <div className="grid grid-cols-2 rounded-2xl bg-gray-100 p-1 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => setPreviewMode("complete")}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${previewMode === "complete" ? "bg-white text-gray-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100" : "text-gray-500 dark:text-zinc-400"}`}
                >
                  <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Completa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("simple")}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${previewMode === "simple" ? "bg-white text-gray-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100" : "text-gray-500 dark:text-zinc-400"}`}
                >
                  <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Simples</span>
                </button>
              </div>
            </div>

            <div className="px-6">
              <textarea
                value={previewText}
                onChange={(event) => setPreviewText(event.target.value)}
                className="min-h-[360px] w-full rounded-[18px] border-2 border-primary/80 bg-white px-4 py-4 text-[15px] leading-7 text-gray-800 outline-none dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div className="px-6 pb-4 pt-3 text-sm text-amber-600 dark:text-amber-400">
              Você pode editar a mensagem antes de copiar
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setPreviewPayment(null)}
                className="rounded-2xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCopyPreview}
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
              >
                <Copy className="h-4 w-4" /> Copiar Texto
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!editingPayment}
        onClose={() => { if (!savingEdit) { setEditingPayment(null); setEditingDate("") } }}
        title="Editar Data do Pagamento"
        className="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Pagamento</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-zinc-100">{editingPayment ? formatCurrency(editingPayment.amount) : ""}</p>
          </div>
          <div>
            <p className="mb-2 text-sm text-gray-500 dark:text-zinc-400">Nova data</p>
            <Input type="date" value={editingDate} onChange={(event) => setEditingDate(event.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setEditingPayment(null); setEditingDate("") }} disabled={savingEdit}>Cancelar</Button>
            <Button onClick={handleSaveEditDate} disabled={!editingDate || savingEdit}>{savingEdit ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
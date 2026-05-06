"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { CalendarDays, Download, FileText, Pencil, Trash2, X } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Payment {
  id: string
  amount: number
  date: string
  notes: string | null
}

interface LoanHistory {
  id: string
  installmentCount: number
  client: {
    name: string
  }
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

  const handleCopy = async (payment: Payment) => {
    if (!loan) return
    await navigator.clipboard.writeText(buildReceiptText(loan, payment))
  }

  const handleDownload = (payment: Payment) => {
    if (!loan) return

    const receiptText = buildReceiptText(loan, payment).replace(/\n/g, "<br />")
    const printWindow = window.open("", "_blank")

    if (!printWindow) return

    printWindow.document.write(`
      <html>
        <head>
          <title>Comprovante de Pagamento</title>
          <style>
            body { font-family: sans-serif; padding: 32px; color: #1f2937; }
            .card { max-width: 420px; margin: 0 auto; border: 1px solid #d1fae5; border-radius: 18px; padding: 24px; }
            h1 { color: #16a34a; font-size: 20px; margin-bottom: 16px; }
            p { line-height: 1.6; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Comprovante de Pagamento</h1>
            <p>${receiptText}</p>
          </div>
        </body>
      </html>
    `)
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
                    onClick={() => handleCopy(payment)}
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
                    disabled
                    className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg text-gray-400"
                    title="Edição de pagamento indisponível"
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
    </div>
  )
}
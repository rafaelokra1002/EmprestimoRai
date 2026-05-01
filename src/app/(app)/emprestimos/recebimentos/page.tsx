"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, HelpCircle, Calendar, RefreshCw, DollarSign, Percent, Hash, TrendingUp, Table2, Trash2 } from "lucide-react"
import { formatCurrency, formatDate, localDateStr } from "@/lib/utils"

interface Loan {
  id: string
  amount: number
  totalAmount: number
  profit: number
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
  const router = useRouter()

  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  const [allLoansCount, setAllLoansCount] = useState(0)
  const [receivedCount, setReceivedCount] = useState(0)

  const [period, setPeriod] = useState<PeriodType>("today")
  const [customStart, setCustomStart] = useState(todayISO())
  const [customEnd, setCustomEnd] = useState(todayISO())

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/loans")
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setLoans(list)
      setAllLoansCount(list.length)
      setReceivedCount(list.filter((l: any) => l.status === "COMPLETED").length)
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
      notes: string | null
      type: "Pagamento" | "Parcela" | "Só Juros"
      installmentInfo: string | null
    }> = []

    loans.forEach((loan) => {
      const principalRatio = loan.totalAmount > 0 ? loan.amount / loan.totalAmount : 0
      const interestRatio = loan.totalAmount > 0 ? loan.profit / loan.totalAmount : 0

      loan.payments.forEach((payment) => {
        const d = new Date(payment.date)
        if (d < range.start || d > range.end) return

        // Determine type from notes first
        let type: "Pagamento" | "Parcela" | "Só Juros" = "Pagamento"
        let installmentInfo: string | null = null
        const n = payment.notes || ""
        if (n.includes("[OVERDUE_CONFIG") || n.toLowerCase().includes("juros") || n.toLowerCase().includes("só juros") || n.toLowerCase().includes("parcial de juros")) {
          type = "Só Juros"
        } else if (n.includes("Parcela") || n.includes("parcela")) {
          type = "Parcela"
          const match = n.match(/Parcela\s+(\d+\s+de\s+\d+)/i)
          if (match) installmentInfo = `Parcela ${match[1]}`
        }

        // For "Só Juros" payments, entire amount is interest, no principal reduction
        let principal: number
        let interest: number
        if (type === "Só Juros") {
          principal = 0
          interest = payment.amount
        } else {
          const lateFeeMatch = n.match(/\[lateFee:([\d.]+)\]/)
          const lateFee = lateFeeMatch ? parseFloat(lateFeeMatch[1]) : 0
          const baseAmount = payment.amount - lateFee
          principal = Math.max(0, Math.round(baseAmount * principalRatio * 100) / 100)
          interest = Math.max(0, Math.round(baseAmount * interestRatio * 100) / 100) + lateFee
        }

        rows.push({
          id: payment.id,
          loanId: loan.id,
          clientName: loan.client?.name || "Cliente",
          amount: payment.amount,
          date: payment.date,
          principal,
          interest,
          notes: payment.notes || null,
          type,
          installmentInfo,
        })
      })
    })

    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [loans, range.start, range.end])

  const stats = useMemo(() => {
    const totalReceived = paymentsInRange.reduce((sum, p) => sum + p.amount, 0)
    const interestReceived = paymentsInRange.reduce((sum, p) => sum + p.interest, 0)
    const principalPaid = paymentsInRange.reduce((sum, p) => sum + p.principal, 0)
    const count = paymentsInRange.length

    return { totalReceived, interestReceived, principalPaid, count }
  }, [paymentsInRange])

  const deletePayment = async (paymentId: string) => {
    if (!confirm("Tem certeza que deseja excluir este pagamento?")) return
    try {
      const res = await fetch(`/api/payments?id=${paymentId}`, { method: "DELETE" })
      if (res.ok) {
        loadData()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const exportCsv = () => {
    const header = ["Data", "Cliente", "Valor", "Principal", "Juros", "Observações"]
    const lines = paymentsInRange.map((p) => [
      formatDate(p.date),
      p.clientName,
      p.amount.toFixed(2).replace(".", ","),
      p.principal.toFixed(2).replace(".", ","),
      p.interest.toFixed(2).replace(".", ","),
      (p.notes || "").replace(/;/g, ","),
    ].join(";"))

    const csv = [header.join(";"), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `recebimentos-${todayISO()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Empréstimos</h1>
          <p className="text-gray-500 dark:text-zinc-400">Gerencie seus empréstimos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.open("https://pt.wikipedia.org/wiki/Juros", "_blank")}>
            <HelpCircle className="h-4 w-4" /> Tutorial
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Baixar Relatório
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 rounded-xl p-1 border border-gray-200 dark:border-zinc-800 overflow-x-auto">
        <a href="/emprestimos" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 whitespace-nowrap">Empréstimos ({allLoansCount})</a>
        <a href="/emprestimos/tabela-price" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 whitespace-nowrap flex items-center gap-1.5"><Table2 className="h-3.5 w-3.5" />Tabela Price</a>
        <button type="button" className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white whitespace-nowrap">Recebimentos</button>
      </div>

      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="text-gray-700 dark:text-zinc-300 text-sm flex items-center gap-1"><Calendar className="h-4 w-4 text-emerald-600" /> Período:</span>
          <button type="button" onClick={() => setPeriod("today")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${period === "today" ? "bg-emerald-600 text-white" : "bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"}`}>Hoje</button>
          <button type="button" onClick={() => setPeriod("week")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${period === "week" ? "bg-emerald-600 text-white" : "bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"}`}>Semana</button>
          <button type="button" onClick={() => setPeriod("month")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${period === "month" ? "bg-emerald-600 text-white" : "bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"}`}>Mês</button>
          <button type="button" onClick={() => setPeriod("custom")} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 ${period === "custom" ? "bg-emerald-600 text-white" : "bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"}`}><Calendar className="h-3.5 w-3.5" /> Período</button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportCsv} className="p-2 rounded-md border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:bg-zinc-800" title="Exportar CSV">
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

      <div className="grid md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-gray-500 dark:text-zinc-400 text-sm flex items-center gap-1"><DollarSign className="h-4 w-4" /> Total Recebido</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600 mt-1">{formatCurrency(stats.totalReceived)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-gray-500 dark:text-zinc-400 text-sm flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Juros Recebido</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-violet-600 mt-1">{formatCurrency(stats.interestReceived)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-gray-500 dark:text-zinc-400 text-sm flex items-center gap-1"><Percent className="h-4 w-4" /> Principal Pago</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600 mt-1">{formatCurrency(stats.principalPaid)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-gray-500 dark:text-zinc-400 text-sm flex items-center gap-1"><Hash className="h-4 w-4" /> Qtd. Pagamentos</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100 mt-1">{stats.count}</p>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 p-5 min-h-[220px]">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-4">Pagamentos – {range.label}</h2>
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
              <tr className="text-left text-sm text-gray-500 dark:text-zinc-400">
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
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
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
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-900 dark:text-zinc-100">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                        {formatCurrency(payment.amount)}
                      </span>
                    </td>
                    <td className="py-4 pl-8">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeBadge}`}>
                        {payment.type}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <button
                        type="button"
                        onClick={() => deletePayment(payment.id)}
                        className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Excluir pagamento"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon,
  Clock, AlertTriangle, Wallet, Car, ShoppingBag, CheckCircle2
} from "lucide-react"
import { formatCurrency, localDateStr } from "@/lib/utils"

// Type for a unified due-date entry
interface DueEntry {
  id: string
  type: "loan" | "vehicle" | "sale"
  clientId: string
  clientName: string
  label: string
  description: string
  installmentNumber: number
  totalInstallments: number
  amount: number
  remainingAmount: number
  dueDate: string
  status: "PENDING" | "PAID" | "OVERDUE"
  interestAmount: number
  loanAmount: number
  totalReceivable: number
}

function getLocalToday() {
  return new Date(`${localDateStr()}T12:00:00`)
}

function toLocalDate(value: Date | string) {
  return new Date(`${localDateStr(value)}T12:00:00`)
}

export default function CalendarioPage() {
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [todayDate, setTodayDate] = useState<Date | null>(null)
  const [loans, setLoans] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = getLocalToday()
    setCurrentDate(today)
    setTodayDate(today)

    Promise.all([
      fetch("/api/loans").then(r => r.json()),
      fetch("/api/sales").then(r => r.json()).catch(() => []),
    ]).then(([loansData, salesData]) => {
      setLoans(Array.isArray(loansData) ? loansData : [])
      setSales(Array.isArray(salesData) ? salesData : [])
    }).finally(() => setLoading(false))
  }, [])

  const resolvedCurrentDate = currentDate ?? getLocalToday()
  const year = resolvedCurrentDate.getFullYear()
  const month = resolvedCurrentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  // Build unified entries
  const allEntries = useMemo<DueEntry[]>(() => {
    const entries: DueEntry[] = []
    const todayKey = localDateStr()

    // Loan installments
    loans.forEach((loan: any) => {
      const totalPaid = loan.installments?.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0) || 0
      const remaining = loan.totalAmount - totalPaid
      loan.installments?.forEach((inst: any) => {
        const isPaid = inst.status === "PAID"
        const isOverdue = !isPaid && localDateStr(inst.dueDate) < todayKey
        entries.push({
          id: inst.id,
          type: "loan",
          clientId: loan.client?.id || loan.clientId || loan.client?.name || inst.id,
          clientName: loan.client?.name || "—",
          label: `Empréstimo`,
          description: loan.notes || `Empréstimo de ${formatCurrency(loan.amount)}`,
          installmentNumber: inst.number,
          totalInstallments: loan.installmentCount,
          amount: inst.amount,
          remainingAmount: remaining > 0 ? remaining : 0,
          dueDate: inst.dueDate,
          status: isPaid ? "PAID" : isOverdue ? "OVERDUE" : "PENDING",
          interestAmount: loan.profit / loan.installmentCount,
          loanAmount: loan.amount,
          totalReceivable: loan.totalAmount,
        })
      })
    })

    // Sale installments
    sales.forEach((sale: any) => {
      const totalPaid = sale.saleInstallments?.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0) || 0
      const remaining = sale.totalAmount - totalPaid
      sale.saleInstallments?.forEach((inst: any) => {
        const isPaid = inst.status === "PAID"
        const isOverdue = !isPaid && localDateStr(inst.dueDate) < todayKey
        entries.push({
          id: inst.id,
          type: "sale",
          clientId: sale.client?.id || sale.clientId || sale.client?.name || inst.id,
          clientName: sale.client?.name || "—",
          label: `Venda`,
          description: sale.description || "Venda de produto",
          installmentNumber: inst.number,
          totalInstallments: sale.installmentCount,
          amount: inst.amount,
          remainingAmount: remaining > 0 ? remaining : 0,
          dueDate: inst.dueDate,
          status: isPaid ? "PAID" : isOverdue ? "OVERDUE" : "PENDING",
          interestAmount: 0,
          loanAmount: sale.amount || sale.totalAmount || 0,
          totalReceivable: sale.totalAmount || 0,
        })
      })
    })

    return entries
  }, [loans, sales])

  const monthStartKey = localDateStr(new Date(year, month, 1, 12))
  const monthEndKey = localDateStr(new Date(year, month, daysInMonth, 12))
  const isCurrentMonth = Boolean(
    todayDate &&
    month === todayDate.getMonth() &&
    year === todayDate.getFullYear()
  )

  const isCarriedOverdue = (entry: DueEntry) => (
    isCurrentMonth &&
    entry.status === "OVERDUE" &&
    localDateStr(entry.dueDate) < monthStartKey
  )

  const getEntriesForDay = (day: number) => {
    return allEntries.filter((e) => {
      if (isCarriedOverdue(e)) {
        return day === todayDate?.getDate()
      }

      const d = toLocalDate(e.dueDate)
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
    }).sort((a, b) => {
      if (a.status !== b.status) return a.status === "OVERDUE" ? -1 : 1
      return localDateStr(a.dueDate).localeCompare(localDateStr(b.dueDate))
    })
  }

  // Month stats
  const monthEntries = useMemo(() => {
    return allEntries.filter((e) => {
      if (isCarriedOverdue(e)) return true
      const key = localDateStr(e.dueDate)
      return key >= monthStartKey && key <= monthEndKey
    })
  }, [allEntries, monthStartKey, monthEndKey, isCurrentMonth])

  const aVencer = monthEntries.filter(e => e.status === "PENDING").length
  const vencidos = monthEntries.filter(e => e.status === "OVERDUE").length
  const totalNoMes = monthEntries.filter(e => e.status !== "PAID").reduce((s, e) => s + e.amount, 0)
  const clientesEmDia = useMemo(() => {
    const clients = new Map<string, { hasPending: boolean; hasOverdue: boolean }>()

    allEntries.forEach((entry) => {
      if (entry.status === "PAID") return

      const current = clients.get(entry.clientId) || { hasPending: false, hasOverdue: false }
      current.hasPending = current.hasPending || entry.status === "PENDING"
      current.hasOverdue = current.hasOverdue || entry.status === "OVERDUE"
      clients.set(entry.clientId, current)
    })

    return Array.from(clients.values()).filter((client) => client.hasPending && !client.hasOverdue).length
  }, [allEntries])

  const selectedEntries = selectedDay ? getEntriesForDay(selectedDay) : []

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => {
    const today = getLocalToday()
    setCurrentDate(today)
    setTodayDate(today)
    setSelectedDay(today.getDate())
  }

  const monthName = resolvedCurrentDate.toLocaleString("pt-BR", { month: "long", year: "numeric" })
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  // Color helpers
  const dotColor = (type: DueEntry["type"]) => {
    if (type === "loan") return "bg-amber-100 dark:bg-amber-900/40"
    if (type === "vehicle") return "bg-blue-100 dark:bg-blue-900/40"
    return "bg-primary/10 dark:bg-primary/20"
  }

  const statusInfo = (status: DueEntry["status"]) => {
    if (status === "PAID") return { label: "Pago", cls: "bg-primary/10 dark:bg-primary/20 text-primary border-primary/30" }
    if (status === "OVERDUE") return { label: "Vencido", cls: "bg-red-50 dark:bg-red-900/20 text-red-600 border-red-500/30" }
    return { label: "Pendente", cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-500/30" }
  }

  if (!currentDate || !todayDate) {
    return (
      <div className="space-y-8 pt-6 pb-12">
        <div className="pt-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Calendário de Vencimentos</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Carregando data local...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pt-6 pb-12">
      {/* ===== HEADER ===== */}
      <div className="pt-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Calendário de Vencimentos</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Visualize todos os vencimentos dos seus empréstimos</p>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/15 bg-primary/[0.03] dark:bg-primary/5">
          <CardContent className="p-5 flex items-start gap-3">
            <Clock className="h-5 w-5 text-gray-500 dark:text-zinc-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">A Vencer</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{aVencer}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/15 bg-primary/[0.03] dark:bg-primary/5">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Vencidos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{vencidos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/15 bg-primary/[0.03] dark:bg-primary/5">
          <CardContent className="p-5 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Clientes em dia</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{clientesEmDia}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/15 bg-primary/[0.03] dark:bg-primary/5">
          <CardContent className="p-5 flex items-start gap-3">
            <CalIcon className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Total no Mês</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(totalNoMes)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== CALENDAR + SIDE PANEL ===== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:items-start">
        {/* Calendar */}
        <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10 lg:col-span-3 min-w-0 overflow-hidden">
          <CardContent className="p-6">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CalIcon className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 capitalize">{monthName}</h2>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday} className="text-xs px-3 h-8">
                Hoje
              </Button>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Week headers */}
          <div className="grid gap-1.5 mb-2" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs text-gray-400 dark:text-zinc-500 py-2 font-medium">
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          {(() => {
            const prevMonthDays = new Date(year, month, 0).getDate()
            const totalCells = firstDayOfWeek + daysInMonth
            const trailingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)
            const todayKey = localDateStr()

            return (
              <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                {/* Prev month trailing days */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => {
                  const d = prevMonthDays - firstDayOfWeek + 1 + i
                  return (
                    <div key={`prev-${i}`} className="aspect-square rounded-xl border border-primary/10 bg-primary/[0.03] dark:bg-primary/5 p-2">
                      <span className="text-sm text-gray-300 dark:text-zinc-700">{d}</span>
                    </div>
                  )
                })}

                {/* Current month days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dayEntries = getEntriesForDay(day)
                  const isToday = day === todayDate.getDate() && month === todayDate.getMonth() && year === todayDate.getFullYear()
                  const isSelected = day === selectedDay
                  const overdueCount = dayEntries.filter(e => e.status === "OVERDUE").length
                  const dueTodayCount = dayEntries.filter(e => e.status === "PENDING" && localDateStr(e.dueDate) === todayKey).length
                  const pendingFutureCount = dayEntries.filter(e => e.status === "PENDING" && localDateStr(e.dueDate) > todayKey).length

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`relative aspect-square w-full rounded-xl p-2 text-left transition-all
                        ${isToday
                          ? "border-2 border-green-600 shadow-[inset_0_0_0_4px_white,inset_0_0_0_5px_#16a34a] dark:shadow-[inset_0_0_0_4px_#18181b,inset_0_0_0_5px_#16a34a] bg-white dark:bg-zinc-900"
                          : isSelected
                          ? "border border-primary/40 bg-primary/5 dark:bg-primary/10 dark:border-primary/30"
                          : "border border-primary/20 bg-primary/[0.03] dark:bg-primary/5 hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10"
                        }`}
                    >
                      <span className={`text-sm font-medium ${
                        isToday ? "text-green-500 dark:text-green-400 font-bold" : "text-gray-700 dark:text-zinc-300"
                      }`}>
                        {day}
                      </span>

                      {(overdueCount > 0 || dueTodayCount > 0 || pendingFutureCount > 0) && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
                          {overdueCount > 0 && (
                            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-sm">
                              {overdueCount}
                            </span>
                          )}
                          {dueTodayCount > 0 && (
                            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-sm">
                              {dueTodayCount}
                            </span>
                          )}
                          {pendingFutureCount > 0 && (
                            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white text-[10px] font-bold shadow-sm">
                              {pendingFutureCount}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}

                {/* Next month leading days */}
                {Array.from({ length: trailingCells }).map((_, i) => (
                  <div key={`next-${i}`} className="aspect-square rounded-xl border border-primary/10 bg-primary/[0.03] dark:bg-primary/5 p-2">
                    <span className="text-sm text-gray-300 dark:text-zinc-700">{i + 1}</span>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-5 text-xs text-gray-500 dark:text-zinc-400">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span>Em Dia</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Vence Hoje</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span>Vencido</span>
            </div>
          </div>
        </CardContent>
      </Card>

        {/* ===== SIDE PANEL - DAY DETAILS ===== */}
        <div className="lg:col-span-1 lg:self-stretch">
          <Card className="h-full border-primary/20 bg-primary/5 dark:bg-primary/10 overflow-hidden">
            <CardContent className="flex h-full min-h-0 flex-col p-5 overflow-hidden">
              {(() => {
                const dateText = selectedDay
                  ? new Date(year, month, selectedDay).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })
                  : ""
                const unpaidEntries = selectedEntries.filter(e => e.status !== "PAID")
                const totalCobrar = unpaidEntries.reduce((s, e) => s + e.amount, 0)
                const countLoans = unpaidEntries.filter(e => e.type === "loan").length
                const countSales = unpaidEntries.filter(e => e.type === "sale").length
                const countLabel = []
                if (countLoans > 0) countLabel.push(`${countLoans} empréstimo(s)`)
                if (countSales > 0) countLabel.push(`${countSales} venda(s)`)

                if (!selectedDay) {
                  return (
                    <div className="flex flex-1 flex-col items-center justify-center text-gray-400 dark:text-zinc-500">
                      <CalIcon className="h-10 w-10 mb-3" />
                      <p className="text-sm">Clique em uma data</p>
                      <p className="text-xs">para ver os vencimentos</p>
                    </div>
                  )
                }

                if (selectedEntries.length === 0 || unpaidEntries.length === 0) {
                  return (
                    <div className="flex h-full flex-col space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 capitalize">{dateText}</h3>
                      </div>
                      <div className="flex flex-1 flex-col items-center justify-center text-gray-400 dark:text-zinc-500">
                        <CalIcon className="h-10 w-10 mb-3" />
                        <p className="text-sm">Nenhum vencimento neste dia</p>
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="flex h-full min-h-0 flex-col space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 capitalize">{dateText}</h3>
                      <Badge className="bg-primary/10 dark:bg-primary/20 text-primary border-primary/30 text-xs">
                        {unpaidEntries.length} cobrança{unpaidEntries.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {/* Total a cobrar */}
                    <div className="mr-2 rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-gray-700 dark:text-zinc-300">Total a cobrar no dia</span>
                          {countLabel.length > 0 && (
                            <p className="text-xs text-primary/70 mt-0.5">
                              {unpaidEntries.length} parcela{unpaidEntries.length !== 1 ? "s" : ""} • {countLabel.join(" • ")}
                            </p>
                          )}
                        </div>
                        <span className="text-xl font-bold text-primary">{formatCurrency(totalCobrar)}</span>
                      </div>
                    </div>

                    {/* Entry cards */}
                    <div className="flex-1 space-y-3 overflow-y-auto pr-2 min-h-0 max-h-[430px] lg:max-h-[520px] [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:#94a3b8_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[scrollbar-color:#52525b_transparent] dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
                      {unpaidEntries.map((entry) => {
                        const status = statusInfo(entry.status)
                        const typeIcon = entry.type === "loan"
                          ? <Wallet className="h-4 w-4 text-amber-600" />
                          : entry.type === "vehicle"
                          ? <Car className="h-4 w-4 text-blue-600" />
                          : <ShoppingBag className="h-4 w-4 text-primary" />

                        // Tom do card por status: vencido=vermelho, vence hoje=âmbar, em dia=azul (bem fraco)
                        const dueD = toLocalDate(entry.dueDate)
                        const isOverdue = entry.status === "OVERDUE"
                        const isDueToday = !isOverdue && !!todayDate && dueD.getFullYear() === todayDate.getFullYear() && dueD.getMonth() === todayDate.getMonth() && dueD.getDate() === todayDate.getDate()
                        const entryTone = isOverdue
                          ? "border-red-300/50 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/20"
                          : isDueToday
                          ? "border-amber-300/50 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20"
                          : "border-blue-300/50 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20"

                        return (
                          <div key={entry.id} className={`rounded-xl border p-4 space-y-2.5 ${entryTone}`}>
                            {/* Top row */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                  {typeIcon}
                                </div>
                                <span className="font-bold text-gray-900 dark:text-zinc-100 text-sm uppercase tracking-wide">{entry.clientName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={status.cls}>{status.label}</Badge>
                                <span className="text-sm font-semibold text-primary">
                                  {entry.installmentNumber}/{entry.totalInstallments}
                                </span>
                              </div>
                            </div>

                            {/* Detail rows */}
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-zinc-400">Parcela:</span>
                                <span className="font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(entry.amount)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-zinc-400">Vencimento:</span>
                                <span className={entry.status === "OVERDUE" ? "font-medium text-red-600 dark:text-red-400" : "font-medium text-gray-900 dark:text-zinc-100"}>
                                  {toLocalDate(entry.dueDate).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                              {entry.interestAmount > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-500 dark:text-zinc-400">Só Juros:</span>
                                  <span className="font-medium text-primary">{formatCurrency(entry.interestAmount)}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-zinc-400">Emprestado:</span>
                                <span className="font-medium text-gray-900 dark:text-zinc-100">{formatCurrency(entry.loanAmount)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-zinc-400">Total a Receber:</span>
                                <span className="font-bold text-primary">{formatCurrency(entry.totalReceivable)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

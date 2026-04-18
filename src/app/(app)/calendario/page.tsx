"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon,
  Clock, AlertTriangle, Wallet, Car, ShoppingBag
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

// Type for a unified due-date entry
interface DueEntry {
  id: string
  type: "loan" | "vehicle" | "sale"
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

export default function CalendarioPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loans, setLoans] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/loans").then(r => r.json()),
      fetch("/api/sales").then(r => r.json()).catch(() => []),
    ]).then(([loansData, salesData]) => {
      setLoans(Array.isArray(loansData) ? loansData : [])
      setSales(Array.isArray(salesData) ? salesData : [])
    }).finally(() => setLoading(false))
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const todayDate = new Date()

  // Build unified entries
  const allEntries = useMemo<DueEntry[]>(() => {
    const entries: DueEntry[] = []
    const now = new Date()

    // Loan installments
    loans.forEach((loan: any) => {
      const totalPaid = loan.installments?.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0) || 0
      const remaining = loan.totalAmount - totalPaid
      loan.installments?.forEach((inst: any) => {
        const isPaid = inst.status === "PAID"
        const isOverdue = !isPaid && new Date(inst.dueDate) < now
        entries.push({
          id: inst.id,
          type: "loan",
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
        const isOverdue = !isPaid && new Date(inst.dueDate) < now
        entries.push({
          id: inst.id,
          type: "sale",
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

  const getEntriesForDay = (day: number) => {
    return allEntries.filter((e) => {
      const d = new Date(e.dueDate)
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
    })
  }

  // Month stats
  const monthEntries = useMemo(() => {
    return allEntries.filter((e) => {
      const d = new Date(e.dueDate)
      return d.getMonth() === month && d.getFullYear() === year
    })
  }, [allEntries, month, year])

  const aVencer = monthEntries.filter(e => e.status === "PENDING").length
  const vencidos = monthEntries.filter(e => e.status === "OVERDUE").length
  const totalNoMes = monthEntries.filter(e => e.status !== "PAID").reduce((s, e) => s + e.amount, 0)

  const selectedEntries = selectedDay ? getEntriesForDay(selectedDay) : []

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date().getDate()) }

  const monthName = currentDate.toLocaleString("pt-BR", { month: "long", year: "numeric" })
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  // Color helpers
  const dotColor = (type: DueEntry["type"]) => {
    if (type === "loan") return "bg-amber-100 dark:bg-amber-900/40"
    if (type === "vehicle") return "bg-blue-100 dark:bg-blue-900/40"
    return "bg-emerald-100 dark:bg-emerald-900/40"
  }

  const statusInfo = (status: DueEntry["status"]) => {
    if (status === "PAID") return { label: "Pago", cls: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-500/30" }
    if (status === "OVERDUE") return { label: "Vencido", cls: "bg-red-50 dark:bg-red-900/20 text-red-600 border-red-500/30" }
    return { label: "Pendente", cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-500/30" }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ===== HEADER ===== */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Calendário de Vencimentos</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Visualize todos os vencimentos dos seus empréstimos</p>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-gray-200 dark:border-zinc-800">
          <CardContent className="p-5 flex items-start gap-3">
            <Clock className="h-5 w-5 text-gray-500 dark:text-zinc-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">A Vencer</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{aVencer}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-zinc-800">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Vencidos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{vencidos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-5 flex items-start gap-3">
            <CalIcon className="h-5 w-5 text-emerald-600 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Total no Mês</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(totalNoMes)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== CALENDAR + SIDE PANEL ===== */}
      <div className="flex gap-6 items-start">
        {/* Calendar */}
        <Card className="border-gray-200 dark:border-zinc-800 flex-1 min-w-0">
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
          <div className="grid grid-cols-7">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs text-gray-400 dark:text-zinc-500 py-3 font-medium border-b border-gray-200 dark:border-zinc-800">
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before 1st */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="border-b border-r border-gray-200 dark:border-zinc-800/50 min-h-[80px]" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayEntries = getEntriesForDay(day)
              const isToday = day === todayDate.getDate() && month === todayDate.getMonth() && year === todayDate.getFullYear()
              const isSelected = day === selectedDay
              const hasOverdue = dayEntries.some(e => e.status === "OVERDUE")
              const hasPending = dayEntries.some(e => e.status === "PENDING")

              // Determine which types are present
              const types = new Set(dayEntries.map(e => e.type))
              const hasOverdueEntry = dayEntries.some(e => e.status === "OVERDUE")

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`relative min-h-[80px] p-2 text-left transition-all border-b border-r border-gray-200 dark:border-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 ${
                    isToday ? "bg-emerald-50 dark:bg-emerald-950/20 ring-2 ring-emerald-500 ring-inset rounded-lg z-10"
                    : isSelected ? "bg-gray-100 dark:bg-zinc-800/40"
                    : "dark:bg-zinc-800/30"
                  }`}
                >
                  <span className={`text-sm ${
                    isToday ? "text-emerald-600 font-bold" : "text-gray-700 dark:text-zinc-300"
                  }`}>
                    {day}
                  </span>

                  {/* Dots for entries */}
                  {dayEntries.length > 0 && (
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
                      {dayEntries.filter(e => e.status !== "PAID").length > 0 && (
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-sm">
                          {dayEntries.filter(e => e.status !== "PAID").length}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}

            {/* Fill remaining cells to complete last row */}
            {(() => {
              const totalCells = firstDayOfWeek + daysInMonth
              const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)
              return Array.from({ length: remaining }).map((_, i) => (
                <div key={`trail-${i}`} className="border-b border-r border-gray-200 dark:border-zinc-800/50 min-h-[80px]" />
              ))
            })()}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-5 text-xs text-gray-500 dark:text-zinc-400">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Empréstimo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span>Veículo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Produto</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span>Vencido</span>
            </div>
          </div>
        </CardContent>
      </Card>

        {/* ===== SIDE PANEL - DAY DETAILS ===== */}
        <div className="w-[380px] shrink-0 sticky top-6">
          <Card className="border-gray-200 dark:border-zinc-800">
            <CardContent className="p-5">
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
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-zinc-500">
                      <CalIcon className="h-10 w-10 mb-3" />
                      <p className="text-sm">Clique em uma data</p>
                      <p className="text-xs">para ver os vencimentos</p>
                    </div>
                  )
                }

                if (selectedEntries.length === 0 || unpaidEntries.length === 0) {
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 capitalize">{dateText}</h3>
                      </div>
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-zinc-500">
                        <CalIcon className="h-10 w-10 mb-3" />
                        <p className="text-sm">Nenhum vencimento neste dia</p>
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 capitalize">{dateText}</h3>
                      <Badge className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-500/30 text-xs">
                        {unpaidEntries.length} cobrança{unpaidEntries.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {/* Total a cobrar */}
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/10 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-gray-700 dark:text-zinc-300">Total a cobrar no dia</span>
                          {countLabel.length > 0 && (
                            <p className="text-xs text-emerald-600/70 mt-0.5">
                              {unpaidEntries.length} parcela{unpaidEntries.length !== 1 ? "s" : ""} • {countLabel.join(" • ")}
                            </p>
                          )}
                        </div>
                        <span className="text-xl font-bold text-emerald-600">{formatCurrency(totalCobrar)}</span>
                      </div>
                    </div>

                    {/* Entry cards */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {unpaidEntries.map((entry) => {
                        const typeIcon = entry.type === "loan"
                          ? <Wallet className="h-4 w-4 text-amber-600" />
                          : entry.type === "vehicle"
                          ? <Car className="h-4 w-4 text-blue-600" />
                          : <ShoppingBag className="h-4 w-4 text-emerald-600" />

                        return (
                          <div key={entry.id} className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 p-4 space-y-2.5">
                            {/* Top row */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                  {typeIcon}
                                </div>
                                <span className="font-bold text-gray-900 dark:text-zinc-100 text-sm uppercase tracking-wide">{entry.clientName}</span>
                              </div>
                              <span className="text-sm font-semibold text-emerald-600">
                                {entry.installmentNumber}/{entry.totalInstallments}
                              </span>
                            </div>

                            {/* Detail rows */}
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-zinc-400">Parcela:</span>
                                <span className="font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(entry.amount)}</span>
                              </div>
                              {entry.interestAmount > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-500 dark:text-zinc-400">Só Juros:</span>
                                  <span className="font-medium text-emerald-600">{formatCurrency(entry.interestAmount)}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-zinc-400">Emprestado:</span>
                                <span className="font-medium text-gray-900 dark:text-zinc-100">{formatCurrency(entry.loanAmount)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-zinc-400">Total a Receber:</span>
                                <span className="font-bold text-emerald-600">{formatCurrency(entry.totalReceivable)}</span>
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
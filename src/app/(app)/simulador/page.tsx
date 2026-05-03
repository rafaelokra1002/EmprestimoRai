"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, localDateStr } from "@/lib/utils"
import {
  Calculator, Calendar, ChevronDown, TrendingUp,
  FileDown, GitCompareArrows
} from "lucide-react"

type PaymentType = "MONTHLY" | "BIWEEKLY" | "WEEKLY" | "DAILY"
type InterestMode = "PER_INSTALLMENT" | "COMPOUND" | "SIMPLE"

interface Installment {
  number: number
  dueDate: Date
  amount: number
}

export default function SimuladorPage() {
  const [paymentType, setPaymentType] = useState<PaymentType>("MONTHLY")
  const [interestMode, setInterestMode] = useState<InterestMode>("PER_INSTALLMENT")
  const [installmentCount, setInstallmentCount] = useState(6)
  const [startDate, setStartDate] = useState(() => {
    return localDateStr()
  })
  const [firstDueDate, setFirstDueDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return localDateStr(d)
  })
  const [valor, setValor] = useState(1000)
  const [taxa, setTaxa] = useState(10)
  const [showCompare, setShowCompare] = useState(false)

  // ===== CALCULATION =====
  const result = useMemo(() => {
    const amount = valor
    const rate = taxa / 100
    const count = Math.max(1, installmentCount)

    let totalInterest = 0
    let totalAmount = 0
    let installmentValue = 0

    if (interestMode === "PER_INSTALLMENT") {
      // Interest applied per installment: total = principal * (1 + rate * count)
      totalInterest = amount * rate * count
      totalAmount = amount + totalInterest
      installmentValue = totalAmount / count
    } else if (interestMode === "COMPOUND") {
      // Compound: totalAmount = principal * (1 + rate)^count
      totalAmount = amount * Math.pow(1 + rate, count)
      totalInterest = totalAmount - amount
      installmentValue = totalAmount / count
    } else {
      // Simple: total = principal * (1 + rate * count)
      totalInterest = amount * rate * count
      totalAmount = amount + totalInterest
      installmentValue = totalAmount / count
    }

    const effectiveRate = amount > 0 ? ((totalAmount - amount) / amount) * 100 : 0

    return {
      installmentValue: Math.round(installmentValue * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 10) / 10,
    }
  }, [valor, taxa, installmentCount, interestMode])

  // ===== COMPARE MODES =====
  const compareResults = useMemo(() => {
    const amount = valor
    const rate = taxa / 100
    const count = Math.max(1, installmentCount)

    const perInst = amount * rate * count
    const perInstTotal = amount + perInst

    const compound = amount * Math.pow(1 + rate, count) - amount
    const compoundTotal = amount + compound

    const simple = amount * rate * count
    const simpleTotal = amount + simple

    return [
      { label: "Por Parcela", interest: perInst, total: perInstTotal, installment: perInstTotal / count },
      { label: "Juros Compostos", interest: compound, total: compoundTotal, installment: compoundTotal / count },
      { label: "Juros Simples", interest: simple, total: simpleTotal, installment: simpleTotal / count },
    ]
  }, [valor, taxa, installmentCount])

  // ===== INSTALLMENT SCHEDULE =====
  const schedule = useMemo(() => {
    const count = Math.max(1, installmentCount)
    const base = firstDueDate ? new Date(firstDueDate + "T12:00:00") : new Date()
    const installments: Installment[] = []

    for (let i = 0; i < count; i++) {
      const dueDate = new Date(base)
      if (paymentType === "MONTHLY") dueDate.setMonth(dueDate.getMonth() + i)
      else if (paymentType === "BIWEEKLY") dueDate.setDate(dueDate.getDate() + i * 15)
      else if (paymentType === "WEEKLY") dueDate.setDate(dueDate.getDate() + i * 7)
      else dueDate.setDate(dueDate.getDate() + i)

      installments.push({
        number: i + 1,
        dueDate,
        amount: result.installmentValue,
      })
    }
    return installments
  }, [installmentCount, firstDueDate, paymentType, result.installmentValue])

  const paymentOptions: { value: PaymentType; label: string }[] = [
    { value: "MONTHLY", label: "Parcelado (Mensal)" },
    { value: "BIWEEKLY", label: "Parcelado (Quinzenal)" },
    { value: "WEEKLY", label: "Parcelado (Semanal)" },
    { value: "DAILY", label: "Parcelado (Diário)" },
  ]

  const interestOptions: { value: InterestMode; label: string }[] = [
    { value: "PER_INSTALLMENT", label: "Por Parcela" },
    { value: "COMPOUND", label: "Juros Compostos" },
    { value: "SIMPLE", label: "Juros Simples" },
  ]


  const formatDateBR = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })

  return (
    <div className="space-y-4 pt-4 pb-8 max-w-2xl">
      {/* ===== HEADER ===== */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" /> Simulador de Empréstimo
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Simule empréstimos antes de criar</p>
      </div>

      {/* ===== MAIN CARD ===== */}
      <div className="rounded-xl border border-primary/30 bg-white dark:bg-zinc-900 p-4 space-y-3">

        {/* Row 1: Tipo de Pagamento + Modo de Juros + Nº Parcelas */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">Tipo de Pagamento</Label>
            <div className="relative mt-1">
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                className="flex h-9 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 text-sm text-gray-900 dark:text-zinc-100 appearance-none pr-8"
              >
                {paymentOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">Modo de Juros</Label>
            <div className="relative mt-1">
              <select
                value={interestMode}
                onChange={(e) => setInterestMode(e.target.value as InterestMode)}
                className="flex h-9 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 text-sm text-gray-900 dark:text-zinc-100 appearance-none pr-8"
              >
                {interestOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">Nº de Parcelas</Label>
            <Input
              type="number"
              min={1}
              max={360}
              value={installmentCount}
              onChange={(e) => setInstallmentCount(parseInt(e.target.value) || 1)}
              className="mt-1 h-9 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-sm"
            />
          </div>
        </div>

        {/* Row 2: Valor + Taxa + Data Início + Primeiro Vencimento */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 flex items-center gap-1">
              <span className="text-primary text-xs">$</span> Valor
            </Label>
            <Input
              type="number"
              step="100"
              min={100}
              max={100000}
              value={valor}
              onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
              className="mt-1 h-9 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-sm font-medium"
            />
            <input
              type="range"
              min={100}
              max={100000}
              step={100}
              value={valor}
              onChange={(e) => setValor(parseFloat(e.target.value))}
              className="w-full mt-1.5 h-1 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-green-500"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 flex items-center gap-1">
              <span className="text-primary text-xs">%</span> Taxa de Juros
            </Label>
            <Input
              type="number"
              step="0.5"
              min={0}
              max={100}
              value={taxa}
              onChange={(e) => setTaxa(parseFloat(e.target.value) || 0)}
              className="mt-1 h-9 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-sm font-medium"
            />
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={taxa}
              onChange={(e) => setTaxa(parseFloat(e.target.value))}
              className="w-full mt-1.5 h-1 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-green-500"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">Data de Início</Label>
            <div className="relative mt-1">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 pl-8 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">1º Vencimento</Label>
            <div className="relative mt-1">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <Input
                type="date"
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
                className="h-9 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 pl-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* ===== RESULT CARDS ===== */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-[11px] text-amber-600 font-medium">Valor da Parcela</p>
            <p className="text-lg font-bold tabular-nums tracking-tight text-primary mt-0.5">{formatCurrency(result.installmentValue)}</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-[11px] text-amber-600 font-medium">Total de Juros</p>
            <p className="text-lg font-bold tabular-nums tracking-tight text-primary mt-0.5">{formatCurrency(result.totalInterest)}</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-[11px] text-amber-600 font-medium">Total a Receber</p>
            <p className="text-lg font-bold tabular-nums tracking-tight text-primary mt-0.5">{formatCurrency(result.totalAmount)}</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-[11px] text-amber-600 font-medium">Taxa Efetiva Total</p>
            <p className="text-lg font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100 mt-0.5">{result.effectiveRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* ===== COMPARE BUTTON ===== */}
        <button
          onClick={() => setShowCompare(!showCompare)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-xs font-medium text-gray-600 dark:text-zinc-400 transition-all"
        >
          <GitCompareArrows className="h-3.5 w-3.5" />
          Comparar Modos de Juros
        </button>

        {/* Compare panel */}
        {showCompare && (
          <div className="space-y-2">
            {compareResults.map((cr) => (
              <div
                key={cr.label}
                className={`rounded-xl border p-4 ${
                  cr.label ===
                    (interestMode === "PER_INSTALLMENT" ? "Por Parcela" :
                     interestMode === "COMPOUND" ? "Juros Compostos" : "Juros Simples")
                    ? "border-primary/40 bg-primary/5 dark:bg-primary/150/5"
                    : "border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800 dark:text-zinc-200">{cr.label}</span>
                  {cr.label ===
                    (interestMode === "PER_INSTALLMENT" ? "Por Parcela" :
                     interestMode === "COMPOUND" ? "Juros Compostos" : "Juros Simples") && (
                    <Badge className="bg-primary/5 dark:bg-primary/150/20 text-primary border-primary/30 text-[10px]">
                      Selecionado
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
                  <div>
                    <p className="text-gray-400 dark:text-zinc-500">Parcela</p>
                    <p className="text-gray-800 dark:text-zinc-200 font-medium">{formatCurrency(Math.round(cr.installment * 100) / 100)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 dark:text-zinc-500">Juros Total</p>
                    <p className="text-amber-600 font-medium">{formatCurrency(Math.round(cr.interest * 100) / 100)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 dark:text-zinc-500">Total</p>
                    <p className="text-primary font-medium">{formatCurrency(Math.round(cr.total * 100) / 100)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== CRONOGRAMA DE PARCELAS ===== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100">Cronograma de Parcelas</h2>
            <Badge className="bg-primary/5 text-primary border-primary/30 text-[10px] px-2 py-0.5 ml-1">
              {installmentCount}x de {formatCurrency(result.installmentValue)}
            </Badge>
          </div>
          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-gray-600 dark:text-zinc-400 hover:bg-gray-50 transition">
            <FileDown className="h-3 w-3" /> Exportar PDF
          </button>
        </div>

        <div className="rounded-xl border border-primary/30 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="grid grid-cols-3 px-4 py-2 border-b border-gray-100 dark:border-zinc-800 text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
            <span>Parcela</span>
            <span>Vencimento</span>
            <span className="text-right">Valor</span>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {schedule.map((inst) => (
              <div
                key={inst.number}
                className="grid grid-cols-3 px-4 py-2 border-b border-gray-100 dark:border-zinc-800/60 last:border-0 items-center hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary/5 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {inst.number}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500">/{installmentCount}</span>
                </div>
                <span className="text-xs text-gray-700 dark:text-zinc-300">{formatDateBR(inst.dueDate)}</span>
                <span className="text-xs font-semibold text-primary text-right">
                  {formatCurrency(inst.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

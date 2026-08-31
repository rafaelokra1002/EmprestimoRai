"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, localDateStr } from "@/lib/utils"
import { showToast } from "@/lib/toast"
import {
  ChevronDown, Copy, Send, Phone, Loader2, CheckCircle2,
  Calculator, Calendar, DollarSign, Percent, ArrowUpDown, TrendingUp, Receipt, Zap
} from "lucide-react"

// Fonte da referência (Segoe UI no Windows, com fallbacks)
const refFont = "'Segoe UI', system-ui, -apple-system, sans-serif"

type PaymentType = "UNICO" | "MONTHLY" | "WEEKLY" | "BIWEEKLY" | "DAILY"
type InterestMode = "PER_INSTALLMENT" | "OVER_TOTAL" | "COMPOUND" | "PRICE" | "SAC"

interface Installment {
  number: number
  dueDate: Date
  amount: number
}

const paymentOptions: { value: PaymentType; label: string }[] = [
  { value: "UNICO", label: "Pagamento Único" },
  { value: "MONTHLY", label: "Parcelado (Mensal)" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quinzenal" },
  { value: "DAILY", label: "Diário" },
]

const interestOptions: { value: InterestMode; label: string }[] = [
  { value: "PER_INSTALLMENT", label: "Por Parcela" },
  { value: "OVER_TOTAL", label: "Sobre o Total" },
  { value: "COMPOUND", label: "Juros Compostos Puro" },
  { value: "PRICE", label: "Tabela Price" },
  { value: "SAC", label: "SAC (Amort. Constante)" },
]

const modeNames: Record<InterestMode, string> = {
  PER_INSTALLMENT: "Por Parcela",
  OVER_TOTAL: "Sobre o Total",
  COMPOUND: "Juros Compostos Puro",
  PRICE: "Tabela Price",
  SAC: "SAC",
}

// Selo colorido por modo (mesmos tons da referência)
const modeBadge: Record<InterestMode, { bg: string; c: string }> = {
  PER_INSTALLMENT: { bg: "#dcfce7", c: "#15803d" },
  OVER_TOTAL: { bg: "#fef9c3", c: "#a16207" },
  COMPOUND: { bg: "#f3e8ff", c: "#7c3aed" },
  PRICE: { bg: "#dbeafe", c: "#1d4ed8" },
  SAC: { bg: "#d1fae5", c: "#047857" },
}

// Cálculo central — portado fielmente da referência (calc)
function calcMode(P: number, ratePct: number, n: number, mode: InterestMode) {
  const r = ratePct / 100
  let sched: number[] = []
  let total = 0
  let interest = 0
  if (mode === "PER_INSTALLMENT") {
    interest = P * r * n; total = P + interest; sched = Array(n).fill(total / n)
  } else if (mode === "OVER_TOTAL") {
    interest = P * r; total = P + interest; sched = Array(n).fill(total / n)
  } else if (mode === "COMPOUND") {
    total = P * Math.pow(1 + r, n); interest = total - P; sched = Array(n).fill(total / n)
  } else if (mode === "PRICE") {
    const pmt = r === 0 ? P / n : (P * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1)
    sched = Array(n).fill(pmt); total = pmt * n; interest = total - P
  } else {
    // SAC — amortização constante (parcelas decrescentes)
    const a = P / n
    let bal = P
    for (let i = 0; i < n; i++) { sched.push(a + bal * r); bal -= a }
    total = sched.reduce((x, y) => x + y, 0); interest = total - P
  }
  const tet = P > 0 ? (interest / P) * 100 : 0
  return { sched, total, interest, tet, variable: mode === "SAC" }
}

export default function SimuladorPage() {
  const [paymentType, setPaymentType] = useState<PaymentType>("MONTHLY")
  const [interestMode, setInterestMode] = useState<InterestMode>("PER_INSTALLMENT")
  const [installmentCount, setInstallmentCount] = useState("6")
  const [startDate, setStartDate] = useState(() => localDateStr())
  const [firstDueDate, setFirstDueDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return localDateStr(d)
  })
  const [valor, setValor] = useState("1000")
  const [taxa, setTaxa] = useState("10")
  const [showCompare, setShowCompare] = useState(false)
  const [clientPhone, setClientPhone] = useState("")
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<"ok" | "error" | null>(null)

  const isSingle = paymentType === "UNICO"
  const count = isSingle ? 1 : Math.max(1, parseInt(installmentCount) || 1)

  // ===== CÁLCULO PRINCIPAL =====
  const result = useMemo(() => {
    const amount = Math.max(0, parseFloat(valor) || 0)
    const rate = Math.max(0, parseFloat(taxa) || 0)
    const R = calcMode(amount, rate, count, interestMode)
    return {
      sched: R.sched.map((v) => Math.round(v * 100) / 100),
      installmentValue: Math.round((R.sched[0] || 0) * 100) / 100,
      totalInterest: Math.round(R.interest * 100) / 100,
      totalAmount: Math.round(R.total * 100) / 100,
      effectiveRate: Math.round(R.tet * 10) / 10,
      variable: R.variable,
    }
  }, [valor, taxa, count, interestMode])

  // ===== COMPARATIVO (5 modos) =====
  const compareResults = useMemo(() => {
    const amount = Math.max(0, parseFloat(valor) || 0)
    const rate = Math.max(0, parseFloat(taxa) || 0)
    return interestOptions.map((o) => {
      const R = calcMode(amount, rate, count, o.value)
      return {
        mode: o.value,
        label: modeNames[o.value],
        badge: modeBadge[o.value],
        interest: R.interest,
        total: R.total,
        installment: R.sched[0] || 0,
        variable: R.variable,
      }
    })
  }, [valor, taxa, count])

  // ===== CRONOGRAMA =====
  const schedule = useMemo(() => {
    const base = firstDueDate ? new Date(firstDueDate + "T12:00:00") : new Date()
    const installments: Installment[] = []
    for (let i = 0; i < count; i++) {
      const dueDate = new Date(base)
      if (paymentType === "MONTHLY" || paymentType === "UNICO") dueDate.setMonth(dueDate.getMonth() + i)
      else if (paymentType === "BIWEEKLY") dueDate.setDate(dueDate.getDate() + i * 15)
      else if (paymentType === "WEEKLY") dueDate.setDate(dueDate.getDate() + i * 7)
      else dueDate.setDate(dueDate.getDate() + i)
      installments.push({ number: i + 1, dueDate, amount: result.sched[i] ?? result.installmentValue })
    }
    return installments
  }, [count, firstDueDate, paymentType, result.sched, result.installmentValue])

  // Cor do card "Valor da Parcela" conforme o modo (roxo=compostos, azul=price, resto=verde)
  const parcelaCardCls =
    interestMode === "COMPOUND"
      ? "border-[#7c3aed]/30 bg-[#f5f0ff] dark:bg-[#1e153a]"
      : interestMode === "PRICE"
        ? "border-[#0ea5e9]/30 bg-[#eff8ff] dark:bg-[#0c2438]"
        : "border-primary/30 bg-primary/5 dark:bg-primary/10"
  const parcelaValueCls =
    interestMode === "COMPOUND"
      ? "text-[#7c3aed] dark:text-[#a78bfa]"
      : interestMode === "PRICE"
        ? "text-[#0ea5e9] dark:text-[#38bdf8]"
        : "text-primary"
  const parcelaLabel = result.variable && count > 1 ? "1ª Parcela" : "Valor da Parcela"

  const formatDateBR = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })

  const buildSimulationText = () => {
    const numEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]
    const fmtShort = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
    const firstVenc = schedule.length > 0 ? fmtShort(schedule[0].dueDate) : "-"

    if (count === 1) {
      const fmtFull = (d: Date) =>
        `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
      const venc = schedule.length > 0 ? fmtFull(schedule[0].dueDate) : "-"
      return `📄 RELATÓRIO DE PAGAMENTO\n\n📅 Vencimento: ${venc}\n\n💰 Valor liberado: ${formatCurrency(parseFloat(valor) || 0)}\n📊 Juros: ${taxa}%\n👉 Total a pagar: ${formatCurrency(result.totalAmount)}\n\n⚠️ Multa por atraso:\nR$ 15,00 por dia.\n\n🔄 Opção de renovação\nPague os juros (${formatCurrency(result.totalInterest)})\ne receba +30 dias de prazo.`
    }

    const paymentLines = schedule.map((i, idx) => {
      const emoji = numEmojis[idx] || `${i.number}.`
      return `${emoji} ${fmtShort(i.dueDate)} — ${formatCurrency(i.amount)}`
    }).join("\n")
    const parcelaResumo = result.variable
      ? `${installmentCount}x (parcelas variáveis, 1ª de ${formatCurrency(result.installmentValue)})`
      : `${installmentCount}x de ${formatCurrency(result.installmentValue)}`
    return `📊 RELATÓRIO DE EMPRÉSTIMO\n\n💰 Valor: ${formatCurrency(parseFloat(valor) || 0)}\n📄 ${parcelaResumo}\n📈 Juros: ${taxa}% ${modeNames[interestMode].toLowerCase()}\n\n📅 1º pagamento: ${firstVenc}\n\n💵 Total de juros: ${formatCurrency(result.totalInterest)}\n💵 Total a pagar: ${formatCurrency(result.totalAmount)}\n\n______________\n📋 PAGAMENTOS\n\n${paymentLines}\n\n⚠️ Multa por atraso: R$ 15,00 ao dia.`
  }

  const selectedCompareLabel = modeNames[interestMode]

  return (
    <div className="space-y-4 pt-0 pb-8 w-full" style={{ fontFamily: refFont }}>
      {/* ===== HEADER ===== */}
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-gray-900 dark:text-zinc-100">Simulador de Empréstimo</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Simule empréstimos antes de criar</p>
      </div>

      {/* ===== MAIN CARD ===== */}
      <div className="rounded-2xl border border-primary/40 bg-white dark:bg-zinc-900 p-6 space-y-5">

        {/* Card header */}
        <div className="flex items-center gap-2.5 pb-1">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#dcfce7] dark:bg-[#0f2a1c]"><Calculator className="h-4 w-4 text-[#16a34a]" /></span>
          <h2 className="text-[19px] font-bold text-gray-900 dark:text-zinc-100">Simulador de Empréstimo</h2>
        </div>

        {/* Row 1: Tipo / Modo / Nº Parcelas / Data Início / Primeiro Vencimento */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Tipo de Pagamento</Label>
            <div className="relative mt-1.5">
              <select
                value={paymentType}
                onChange={(e) => {
                  const t = e.target.value as PaymentType
                  setPaymentType(t)
                  if (t === "UNICO") setInstallmentCount("1")
                }}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 appearance-none pr-8"
              >
                {paymentOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Modo de Juros</Label>
            <div className="relative mt-1.5">
              <select
                value={interestMode}
                onChange={(e) => setInterestMode(e.target.value as InterestMode)}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 appearance-none pr-8"
              >
                {interestOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Nº de Parcelas</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={isSingle ? "1" : installmentCount}
              disabled={isSingle}
              onChange={(e) => { const v = e.target.value; if (/^\d*$/.test(v)) setInstallmentCount(v) }}
              className="mt-1.5 h-11 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Data de Início</Label>
            <div className="relative mt-1.5 flex h-11 items-center gap-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 text-sm text-gray-900 dark:text-zinc-100">
              <Calendar className="h-4 w-4 shrink-0 text-gray-500 dark:text-zinc-400" />
              <span>{startDate ? formatDateBR(new Date(startDate + "T12:00:00")) : "--/--/----"}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Primeiro Vencimento</Label>
            <div className="relative mt-1.5 flex h-11 items-center gap-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 text-sm text-gray-900 dark:text-zinc-100">
              <Calendar className="h-4 w-4 shrink-0 text-gray-500 dark:text-zinc-400" />
              <span>{firstDueDate ? formatDateBR(new Date(firstDueDate + "T12:00:00")) : "--/--/----"}</span>
              <input
                type="date"
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">Próximas parcelas calculadas a partir desta data</p>
          </div>
        </div>

        {/* Row 2: Valor + Taxa */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-[13px] font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-gray-500 dark:text-zinc-400" /> Valor do Empréstimo
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => { const v = e.target.value; if (/^\d*[,.]?\d*$/.test(v)) setValor(v.replace(",", ".")) }}
              className="mt-1.5 h-11 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-sm font-medium"
            />
            <input
              type="range"
              min={100}
              max={100000}
              step={100}
              value={parseFloat(valor) || 100}
              onChange={(e) => setValor(e.target.value)}
              className="w-full mt-2 h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-green-500"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">R$ 100 - R$ 100.000</p>
          </div>
          <div>
            <Label className="text-[13px] font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-gray-500 dark:text-zinc-400" /> Taxa de Juros (%)
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              value={taxa}
              onChange={(e) => { const v = e.target.value; if (/^\d*[,.]?\d*$/.test(v)) setTaxa(v.replace(",", ".")) }}
              className="mt-1.5 h-11 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-sm font-medium"
            />
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={parseFloat(taxa) || 0}
              onChange={(e) => setTaxa(e.target.value)}
              className="w-full mt-2 h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-green-500"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">Sem limite máximo</p>
          </div>
        </div>

        {/* ===== RESULT CARDS ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className={`rounded-xl border p-4 ${parcelaCardCls}`}>
            <p className="text-xs text-gray-500 dark:text-zinc-400">{parcelaLabel}</p>
            <p className={`text-2xl font-bold tabular-nums tracking-tight mt-1 ${parcelaValueCls}`}>{formatCurrency(result.installmentValue)}</p>
          </div>
          <div className="rounded-xl border border-orange-500/30 bg-orange-50 dark:bg-orange-950/20 p-4">
            <p className="text-xs text-gray-500 dark:text-zinc-400">Total de Juros</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-orange-600 dark:text-orange-400 mt-1">{formatCurrency(result.totalInterest)}</p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 p-4">
            <p className="text-xs text-gray-500 dark:text-zinc-400">Total a Receber</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-primary mt-1">{formatCurrency(result.totalAmount)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 p-4">
            <p className="text-xs text-gray-500 dark:text-zinc-400">Taxa Efetiva Total</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100 mt-1">{result.effectiveRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* ===== COMPARE BUTTON ===== */}
        <button
          onClick={() => setShowCompare(!showCompare)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-sm font-medium text-gray-600 dark:text-zinc-300 transition-all"
        >
          <ArrowUpDown className="h-4 w-4" />
          {showCompare ? "Ocultar Modos de Juros" : "Comparar Modos de Juros"}
        </button>

        {/* Compare panel — tabela de 5 modos */}
        {showCompare && (
          <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
            <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-zinc-100">
<Zap className="h-4 w-4 text-amber-500" /> Comparativo: {count} parcela{count > 1 ? "s" : ""} de {formatCurrency(parseFloat(valor) || 0)}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-gray-500 dark:text-zinc-400">
                    <th className="text-left font-semibold py-2 px-2.5">Modo de Juros</th>
                    <th className="text-right font-semibold py-2 px-2.5">Juros Total</th>
                    <th className="text-right font-semibold py-2 px-2.5">Total a Receber</th>
                    <th className="text-right font-semibold py-2 px-2.5">Parcela</th>
                  </tr>
                </thead>
                <tbody>
                  {compareResults.map((cr) => {
                    const selected = cr.mode === interestMode
                    return (
                      <tr key={cr.mode} className={`border-t border-gray-200 dark:border-zinc-800 ${selected ? "bg-primary/5 dark:bg-primary/10" : ""}`}>
                        <td className="py-2.5 px-2.5 text-left">
                          <span className="inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: cr.badge.bg, color: cr.badge.c }}>
                            {cr.label}
                          </span>
                          {selected && <span className="ml-2 text-xs text-primary">✓ Selecionado</span>}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(Math.round(cr.interest * 100) / 100)}</td>
                        <td className="py-2.5 px-2.5 text-right font-semibold text-primary">{formatCurrency(Math.round(cr.total * 100) / 100)}</td>
                        <td className="py-2.5 px-2.5 text-right text-gray-800 dark:text-zinc-200">
                          {cr.variable && count > 1 ? "Variável" : formatCurrency(Math.round(cr.installment * 100) / 100)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-center text-xs text-gray-400 dark:text-zinc-500 mt-3">
              Modo selecionado: <span className="font-medium text-gray-600 dark:text-zinc-300">{selectedCompareLabel}</span>
            </p>
          </div>
        )}

        {/* ===== ENVIAR PARA CLIENTE ===== */}
        <div className="border-t border-gray-200 dark:border-zinc-700 pt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Enviar para Cliente</p>
          <div className="relative">
            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="tel"
              placeholder="Telefone do cliente (opcional)"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value.replace(/\D/g, "").slice(0, 15))}
              className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 pl-8 pr-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(buildSimulationText()); showToast("Texto copiado!", "success", "center") }}
              className="flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-xs font-medium text-gray-700 dark:text-zinc-300 transition"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar Texto
            </button>
            <button
              disabled={sending}
              onClick={async () => {
                const phone = clientPhone.replace(/\D/g, "")
                if (!phone) { showToast("Informe o telefone do cliente.", "error", "center"); return }
                setSending(true)
                setSendResult(null)
                try {
                  const res = await fetch("/api/whatsapp/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phone, message: buildSimulationText() }),
                  })
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    showToast("Erro ao enviar: " + (data?.error || "Erro desconhecido"), "error", "center")
                    setSendResult("error")
                  } else {
                    setSendResult("ok")
                  }
                } catch {
                  setSendResult("error")
                } finally {
                  setSending(false)
                  setTimeout(() => setSendResult(null), 3000)
                }
              }}
              className="flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-medium transition"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : sendResult === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? "Enviando..." : sendResult === "ok" ? "Enviado!" : sendResult === "error" ? "Erro ao enviar" : "Enviar via WhatsApp"}
            </button>
          </div>
        </div>
      </div>

      {/* ===== CRONOGRAMA DE PARCELAS ===== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-700 dark:text-zinc-200" />
            <h2 className="text-[19px] font-bold text-gray-900 dark:text-zinc-100">Cronograma de Parcelas</h2>
            <Badge className="bg-primary/5 text-primary border-primary/30 text-[10px] px-2 py-0.5 ml-1">
              {result.variable && count > 1 ? `${count}x variável` : `${installmentCount}x de ${formatCurrency(result.installmentValue)}`}
            </Badge>
          </div>
          <button
            onClick={() => {
              const scheduleRows = schedule.map((i) =>
                `<tr><td style="text-align:center">${i.number}/${count}</td><td style="text-align:center">${formatDateBR(i.dueDate)}</td><td style="text-align:right;color:#059669;font-weight:600">${formatCurrency(i.amount)}</td></tr>`
              ).join("")
              const printContent = `<html><head><title>Simulação de Empréstimo</title>
                <style>body{font-family:sans-serif;padding:40px;max-width:500px;margin:auto}h2{color:#059669;text-align:center}
                .summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}
                .card{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center}
                .card p{margin:0;font-size:11px;color:#6b7280}.card span{font-size:16px;font-weight:700;color:#059669}
                table{width:100%;border-collapse:collapse;margin-top:16px}
                th{background:#f9fafb;padding:8px;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb}
                td{padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px}</style></head>
                <body><h2>📊 Simulação de Empréstimo</h2>
                <div class="summary">
                  <div class="card"><p>Valor</p><span>${formatCurrency(parseFloat(valor) || 0)}</span></div>
                  <div class="card"><p>Juros (${modeNames[interestMode]})</p><span>${taxa}%</span></div>
                  <div class="card"><p>Total de Juros</p><span>${formatCurrency(result.totalInterest)}</span></div>
                  <div class="card"><p>Total a Pagar</p><span>${formatCurrency(result.totalAmount)}</span></div>
                </div>
                <table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead>
                <tbody>${scheduleRows}</tbody></table></body></html>`
              const w = window.open("", "_blank")
              if (w) { w.document.write(printContent); w.document.close(); w.print() }
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-gray-600 dark:text-zinc-400 hover:bg-gray-50 transition"
          >
            <Receipt className="h-3.5 w-3.5" /> Exportar PDF
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
                  <span className="text-xs text-gray-400 dark:text-zinc-500">/{count}</span>
                </div>
                <span className="text-xs text-gray-700 dark:text-zinc-300">{formatDateBR(inst.dueDate)}</span>
                <span className="text-xs font-medium text-primary text-right">
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

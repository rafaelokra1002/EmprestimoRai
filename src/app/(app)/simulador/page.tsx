"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, localDateStr } from "@/lib/utils"
import {
  Calculator, Calendar, ChevronDown, TrendingUp,
  FileDown, GitCompareArrows, Copy, Send, Phone, Loader2, CheckCircle2
} from "lucide-react"

type PaymentType = "MONTHLY" | "BIWEEKLY" | "WEEKLY" | "DAILY"
type InterestMode = "PER_INSTALLMENT" | "PRICE"

interface Installment {
  number: number
  dueDate: Date
  amount: number
}

export default function SimuladorPage() {
  const [paymentType, setPaymentType] = useState<PaymentType>("MONTHLY")
  const [interestMode, setInterestMode] = useState<InterestMode>("PER_INSTALLMENT")
  const [installmentCount, setInstallmentCount] = useState("6")
  const [startDate, setStartDate] = useState(() => {
    return localDateStr()
  })
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

  // ===== CALCULATION =====
  const result = useMemo(() => {
    const amount = parseFloat(valor) || 0
    const rate = (parseFloat(taxa) || 0) / 100
    const count = Math.max(1, parseInt(installmentCount) || 1)

    let totalInterest = 0
    let totalAmount = 0
    let installmentValue = 0

    if (interestMode === "PER_INSTALLMENT") {
      // Interest applied per installment: total = principal * (1 + rate * count)
      totalInterest = amount * rate * count
      totalAmount = amount + totalInterest
      installmentValue = totalAmount / count
    } else {
      // Tabela Price (French amortization): PMT = PV * i / (1 - (1+i)^-n)
      if (rate === 0) {
        installmentValue = amount / count
      } else {
        installmentValue = (amount * rate) / (1 - Math.pow(1 + rate, -count))
      }
      totalAmount = installmentValue * count
      totalInterest = totalAmount - amount
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
    const amount = parseFloat(valor) || 0
    const rate = (parseFloat(taxa) || 0) / 100
    const count = Math.max(1, parseInt(installmentCount) || 1)

    const perInst = amount * rate * count
    const perInstTotal = amount + perInst

    const priceInstallment = rate === 0 ? amount / count : (amount * rate) / (1 - Math.pow(1 + rate, -count))
    const priceTotal = priceInstallment * count
    const priceInterest = priceTotal - amount

    return [
      { label: "Por Parcela", interest: perInst, total: perInstTotal, installment: perInstTotal / count },
      { label: "Tabela Price", interest: priceInterest, total: priceTotal, installment: priceInstallment },
    ]
  }, [valor, taxa, installmentCount])

  // ===== INSTALLMENT SCHEDULE =====
  const schedule = useMemo(() => {
    const count = Math.max(1, parseInt(installmentCount) || 1)
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
    { value: "PRICE", label: "Tabela Price" },
  ]


  const formatDateBR = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })

  const buildSimulationText = () => {
    const modeLabel = interestMode === "PER_INSTALLMENT" ? "Por Parcela" : "Tabela Price"
    const venc = firstDueDate ? new Date(firstDueDate + "T12:00:00").toLocaleDateString("pt-BR") : "-"
    const scheduleLines = schedule.map((i) => `  ${i.number}/${installmentCount} - ${formatDateBR(i.dueDate)} - ${formatCurrency(i.amount)}`).join("\n")
    return `📊 *Simulação de Empréstimo*\n\n💰 Valor: ${formatCurrency(parseFloat(valor) || 0)}\n📈 Juros: ${taxa}% (${modeLabel})\n📄 Parcelas: ${installmentCount}x ${formatCurrency(result.installmentValue)}\n📅 1º Vencimento: ${venc}\n\n💵 Total de Juros: ${formatCurrency(result.totalInterest)}\n💵 *Total a Pagar: ${formatCurrency(result.totalAmount)}*\n\n📋 *Cronograma:*\n${scheduleLines}`
  }

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
              type="text"
              inputMode="numeric"
              value={installmentCount}
              onChange={(e) => { const v = e.target.value; if (/^\d*$/.test(v)) setInstallmentCount(v) }}
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
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => { const v = e.target.value; if (/^\d*[,.]?\d*$/.test(v)) setValor(v.replace(",", ".")) }}
              className="mt-1 h-9 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-sm font-medium"
            />
            <input
              type="range"
              min={100}
              max={100000}
              step={100}
              value={parseFloat(valor) || 100}
              onChange={(e) => setValor(e.target.value)}
              className="w-full mt-1.5 h-1 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-green-500"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 flex items-center gap-1">
              <span className="text-primary text-xs">%</span> Taxa de Juros
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              value={taxa}
              onChange={(e) => { const v = e.target.value; if (/^\d*[,.]?\d*$/.test(v)) setTaxa(v.replace(",", ".")) }}
              className="mt-1 h-9 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-sm font-medium"
            />
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={parseFloat(taxa) || 0}
              onChange={(e) => setTaxa(e.target.value)}
              className="w-full mt-1.5 h-1 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-green-500"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">Data de Início</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 h-9 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">1º Vencimento</Label>
            <Input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="mt-1 h-9 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-sm"
            />
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
                  cr.label === (interestMode === "PER_INSTALLMENT" ? "Por Parcela" : "Tabela Price")
                    ? "border-primary/40 bg-primary/5 dark:bg-primary/150/5"
                    : "border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800 dark:text-zinc-200">{cr.label}</span>
                  {cr.label === (interestMode === "PER_INSTALLMENT" ? "Por Parcela" : "Tabela Price") && (
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
              onClick={() => { navigator.clipboard.writeText(buildSimulationText()); alert("Texto copiado!") }}
              className="flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-xs font-medium text-gray-700 dark:text-zinc-300 transition"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar Texto
            </button>
            <button
              disabled={sending || !clientPhone.trim()}
              onClick={async () => {
                const phone = clientPhone.replace(/\D/g, "")
                if (!phone) return
                setSending(true)
                setSendResult(null)
                try {
                  const res = await fetch("/api/whatsapp/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phone, message: buildSimulationText() }),
                  })
                  setSendResult(res.ok ? "ok" : "error")
                } catch {
                  setSendResult("error")
                } finally {
                  setSending(false)
                  setTimeout(() => setSendResult(null), 3000)
                }
              }}
              className="flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition"
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
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100">Cronograma de Parcelas</h2>
            <Badge className="bg-primary/5 text-primary border-primary/30 text-[10px] px-2 py-0.5 ml-1">
              {installmentCount}x de {formatCurrency(result.installmentValue)}
            </Badge>
          </div>
          <button
            onClick={() => {
              const scheduleRows = schedule.map((i) =>
                `<tr><td style="text-align:center">${i.number}/${installmentCount}</td><td style="text-align:center">${formatDateBR(i.dueDate)}</td><td style="text-align:right;color:#059669;font-weight:600">${formatCurrency(i.amount)}</td></tr>`
              ).join("")
              const modeLabel = interestMode === "PER_INSTALLMENT" ? "Por Parcela" : "Tabela Price"
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
                  <div class="card"><p>Valor</p><span>${formatCurrency(parseFloat(valor)||0)}</span></div>
                  <div class="card"><p>Juros (${modeLabel})</p><span>${taxa}%</span></div>
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

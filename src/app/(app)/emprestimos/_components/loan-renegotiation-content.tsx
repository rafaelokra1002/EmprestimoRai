"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarDays, CheckCircle2, FileText, Plus, RefreshCw, Shield, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { calculateLoan, formatCurrency, formatDate, generateInstallmentDates, localDateStr, resolveDailyInterestAmount } from "@/lib/utils"

type RenegotiationLoan = {
  id: string
  client: { id: string; name: string; photo: string | null }
  amount: number
  interestRate: number
  interestType: string
  modality: string
  installmentCount: number
  totalAmount: number
  dailyInterest: boolean
  dailyInterestAmount: number
  notes?: string | null
  tags?: string[]
  installments: { id: string; number: number; amount: number; dueDate: string; status: string }[]
  payments: { id: string; amount: number; date: string; notes?: string }[]
}

interface LoanRenegotiationContentProps {
  loan: RenegotiationLoan
  remainingAmount: number
  onClose: () => void
  onSuccess?: () => void | Promise<void>
}

const interestTypeOptions = [
  { value: "PER_INSTALLMENT", label: "Por Parcela" },
  { value: "PRICE", label: "Tabela Price" },
  { value: "CUSTOM", label: "Parcelas Personalizadas" },
]

const modalityOptions = [
  { value: "MONTHLY", label: "Parcelado (Mensal)" },
  { value: "BIWEEKLY", label: "Quinzenal" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "DAILY", label: "Diário" },
]

function normalizeInterestType(interestType: string) {
  if (interestType === "PRICE" || interestType === "CUSTOM") {
    return interestType
  }
  return "PER_INSTALLMENT"
}

function buildInstallmentSeed(loan: RenegotiationLoan) {
  const pending = loan.installments
    .filter((installment) => installment.status !== "PAID")
    .sort((a, b) => a.number - b.number)

  if (pending.length > 0) {
    return pending.map((installment) => Math.round(installment.amount * 100) / 100)
  }

  const defaultValue = loan.installmentCount > 0 ? loan.totalAmount / loan.installmentCount : loan.totalAmount
  return Array.from({ length: Math.max(loan.installmentCount, 1) }, () => Math.round(defaultValue * 100) / 100)
}

function formatCurrencyInputValue(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value || 0)
}

function formatPercentValue(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function resolvePreviousInterestRate(loan: RenegotiationLoan) {
  const storedRate = Number(loan.interestRate) || 0
  const normalizedStoredRate = storedRate > 100 ? storedRate / 10 : storedRate
  const normalizedType = normalizeInterestType(loan.interestType)

  if (normalizedStoredRate > 0) {
    return Math.round(normalizedStoredRate * 100) / 100
  }

  if (normalizedType !== "PER_INSTALLMENT" || !loan.amount || !loan.installmentCount) {
    return 0
  }

  const derivedRate = ((loan.totalAmount - loan.amount) / loan.amount / loan.installmentCount) * 100
  if (!Number.isFinite(derivedRate) || derivedRate < 0) {
    return 0
  }

  return Math.round(derivedRate * 100) / 100
}

export function LoanRenegotiationContent({ loan, remainingAmount, onClose, onSuccess }: LoanRenegotiationContentProps) {
  const pendingInstallments = useMemo(
    () => loan.installments.filter((installment) => installment.status !== "PAID").sort((a, b) => a.number - b.number),
    [loan.installments]
  )
  const paidTotal = useMemo(() => loan.payments.reduce((sum, payment) => sum + payment.amount, 0), [loan.payments])
  const defaultCount = Math.max(pendingInstallments.length || loan.installmentCount || 1, 1)
  const defaultFirstDate = pendingInstallments[0]?.dueDate ? localDateStr(pendingInstallments[0].dueDate) : localDateStr()
  const initialCustomInstallments = useMemo(() => buildInstallmentSeed(loan), [loan])
  const previousInterestRate = useMemo(() => resolvePreviousInterestRate(loan), [loan])

  const [amount, setAmount] = useState<number>(Math.round(Math.max(remainingAmount, 0) * 100) / 100)
  const [interestRate, setInterestRate] = useState<number>(previousInterestRate)
  const [interestType, setInterestType] = useState(normalizeInterestType(loan.interestType))
  const [modality, setModality] = useState(loan.modality || "MONTHLY")
  const [installmentCount, setInstallmentCount] = useState(defaultCount)
  const [contractDate, setContractDate] = useState(localDateStr())
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(defaultFirstDate)
  const [customInstallmentAmounts, setCustomInstallmentAmounts] = useState<number[]>(() => {
    const seed = initialCustomInstallments.slice(0, defaultCount)
    if (seed.length === defaultCount) return seed
    const fallbackValue = defaultCount > 0 ? (remainingAmount || 0) / defaultCount : remainingAmount || 0
    return Array.from({ length: defaultCount }, (_, index) => seed[index] ?? Math.round(fallbackValue * 100) / 100)
  })
  const [installmentDates, setInstallmentDates] = useState<string[]>([])
  const [observations, setObservations] = useState("")
  const [guarantees, setGuarantees] = useState("")
  const [showGuarantees, setShowGuarantees] = useState(false)
  const [skipSaturday, setSkipSaturday] = useState(false)
  const [skipSunday, setSkipSunday] = useState(false)
  const [skipHolidays, setSkipHolidays] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCustomInstallmentAmounts((current) => {
      const next = Array.from({ length: installmentCount }, (_, index) => {
        const seededValue = initialCustomInstallments[index]
        if (typeof current[index] === "number") return current[index]
        if (typeof seededValue === "number") return seededValue
        const fallback = installmentCount > 0 ? amount / installmentCount : amount
        return Math.round(fallback * 100) / 100
      })
      return next
    })
  }, [amount, initialCustomInstallments, installmentCount])

  useEffect(() => {
    if (!firstInstallmentDate || installmentCount < 1) {
      setInstallmentDates([])
      return
    }

    const dates = generateInstallmentDates(
      new Date(`${firstInstallmentDate}T12:00:00`),
      installmentCount,
      modality,
      skipSaturday,
      skipSunday,
      skipHolidays
    )
    setInstallmentDates(dates.map((date) => localDateStr(date)))
  }, [firstInstallmentDate, installmentCount, modality, skipSaturday, skipSunday, skipHolidays])

  const preview = useMemo(
    () => calculateLoan(
      amount || 0,
      interestRate || 0,
      installmentCount || 1,
      interestType,
      undefined,
      interestType === "CUSTOM" ? customInstallmentAmounts : undefined
    ),
    [amount, customInstallmentAmounts, installmentCount, interestRate, interestType]
  )

  const interestTypeLabel = interestTypeOptions.find((option) => option.value === normalizeInterestType(loan.interestType))?.label || "Por Parcela"
  const realizedProfit = Math.max(0, paidTotal - loan.amount)

  const handleRecalculateDates = () => {
    if (!firstInstallmentDate || installmentCount < 1) return
    const dates = generateInstallmentDates(
      new Date(`${firstInstallmentDate}T12:00:00`),
      installmentCount,
      modality,
      skipSaturday,
      skipSunday,
      skipHolidays
    )
    setInstallmentDates(dates.map((date) => localDateStr(date)))
  }

  const handleSave = async () => {
    if (saving) return
    if (!amount || amount <= 0) {
      setError("Informe um valor válido para renegociar")
      return
    }
    if (!firstInstallmentDate) {
      setError("Informe a data da primeira parcela")
      return
    }
    if (!installmentCount || installmentCount < 1) {
      setError("Informe a quantidade de parcelas")
      return
    }
    if (interestType === "CUSTOM") {
      if (customInstallmentAmounts.length !== installmentCount) {
        setError("Preencha todas as parcelas personalizadas")
        return
      }
      if (customInstallmentAmounts.some((value) => !value || value <= 0)) {
        setError("As parcelas personalizadas devem ser maiores que zero")
        return
      }
    }

    setSaving(true)
    setError(null)

    const notesParts = [
      `Renegociacao do contrato ${loan.id}`,
      `Saldo renegociado: ${formatCurrency(remainingAmount)}`,
      observations.trim() ? `Observacoes: ${observations.trim()}` : null,
      guarantees.trim() ? `Garantias: ${guarantees.trim()}` : null,
    ].filter(Boolean)

    const nextTags = Array.from(new Set([...(loan.tags || []), "Renegociacao"]))

    try {
      const createRes = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: loan.client.id,
          amount,
          interestRate,
          interestType,
          modality,
          installmentCount,
          contractDate,
          firstInstallmentDate,
          dailyInterest: loan.dailyInterest,
          dailyInterestAmount: resolveDailyInterestAmount(
            loan.dailyInterest,
            loan.dailyInterestAmount,
            amount,
            interestRate,
            modality
          ),
          installmentDates,
          notes: notesParts.join("\n"),
          tags: nextTags,
          customInstallmentAmounts: interestType === "CUSTOM" ? customInstallmentAmounts : undefined,
        }),
      })

      const createdLoan = await createRes.json().catch(() => ({}))
      if (!createRes.ok) {
        setError(createdLoan?.error || "Não foi possível salvar a renegociação")
        return
      }

      const previousLoanNotes = [
        loan.notes?.trim() || null,
        `Contrato renegociado em ${formatDate(contractDate)}. Novo contrato: ${createdLoan.id}.`,
      ].filter(Boolean).join("\n\n")

      const closeRes = await fetch(`/api/loans/${loan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          notes: previousLoanNotes,
        }),
      })

      if (!closeRes.ok) {
        const closeData = await closeRes.json().catch(() => ({}))
        setError(closeData?.error || "Novo contrato criado, mas o contrato anterior não foi encerrado automaticamente")
        if (onSuccess) {
          await onSuccess()
        }
        return
      }

      if (onSuccess) {
        await onSuccess()
      }
      onClose()
    } catch (requestError: any) {
      setError(requestError?.message || "Erro ao salvar renegociação")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-zinc-100">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span>Renegociação de Contrato</span>
        </div>
        <button type="button" onClick={onClose} className="text-slate-500 transition-colors hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-500 dark:border-amber-500/60 dark:bg-amber-950/20 dark:text-amber-300">
        <div className="flex items-start gap-2">
          <div className="hidden">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="sr-only">Aviso de renegociação</p>
            <p>
              Este contrato já possui pagamentos registrados. Ao salvar, você estará criando uma <span className="font-semibold uppercase">renegociação</span> baseada no saldo devedor atual.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-amber-600 dark:text-amber-300">
          <FileText className="h-3.5 w-3.5" />
          <span>Contrato anterior</span>
        </div>

        <div className="grid grid-cols-2 gap-x-7 gap-y-2">
          <div>
            <p className="text-slate-500 dark:text-zinc-400">Emprestado:</p>
            <p className="font-bold text-slate-950 dark:text-zinc-100">{formatCurrency(loan.amount)}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-zinc-400">Taxa:</p>
            <p className="font-bold text-slate-950 dark:text-zinc-100">{formatPercentValue(previousInterestRate)}% ({interestTypeLabel})</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-zinc-400">Parcelas:</p>
            <p className="font-bold text-slate-950 dark:text-zinc-100">{loan.installmentCount}x</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-zinc-400">Total Previsto:</p>
            <p className="font-bold text-slate-950 dark:text-zinc-100">{formatCurrency(loan.totalAmount)}</p>
          </div>
        </div>

        <div className="mt-2 space-y-0.5 border-t border-amber-200 pt-2 dark:border-amber-900/50">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-zinc-400">Total já recebido:</span>
            <span className="font-semibold !text-emerald-500">{formatCurrency(paidTotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-zinc-400">Lucro já realizado:</span>
            <span className="font-semibold !text-emerald-500">{formatCurrency(realizedProfit)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-zinc-400">Saldo devedor atual:</span>
            <span className="font-semibold text-amber-500">{formatCurrency(remainingAmount)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border !border-emerald-200 !bg-emerald-50/80 px-3 py-2 text-sm dark:!border-emerald-900/50 dark:!bg-emerald-950/20">
        <div className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase !text-emerald-600 dark:!text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Novo contrato</span>
        </div>
        <p className="text-slate-500 dark:text-zinc-400">
          Configure abaixo os novos termos. O valor base é o saldo devedor de {formatCurrency(remainingAmount)}.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Cliente *</Label>
          <div className="mt-1 flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full !bg-emerald-100 text-[10px] font-semibold !text-emerald-600 dark:!bg-emerald-950/60 dark:!text-emerald-300">
              {loan.client.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="font-medium">{loan.client.name}</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 h-9" />
          </div>
          <div>
            <Label>Juros (%)</Label>
            <Input type="number" step="0.1" value={interestRate || ""} onChange={(e) => setInterestRate(Number(e.target.value))} className="mt-1 h-9" />
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Tipo de Pagamento</Label>
            <select value={modality} onChange={(e) => setModality(e.target.value)} className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-background px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              {modalityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Parcelas</Label>
            <Input type="number" min={1} value={installmentCount} onChange={(e) => setInstallmentCount(Math.max(Number(e.target.value) || 1, 1))} className="mt-1 h-9" />
          </div>
        </div>

        <div className="mt-3">
          <div>
            <Label>Juros Aplicado</Label>
            <select
              value={interestType}
              onChange={(e) => setInterestType(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-background px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {interestTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {interestType === "CUSTOM" ? (
          <div className="mt-3 rounded-lg border border-gray-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">Valores das Parcelas</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {customInstallmentAmounts.map((value, index) => (
                <div key={index}>
                  <Label>Parcela {index + 1}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={value || ""}
                    onChange={(e) => {
                      const next = [...customInstallmentAmounts]
                      next[index] = Number(e.target.value) || 0
                      setCustomInstallmentAmounts(next)
                    }}
                    className="mt-1 h-9"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Juros Total (R$)</Label>
            <Input type="text" readOnly value={formatCurrencyInputValue(preview.totalInterest)} className="mt-1 h-9 bg-white dark:bg-zinc-900" />
          </div>
          <div>
            <Label>Valor da Parcela (R$)</Label>
            <Input type="text" readOnly value={formatCurrencyInputValue(preview.installmentAmount)} className="mt-1 h-9 bg-white dark:bg-zinc-900" />
          </div>
        </div>

        <div className="mt-3">
          <Label>Total a Receber</Label>
          <div className="mt-1 flex h-9 items-center rounded-md border border-gray-200 bg-emerald-50/40 px-3 text-sm font-semibold text-emerald-600 dark:border-zinc-800 dark:bg-emerald-950/20 dark:text-emerald-300">
            {formatCurrency(preview.totalAmount)}
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Data do Contrato</Label>
            <div className="relative mt-1">
              <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className="h-9 pr-11" />
              <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Quando foi fechado</p>
          </div>
          <div>
            <Label>1ª Parcela</Label>
            <div className="relative mt-1">
              <Input type="date" value={firstInstallmentDate} onChange={(e) => setFirstInstallmentDate(e.target.value)} className="h-9 pr-11" />
              <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Quando começa a pagar</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Datas das Parcelas</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Você pode ajustar as datas antes de salvar.</p>
            </div>
            <Button type="button" variant="outline" className="hidden gap-2" onClick={handleRecalculateDates}>
              <RefreshCw className="h-4 w-4" /> Recalcular Datas
            </Button>
          </div>

          <div className="max-h-[190px] space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-zinc-800">
            {installmentDates.map((date, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="w-[72px] shrink-0 text-xs font-medium text-slate-500 dark:text-zinc-400">Parcela {index + 1}:</span>
                <div className="relative flex-1">
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      const next = [...installmentDates]
                      next[index] = e.target.value
                      setInstallmentDates(next)
                    }}
                    className="h-9 pr-11"
                  />
                  <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-zinc-800">
          <p className="text-xs text-slate-500 dark:text-zinc-400">Nao cobra nos seguintes dias:</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {[
              { label: "Sabados", checked: skipSaturday, onChange: setSkipSaturday },
              { label: "Domingos", checked: skipSunday, onChange: setSkipSunday },
              { label: "Feriados", checked: skipHolidays, onChange: setSkipHolidays },
            ].map((option) => (
              <label key={option.label} className="flex cursor-pointer items-center gap-2 text-sm text-slate-900 dark:text-zinc-100">
                <input
                  type="checkbox"
                  checked={option.checked}
                  onChange={(event) => option.onChange(event.target.checked)}
                  className="sr-only"
                />
                <span className={`h-4 w-4 rounded-full border ${option.checked ? "border-emerald-500 bg-emerald-500 shadow-[inset_0_0_0_3px_white] dark:shadow-[inset_0_0_0_3px_#18181b]" : "border-emerald-500"}`} />
                {option.label}
              </label>
            ))}
          </div>
          <Button type="button" variant="outline" className="mt-2 h-8 gap-2 rounded-lg px-3" onClick={handleRecalculateDates}>
            <RefreshCw className="h-4 w-4" /> Recalcular Datas
          </Button>
        </div>

        <div className="mt-3">
          <div>
            <Label>Observações</Label>
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="mt-1.5 min-h-[64px]"
              placeholder="Descreva o motivo ou o acordo feito na renegociação"
            />
          </div>
          <div className="hidden">
            <Label>Garantias</Label>
            <Textarea
              value={guarantees}
              onChange={(e) => setGuarantees(e.target.value)}
              className="mt-1 min-h-[110px]"
              placeholder="Informe garantias, bens ou observações adicionais"
            />
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/30 p-3 dark:border-amber-900/60 dark:bg-amber-950/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
              <Shield className="h-4 w-4 text-amber-500" />
              <span>Garantias (opcional)</span>
            </div>
            <Button type="button" variant="outline" className="h-8 gap-2 rounded-lg px-3" onClick={() => setShowGuarantees((current) => !current)}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
          <p className="mt-2 text-xs leading-snug text-slate-500 dark:text-zinc-400">
            Registre bens recebidos como garantia. NÃ£o afeta cÃ¡lculos - apenas aparece no comprovante.
          </p>
          {showGuarantees && (
            <Textarea
              value={guarantees}
              onChange={(e) => setGuarantees(e.target.value)}
              className="mt-2 min-h-[72px]"
              placeholder="Informe garantias, bens ou observaÃ§Ãµes adicionais"
            />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-0.5">
        <div className="hidden items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>O novo contrato será criado com o saldo atual e exibido imediatamente na lista.</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="h-9 min-w-24">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="h-9 bg-amber-500 text-slate-950 hover:bg-amber-600">
            {saving ? "Salvando..." : "Salvar Renegociação"}
          </Button>
        </div>
      </div>
    </div>
  )
}

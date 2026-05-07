"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarDays, CheckCircle2, RefreshCw } from "lucide-react"
import { Avatar } from "@/components/avatar"
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

export function LoanRenegotiationContent({ loan, remainingAmount, onClose, onSuccess }: LoanRenegotiationContentProps) {
  const pendingInstallments = useMemo(
    () => loan.installments.filter((installment) => installment.status !== "PAID").sort((a, b) => a.number - b.number),
    [loan.installments]
  )
  const paidTotal = useMemo(() => loan.payments.reduce((sum, payment) => sum + payment.amount, 0), [loan.payments])
  const defaultCount = Math.max(pendingInstallments.length || loan.installmentCount || 1, 1)
  const defaultFirstDate = pendingInstallments[0]?.dueDate ? localDateStr(pendingInstallments[0].dueDate) : localDateStr()
  const initialCustomInstallments = useMemo(() => buildInstallmentSeed(loan), [loan])

  const [amount, setAmount] = useState<number>(Math.round(Math.max(remainingAmount, 0) * 100) / 100)
  const [interestRate, setInterestRate] = useState<number>(loan.interestRate || 0)
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
      modality
    )
    setInstallmentDates(dates.map((date) => localDateStr(date)))
  }, [firstInstallmentDate, installmentCount, modality])

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

  const pendingLabel = pendingInstallments.length > 0
    ? `${pendingInstallments[0].number} ate ${pendingInstallments[pendingInstallments.length - 1].number}`
    : "Sem parcelas pendentes"

  const handleRecalculateDates = () => {
    if (!firstInstallmentDate || installmentCount < 1) return
    const dates = generateInstallmentDates(
      new Date(`${firstInstallmentDate}T12:00:00`),
      installmentCount,
      modality
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
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-white p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-zinc-900 dark:text-amber-100">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold">Renegociação de Contrato</p>
            <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90">
              Um novo contrato será criado com o saldo atual. O contrato anterior será encerrado automaticamente após salvar.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={loan.client.name} src={loan.client.photo} size="sm" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">CONTRATO ANTERIOR</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">#{loan.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Cliente</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-zinc-100">{loan.client.name}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Saldo Atual</p>
            <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(remainingAmount)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Pago no Contrato</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-zinc-100">{formatCurrency(paidTotal)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Parcelas Pendentes</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-zinc-100">{pendingLabel}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">NOVO CONTRATO</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Configure os dados da renegociação antes de salvar.</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-right dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Total do Novo Contrato</p>
            <p className="text-base font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(preview.totalAmount)}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label>Juros (%)</Label>
            <Input type="number" step="0.1" value={interestRate || ""} onChange={(e) => setInterestRate(Number(e.target.value))} className="mt-1" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Tipo de Pagamento</Label>
            <select value={modality} onChange={(e) => setModality(e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-background px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              {modalityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Parcelas</Label>
            <Input type="number" min={1} value={installmentCount} onChange={(e) => setInstallmentCount(Math.max(Number(e.target.value) || 1, 1))} className="mt-1" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Juros Aplicado</Label>
            <select
              value={interestType}
              onChange={(e) => setInterestType(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-background px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {interestTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Juros Total (R$)</Label>
            <Input type="text" readOnly value={formatCurrency(preview.totalInterest)} className="mt-1 bg-gray-100 dark:bg-zinc-800/50" />
          </div>
        </div>

        {interestType === "CUSTOM" ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-zinc-100">Valores das Parcelas</p>
            <div className="grid gap-3 sm:grid-cols-2">
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
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Valor da Parcela (R$)</Label>
              <Input type="text" readOnly value={formatCurrency(preview.installmentAmount)} className="mt-1 bg-gray-100 dark:bg-zinc-800/50" />
            </div>
            <div>
              <Label>Total a Receber</Label>
              <div className="mt-1 flex h-10 items-center rounded-md border border-primary/20 bg-primary/10 px-3 text-sm font-semibold text-primary dark:border-primary/30 dark:bg-primary/15">
                {formatCurrency(preview.totalAmount)}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Data do Contrato</Label>
            <div className="relative mt-1">
              <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className="pr-11" />
              <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            </div>
          </div>
          <div>
            <Label>1ª Parcela</Label>
            <div className="relative mt-1">
              <Input type="date" value={firstInstallmentDate} onChange={(e) => setFirstInstallmentDate(e.target.value)} className="pr-11" />
              <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Datas das Parcelas</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Você pode ajustar as datas antes de salvar.</p>
            </div>
            <Button type="button" variant="outline" className="gap-2" onClick={handleRecalculateDates}>
              <RefreshCw className="h-4 w-4" /> Recalcular Datas
            </Button>
          </div>

          <div className="max-h-[220px] space-y-3 overflow-y-auto pr-1">
            {installmentDates.map((date, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="w-20 text-sm font-medium text-slate-500 dark:text-zinc-400">Parcela {index + 1}</span>
                <div className="relative flex-1">
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      const next = [...installmentDates]
                      next[index] = e.target.value
                      setInstallmentDates(next)
                    }}
                    className="pr-11"
                  />
                  <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Observações</Label>
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="mt-1 min-h-[110px]"
              placeholder="Descreva o motivo ou o acordo feito na renegociação"
            />
          </div>
          <div>
            <Label>Garantias</Label>
            <Textarea
              value={guarantees}
              onChange={(e) => setGuarantees(e.target.value)}
              className="mt-1 min-h-[110px]"
              placeholder="Informe garantias, bens ou observações adicionais"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>O novo contrato será criado com o saldo atual e exibido imediatamente na lista.</span>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-amber-500 text-white hover:bg-amber-600">
            {saving ? "Salvando..." : "Salvar Renegociação"}
          </Button>
        </div>
      </div>
    </div>
  )
}
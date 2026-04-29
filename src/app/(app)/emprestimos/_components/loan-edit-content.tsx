"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar } from "@/components/avatar"
import { CalendarDays, ChevronDown, RefreshCw, Plus, X } from "lucide-react"
import { calculateLoan, formatCurrency, generateInstallmentDates, resolveDailyInterestAmount } from "@/lib/utils"

interface Client {
  id: string
  name: string
  phone: string | null
  document: string | null
  photo: string | null
  score: number
}

interface LoanEdit {
  id: string
  clientId: string
  amount: number
  interestRate: number
  interestType: string
  modality: string
  installmentCount: number
  totalInterest: number
  installmentValue: number
  totalAmount: number
  contractDate: string
  firstInstallmentDate: string
  skipSaturday: boolean
  skipSunday: boolean
  skipHolidays: boolean
  dailyInterest: boolean
  dailyInterestAmount?: number
  whatsappNotify: boolean
  notes: string | null
  tags: string[]
  client: { id: string; name: string; photo: string | null }
  installments: { id: string; number: number; dueDate: string; paidAmount: number; status: string }[]
}

interface LoanEditContentProps {
  presentation?: "page" | "modal"
  onClose?: () => void
}

const loanIdPattern = /^c[a-z0-9]{24,}$/i

export function LoanEditContent({ presentation = "page", onClose }: LoanEditContentProps) {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const routeLoanId = params?.id
  const loanId = routeLoanId && loanIdPattern.test(routeLoanId) ? routeLoanId : null

  const [loan, setLoan] = useState<LoanEdit | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState("")
  const [amount, setAmount] = useState<number>(0)
  const [interestRate, setInterestRate] = useState<number>(0)
  const [interestType, setInterestType] = useState("PER_INSTALLMENT")
  const [modality, setModality] = useState("MONTHLY")
  const [installmentCount, setInstallmentCount] = useState(1)
  const [totalInterestAmount, setTotalInterestAmount] = useState<number>(0)
  const [contractDate, setContractDate] = useState("")
  const [firstInstallmentDate, setFirstInstallmentDate] = useState("")
  const [skipSaturday, setSkipSaturday] = useState(false)
  const [skipSunday, setSkipSunday] = useState(false)
  const [skipHolidays, setSkipHolidays] = useState(false)
  const [dailyInterest, setDailyInterest] = useState(false)
  const [dailyInterestAmount, setDailyInterestAmount] = useState(0)
  const [whatsappNotify, setWhatsappNotify] = useState(false)
  const [installmentDates, setInstallmentDates] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [loanTags, setLoanTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [loading, setLoading] = useState(Boolean(loanId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const backHref = presentation === "modal"
    ? "/emprestimos"
    : loanId
      ? `/emprestimos/${loanId}`
      : "/emprestimos"

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
          setError(data?.error || "Erro ao carregar empréstimo")
          setLoading(false)
          return
        }
        setLoan(data)
        setClientId(data.clientId)
        setAmount(data.amount || 0)
        setInterestRate(data.interestRate || 0)
        setInterestType(data.interestType || "PER_INSTALLMENT")
        setModality(data.modality || "MONTHLY")
        setInstallmentCount(data.installmentCount || 1)
        setTotalInterestAmount(data.totalInterest || 0)
        setContractDate(data.contractDate?.split("T")?.[0] || "")
        setFirstInstallmentDate(data.firstInstallmentDate?.split("T")?.[0] || "")
        setSkipSaturday(Boolean(data.skipSaturday))
        setSkipSunday(Boolean(data.skipSunday))
        setSkipHolidays(Boolean(data.skipHolidays))
        setNotes(data.notes || "")
        setLoanTags(Array.isArray(data.tags) ? data.tags : [])
        setWhatsappNotify(Boolean(data.whatsappNotify))
        setDailyInterest(Boolean(data.dailyInterest))
        setDailyInterestAmount(data.dailyInterestAmount || 0)
        if (Array.isArray(data.installments)) {
          const sorted = [...data.installments].sort((a, b) => a.number - b.number)
          setInstallmentDates(sorted.map((inst) => inst.dueDate.split("T")[0]))
        }
      } catch (err: any) {
        setError(err?.message || "Erro de conexão")
      } finally {
        setLoading(false)
      }
    }

    fetchLoan()
  }, [loanId, routeLoanId])

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch("/api/clients")
        const data = await res.json()
        setClients(Array.isArray(data) ? data : [])
      } catch {
        setClients([])
      }
    }

    fetchClients()
  }, [])

  useEffect(() => {
    if (!firstInstallmentDate || installmentCount < 1) return
    const dates = generateInstallmentDates(
      new Date(firstInstallmentDate + "T12:00:00"),
      installmentCount,
      modality,
      skipSaturday,
      skipSunday,
      skipHolidays
    )
    setInstallmentDates(dates.map((d) => d.toISOString().split("T")[0]))
  }, [firstInstallmentDate, installmentCount, modality, skipSaturday, skipSunday, skipHolidays])

  const selectedClient = clients.find((client) => client.id === clientId)

  const inputClass = "mt-2 h-12 rounded-2xl border-gray-200 bg-white px-4 text-[15px] text-slate-700 shadow-none"
  const selectClass = "mt-2 h-12 w-full appearance-none rounded-2xl border border-gray-200 bg-white px-4 pr-10 text-[15px] text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
  const helperClass = "mt-2 text-xs text-slate-400"

  const preview = calculateLoan(
    amount || 0,
    interestRate || 0,
    installmentCount || 1,
    interestType,
    interestType === "FIXED_AMOUNT" ? totalInterestAmount : undefined
  )

  const handleRecalculateDates = () => {
    if (!firstInstallmentDate || installmentCount < 1) return
    const dates = generateInstallmentDates(
      new Date(firstInstallmentDate + "T12:00:00"),
      installmentCount,
      modality,
      skipSaturday,
      skipSunday,
      skipHolidays
    )
    setInstallmentDates(dates.map((d) => d.toISOString().split("T")[0]))
  }

  const handleClose = () => {
    if (onClose) {
      onClose()
      return
    }

    router.replace(backHref)
  }

  const handleSave = async () => {
    if (!loanId) return
    if (!clientId) return setError("Selecione um cliente")
    if (!amount || amount <= 0) return setError("Informe um valor válido")
    if (!installmentCount || installmentCount < 1) return setError("Informe a quantidade de parcelas")

    setSaving(true)
    setError(null)
    try {
      const resolvedDailyInterestAmount = resolveDailyInterestAmount(
        dailyInterest,
        dailyInterestAmount,
        amount,
        interestRate,
        modality
      )

      const res = await fetch(`/api/loans/${loanId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          amount,
          interestRate,
          interestType,
          modality,
          installmentCount,
          totalInterestAmount: interestType === "FIXED_AMOUNT" ? totalInterestAmount : undefined,
          contractDate,
          firstInstallmentDate,
          skipSaturday,
          skipSunday,
          skipHolidays,
          dailyInterest,
          dailyInterestAmount: resolvedDailyInterestAmount,
          whatsappNotify,
          installmentDates,
          notes: notes || undefined,
          tags: loanTags,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Erro ao salvar alterações")
        return
      }

      window.dispatchEvent(new Event("loans:updated"))
      handleClose()
    } catch (err: any) {
      setError(err?.message || "Erro de conexão")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-gray-500 dark:text-zinc-400">Carregando dados do empréstimo...</div>
  }

  if (error && !loan) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{error}</p>
        <Button variant="outline" onClick={handleClose}>Voltar</Button>
      </div>
    )
  }

  const card = (
    <div className="mx-auto max-w-3xl rounded-[28px] border border-gray-200 bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.18)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between px-6 pb-3 pt-6 sm:px-8">
        <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-slate-800 dark:text-zinc-100">Editar Empréstimo</h1>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full p-2 text-slate-500 transition hover:bg-gray-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="max-h-[calc(100vh-96px)] space-y-6 overflow-y-auto px-6 pb-8 sm:px-8">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Cliente *</Label>
          <div className="relative mt-2 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            >
              <option value="">Selecione o cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <div className="flex min-h-[56px] items-center justify-between px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {selectedClient ? (
                  <>
                    <Avatar name={selectedClient.name} src={selectedClient.photo} size="sm" className="bg-emerald-200 text-emerald-700" />
                    <span className="truncate text-base font-medium text-emerald-900 dark:text-emerald-100">{selectedClient.name}</span>
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
                      💰 {selectedClient.score}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-zinc-400">Selecione o cliente</span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Valor (R$) *</Label>
            <Input type="number" step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Juros (%)</Label>
            <Input type="number" step="0.1" value={interestRate || ""} onChange={(e) => setInterestRate(Number(e.target.value))} className={inputClass} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Tipo de Pagamento</Label>
            <div className="relative">
              <select value={modality} onChange={(e) => setModality(e.target.value)} className={selectClass}>
                <option value="MONTHLY">Parcelado (Mensal)</option>
                <option value="BIWEEKLY">Quinzenal</option>
                <option value="WEEKLY">Semanal</option>
                <option value="DAILY">Diário</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div>
            <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Parcelas</Label>
            <Input type="number" min={1} value={installmentCount} onChange={(e) => setInstallmentCount(Number(e.target.value) || 1)} className={inputClass} />
          </div>
        </div>

        <div>
          <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Juros Aplicado</Label>
          <div className="relative">
            <select value={interestType} onChange={(e) => setInterestType(e.target.value)} className={selectClass}>
              <option value="PER_INSTALLMENT">Por Parcela</option>
              <option value="TOTAL">Sobre o Total</option>
              <option value="FIXED_AMOUNT">Valor Fixo (R$)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Juros Total (R$)</Label>
            {interestType === "FIXED_AMOUNT" ? (
              <Input type="number" step="0.01" value={totalInterestAmount || ""} onChange={(e) => setTotalInterestAmount(Number(e.target.value))} className={inputClass} />
            ) : (
              <Input type="text" readOnly value={formatCurrency(preview.totalInterest)} className={`${inputClass} bg-gray-50 text-slate-700`} />
            )}
          </div>
          <div>
            <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Valor da Parcela (R$)</Label>
            <Input type="text" readOnly value={formatCurrency(preview.installmentAmount)} className={`${inputClass} bg-gray-50 text-slate-700`} />
          </div>
        </div>

        <div>
          <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Total a Receber</Label>
          <div className="mt-2 flex h-12 w-full items-center rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 text-[1.35rem] font-semibold tracking-[-0.02em] text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            {formatCurrency(preview.totalAmount)}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Data do Contrato</Label>
            <div className="relative">
              <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className={`${inputClass} pr-11`} />
              <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
            </div>
            <p className={helperClass}>Quando foi fechado</p>
          </div>
          <div>
            <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">1ª Parcela *</Label>
            <div className="relative">
              <Input type="date" value={firstInstallmentDate} onChange={(e) => setFirstInstallmentDate(e.target.value)} className={`${inputClass} pr-11`} />
              <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
            </div>
            <p className={helperClass}>Quando começa a pagar</p>
          </div>
        </div>

        <div>
          <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Datas das Parcelas</Label>
          <div className="mt-3 max-h-[260px] space-y-3 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/20">
            {installmentDates.map((date, index) => (
              <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="w-20 text-sm font-medium text-slate-500 dark:text-zinc-400">Parcela {index + 1}:</span>
                <div className="relative flex-1">
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      const updated = [...installmentDates]
                      updated[index] = e.target.value
                      setInstallmentDates(updated)
                    }}
                    className={`${inputClass} mt-0 pr-11`}
                  />
                  <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Não cobra nos seguintes dias:</p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
              <input type="checkbox" checked={skipSaturday} onChange={(e) => setSkipSaturday(e.target.checked)} /> Sábados
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
              <input type="checkbox" checked={skipSunday} onChange={(e) => setSkipSunday(e.target.checked)} /> Domingos
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
              <input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} /> Feriados
            </label>
          </div>
          <Button type="button" variant="outline" onClick={handleRecalculateDates} className="gap-2 rounded-xl">
            <RefreshCw className="h-4 w-4" /> Recalcular Datas
          </Button>
        </div>

        <div>
          <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Observações</Label>
          <Textarea className="mt-2 min-h-[110px] rounded-2xl border-gray-200 bg-white px-4 py-3 text-[15px] text-slate-700" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div>
          <Label className="text-base font-medium text-slate-800 dark:text-zinc-100">Etiquetas</Label>
          <div className="mb-3 mt-2 flex flex-wrap gap-2">
            {loanTags.map((tag, index) => (
              <span key={index} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 dark:bg-red-950/20 dark:text-red-300">
                {tag}
                <button type="button" onClick={() => setLoanTags(loanTags.filter((_, currentIndex) => currentIndex !== index))} className="hover:text-red-800 dark:hover:text-red-300">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Digite uma etiqueta..."
              className={`${inputClass} mt-0 flex-1`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  const value = tagInput.trim()
                  if (value && !loanTags.includes(value)) {
                    setLoanTags([...loanTags, value])
                  }
                  setTagInput("")
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                const value = tagInput.trim()
                if (value && !loanTags.includes(value)) {
                  setLoanTags([...loanTags, value])
                }
                setTagInput("")
              }}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-white transition-colors hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
              <input type="checkbox" checked={dailyInterest} onChange={(e) => setDailyInterest(e.target.checked)} /> Juros diário
            </label>
            {dailyInterest && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600 dark:text-zinc-300">R$</label>
                <input type="number" step="0.01" min="0" value={dailyInterestAmount || ""} onChange={(e) => setDailyInterestAmount(parseFloat(e.target.value) || 0)} className="h-11 w-28 rounded-xl border border-gray-200 bg-white px-3 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" placeholder="0.00" />
                <span className="text-sm text-slate-500 dark:text-zinc-400">/dia</span>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
              <input type="checkbox" checked={whatsappNotify} onChange={(e) => setWhatsappNotify(e.target.checked)} /> Notificar WhatsApp
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-2 dark:border-zinc-800">
          <Button variant="outline" className="rounded-2xl px-5" onClick={handleClose}>Cancelar</Button>
          <Button className="rounded-2xl bg-emerald-600 px-5 text-white hover:bg-emerald-700" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Alterações"}</Button>
        </div>
      </div>
    </div>
  )

  if (presentation === "modal") {
    return card
  }

  return <div className="min-h-screen bg-[#f6f8f7] px-4 py-6 dark:bg-zinc-950 sm:px-6">{card}</div>
}
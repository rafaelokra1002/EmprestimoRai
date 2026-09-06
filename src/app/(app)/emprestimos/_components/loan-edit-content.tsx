"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar } from "@/components/avatar"
import { ChevronDown, ChevronsUpDown, RefreshCw, Plus, X, Search, Check, Trash2, UserPlus, Shield } from "lucide-react"
import { calculateLoan, formatCurrency, generateInstallmentDates, localDateStr, resolveDailyInterestAmount } from "@/lib/utils"
import { showToast } from "@/lib/toast"

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
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const [manualSelected, setManualSelected] = useState(false)
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
  const [dailyInterestAmount, setDailyInterestAmount] = useState("")
  const [whatsappNotify, setWhatsappNotify] = useState(false)
  const [installmentDates, setInstallmentDates] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [garantias, setGarantias] = useState<{ description: string; value: string; notes: string }[]>([])
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
        setContractDate(data.contractDate ? localDateStr(data.contractDate) : "")
        setFirstInstallmentDate(data.firstInstallmentDate ? localDateStr(data.firstInstallmentDate) : "")
        setSkipSaturday(Boolean(data.skipSaturday))
        setSkipSunday(Boolean(data.skipSunday))
        setSkipHolidays(Boolean(data.skipHolidays))
        setNotes(data.notes || "")
        setLoanTags(Array.isArray(data.tags) ? data.tags : [])
        setWhatsappNotify(Boolean(data.whatsappNotify))
        setDailyInterest(Boolean(data.dailyInterest))
        setDailyInterestAmount(String(data.dailyInterestAmount || 0))
        if (Array.isArray(data.installments)) {
          const sorted = [...data.installments].sort((a, b) => a.number - b.number)
          setInstallmentDates(sorted.map((inst) => localDateStr(inst.dueDate)))
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

  const didInitDatesRef = useRef(false)
  useEffect(() => {
    if (!firstInstallmentDate || installmentCount < 1) return
    // Não regenerar as datas no carregamento — preserva as datas salvas/editadas.
    // Só regenera quando o usuário muda os campos (data, parcelas, modalidade...) depois.
    if (!didInitDatesRef.current) { didInitDatesRef.current = true; return }
    const dates = generateInstallmentDates(
      new Date(firstInstallmentDate + "T12:00:00"),
      installmentCount,
      modality,
      skipSaturday,
      skipSunday,
      skipHolidays
    )
    setInstallmentDates(dates.map((d) => localDateStr(d)))
  }, [firstInstallmentDate, installmentCount, modality, skipSaturday, skipSunday, skipHolidays])

  const selectedClient = clients.find((client) => client.id === clientId)
  const filteredClients = clients.filter((client) => {
    if (!clientSearch.trim()) return true
    const q = clientSearch.toLowerCase()
    return client.name.toLowerCase().includes(q)
      || (client.phone || "").toLowerCase().includes(q)
      || (client.document || "").toLowerCase().includes(q)
  })

  const inputClass = "mt-1.5 h-9 rounded-md border-gray-200 dark:border-zinc-700 bg-white dark:bg-[#121614] px-3 text-sm text-slate-700 dark:text-zinc-100 shadow-none"
  const selectClass = "mt-1.5 h-9 w-full appearance-none rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-[#121614] px-3 pr-9 text-sm text-slate-700 dark:text-zinc-100 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
  const helperClass = "mt-1 text-xs text-slate-400 dark:text-zinc-500"
  const labelClass = "text-sm font-medium text-slate-700 dark:text-zinc-300"

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
    setInstallmentDates(dates.map((d) => localDateStr(d)))
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
        parseFloat(dailyInterestAmount) || 0,
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
        window.dispatchEvent(new Event("loans:updated"))
        return
      }

      window.dispatchEvent(new Event("loans:updated"))
      showToast("Empréstimo atualizado! As próximas cobranças usarão os novos dados.")
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
    <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#121614]">
      <div className="max-h-[calc(100vh-48px)] space-y-6 overflow-y-auto px-6 pb-8 pt-4 sm:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight text-slate-800 dark:text-zinc-100 sm:text-xl">Editar Empréstimo</h1>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500 text-white transition hover:bg-red-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Cliente *</Label>
          <button
            type="button"
            onClick={() => setClientPickerOpen((open) => !open)}
            className="mt-1.5 flex h-9 w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 text-left transition hover:border-primary/50 dark:border-zinc-700 dark:bg-[#121614]"
          >
            <div className="flex min-w-0 items-center gap-2">
              {selectedClient ? (
                <>
                  <Avatar name={selectedClient.name} src={selectedClient.photo} size="sm" className="h-6 w-6 text-[10px] bg-primary/20 text-primary" />
                  <span className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">{selectedClient.name}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-[#3a2f12] dark:text-[#f5c451]">
                    👍 {selectedClient.score}
                  </span>
                </>
              ) : (
                <span className="text-sm text-slate-500 dark:text-zinc-400">Selecione o cliente</span>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400 dark:text-zinc-500" />
          </button>

          {clientPickerOpen && (
            <div className="mt-2 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-[#121614]">
              <div className="border-b border-gray-100 p-3 dark:border-zinc-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                  <Input
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Buscar cliente..."
                    className="pl-9 border-gray-200 bg-white dark:border-zinc-700 dark:bg-[#121614]"
                    autoFocus
                  />
                </div>
              </div>
              <div className="p-2 pb-0">
                <button
                  type="button"
                  onClick={() => { setManualSelected(true); setClientId("") }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${manualSelected ? "bg-primary/10 text-primary dark:bg-[#29322E] dark:text-zinc-100" : "text-gray-500 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-[#29322E]"}`}
                >
                  <span className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Digitar manualmente</span>
                  {manualSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {filteredClients.length === 0 ? (
                  <div className="rounded-lg px-3 py-6 text-center text-sm text-gray-500 dark:text-zinc-400">
                    {clientSearch.trim() ? "Nenhum cliente encontrado." : "Digite para buscar um cliente."}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredClients.map((client) => {
                      const isSelected = client.id === clientId
                      return (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => { setClientId(client.id); setManualSelected(false); setClientPickerOpen(false); setClientSearch("") }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${isSelected ? "bg-primary/10 dark:bg-[#29322E]" : "hover:bg-gray-50 dark:hover:bg-[#29322E]"}`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={client.name} src={client.photo} size="sm" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">{client.name}</p>
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-[#3a2f12] dark:text-[#f5c451]">
                                  👍 {client.score ?? 0}
                                </span>
                              </div>
                              <p className="truncate text-xs text-gray-500 dark:text-zinc-400">
                                {client.phone || client.document || "Sem telefone ou CPF"}
                              </p>
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Valor (R$) *</Label>
            <Input type="number" step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Juros (%)</Label>
            <Input type="number" step="0.1" value={interestRate || ""} onChange={(e) => setInterestRate(Number(e.target.value))} className={inputClass} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Tipo de Pagamento</Label>
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
            <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Parcelas</Label>
            <Input type="number" min={1} value={installmentCount} onChange={(e) => setInstallmentCount(Number(e.target.value) || 1)} className={inputClass} />
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Juros Aplicado</Label>
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
            <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Juros Total (R$)</Label>
            {interestType === "FIXED_AMOUNT" ? (
              <Input type="number" step="0.01" value={totalInterestAmount || ""} onChange={(e) => setTotalInterestAmount(Number(e.target.value))} className={inputClass} />
            ) : (
              <Input type="text" readOnly value={formatCurrency(preview.totalInterest)} className={`${inputClass} bg-gray-50 dark:bg-[#121614] text-slate-700 dark:text-zinc-100`} />
            )}
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Valor da Parcela (R$)</Label>
            <Input type="text" readOnly value={formatCurrency(preview.installmentAmount)} className={`${inputClass} bg-gray-50 dark:bg-[#121614] text-slate-700 dark:text-zinc-100`} />
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Total a Receber</Label>
          <Input type="text" readOnly value={formatCurrency(preview.totalAmount)} className={`${inputClass} w-full bg-primary/10 dark:bg-[#222A26] text-primary dark:text-primary font-semibold`} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Data do Contrato</Label>
            <div className="relative">
              <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className={`${inputClass} pr-3 cal-green`} />
            </div>
            <p className={helperClass}>Quando foi fechado</p>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">1ª Parcela *</Label>
            <div className="relative">
              <Input type="date" value={firstInstallmentDate} onChange={(e) => setFirstInstallmentDate(e.target.value)} className={`${inputClass} pr-3 cal-green`} />
            </div>
            <p className={helperClass}>Quando começa a pagar</p>
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Datas das Parcelas</Label>
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
                    className={`${inputClass} mt-0 pr-3 cal-green`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Não cobra nos seguintes dias:</p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
              <input type="checkbox" checked={skipSaturday} onChange={(e) => setSkipSaturday(e.target.checked)} className="h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-2 border-green-600 bg-transparent transition-colors checked:bg-green-500" /> Sábados
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
              <input type="checkbox" checked={skipSunday} onChange={(e) => setSkipSunday(e.target.checked)} className="h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-2 border-green-600 bg-transparent transition-colors checked:bg-green-500" /> Domingos
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
              <input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} className="h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-2 border-green-600 bg-transparent transition-colors checked:bg-green-500" /> Feriados
            </label>
          </div>
          <Button type="button" variant="outline" onClick={handleRecalculateDates} className="gap-2 rounded-xl">
            <RefreshCw className="h-4 w-4" /> Recalcular Datas
          </Button>
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-800 dark:text-zinc-100 sm:text-sm">Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações sobre este empréstimo..."
            className={`${inputClass} mt-1.5 min-h-[80px] resize-y`}
          />
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">
              <Shield className="h-4 w-4 text-amber-600" /> Garantias (opcional)
            </span>
            <button
              type="button"
              onClick={() => setGarantias([...garantias, { description: "", value: "", notes: "" }])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
          {garantias.length === 0 ? (
            <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-zinc-400">Registre bens recebidos como garantia. Não afeta cálculos — apenas aparece no comprovante.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {garantias.map((g, i) => (
                <div key={i} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Garantia {i + 1}</span>
                    <button type="button" onClick={() => setGarantias(garantias.filter((_, idx) => idx !== i))} className="text-red-500 transition hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Descrição do bem *</Label>
                      <Input
                        value={g.description}
                        onChange={(e) => setGarantias(garantias.map((it, idx) => idx === i ? { ...it, description: e.target.value } : it))}
                        className={`${inputClass} mt-1`}
                        placeholder="Ex: Moto Honda CG 160 placa ABC1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Valor combinado (R$)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={g.value}
                        onChange={(e) => { const v = e.target.value; if (/^\d*[,.]?\d*$/.test(v)) setGarantias(garantias.map((it, idx) => idx === i ? { ...it, value: v.replace(",", ".") } : it)) }}
                        className={`${inputClass} mt-1`}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-xs">Observações</Label>
                    <Textarea
                      value={g.notes}
                      onChange={(e) => setGarantias(garantias.map((it, idx) => idx === i ? { ...it, notes: e.target.value } : it))}
                      className={`${inputClass} mt-1 min-h-[70px] resize-y`}
                      placeholder="Estado de conservação, onde está guardado, etc."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-2 dark:border-zinc-800">
          <Button variant="outline" className="rounded-md px-5 !border-gray-300 dark:!border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800" onClick={handleClose}>Cancelar</Button>
          <Button className="rounded-md bg-primary px-5 text-white hover:bg-primary/90" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Alterações"}</Button>
        </div>
      </div>
    </div>
  )

  if (presentation === "modal") {
    return card
  }

  return <div className="min-h-screen bg-[#f6f8f7] px-4 py-6 dark:bg-zinc-950 sm:px-6">{card}</div>
}
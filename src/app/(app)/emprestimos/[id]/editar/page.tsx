"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar } from "@/components/avatar"
import { RefreshCw, Plus, X } from "lucide-react"
import { calculateLoan, formatCurrency, generateInstallmentDates } from "@/lib/utils"

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
  whatsappNotify: boolean
  notes: string | null
  tags: string[]
  client: { id: string; name: string; photo: string | null }
  installments: { id: string; number: number; dueDate: string; paidAmount: number; status: string }[]
}

export default function EditarEmprestimoPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const loanId = params?.id

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
  const [whatsappNotify, setWhatsappNotify] = useState(false)
  const [installmentDates, setInstallmentDates] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [loanTags, setLoanTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLoan = async () => {
      if (!loanId) return
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
  }, [loanId])

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

  const selectedClient = clients.find((c) => c.id === clientId)

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

  const handleSave = async () => {
    if (!loanId) return
    if (!clientId) return setError("Selecione um cliente")
    if (!amount || amount <= 0) return setError("Informe um valor válido")
    if (!installmentCount || installmentCount < 1) return setError("Informe a quantidade de parcelas")

    setSaving(true)
    setError(null)
    try {
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

      router.push(`/emprestimos/${loanId}`)
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
        <Button variant="outline" onClick={() => router.push("/emprestimos")}>Voltar</Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Editar Empréstimo</h1>
          <p className="text-gray-500 dark:text-zinc-400">Ajuste os dados do contrato e recalcule as parcelas</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/emprestimos/${loanId}`)}>
          Voltar
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-50 dark:bg-red-950/300/10 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 p-5">
        <div>
          <Label>Cliente *</Label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100"
          >
            <option value="">Selecione o cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {selectedClient && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 px-2.5 py-1.5">
              <Avatar name={selectedClient.name} src={selectedClient.photo} size="sm" />
              <span className="text-sm text-gray-900 dark:text-zinc-100">{selectedClient.name}</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">👍 {selectedClient.score}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Valor (R$) *</Label>
            <Input type="number" step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label>Juros (%)</Label>
            <Input type="number" step="0.1" value={interestRate || ""} onChange={(e) => setInterestRate(Number(e.target.value))} className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tipo de Pagamento</Label>
            <select value={modality} onChange={(e) => setModality(e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100">
              <option value="MONTHLY">Parcelado (Mensal)</option>
              <option value="BIWEEKLY">Quinzenal</option>
              <option value="WEEKLY">Semanal</option>
              <option value="DAILY">Diário</option>
            </select>
          </div>
          <div>
            <Label>Parcelas</Label>
            <Input type="number" min={1} value={installmentCount} onChange={(e) => setInstallmentCount(Number(e.target.value) || 1)} className="mt-1" />
          </div>
        </div>

        <div>
          <Label>Juros Aplicado</Label>
          <select value={interestType} onChange={(e) => setInterestType(e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100">
            <option value="PER_INSTALLMENT">Por Parcela</option>
            <option value="TOTAL">Sobre o Total</option>
            <option value="FIXED_AMOUNT">Valor Fixo (R$)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Juros Total (R$)</Label>
            {interestType === "FIXED_AMOUNT" ? (
              <Input type="number" step="0.01" value={totalInterestAmount || ""} onChange={(e) => setTotalInterestAmount(Number(e.target.value))} className="mt-1" />
            ) : (
              <Input type="text" readOnly value={formatCurrency(preview.totalInterest)} className="mt-1 bg-gray-100 dark:bg-zinc-800" />
            )}
          </div>
          <div>
            <Label>Valor da Parcela (R$)</Label>
            <Input type="text" readOnly value={formatCurrency(preview.installmentAmount)} className="mt-1 bg-gray-100 dark:bg-zinc-800" />
          </div>
        </div>

        <div>
          <Label>Total a Receber</Label>
          <div className="mt-1 flex h-10 w-full items-center rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 text-sm font-bold tabular-nums tracking-tight text-emerald-600">
            {formatCurrency(preview.totalAmount)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Data do Contrato</Label>
            <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className="mt-1" />
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Quando foi fechado</p>
          </div>
          <div>
            <Label>1ª Parcela *</Label>
            <Input type="date" value={firstInstallmentDate} onChange={(e) => setFirstInstallmentDate(e.target.value)} className="mt-1" />
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Quando começa a pagar</p>
          </div>
        </div>

        <div>
          <Label>Datas das Parcelas</Label>
          <div className="mt-2 space-y-2 max-h-[240px] overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-800 p-3">
            {installmentDates.map((date, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-zinc-400 w-20">Parcela {i + 1}:</span>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    const updated = [...installmentDates]
                    updated[i] = e.target.value
                    setInstallmentDates(updated)
                  }}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-zinc-400">Não cobra nos seguintes dias:</p>
          <div className="flex gap-6 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-zinc-200">
              <input type="checkbox" checked={skipSaturday} onChange={(e) => setSkipSaturday(e.target.checked)} /> Sábados
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-zinc-200">
              <input type="checkbox" checked={skipSunday} onChange={(e) => setSkipSunday(e.target.checked)} /> Domingos
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-zinc-200">
              <input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} /> Feriados
            </label>
          </div>
          <Button type="button" variant="outline" onClick={handleRecalculateDates} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Recalcular Datas
          </Button>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea className="mt-1" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div>
          <Label>Etiquetas</Label>
          <div className="flex flex-wrap gap-1 mt-1 mb-2">
            {loanTags.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                {tag}
                <button type="button" onClick={() => setLoanTags(loanTags.filter((_, idx) => idx !== i))} className="hover:text-red-800 dark:hover:text-red-300">
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
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  const val = tagInput.trim()
                  if (val && !loanTags.includes(val)) {
                    setLoanTags([...loanTags, val])
                  }
                  setTagInput("")
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                const val = tagInput.trim()
                if (val && !loanTags.includes(val)) {
                  setLoanTags([...loanTags, val])
                }
                setTagInput("")
              }}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
            <input type="checkbox" checked={dailyInterest} onChange={(e) => setDailyInterest(e.target.checked)} /> Juros diário
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
            <input type="checkbox" checked={whatsappNotify} onChange={(e) => setWhatsappNotify(e.target.checked)} /> Notificar WhatsApp
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push(`/emprestimos/${loanId}`)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Alterações"}</Button>
        </div>
      </div>
    </div>
  )
}

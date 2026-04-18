"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calculator, Calendar, Download, HelpCircle, Plus, Table2, User, Wallet, DollarSign, TrendingUp } from "lucide-react"
import { formatCurrency, generateInstallmentDates } from "@/lib/utils"

interface Client {
  id: string
  name: string
  phone: string | null
  document: string | null
}

const today = () => new Date().toISOString().split("T")[0]

function calcPrice(amount: number, monthlyRatePercent: number, installments: number) {
  if (!amount || !installments) {
    return { installmentValue: 0, totalAmount: 0, totalInterest: 0 }
  }

  const rate = monthlyRatePercent / 100
  if (rate <= 0) {
    const installmentValue = amount / installments
    return {
      installmentValue: Math.round(installmentValue * 100) / 100,
      totalAmount: Math.round(amount * 100) / 100,
      totalInterest: 0,
    }
  }

  const factor = Math.pow(1 + rate, installments)
  const installmentValue = amount * ((rate * factor) / (factor - 1))
  const totalAmount = installmentValue * installments
  const totalInterest = totalAmount - amount

  return {
    installmentValue: Math.round(installmentValue * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
  }
}

export default function TabelaPricePage() {
  const router = useRouter()

  const [clients, setClients] = useState<Client[]>([])
  const [allLoansCount, setAllLoansCount] = useState(0)
  const [receivedCount, setReceivedCount] = useState(0)

  const [clientId, setClientId] = useState("")
  const [amount, setAmount] = useState<number>(0)
  const [monthlyRate, setMonthlyRate] = useState<number>(0)
  const [installments, setInstallments] = useState<number>(1)
  const [modality, setModality] = useState("MONTHLY")
  const [contractDate, setContractDate] = useState(today())
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(today())
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  const preview = useMemo(() => calcPrice(amount, monthlyRate, installments), [amount, monthlyRate, installments])

  const installmentDates = useMemo(() => {
    if (!firstInstallmentDate || installments < 1) return []
    return generateInstallmentDates(new Date(firstInstallmentDate + "T12:00:00"), installments, modality)
      .map((d) => d.toISOString().split("T")[0])
  }, [firstInstallmentDate, installments, modality])

  const amortizationTable = useMemo(() => {
    if (!amount || !installments || installments < 1) return []
    const rate = monthlyRate / 100
    const rows: Array<{ n: number; payment: number; amort: number; interest: number; balance: number; date: string }> = []
    let balance = amount
    for (let i = 0; i < installments; i++) {
      const interest = Math.round(balance * rate * 100) / 100
      const payment = preview.installmentValue
      const amort = Math.round((payment - interest) * 100) / 100
      balance = Math.max(0, Math.round((balance - amort) * 100) / 100)
      rows.push({
        n: i + 1,
        payment,
        amort,
        interest,
        balance,
        date: installmentDates[i] || "",
      })
    }
    return rows
  }, [amount, monthlyRate, installments, preview.installmentValue, installmentDates])

  useEffect(() => {
    const load = async () => {
      const [clientsRes, loansRes] = await Promise.all([fetch("/api/clients"), fetch("/api/loans")])
      const clientsData = await clientsRes.json()
      const loansData = await loansRes.json()
      const loans = Array.isArray(loansData) ? loansData : []
      setClients(Array.isArray(clientsData) ? clientsData : [])
      setAllLoansCount(loans.length)
      setReceivedCount(loans.filter((l: any) => l.status === "COMPLETED").length)
    }
    load()
  }, [])

  const handleCreate = async () => {
    if (!clientId) return alert("Selecione o cliente")
    if (!amount || amount <= 0) return alert("Informe o valor")
    if (!installments || installments < 1) return alert("Informe as parcelas")

    setLoading(true)
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          amount,
          interestRate: monthlyRate,
          interestType: "FIXED_AMOUNT",
          modality,
          installmentCount: installments,
          totalInterestAmount: preview.totalInterest,
          contractDate,
          firstInstallmentDate,
          installmentDates,
          notes: notes || undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error || "Erro ao criar empréstimo Price")
        return
      }

      alert("Empréstimo Price criado com sucesso")
      router.push("/emprestimos")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Empréstimos</h1>
          <p className="text-gray-500 dark:text-zinc-400">Gerencie seus empréstimos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.open("https://pt.wikipedia.org/wiki/Sistema_de_amortiza%C3%A7%C3%A3o_franc%C3%AAs", "_blank")}>
            <HelpCircle className="h-4 w-4" /> Tutorial
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => router.push("/emprestimos/relatorio")}>
            <Download className="h-4 w-4" /> Baixar Relatório
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 rounded-xl p-1 border border-gray-200 dark:border-zinc-800 overflow-x-auto">
        <button onClick={() => router.push("/emprestimos")} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200 whitespace-nowrap">Empréstimos ({allLoansCount})</button>
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white whitespace-nowrap flex items-center gap-1.5"><Table2 className="h-3.5 w-3.5" />Tabela Price</button>
        <button onClick={() => router.push("/emprestimos/recebimentos")} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 whitespace-nowrap">Recebimentos ({receivedCount})</button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2"><Table2 className="h-5 w-5 text-blue-600" /> Sistema de Amortização Francês (Price)</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Parcelas fixas com juros compostos embutidos - ideal para empréstimos de longo prazo</p>
        </div>

        <div>
          <Label className="flex items-center gap-1"><User className="h-4 w-4" /> Cliente</Label>
          <div className="mt-1 flex gap-2">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100"
            >
              <option value="">Selecione o cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            <button
              onClick={() => router.push("/clientes")}
              className="h-10 w-10 rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700"
              title="Cadastrar cliente"
            >
              <Plus className="h-4 w-4 mx-auto" />
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <Label className="flex items-center gap-1"><DollarSign className="h-4 w-4" /> Valor do Capital</Label>
            <Input type="number" step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label>% Taxa Mensal (%)</Label>
            <Input type="number" step="0.01" value={monthlyRate || ""} onChange={(e) => setMonthlyRate(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Parcelas</Label>
            <Input type="number" min={1} value={installments || ""} onChange={(e) => setInstallments(Number(e.target.value) || 1)} className="mt-1" />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Frequência</Label>
            <select value={modality} onChange={(e) => setModality(e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100">
              <option value="MONTHLY">Mensal</option>
              <option value="BIWEEKLY">Quinzenal</option>
              <option value="WEEKLY">Semanal</option>
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Data do Contrato</Label>
            <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Calendar className="h-4 w-4" /> 1ª Parcela</Label>
            <Input type="date" value={firstInstallmentDate} onChange={(e) => setFirstInstallmentDate(e.target.value)} className="mt-1" />
          </div>
        </div>
      </div>

      {/* Tabela de Amortização */}
      {amount > 0 && installments > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              <Table2 className="h-5 w-5 text-blue-600" /> Tabela de Amortização
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-emerald-600" /> Parcela: {formatCurrency(preview.installmentValue)}
              </span>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                const printContent = `
                  <html><head><title>Tabela Price</title>
                  <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:center}th{background:#f5f5f5}h2{margin-bottom:10px}</style>
                  </head><body>
                  <h2>Tabela de Amortização - Price</h2>
                  <p>Capital: ${formatCurrency(amount)} | Taxa: ${monthlyRate}% | Parcelas: ${installments}</p>
                  <table><thead><tr><th>#</th><th>Parcela</th><th>Amortização</th><th>Juros</th><th>Saldo</th><th>Vencimento</th></tr></thead><tbody>
                  ${amortizationTable.map(r => `<tr><td>${r.n}</td><td>${formatCurrency(r.payment)}</td><td>${formatCurrency(r.amort)}</td><td>${formatCurrency(r.interest)}</td><td>${formatCurrency(r.balance)}</td><td>${r.date ? new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td></tr>`).join("")}
                  </tbody></table></body></html>`
                const w = window.open("", "_blank")
                if (w) { w.document.write(printContent); w.document.close(); w.print() }
              }}>
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-800">
                  <th className="pb-3 font-medium">#</th>
                  <th className="pb-3 font-medium text-center">Parcela</th>
                  <th className="pb-3 font-medium text-center">Amortização</th>
                  <th className="pb-3 font-medium text-center">Juros</th>
                  <th className="pb-3 font-medium text-center">Saldo</th>
                  <th className="pb-3 font-medium text-right">Vencimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {amortizationTable.map((row) => (
                  <tr key={row.n} className="text-sm">
                    <td className="py-3 text-blue-600 font-medium">{row.n}</td>
                    <td className="py-3 text-center font-medium text-gray-900 dark:text-zinc-100">{formatCurrency(row.payment)}</td>
                    <td className="py-3 text-center text-blue-600 font-medium">{formatCurrency(row.amort)}</td>
                    <td className="py-3 text-center text-orange-600 font-medium">{formatCurrency(row.interest)}</td>
                    <td className="py-3 text-center text-gray-700 dark:text-zinc-300">{formatCurrency(row.balance)}</td>
                    <td className="py-3 text-right text-gray-500 dark:text-zinc-400">
                      {row.date ? new Date(row.date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totais */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-zinc-800">
            <p className="text-sm font-semibold flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <span className="text-gray-600 dark:text-zinc-400">Total a Receber:</span>
              <span className="text-orange-500">{formatCurrency(amortizationTable.reduce((s, r) => s + r.payment, 0))}</span>
            </p>
            <p className="text-sm font-semibold flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-gray-600 dark:text-zinc-400">Juros Total:</span>
              <span className="text-emerald-500">{formatCurrency(amortizationTable.reduce((s, r) => s + r.interest, 0))}</span>
            </p>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-zinc-800">
            <Button onClick={handleCreate} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Table2 className="h-4 w-4" />
              {loading ? "Criando..." : "Criar Empréstimo Price"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

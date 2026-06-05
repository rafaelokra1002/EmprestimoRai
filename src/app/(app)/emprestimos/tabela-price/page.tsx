"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import { Calculator, Calendar, Download, HelpCircle, Plus, Table2, User, Wallet, DollarSign, TrendingUp, X, MessageCircle, Send, Loader2, CheckCircle2, Copy, ExternalLink, FileText } from "lucide-react"
import { formatCurrency, generateInstallmentDates, localDateStr } from "@/lib/utils"

interface Client {
  id: string
  name: string
  phone: string | null
  document: string | null
}

const today = () => localDateStr()

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
  const [priceLoans, setPriceLoans] = useState<any[]>([])
  const [successDialog, setSuccessDialog] = useState(false)
  const [createdInfo, setCreatedInfo] = useState<{
    clientName: string; clientPhone: string | null
    amount: number; interestRate: number; installmentCount: number
    installmentValue: number; totalAmount: number; totalInterest: number
    firstInstallmentDate: string; modality: string
    table: { n: number; payment: number; amort: number; interest: number; balance: number; date: string }[]
  } | null>(null)

  const [clientId, setClientId] = useState("")
  const [amount, setAmount] = useState<number>(0)
  const [monthlyRate, setMonthlyRate] = useState<number>(0)
  const [installments, setInstallments] = useState<number>(1)
  const [modality, setModality] = useState("MONTHLY")
  const [contractDate, setContractDate] = useState(today())
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(today())
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  // Card suspenso
  type RowDetail = { n: number; payment: number; amort: number; interest: number; balance: number; date: string }
  const [selectedRow, setSelectedRow] = useState<RowDetail | null>(null)
  const [waSending, setWaSending] = useState(false)
  const [waSent, setWaSent] = useState(false)

  const selectedClient = clients.find(c => c.id === clientId) || null

  const buildRowMessage = (row: RowDetail) => {
    const clientName = selectedClient?.name || "Cliente"
    const dateStr = row.date ? new Date(row.date + "T12:00:00").toLocaleDateString("pt-BR") : "—"
    return `📋 Tabela Price — Parcela ${row.n}/${installments}\n\n👤 ${clientName}\n\n💰 Valor da Parcela: ${formatCurrency(row.payment)}\n📉 Amortização: ${formatCurrency(row.amort)}\n📈 Juros: ${formatCurrency(row.interest)}\n💼 Saldo após: ${formatCurrency(row.balance)}\n📅 Vencimento: ${dateStr}`
  }

  const sendWhatsapp = async () => {
    if (!selectedRow || !selectedClient?.phone) return
    setWaSending(true)
    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selectedClient.phone, message: buildRowMessage(selectedRow) }),
      })
      setWaSent(true)
    } catch {}
    setWaSending(false)
  }

  const preview = useMemo(() => calcPrice(amount, monthlyRate, installments), [amount, monthlyRate, installments])

  const installmentDates = useMemo(() => {
    if (!firstInstallmentDate || installments < 1) return []
    return generateInstallmentDates(new Date(firstInstallmentDate + "T12:00:00"), installments, modality)
      .map((d) => localDateStr(d))
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

  const loadData = async () => {
    const [clientsRes, loansRes] = await Promise.all([fetch("/api/clients"), fetch("/api/loans")])
    const clientsData = await clientsRes.json()
    const loansData = await loansRes.json()
    const loans = Array.isArray(loansData) ? loansData : []
    setClients(Array.isArray(clientsData) ? clientsData : [])
    setAllLoansCount(loans.length)
    setReceivedCount(loans.filter((l: any) => l.status === "COMPLETED").length)
    setPriceLoans(loans.filter((l: any) => l.interestType === "FIXED_AMOUNT"))
  }

  useEffect(() => { loadData() }, [])

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

      setCreatedInfo({
        clientName: selectedClient?.name || "Cliente",
        clientPhone: selectedClient?.phone || null,
        amount,
        interestRate: monthlyRate,
        installmentCount: installments,
        installmentValue: preview.installmentValue,
        totalAmount: preview.totalAmount,
        totalInterest: preview.totalInterest,
        firstInstallmentDate,
        modality,
        table: amortizationTable,
      })
      setSuccessDialog(true)
      setAmount(0); setMonthlyRate(0); setInstallments(1); setClientId(""); setNotes("")
      await loadData()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 pt-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Empréstimos</h1>
          <p className="text-gray-500 dark:text-zinc-400">Gerencie seus empréstimos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.open("https://pt.wikipedia.org/wiki/Sistema_de_amortiza%C3%A7%C3%A3o_franc%C3%AAs", "_blank")}>
            <HelpCircle className="h-4 w-4" /> Tutorial
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => window.location.href = "/emprestimos/relatorio"}>
            <Download className="h-4 w-4" /> Baixar Relatório
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 rounded-xl p-1 border border-gray-200 dark:border-zinc-800 overflow-x-auto">
        <a href="/emprestimos" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200 whitespace-nowrap">Empréstimos ({allLoansCount})</a>
        <button type="button" className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white whitespace-nowrap flex items-center gap-1.5"><Table2 className="h-3.5 w-3.5" />Tabela Price</button>
        <a href="/emprestimos/recebimentos" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 whitespace-nowrap">Recebimentos ({receivedCount})</a>
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
              type="button"
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
                <DollarSign className="h-4 w-4 text-primary" /> Parcela: {formatCurrency(preview.installmentValue)}
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

          <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800">
            <div className="grid grid-cols-3 px-4 py-2 bg-gray-100 dark:bg-zinc-800/60 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              <span>Parcela</span>
              <span className="text-center">Vencimento</span>
              <span className="text-right">Valor</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {amortizationTable.map((row) => (
                <div
                  key={row.n}
                  onClick={() => { setSelectedRow(row); setWaSent(false) }}
                  className="grid grid-cols-3 items-center px-4 py-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0">
                      {row.n}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-zinc-400">/{installments}</span>
                  </div>
                  <span className="text-center text-sm text-gray-700 dark:text-zinc-300">
                    {row.date ? new Date(row.date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                  </span>
                  <span className="text-right text-sm font-semibold text-primary">
                    {formatCurrency(row.payment)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totais */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-zinc-800">
            <p className="text-sm font-semibold flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <span className="text-gray-600 dark:text-zinc-400">Total a Receber:</span>
              <span className="text-orange-500">{formatCurrency(amortizationTable.reduce((s, r) => s + r.payment, 0))}</span>
            </p>
            <p className="text-sm font-semibold flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-gray-600 dark:text-zinc-400">Juros Total:</span>
              <span className="text-primary">{formatCurrency(amortizationTable.reduce((s, r) => s + r.interest, 0))}</span>
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
      {/* Dialog de sucesso */}
      <Dialog open={successDialog} onClose={() => setSuccessDialog(false)} className="max-w-md">
        <div className="space-y-5">
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-primary">Empréstimo Criado!</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Deseja enviar comprovante ao cliente?</p>
          </div>

          {createdInfo && (
            <div className="rounded-lg border border-gray-200 dark:border-zinc-700 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-bold text-gray-900 dark:text-zinc-100">{createdInfo.clientName}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-zinc-300">
                <div className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-gray-400" /> Valor: {formatCurrency(createdInfo.amount)}</div>
                <div className="flex items-center gap-1.5"><span className="text-gray-400 text-xs font-bold">%</span> Taxa: {createdInfo.interestRate}%/mês</div>
                <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-gray-400" /> {createdInfo.installmentCount}x {formatCurrency(createdInfo.installmentValue)}</div>
                <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gray-400" /> Venc: {new Date(createdInfo.firstInstallmentDate + "T12:00:00").toLocaleDateString("pt-BR")}</div>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-zinc-700 pt-3">
                <span className="text-sm text-gray-500 dark:text-zinc-400">Total a Receber:</span>
                <span className="text-lg font-bold tabular-nums text-primary">{formatCurrency(createdInfo.totalAmount)}</span>
              </div>
              <div className="text-xs text-gray-400 dark:text-zinc-500 flex justify-between border-t border-gray-100 dark:border-zinc-800 pt-2">
                <span>Juros Total (Price):</span>
                <span className="font-medium text-orange-500">{formatCurrency(createdInfo.totalInterest)}</span>
              </div>

              {/* Tabela de parcelas */}
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Parcelas</p>
                <div className="rounded-lg overflow-hidden border border-gray-100 dark:border-zinc-800">
                  <div className="grid grid-cols-3 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800/60 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                    <span>Parcela</span><span className="text-center">Vencimento</span><span className="text-right">Valor</span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-48 overflow-y-auto">
                    {createdInfo.table.map((row) => (
                      <div key={row.n} className="grid grid-cols-3 items-center px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold shrink-0">{row.n}</span>
                          <span className="text-xs text-gray-400 dark:text-zinc-500">/{createdInfo.installmentCount}</span>
                        </div>
                        <span className="text-center text-xs text-gray-600 dark:text-zinc-300">
                          {row.date ? new Date(row.date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                        </span>
                        <span className="text-right text-xs font-semibold text-primary">{formatCurrency(row.payment)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => {
              if (!createdInfo) return
              const text = `📋 *Empréstimo Price — Relatório*\n\n👤 ${createdInfo.clientName}\n\n💰 Capital: ${formatCurrency(createdInfo.amount)}\n📊 Taxa: ${createdInfo.interestRate}% ao mês\n📅 1ª Parcela: ${new Date(createdInfo.firstInstallmentDate + "T12:00:00").toLocaleDateString("pt-BR")}\n\n🔢 *${createdInfo.installmentCount} parcelas de ${formatCurrency(createdInfo.installmentValue)}*\n💵 Total a pagar: ${formatCurrency(createdInfo.totalAmount)}\n📈 Juros: ${formatCurrency(createdInfo.totalInterest)}`
              navigator.clipboard.writeText(text).then(() => alert("Texto copiado!"))
            }}>
              <Copy className="h-4 w-4" /> Copiar Texto
            </Button>
            <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => {
              if (!createdInfo) return
              const text = `📋 *Empréstimo Price — Relatório*\n\n👤 ${createdInfo.clientName}\n\n💰 Capital: ${formatCurrency(createdInfo.amount)}\n📊 Taxa: ${createdInfo.interestRate}% ao mês\n📅 1ª Parcela: ${new Date(createdInfo.firstInstallmentDate + "T12:00:00").toLocaleDateString("pt-BR")}\n\n🔢 *${createdInfo.installmentCount} parcelas de ${formatCurrency(createdInfo.installmentValue)}*\n💵 Total a pagar: ${formatCurrency(createdInfo.totalAmount)}\n📈 Juros: ${formatCurrency(createdInfo.totalInterest)}`
              const phone = createdInfo.clientPhone?.replace(/\D/g, "") || ""
              window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")
            }}>
              <ExternalLink className="h-4 w-4" /> Enviar para Cliente
            </Button>
          </div>
        </div>
      </Dialog>


      {/* Card suspenso */}
      {selectedRow && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelectedRow(null)} />
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm mx-auto px-4">
            <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-zinc-900 shadow-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-blue-600" />
                  <p className="font-bold text-gray-900 dark:text-zinc-100">Parcela {selectedRow.n}/{installments}</p>
                </div>
                <button onClick={() => setSelectedRow(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {selectedClient && (
                <p className="text-sm text-gray-500 dark:text-zinc-400 flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> {selectedClient.name}
                </p>
              )}

              <div className="rounded-xl bg-gray-50 dark:bg-zinc-800/60 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-zinc-400">Valor da Parcela</span>
                  <span className="font-semibold text-gray-900 dark:text-zinc-100">{formatCurrency(selectedRow.payment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-zinc-400">Amortização</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(selectedRow.amort)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-zinc-400">Juros</span>
                  <span className="font-semibold text-orange-500">{formatCurrency(selectedRow.interest)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-zinc-700 pt-2">
                  <span className="text-gray-500 dark:text-zinc-400">Saldo após</span>
                  <span className="font-semibold text-gray-900 dark:text-zinc-100">{formatCurrency(selectedRow.balance)}</span>
                </div>
                {selectedRow.date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-zinc-400">Vencimento</span>
                    <span className="font-semibold text-gray-900 dark:text-zinc-100">
                      {new Date(selectedRow.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}
              </div>

              {selectedClient?.phone ? (
                <button
                  onClick={sendWhatsapp}
                  disabled={waSending || waSent}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold py-3 transition-colors text-sm"
                >
                  {waSending ? <Loader2 className="h-4 w-4 animate-spin" /> : waSent ? "✓ Enviado!" : <><MessageCircle className="h-4 w-4" /> Enviar via WhatsApp</>}
                </button>
              ) : (
                <p className="text-center text-xs text-gray-400 dark:text-zinc-500">
                  {selectedClient ? "Cliente sem telefone cadastrado" : "Selecione um cliente para enviar"}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

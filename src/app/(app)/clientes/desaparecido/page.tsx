"use client"

import { useEffect, useMemo, useState } from "react"
import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Users, Phone, MapPin, FileText, CalendarDays, Percent, Wallet, AlertTriangle, Plus, Banknote, LayoutGrid, Rows3 } from "lucide-react"

interface DisappearedClient {
  id: string
  name: string
  phone: string | null
  document: string | null
  city: string | null
  notes: string | null
  photo: string | null
  createdAt: string
  status: "ACTIVE" | "INACTIVE" | "DESAPARECIDO"
  loans: {
    id: string
    amount: number
    totalAmount: number
    profit: number
    interestRate: number
    modality: string
    installmentCount: number
    dailyInterest: boolean
    dailyInterestAmount: number
    status: string
    installments: {
      id: string
      number: number
      amount: number
      paidAmount: number
      status: string
      dueDate: string
    }[]
  }[]
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "-"
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("pt-BR")
}

function getOutstandingBalance(client: DisappearedClient) {
  return client.loans
    .filter((loan) => loan.status === "ACTIVE")
    .reduce((clientTotal, loan) => {
      const loanBalance = loan.installments.reduce((sum, installment) => {
        return sum + Math.max(installment.amount - installment.paidAmount, 0)
      }, 0)
      return clientTotal + loanBalance
    }, 0)
}

function getActiveLoans(client: DisappearedClient) {
  return client.loans.filter((loan) => loan.status === "ACTIVE")
}

function getNextDueDate(client: DisappearedClient) {
  const nextInstallment = getActiveLoans(client)
    .flatMap((loan) => loan.installments)
    .filter((installment) => installment.status !== "PAID")
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())[0]

  return nextInstallment?.dueDate
}

function getInterestSummary(client: DisappearedClient) {
  const activeLoans = getActiveLoans(client)
  if (activeLoans.length === 0) return "-"

  return activeLoans
    .map((loan) => loan.dailyInterest ? `${loan.interestRate}% + ${formatCurrency(loan.dailyInterestAmount)}/dia` : `${loan.interestRate}%`)
    .join(" | ")
}

export default function ClientesDesaparecidosPage() {
  const [clients, setClients] = useState<DisappearedClient[]>([])
  const [search, setSearch] = useState("")
  const [pickerSearch, setPickerSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards")

  useEffect(() => {
    const fetchClients = async () => {
      const response = await fetch("/api/clients?includeInstallments=true")
      const data = await response.json()
      const list = Array.isArray(data) ? data : []
      setClients(list)
      setLoading(false)
    }

    fetchClients()
  }, [])

  const disappearedClients = useMemo(() => {
    return clients.filter((client) => client.status === "DESAPARECIDO")
  }, [clients])

  const filteredClients = useMemo(() => {
    return disappearedClients.filter((client) => {
      const term = search.toLowerCase()
      return (
        client.name.toLowerCase().includes(term) ||
        client.phone?.includes(search) ||
        client.document?.includes(search) ||
        client.city?.toLowerCase().includes(term)
      )
    })
  }, [disappearedClients, search])

  const candidateClients = useMemo(() => {
    const term = pickerSearch.toLowerCase()

    return clients
      .filter((client) => client.status !== "DESAPARECIDO")
      .filter((client) => {
        return (
          client.name.toLowerCase().includes(term) ||
          client.phone?.includes(pickerSearch) ||
          client.document?.includes(pickerSearch) ||
          client.city?.toLowerCase().includes(term)
        )
      })
      .sort((left, right) => {
        const leftHasActiveLoan = left.loans.some((loan) => loan.status === "ACTIVE")
        const rightHasActiveLoan = right.loans.some((loan) => loan.status === "ACTIVE")

        if (leftHasActiveLoan === rightHasActiveLoan) {
          return left.name.localeCompare(right.name)
        }

        return leftHasActiveLoan ? -1 : 1
      })
  }, [clients, pickerSearch])

  const markAsDisappeared = async (clientId: string) => {
    setSavingId(clientId)

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DESAPARECIDO" }),
      })

      if (!response.ok) {
        throw new Error("Falha ao atualizar cliente")
      }

      setClients((current) => current.map((client) => (
        client.id === clientId ? { ...client, status: "DESAPARECIDO" } : client
      )))
      setPickerOpen(false)
      setPickerSearch("")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Desaparecido</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            Clientes marcados como desaparecidos com resumo de empréstimos, juros e pendências.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            <Users className="h-4 w-4" />
            {filteredClients.length} clientes
          </div>
          <Button
            onClick={() => setPickerOpen(true)}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Adicionar Desaparecido
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar cliente desaparecido..."
          className="pl-10"
        />
      </div>

      <div className="flex justify-end">
        <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              viewMode === "table"
                ? "bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Rows3 className="h-4 w-4" />
            Tabela
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              viewMode === "cards"
                ? "bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Carregando clientes desaparecidos...
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
          <h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-zinc-100">Nenhum cliente desaparecido encontrado</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            Marque um cliente com status desaparecido para ele aparecer nesta página.
          </p>
        </div>
      ) : viewMode === "table" ? (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Empréstimos ativos</TableHead>
                <TableHead>Saldo em aberto</TableHead>
                <TableHead>Próximo vencimento</TableHead>
                <TableHead>Juros</TableHead>
                <TableHead>Cadastrado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => {
                const activeLoans = getActiveLoans(client)

                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={client.name} src={client.photo} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{client.name}</p>
                          <p className="truncate text-xs text-gray-500 dark:text-zinc-400">Desaparecido</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{client.phone || "-"}</TableCell>
                    <TableCell>{client.city || "-"}</TableCell>
                    <TableCell>{activeLoans.length}</TableCell>
                    <TableCell>{formatCurrency(getOutstandingBalance(client))}</TableCell>
                    <TableCell>{formatDate(getNextDueDate(client))}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{getInterestSummary(client)}</TableCell>
                    <TableCell>{formatDate(client.createdAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {filteredClients.map((client) => {
            const activeLoans = getActiveLoans(client)
            const outstandingBalance = getOutstandingBalance(client)

            return (
              <div key={client.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={client.name} src={client.photo} size="lg" className="h-12 w-12 border border-red-100 dark:border-red-900/40" />
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-zinc-100">{client.name}</h2>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">Marcado como desaparecido</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    Desaparecido
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/80">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                      <Phone className="h-3.5 w-3.5" />
                      Telefone
                    </div>
                    <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">{client.phone || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/80">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                      <FileText className="h-3.5 w-3.5" />
                      Documento
                    </div>
                    <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">{client.document || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/80">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                      <MapPin className="h-3.5 w-3.5" />
                      Cidade
                    </div>
                    <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">{client.city || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 dark:border-red-900/40 dark:bg-red-950/20">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-red-600 dark:text-red-300">
                      <Wallet className="h-3.5 w-3.5" />
                      Saldo em aberto
                    </div>
                    <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-200">{formatCurrency(outstandingBalance)}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-gray-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-zinc-300">Observações</h3>
                    <span className="text-xs text-gray-400 dark:text-zinc-500">Cadastrado em {formatDate(client.createdAt)}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-5 text-gray-600 dark:text-zinc-400">{client.notes || "Sem observações registradas."}</p>
                </div>

                <div className="mt-3 space-y-2.5">
                  {activeLoans.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                      Nenhum empréstimo ativo vinculado a este cliente.
                    </div>
                  ) : (
                    activeLoans.map((loan) => {
                      const pendingInstallments = loan.installments.filter((installment) => installment.status !== "PAID")
                      const overdueInstallments = pendingInstallments.filter((installment) => installment.status === "OVERDUE")
                      const nextInstallment = pendingInstallments
                        .slice()
                        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

                      return (
                        <div key={loan.id} className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/60">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Empréstimo ativo</h3>
                            </div>
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${loan.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : loan.status === "DEFAULTED" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-200"}`}>
                              {loan.status}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                                <Wallet className="h-3.5 w-3.5" />
                                Valor emprestado
                              </div>
                              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-zinc-100">{formatCurrency(loan.amount)}</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                                <Wallet className="h-3.5 w-3.5" />
                                Total previsto
                              </div>
                              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-zinc-100">{formatCurrency(loan.totalAmount)}</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                                <Percent className="h-3.5 w-3.5" />
                                Juros
                              </div>
                              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-zinc-100">
                                {loan.interestRate}% {loan.dailyInterest ? `• diário ${formatCurrency(loan.dailyInterestAmount)}` : ""}
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Próximo vencimento
                              </div>
                              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-zinc-100">{nextInstallment ? formatDate(nextInstallment.dueDate) : "Sem pendência"}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-gray-600 dark:bg-zinc-900 dark:text-zinc-300">
                              Lucro previsto {formatCurrency(loan.profit)}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-gray-600 dark:bg-zinc-900 dark:text-zinc-300">
                              {pendingInstallments.length} parcelas pendentes
                            </span>
                            <span className={`rounded-full px-2.5 py-1 font-semibold ${overdueInstallments.length > 0 ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>
                              {overdueInstallments.length} atrasadas
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false)
          setPickerSearch("")
        }}
        title="Selecionar cliente cadastrado"
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Busque um cliente já cadastrado e marque-o como desaparecido. Clientes com empréstimos ativos aparecem primeiro.
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
            <Input
              value={pickerSearch}
              onChange={(event) => setPickerSearch(event.target.value)}
              placeholder="Buscar cliente cadastrado..."
              className="pl-10"
            />
          </div>

          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {candidateClients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                Nenhum cliente elegível encontrado.
              </div>
            ) : (
              candidateClients.map((client) => {
                const hasActiveLoan = client.loans.some((loan) => loan.status === "ACTIVE")

                return (
                  <div key={client.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-zinc-800">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={client.name} src={client.photo} size="md" className="h-11 w-11" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">{client.name}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-zinc-400">
                          {client.phone || client.document || client.city || "Sem contato"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className={`rounded-full px-2 py-0.5 font-medium ${hasActiveLoan ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                            {hasActiveLoan ? "Com empréstimo ativo" : "Sem empréstimo ativo"}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {client.loans.length} empréstimos
                          </span>
                          {hasActiveLoan && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                              <Banknote className="h-3 w-3" />
                              Ativo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => markAsDisappeared(client.id)}
                      disabled={savingId === client.id}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      {savingId === client.id ? "Salvando..." : "Marcar"}
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Dialog>
    </div>
  )
}
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { LoanDetailsContent } from "@/app/(app)/emprestimos/_components/loan-details-content"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Users, Phone, MapPin, FileText, CalendarDays, Percent, Wallet, AlertTriangle, Plus, Banknote, LayoutGrid, Rows3, Camera, Upload, RotateCcw, Trash2, Eye, Download, X } from "lucide-react"
import { buildLoanData, calculateOverdueInterest, calculateTotalAmountWithLateFee, getDaysOverdue, getOverdueDailyAmountBRL } from "@/lib/loan-logic"

const MODALITY_LABELS: Record<string, string> = {
  MONTHLY: "MENSAL",
  BIWEEKLY: "QUINZENAL",
  WEEKLY: "SEMANAL",
  DAILY: "DIÁRIO",
}

interface DisappearedClient {
  id: string
  name: string
  phone: string | null
  document: string | null
  instagram: string | null
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
    interestType: string
    modality: string
    installmentCount: number
    dailyInterest: boolean
    dailyInterestAmount: number
    dueDay: number | null
    firstInstallmentDate: string
    status: string
    payments: {
      amount: number
      notes?: string | null
    }[]
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

interface ClientDocumentSummary {
  id: string
  name: string
  type: string
  fileType: string
  createdAt: string
}

interface ClientDocumentDetail extends ClientDocumentSummary {
  fileData: string
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "-"
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("pt-BR")
}

function getLoanCurrentBalance(loan: DisappearedClient["loans"][number]) {
  const loanData = buildLoanData({
    amount: loan.amount,
    interestRate: loan.interestRate,
    interestType: loan.interestType || "SIMPLE",
    totalAmount: loan.totalAmount,
    dailyInterest: loan.dailyInterest,
    dailyInterestAmount: loan.dailyInterestAmount || 0,
    dueDay: loan.dueDay || new Date(loan.installments[0]?.dueDate || loan.firstInstallmentDate || Date.now()).getDate(),
    modality: loan.modality,
    firstInstallmentDate: loan.firstInstallmentDate || loan.installments[0]?.dueDate || new Date().toISOString(),
    installments: loan.installments,
    payments: loan.payments || [],
  })

  return calculateTotalAmountWithLateFee(loanData)
}

function getOutstandingBalance(client: DisappearedClient) {
  return (client.loans || [])
    .filter((loan) => loan.status === "ACTIVE")
    .reduce((clientTotal, loan) => clientTotal + getLoanCurrentBalance(loan), 0)
}

function getActiveLoans(client: DisappearedClient) {
  return (client.loans || []).filter((loan) => loan.status === "ACTIVE")
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
    .map((loan) => {
      const dailyAmount = getOverdueDailyAmountBRL({
        dailyInterest: loan.dailyInterest,
        dailyInterestAmount: loan.dailyInterestAmount || 0,
        amount: loan.amount,
        interestRate: loan.interestRate,
        modality: loan.modality,
      })

      return dailyAmount > 0 ? `${loan.interestRate}% + ${formatCurrency(dailyAmount)}/dia` : `${loan.interestRate}%`
    })
    .join(" | ")
}

function getPaidTotal(loan: DisappearedClient["loans"][number]) {
  return (loan.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
}

function getReceivedProfit(loan: DisappearedClient["loans"][number]) {
  const paidInstallments = loan.installments.filter((installment) => installment.status === "PAID").length
  if (paidInstallments === 0) return 0
  return Math.round(paidInstallments * (loan.profit / Math.max(1, loan.installmentCount)) * 100) / 100
}

function getPrimaryLoan(loans: DisappearedClient["loans"]) {
  return [...loans].sort((left, right) => {
    const leftPending = left.installments
      .filter((installment) => installment.status !== "PAID")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
    const rightPending = right.installments
      .filter((installment) => installment.status !== "PAID")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

    return new Date(leftPending?.dueDate || left.firstInstallmentDate).getTime() - new Date(rightPending?.dueDate || right.firstInstallmentDate).getTime()
  })[0]
}

function getLoanOverdueDetails(loan: DisappearedClient["loans"][number]) {
  const loanData = buildLoanData({
    amount: loan.amount,
    interestRate: loan.interestRate,
    interestType: loan.interestType || "SIMPLE",
    totalAmount: loan.totalAmount,
    dailyInterest: loan.dailyInterest,
    dailyInterestAmount: loan.dailyInterestAmount || 0,
    dueDay: loan.dueDay || new Date(loan.installments[0]?.dueDate || loan.firstInstallmentDate || Date.now()).getDate(),
    modality: loan.modality,
    firstInstallmentDate: loan.firstInstallmentDate || loan.installments[0]?.dueDate || new Date().toISOString(),
    installments: loan.installments,
    payments: loan.payments || [],
  })

  const daysOverdue = getDaysOverdue(loanData)
  const totalWithLateFee = calculateTotalAmountWithLateFee(loanData)
  const totalPaid = (loan.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const baseAmount = Math.max(0, loan.totalAmount - totalPaid)
  const overdueExtra = Math.max(0, totalWithLateFee - loan.totalAmount + totalPaid)
  const overdueInterest = daysOverdue >= 30
    ? calculateOverdueInterest(
        loan.totalAmount,
        loan.amount,
        loan.interestRate,
        daysOverdue,
        (loan.interestType || "SIMPLE").toLowerCase() === "compound" ? "compound" : "simple"
      )
    : 0
  const dailyRate = getOverdueDailyAmountBRL(loanData)
  const dailyPenalty = daysOverdue > 0 ? dailyRate * daysOverdue : 0

  const overdueInstallments = loan.installments
    .filter((installment) => installment.status !== "PAID" && new Date(installment.dueDate) < new Date())
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())
    .map((installment) => ({
      ...installment,
      daysOverdue: Math.max(0, Math.floor((new Date().getTime() - new Date(installment.dueDate).getTime()) / (1000 * 60 * 60 * 24))),
    }))

  return {
    baseAmount,
    daysOverdue,
    dailyRate,
    overdueExtra,
    overdueInterest,
    dailyPenalty,
    totalWithLateFee,
    overdueInstallments,
  }
}

export default function ClientesDesaparecidosPage() {
  const [clients, setClients] = useState<DisappearedClient[]>([])
  const [activeSection, setActiveSection] = useState<"desaparecido" | "clientes">("desaparecido")
  const [search, setSearch] = useState("")
  const [pickerSearch, setPickerSearch] = useState("")
  const [createForm, setCreateForm] = useState({
    name: "",
    phone: "",
    document: "",
    rg: "",
    city: "",
    requestedAmount: "",
    disappearedInterestRate: "",
    notes: "",
    photo: "",
  })
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards")
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [detailsLoanId, setDetailsLoanId] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState<DisappearedClient | null>(null)
  const [clientDocuments, setClientDocuments] = useState<ClientDocumentSummary[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState<string | null>(null)
  const [openingDocId, setOpeningDocId] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  const getDocTypeLabel = (type: string) => {
    switch (type) {
      case "RG":
        return "RG"
      case "CPF":
        return "CPF"
      case "CNH":
        return "CNH"
      case "COMPROVANTE_RESIDENCIA":
        return "Comprovante"
      default:
        return type || "Documento"
    }
  }

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
        const leftHasActiveLoan = (left.loans || []).some((loan) => loan.status === "ACTIVE")
        const rightHasActiveLoan = (right.loans || []).some((loan) => loan.status === "ACTIVE")

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
      setActiveSection("desaparecido")
      setPickerOpen(false)
      setPickerSearch("")
    } finally {
      setSavingId(null)
    }
  }

  const resetCreateForm = () => {
    setCreateForm({
      name: "",
      phone: "",
      document: "",
      rg: "",
      city: "",
      requestedAmount: "",
      disappearedInterestRate: "",
      notes: "",
      photo: "",
    })
    setPendingDocuments([])
    setCreateError(null)
  }

  const handleCreatePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setCreateForm((current) => ({ ...current, photo: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleCreateDocumentsSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    Promise.all(files.map((file) => new Promise<PendingDocument>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const fileData = reader.result as string
        resolve({
          name: file.name,
          type: "RG",
          fileData,
          fileType: file.type || "application/octet-stream",
        })
      }
      reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`))
      reader.readAsDataURL(file)
    })))
      .then((documents) => {
        setPendingDocuments((current) => [...current, ...documents])
        if (documentInputRef.current) documentInputRef.current.value = ""
      })
      .catch(() => {
        setCreateError("Não foi possível carregar um dos arquivos selecionados.")
      })
  }

  const removePendingDocument = (index: number) => {
    setPendingDocuments((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const createDisappearedClient = async () => {
    if (createForm.name.trim().length < 2) {
      setCreateError("Informe um nome com pelo menos 2 caracteres.")
      return
    }

    const hasRequestedAmount = createForm.requestedAmount.trim() !== ""
    const hasInterestRate = createForm.disappearedInterestRate.trim() !== ""

    if (hasRequestedAmount !== hasInterestRate) {
      setCreateError("Informe valor e taxa de juros para cadastrar o empréstimo do desaparecido.")
      return
    }

    if (hasRequestedAmount) {
      const requestedAmount = Number(createForm.requestedAmount)
      const disappearedInterestRate = Number(createForm.disappearedInterestRate)

      if (!Number.isFinite(requestedAmount) || requestedAmount < 0) {
        setCreateError("Informe um valor válido.")
        return
      }

      if (!Number.isFinite(disappearedInterestRate) || disappearedInterestRate < 0) {
        setCreateError("Informe uma taxa de juros válida.")
        return
      }
    }

    setCreateSaving(true)
    setCreateError(null)

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          phone: createForm.phone.trim() || undefined,
          document: createForm.document.trim() || undefined,
          rg: createForm.rg.trim() || undefined,
          city: createForm.city.trim() || undefined,
          requestedAmount: hasRequestedAmount ? Number(createForm.requestedAmount) : undefined,
          disappearedInterestRate: hasInterestRate ? Number(createForm.disappearedInterestRate) : undefined,
          notes: createForm.notes.trim() || undefined,
          photo: createForm.photo || undefined,
          status: "DESAPARECIDO",
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || "Falha ao cadastrar cliente desaparecido")
      }

      if (pendingDocuments.length > 0) {
        await Promise.all(
          pendingDocuments.map((document) => fetch(`/api/clients/${data.id}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(document),
          }))
        )
      }

      setClients((current) => [{ ...data, loans: Array.isArray(data?.loans) ? data.loans : [] }, ...current])
      setCreateOpen(false)
      resetCreateForm()
    } catch (error: any) {
      setCreateError(error.message || "Falha ao cadastrar cliente desaparecido")
    } finally {
      setCreateSaving(false)
    }
  }

  const restoreClient = async (clientId: string) => {
    setActionId(clientId)

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      })

      if (!response.ok) {
        throw new Error("Falha ao atualizar cliente")
      }

      setClients((current) => current.map((client) => (
        client.id === clientId ? { ...client, status: "ACTIVE" } : client
      )))
      setActiveSection("clientes")
    } finally {
      setActionId(null)
    }
  }

  const deleteClient = async (clientId: string) => {
    if (!confirm("Excluir este cliente desaparecido?")) return

    setActionId(clientId)

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Falha ao excluir cliente")
      }

      setClients((current) => current.filter((client) => client.id !== clientId))
    } finally {
      setActionId(null)
    }
  }

  const openClientDocuments = async (client: DisappearedClient) => {
    setSelectedClient(client)
    setDocumentsOpen(true)
    setDocsLoading(true)
    setDocsError(null)

    try {
      const response = await fetch(`/api/clients/${client.id}/documents`)
      const data = await response.json().catch(() => [])

      if (!response.ok) {
        throw new Error(data?.error || "Falha ao carregar documentos")
      }

      setClientDocuments(Array.isArray(data) ? data : [])
    } catch (error: any) {
      setClientDocuments([])
      setDocsError(error.message || "Falha ao carregar documentos")
    } finally {
      setDocsLoading(false)
    }
  }

  const handleOpenDocument = async (document: ClientDocumentSummary, download = false) => {
    if (!selectedClient) return

    const previewWindow = download ? null : window.open("about:blank", "_blank")

    setOpeningDocId(document.id)
    setDocsError(null)

    if (previewWindow) {
      previewWindow.document.title = document.name
      previewWindow.document.body.innerHTML = "<p style='font-family: Arial, sans-serif; padding: 24px; color: #475569;'>Carregando documento...</p>"
    }

    try {
      const response = await fetch(`/api/clients/${selectedClient.id}/documents?docId=${document.id}`)
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.fileData) {
        throw new Error(data?.error || "Falha ao abrir documento")
      }

      if (download) {
        const link = window.document.createElement("a")
        link.href = data.fileData
        link.download = document.name
        link.target = "_blank"
        link.click()
        return
      }

      if (!previewWindow) {
        throw new Error("O navegador bloqueou a abertura do documento")
      }

      const isImage = typeof data.fileType === "string" && data.fileType.startsWith("image/")
      const previewContent = isImage
        ? `<img src="${data.fileData}" alt="${document.name}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />`
        : `<iframe src="${data.fileData}" title="${document.name}" style="width: 100%; height: 100vh; border: 0;"></iframe>`

      previewWindow.document.open()
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${document.name}</title>
            <style>
              body {
                margin: 0;
                background: #f8fafc;
                font-family: Arial, sans-serif;
              }
              .frame {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                box-sizing: border-box;
              }
              iframe {
                background: #fff;
              }
            </style>
          </head>
          <body>
            <div class="frame">${previewContent}</div>
          </body>
        </html>
      `)
      previewWindow.document.close()
    } catch (error: any) {
      previewWindow?.close()
      setDocsError(error.message || "Falha ao abrir documento")
    } finally {
      setOpeningDocId(null)
    }
  }

  const openLoanDetails = (loanId: string | null | undefined) => {
    if (!loanId) return
    setDetailsLoanId(loanId)
  }

  const sectionTitle = activeSection === "desaparecido" ? "Desaparecido" : "Clientes"
  const sectionDescription = "Clientes marcados como desaparecidos com resumo de empréstimos, juros e pendências."
  const searchPlaceholder = "Buscar cliente desaparecido..."
  const emptyTitle = "Nenhum cliente desaparecido encontrado"
  const emptyDescription = "Marque um cliente com status desaparecido para ele aparecer nesta página."
  const effectiveViewMode = activeSection === "clientes" ? "table" : viewMode

  return (
    <div className="space-y-6 pt-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{sectionTitle}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {sectionDescription}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 xl:min-w-[640px] xl:items-end">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button
              onClick={() => setActiveSection("desaparecido")}
              variant="outline"
              className={activeSection === "desaparecido" ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300" : "border-gray-200 dark:border-zinc-700"}
            >
              <AlertTriangle className="h-4 w-4" />
              Desaparecido
            </Button>
            <Button
              onClick={() => {
                setActiveSection("clientes")
                setViewMode("table")
              }}
              variant="outline"
              className={activeSection === "clientes" ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300" : "border-gray-200 dark:border-zinc-700"}
            >
              <Users className="h-4 w-4" />
              Cliente
            </Button>
            <Button
              onClick={() => setPickerOpen(true)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Adicionar Desaparecido
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              <Users className="h-4 w-4" />
              {filteredClients.length} clientes
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="pl-10"
        />
      </div>

      <div className="flex justify-end">
        <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              effectiveViewMode === "table"
                ? "bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Rows3 className="h-4 w-4" />
            Tabela
          </button>
          {activeSection === "desaparecido" ? (
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
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Carregando clientes desaparecidos...
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
          <h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-zinc-100">{emptyTitle}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {emptyDescription}
          </p>
        </div>
      ) : effectiveViewMode === "table" ? (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                {activeSection === "clientes" ? (
                  <>
                    <TableHead>CPF</TableHead>
                    <TableHead>Instagram</TableHead>
                  </>
                ) : null}
                {activeSection === "desaparecido" ? (
                  <>
                    <TableHead>Empréstimos ativos</TableHead>
                    <TableHead>Saldo em aberto</TableHead>
                    <TableHead>Próximo vencimento</TableHead>
                    <TableHead>Juros</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </>
                ) : null}
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
                          <p className="truncate text-xs text-gray-500 dark:text-zinc-400">
                            {client.status === "DESAPARECIDO" ? "Desaparecido" : client.status === "ACTIVE" ? "Ativo" : "Inativo"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{client.phone || "-"}</TableCell>
                    <TableCell>{client.city || "-"}</TableCell>
                    {activeSection === "clientes" ? (
                      <>
                        <TableCell>{client.document || "-"}</TableCell>
                        <TableCell>{client.instagram || "-"}</TableCell>
                      </>
                    ) : null}
                    {activeSection === "desaparecido" ? (
                      <>
                        <TableCell>{activeLoans.length}</TableCell>
                        <TableCell>{formatCurrency(getOutstandingBalance(client))}</TableCell>
                        <TableCell>{formatDate(getNextDueDate(client))}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{getInterestSummary(client)}</TableCell>
                        <TableCell>{client.status === "DESAPARECIDO" ? "Desaparecido" : client.status === "ACTIVE" ? "Ativo" : "Inativo"}</TableCell>
                        <TableCell>{formatDate(client.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => restoreClient(client.id)}
                              disabled={actionId === client.id}
                            >
                              {actionId === client.id ? "Atualizando..." : "Reapareceu"}
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : null}
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
            const nextDueDate = getNextDueDate(client)
            const primaryLoan = getPrimaryLoan(activeLoans)
            const primaryLoanOverdue = primaryLoan ? getLoanOverdueDetails(primaryLoan) : null
            const hasOverdueLoan = activeLoans.some((loan) => getLoanOverdueDetails(loan).daysOverdue > 0)
            const cardBorder = hasOverdueLoan ? "border-red-400 dark:border-red-700" : "border-blue-400 dark:border-blue-700"
            const cardBg = hasOverdueLoan ? "bg-red-100 dark:bg-red-950/30" : "bg-blue-100 dark:bg-blue-950/30"
            const remainingBg = hasOverdueLoan ? "bg-red-100 dark:bg-red-900/40" : "bg-blue-100 dark:bg-blue-900/40"
            const remainingColor = hasOverdueLoan ? "text-red-700 dark:text-red-400" : "text-blue-700 dark:text-blue-400"
            const cellBg = hasOverdueLoan ? "bg-red-50 dark:bg-red-950/20" : "bg-blue-50 dark:bg-blue-950/20"
            const paid = primaryLoan ? getPaidTotal(primaryLoan) : 0
            const receivedProfit = primaryLoan ? getReceivedProfit(primaryLoan) : 0
            const profitPct = primaryLoan && primaryLoan.profit > 0 ? Math.round((receivedProfit / primaryLoan.profit) * 100) : 0
            const extraLoansCount = Math.max(0, activeLoans.length - (primaryLoan ? 1 : 0))
            const statusLabel = client.status === "DESAPARECIDO" ? "Desaparecido" : client.status === "ACTIVE" ? "Ativo" : "Inativo"
            const statusBadgeClass = client.status === "DESAPARECIDO"
              ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
              : client.status === "ACTIVE"
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"

            return (
              <div key={client.id} className={`rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${cardBorder} ${cardBg}`}>
                <div className="px-4 pt-4 pb-2 text-center border-b border-gray-100 dark:border-zinc-800">
                  <h2 className="font-semibold text-base text-gray-900 dark:text-zinc-100 truncate">{client.name}</h2>
                </div>

                <div className="flex flex-col gap-2 px-4 pb-2 pt-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Avatar name={client.name} src={client.photo} size="sm" className="border border-red-100 dark:border-red-900/40" />
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadgeClass}`}>
                      {statusLabel}
                    </span>
                    {primaryLoan && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                        {MODALITY_LABELS[primaryLoan.modality] || primaryLoan.modality}
                      </span>
                    )}
                    {extraLoansCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
                        +{extraLoansCount} empréstimo{extraLoansCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => primaryLoan ? openLoanDetails(primaryLoan.id) : openClientDocuments(client)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Detalhes"
                    >
                      <Eye className="h-3 w-3" /> Detalhes
                    </button>
                    <button
                      type="button"
                      onClick={() => openClientDocuments(client)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Documentos"
                    >
                      <FileText className="h-3 w-3" /> Documentos
                    </button>
                  </div>
                </div>

                <div className="px-4 pb-3">
                  <div className={`${remainingBg} rounded-lg px-4 py-3 text-center`}>
                    <p className={`text-lg font-bold tabular-nums tracking-tight ${remainingColor}`}>{formatCurrency(outstandingBalance)}</p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">restante a receber</p>
                  </div>
                </div>

                <div className="mx-4 grid grid-cols-2 gap-px bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-gray-100 dark:border-zinc-800">
                  <div className={`${cellBg} px-3 py-2.5`}>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500">Emprestado</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{formatCurrency(primaryLoan?.amount || 0)}</p>
                  </div>
                  <div className={`${cellBg} px-3 py-2.5 text-right`}>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500">Total a Receber</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{formatCurrency(primaryLoan?.totalAmount || outstandingBalance)}</p>
                  </div>
                  <div className={`${cellBg} px-3 py-2.5`}>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1"><Wallet className="h-3 w-3" /> Lucro Previsto</p>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(primaryLoan?.profit || 0)}</p>
                  </div>
                  <div className={`${cellBg} px-3 py-2.5 text-right`}>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center justify-end gap-1"><Percent className="h-3 w-3" /> Lucro Realizado</p>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(receivedProfit)} <span className="text-gray-400 dark:text-zinc-500 text-xs">{profitPct}%</span></p>
                  </div>
                </div>

                <div className="mx-4 mt-3 flex flex-col gap-2 text-xs text-gray-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>Venc: {formatDate(nextDueDate)}</span>
                    <MapPin className="h-3 w-3 text-gray-300 dark:text-zinc-600" />
                    <span>{client.city || "Sem cidade"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    <Wallet className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="font-medium text-gray-700 dark:text-zinc-300">Pago: {formatCurrency(paid)}</span>
                  </div>
                </div>

                {primaryLoan && (
                  <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-zinc-400">Só Juros (por parcela):</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{formatCurrency(primaryLoan.profit / Math.max(1, primaryLoan.installmentCount))}</span>
                    </div>
                  </div>
                )}

                {primaryLoanOverdue && primaryLoanOverdue.daysOverdue > 0 && (
                  <div className="mx-4 mt-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 space-y-2">
                    {primaryLoanOverdue.overdueInstallments.map((installment, index) => (
                      <div key={installment.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-red-700 dark:text-red-400">Parcela {installment.number}/{primaryLoan.installmentCount} em atraso</span>
                          <span className="text-xs font-bold text-red-700 dark:text-red-400">{installment.daysOverdue} dias</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-zinc-400">Vencimento: {formatDate(installment.dueDate)}</span>
                          <span className="text-gray-700 dark:text-zinc-300 font-medium">Valor: {formatCurrency(installment.amount)}</span>
                        </div>
                        {primaryLoanOverdue.dailyRate > 0 && installment.daysOverdue > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-red-600 dark:text-red-400">% Juros ({formatCurrency(primaryLoanOverdue.dailyRate)}/dia)</span>
                            <span className="text-red-600 dark:text-red-400 font-bold">+{formatCurrency(primaryLoanOverdue.dailyRate * installment.daysOverdue)}</span>
                          </div>
                        )}
                        {index < primaryLoanOverdue.overdueInstallments.length - 1 && (
                          <div className="border-b border-red-200 dark:border-red-800/40 pt-1" />
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-red-200 dark:border-red-800/40">
                      <span className="font-semibold text-red-700 dark:text-red-300">Total com Atraso:</span>
                      <span className="font-bold text-red-700 dark:text-red-300">{formatCurrency(getLoanCurrentBalance(primaryLoan))}</span>
                    </div>
                  </div>
                )}

                <div className="px-4 pt-3 pb-4 mt-2 border-t border-gray-100 dark:border-zinc-800 space-y-3">
                  <Button
                    type="button"
                    onClick={() => activeSection === "desaparecido" ? openClientDocuments(client) : markAsDisappeared(client.id)}
                    disabled={activeSection === "clientes" && savingId === client.id}
                    className={`w-full h-9 text-sm text-white transition-colors ${activeSection === "desaparecido" ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}
                  >
                    <>
                      <FileText className="h-3.5 w-3.5 mr-1.5" /> Ver documentos
                    </>
                  </Button>
                  <div className="grid w-full min-w-0 grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))] gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => restoreClient(client.id)}
                      disabled={actionId === client.id}
                      className="min-w-0 h-10 px-2 text-xs border border-emerald-100 bg-emerald-50 font-medium text-emerald-700 shadow-none transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30 sm:text-sm"
                    >
                      <RotateCcw className="mr-1 h-4 w-4 shrink-0" /> <span className="truncate">{actionId === client.id ? "Atualizando..." : "Reapareceu"}</span>
                    </Button>
                    <button
                      type="button"
                      onClick={() => primaryLoan ? openLoanDetails(primaryLoan.id) : openClientDocuments(client)}
                      className="flex min-w-0 w-full items-center justify-center rounded-xl bg-emerald-50 p-2 text-emerald-600 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                      title="Histórico"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openClientDocuments(client)}
                      className="flex min-w-0 w-full items-center justify-center rounded-xl bg-blue-50 p-2 text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
                      title="Documentos"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteClient(client.id)}
                      className="flex min-w-0 w-full items-center justify-center rounded-xl bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40 disabled:opacity-60"
                      title="Excluir"
                      disabled={actionId === client.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="px-4 pb-4 space-y-2">
                  {!primaryLoan ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                      Nenhum empréstimo ativo vinculado a este cliente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-800/50 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Observações</p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400 line-clamp-2">{client.notes || "Sem observações registradas."}</p>
                          </div>
                          <span className="text-[11px] text-gray-400 dark:text-zinc-500">{client.phone || "Sem telefone"}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-gray-600 dark:bg-zinc-900 dark:text-zinc-300">
                          Documento {client.document || "-"}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-gray-600 dark:bg-zinc-900 dark:text-zinc-300">
                          Juros {getInterestSummary(client)}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-gray-600 dark:bg-zinc-900 dark:text-zinc-300">
                          Cadastrado em {formatDate(client.createdAt)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog
        open={Boolean(detailsLoanId)}
        onClose={() => setDetailsLoanId(null)}
        className="max-w-5xl border-none bg-transparent p-0 shadow-none"
      >
        {detailsLoanId ? (
          <LoanDetailsContent
            loanId={detailsLoanId}
            presentation="modal"
            onClose={() => setDetailsLoanId(null)}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          resetCreateForm()
        }}
        title="Cadastrar cliente desaparecido"
        className="max-w-xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Cadastre um novo cliente já com status desaparecido.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 px-4 py-5 dark:border-zinc-800">
              {createForm.photo ? (
                <img
                  src={createForm.photo}
                  alt="Foto do cliente"
                  className="h-24 w-24 rounded-full border border-red-200 object-cover dark:border-red-900/40"
                />
              ) : (
                <Avatar name={createForm.name || "Cliente"} size="xl" className="h-24 w-24 border border-gray-200 dark:border-zinc-800" />
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCreatePhotoSelect}
              />
              <Button type="button" variant="outline" onClick={() => photoInputRef.current?.click()}>
                <Camera className="h-4 w-4" />
                Adicionar foto do cliente
              </Button>
            </div>

            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-gray-900 dark:text-zinc-100">Nome</p>
              <Input
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nome do cliente"
              />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-900 dark:text-zinc-100">Telefone</p>
              <Input
                value={createForm.phone}
                onChange={(event) => setCreateForm((current) => ({ ...current, phone: phoneMask(event.target.value) }))}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-900 dark:text-zinc-100">CPF</p>
              <Input
                value={createForm.document}
                onChange={(event) => setCreateForm((current) => ({ ...current, document: cpfMask(event.target.value) }))}
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-900 dark:text-zinc-100">RG</p>
              <Input
                value={createForm.rg}
                onChange={(event) => setCreateForm((current) => ({ ...current, rg: rgMask(event.target.value) }))}
                placeholder="00.000.000-0"
              />
            </div>

            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-gray-900 dark:text-zinc-100">Cidade</p>
              <Input
                value={createForm.city}
                onChange={(event) => setCreateForm((current) => ({ ...current, city: event.target.value }))}
                placeholder="Cidade"
              />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-900 dark:text-zinc-100">Valor</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={createForm.requestedAmount}
                onChange={(event) => setCreateForm((current) => ({ ...current, requestedAmount: event.target.value }))}
                placeholder="Valor do empréstimo"
              />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-900 dark:text-zinc-100">Taxa de juros (%)</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={createForm.disappearedInterestRate}
                onChange={(event) => setCreateForm((current) => ({ ...current, disappearedInterestRate: event.target.value }))}
                placeholder="Taxa de juros"
              />
            </div>

            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-gray-900 dark:text-zinc-100">Observações</p>
              <Textarea
                value={createForm.notes}
                onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Informações úteis sobre o desaparecimento"
                rows={4}
              />
            </div>

            <div className="sm:col-span-2 rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">Fotos do documento</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">Adicione frente, verso ou PDF do documento do desaparecido.</p>
                </div>
                <input
                  ref={documentInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                  onChange={handleCreateDocumentsSelect}
                />
                <Button type="button" variant="outline" onClick={() => documentInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Adicionar arquivos
                </Button>
              </div>

              {pendingDocuments.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {pendingDocuments.map((document, index) => (
                    <div key={`${document.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-zinc-800">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">{document.name}</p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">Documento anexado para envio no cadastro</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingDocument(index)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        aria-label={`Remover ${document.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                  Nenhum documento anexado.
                </div>
              )}
            </div>
          </div>

          {createError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {createError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(false)
                resetCreateForm()
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={createDisappearedClient}
              disabled={createSaving}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {createSaving ? "Salvando..." : "Cadastrar"}
            </Button>
          </div>
        </div>
      </Dialog>

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

      <Dialog
        open={documentsOpen}
        onClose={() => {
          setDocumentsOpen(false)
          setSelectedClient(null)
          setClientDocuments([])
          setDocsError(null)
          setOpeningDocId(null)
        }}
        title={selectedClient ? `Documentos de ${selectedClient.name}` : "Documentos do cliente"}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Use esta área para verificar os documentos enviados do cliente desaparecido.
          </p>

          {docsError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {docsError}
            </div>
          )}

          {docsLoading ? (
            <div className="rounded-xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
              Carregando documentos...
            </div>
          ) : clientDocuments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center dark:border-zinc-800">
              <FileText className="mx-auto h-8 w-8 text-gray-400 dark:text-zinc-500" />
              <p className="mt-3 text-sm text-gray-500 dark:text-zinc-400">Nenhum documento cadastrado para este cliente.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clientDocuments.map((document) => (
                <div
                  key={document.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">{document.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-zinc-800">{getDocTypeLabel(document.type)}</span>
                      <span>{new Date(document.createdAt).toLocaleDateString("pt-BR")}</span>
                      <span>{document.fileType}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenDocument(document)}
                      disabled={openingDocId === document.id}
                      className="rounded-xl"
                    >
                      <Eye className="h-4 w-4" />
                      {openingDocId === document.id ? "Abrindo..." : "Visualizar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenDocument(document, true)}
                      disabled={openingDocId === document.id}
                      className="rounded-xl"
                    >
                      <Download className="h-4 w-4" />
                      Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}

interface PendingDocument {
  name: string
  type: string
  fileData: string
  fileType: string
}

function cpfMask(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

function rgMask(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 9)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1})$/, "$1-$2")
}

function phoneMask(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
}
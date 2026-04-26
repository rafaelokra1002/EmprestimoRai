"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { clientSchema, ClientFormData } from "@/lib/validations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { Textarea } from "@/components/ui/textarea"
import { Avatar } from "@/components/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, Pencil, Trash2, User, MapPin, FileText, Mail, Phone, Instagram, Globe, Briefcase, Users, Camera, Upload, X, Eye, Download, Image, DollarSign, LayoutGrid, Rows3, CalendarDays, Flame, Filter, CheckCircle2 } from "lucide-react"

interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  rg: string | null
  instagram: string | null
  facebook: string | null
  profession: string | null
  workplace: string | null
  category: string | null
  income: number | null
  requestedAmount: number | null
  referral: boolean
  referralName: string | null
  referralPhone: string | null
  photo: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  neighborhood: string | null
  complement: string | null
  number: string | null
  notes: string | null
  score: number
  status: "ACTIVE" | "INACTIVE" | "DESAPARECIDO"
  createdAt: string
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

type DialogTab = "dados" | "endereco" | "documentos"

interface ClientDoc {
  id: string
  name: string
  type: string
  fileType: string
  createdAt: string
}

const DOC_TYPES = [
  { value: "CPF", label: "CPF" },
  { value: "RG", label: "RG" },
  { value: "CNH", label: "CNH" },
  { value: "COMPROVANTE_RESIDENCIA", label: "Comprovante de Residência" },
  { value: "COMPROVANTE_RENDA", label: "Comprovante de Renda" },
  { value: "SELFIE", label: "Selfie / Foto do Cliente" },
  { value: "CONTRATO", label: "Contrato" },
  { value: "OUTRO", label: "Outro" },
]

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

function cepMask(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2")
}

export default function ClientesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [filtered, setFiltered] = useState<Client[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DialogTab>("dados")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [clientDocs, setClientDocs] = useState<ClientDoc[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState("OUTRO")
  const [previewDoc, setPreviewDoc] = useState<{ name: string; data: string; fileType: string } | null>(null)
  const [profileImagePreview, setProfileImagePreview] = useState<{ name: string; src: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docFileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      status: "ACTIVE",
      referral: false,
      referralName: "",
      referralPhone: "",
    }
  })

  const watchName = watch("name") || ""
  const watchStatus = watch("status")
  const watchReferral = watch("referral")
  const watchZipCode = watch("zipCode") || ""
  const newClientMode = searchParams.get("novo")
  const requestedStatus = searchParams.get("status")

  const searchCep = async () => {
    const cep = watchZipCode.replace(/\D/g, "")
    if (cep.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setValue("address", data.logradouro || "")
        setValue("neighborhood", data.bairro || "")
        setValue("city", data.localidade || "")
        setValue("state", data.uf || "")
      }
    } catch {
      // silently fail
    } finally {
      setCepLoading(false)
    }
  }

  const fetchClients = async () => {
    const res = await fetch("/api/clients?includeInstallments=true")
    const data = await res.json()
    const list = Array.isArray(data) ? data : []
    setClients(list)
    setFiltered(list)
    setLoading(false)
  }

  useEffect(() => { fetchClients() }, [])

  useEffect(() => {
    let list = clients
      .filter((client) => client.status !== "DESAPARECIDO")
      .filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) ||
        c.document?.includes(search)
      )
    if (statusFilter === "active") {
      list = list.filter(c => c.status === "ACTIVE" || c.loans?.some(l => l.status === "ACTIVE"))
    } else if (statusFilter === "inactive") {
      list = list.filter(c => c.status === "INACTIVE" || (!c.loans?.some(l => l.status === "ACTIVE")))
    }
    setFiltered(list)
  }, [search, clients, statusFilter])

  const onSubmit = async (data: ClientFormData) => {
    setSaving(true)
    setFormError(null)

    // Clean empty strings to avoid sending "" for optional fields
    const cleanData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      cleanData[key] = typeof value === "string" && value.trim() === "" ? undefined : value
    }

    try {
      let res: Response
      if (editing) {
        res = await fetch(`/api/clients/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanData),
        })
      } else {
        res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanData),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao salvar cliente" }))
        setFormError(err.error || "Erro ao salvar cliente")
        return
      }

      setDialogOpen(false)
      setEditing(null)
      setActiveTab("dados")
      setPhotoPreview(null)
      reset()
      fetchClients()
    } catch (err: any) {
      setFormError(err.message || "Erro de conexão ao salvar cliente")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (client: Client) => {
    setEditing(client)
    setFormError(null)
    reset({
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      document: client.document || "",
      rg: client.rg || "",
      instagram: client.instagram || "",
      facebook: client.facebook || "",
      profession: client.profession || "",
      workplace: client.workplace || "",
      category: client.category || "",
      income: client.income || undefined,
      requestedAmount: client.requestedAmount || undefined,
      referral: client.referral || false,
      referralName: client.referralName || "",
      referralPhone: client.referralPhone || "",
      photo: client.photo || "",
      address: client.address || "",
      city: client.city || "",
      state: client.state || "",
      zipCode: client.zipCode || "",
      neighborhood: client.neighborhood || "",
      complement: client.complement || "",
      number: client.number || "",
      notes: client.notes || "",
      status: client.status,
    })
    setPhotoPreview(client.photo || null)
    setActiveTab("dados")
    setDialogOpen(true)
    fetchClientDocs(client.id)
  }

  const fetchClientDocs = async (clientId: string) => {
    setDocsLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`)
      const data = await res.json()
      setClientDocs(Array.isArray(data) ? data : [])
    } catch {
      setClientDocs([])
    } finally {
      setDocsLoading(false)
    }
  }

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editing) return

    setUploadingDoc(true)
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = reader.result as string
      try {
        await fetch(`/api/clients/${editing.id}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            type: selectedDocType,
            fileData: base64,
            fileType: file.type,
          }),
        })
        fetchClientDocs(editing.id)
      } catch {
        // silently fail
      } finally {
        setUploadingDoc(false)
        if (docFileInputRef.current) docFileInputRef.current.value = ""
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDocDelete = async (docId: string) => {
    if (!editing) return
    if (!confirm("Tem certeza que deseja excluir este documento?")) return
    await fetch(`/api/clients/${editing.id}/documents?docId=${docId}`, { method: "DELETE" })
    fetchClientDocs(editing.id)
  }

  const handleDocPreview = async (doc: ClientDoc) => {
    if (!editing) return
    try {
      // Fetch full document with fileData for preview
      const res = await fetch(`/api/clients/${editing.id}/documents`)
      // We need a separate endpoint or inline data. For now use a direct fetch.
      // Since we store base64, we re-fetch when needed
      setPreviewDoc({ name: doc.name, data: "", fileType: doc.fileType })
    } catch {
      // silently fail
    }
  }

  const getDocTypeLabel = (type: string) => {
    return DOC_TYPES.find(d => d.value === type)?.label || type
  }

  const getDocIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <Image className="h-5 w-5 text-emerald-600" />
    return <FileText className="h-5 w-5 text-blue-600" />
  }

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
      await fetch(`/api/clients/${id}`, { method: "DELETE" })
      fetchClients()
    }
  }

  const openNewClient = (initialStatus: Client["status"] = "ACTIVE") => {
    setEditing(null)
    setFormError(null)
    reset({
      name: "", email: "", phone: "", document: "", rg: "",
      instagram: "", facebook: "", profession: "",
      workplace: "", category: "",
      income: undefined, requestedAmount: undefined,
      referral: false, referralName: "", referralPhone: "", photo: "",
      address: "", city: "", state: "", zipCode: "",
      neighborhood: "", complement: "", number: "",
      notes: "", status: initialStatus
    })
    setPhotoPreview(null)
    setActiveTab("dados")
    setDialogOpen(true)
  }

  useEffect(() => {
    if (newClientMode !== "true") return

    const initialStatus: Client["status"] = requestedStatus === "DESAPARECIDO" ? "DESAPARECIDO" : "ACTIVE"
    openNewClient(initialStatus)
  }, [newClientMode, requestedStatus])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setPhotoPreview(base64)
        setValue("photo", base64)
      }
      reader.readAsDataURL(file)
    }
  }

  const tabs: { key: DialogTab; label: string; icon: React.ReactNode }[] = [
    { key: "dados", label: "Dados Pessoais", icon: <User className="h-4 w-4" /> },
    { key: "endereco", label: "Endereço", icon: <MapPin className="h-4 w-4" /> },
    { key: "documentos", label: "Documentos", icon: <FileText className="h-4 w-4" /> },
  ]

  const getScoreIcon = (score: number) => {
    if (score >= 150) return "⭐"
    if (score >= 100) return "🔥"
    if (score >= 50) return "👍"
    return "⚠️"
  }

  const getScoreColor = (score: number) => {
    if (score >= 150) return "bg-yellow-50 dark:bg-yellow-950/300/20 text-yellow-600"
    if (score >= 100) return "bg-orange-50 dark:bg-orange-950/300/20 text-orange-600"
    if (score >= 50) return "bg-blue-50 dark:bg-blue-950/300/20 text-blue-600"
    return "bg-red-50 dark:bg-red-950/300/20 text-red-600"
  }

  const getScoreLabel = (score: number) => {
    if (score >= 150) return "Premium"
    if (score >= 100) return "Excelente"
    if (score >= 50) return "Bom"
    return "Baixo"
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR")
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return "-"
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
  }

  const isInactiveClient = (client: Client) => {
    return client.status === "INACTIVE" || !client.loans?.some((loan) => loan.status === "ACTIVE")
  }

  const getDisplayedClientStatus = (client: Client): Client["status"] => {
    if (client.status === "DESAPARECIDO") return "DESAPARECIDO"
    if (statusFilter === "inactive" && isInactiveClient(client)) return "INACTIVE"
    return client.status
  }

  const getActiveLoanSummary = (client: Client) => {
    const activeLoan = client.loans.find((loan) => loan.status === "ACTIVE")
    if (!activeLoan) return null

    const nextInstallment = activeLoan.installments
      ?.filter((installment) => installment.status !== "PAID")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

    return {
      loan: activeLoan,
      nextInstallment,
    }
  }

  return (
    <div className="space-y-4 pt-6">
      {/* Title + actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Clientes</h1>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push("/emprestimos?novo=true")} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 whitespace-nowrap text-xs px-3 py-1.5 h-8">
              <DollarSign className="h-4 w-4" />
              Criar Empréstimo
            </Button>
            <Button onClick={() => openNewClient()} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                viewMode === "table"
                  ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
              }`}
              title="Visualizar em tabela"
            >
              <Rows3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                viewMode === "cards"
                  ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
              }`}
              title="Visualizar em cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search bar with controls */}
      <div className="flex items-start gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
          <Input
            placeholder="Buscar clientes..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-4 text-sm">
            <FilterDropdown
              label="Filtros"
              icon={<Filter className="h-4 w-4" />}
              tone="emerald"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as "all" | "active" | "inactive")}
              options={[
                { value: "all", label: "Todos" },
                { value: "active", label: `Ativos (${clients.filter(c => c.status !== "DESAPARECIDO" && (c.status === "ACTIVE" || c.loans?.some(l => l.status === "ACTIVE"))).length})` },
                { value: "inactive", label: `Inativos (${clients.filter(c => c.status !== "DESAPARECIDO" && (c.status === "INACTIVE" || (!c.loans?.some(l => l.status === "ACTIVE")))).length})` },
              ]}
              minWidthClassName="min-w-[190px]"
            />
            <div className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 whitespace-nowrap dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400">
              <Users className="h-4 w-4" />
              {filtered.length} clientes
            </div>
          </div>
        </div>
      </div>

      {/* Listing */}
      {viewMode === "table" ? (
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Renda</TableHead>
                <TableHead>Valor Solicitado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Cadastrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500 dark:text-zinc-400">Carregando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500 dark:text-zinc-400">Nenhum cliente encontrado</TableCell>
                </TableRow>
              ) : (
                filtered.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={client.name} src={client.photo} size="sm" />
                        <span className="font-medium">{client.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 dark:text-zinc-400">{client.city || "-"}</TableCell>
                    <TableCell>{client.phone || "-"}</TableCell>
                    <TableCell className="text-gray-700 dark:text-zinc-300">{client.income ? `R$ ${client.income.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}</TableCell>
                    <TableCell className="text-gray-700 dark:text-zinc-300">{client.requestedAmount ? `R$ ${client.requestedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={getDisplayedClientStatus(client) === "ACTIVE" ? "success" : "warning"}>
                        {getDisplayedClientStatus(client) === "ACTIVE" ? "Ativo" : getDisplayedClientStatus(client) === "DESAPARECIDO" ? "Desaparecido" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getScoreColor(client.score)}`}>
                        {getScoreIcon(client.score)} {client.score}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500 dark:text-zinc-400">{formatDate(client.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 py-8 text-center text-gray-500 dark:text-zinc-400">
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 py-8 text-center text-gray-500 dark:text-zinc-400">
          Nenhum cliente encontrado
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => {
            const loanSummary = getActiveLoanSummary(client)
            const activeLoan = loanSummary?.loan
            const hasActiveLoan = Boolean(activeLoan)
            const displayStatus = getDisplayedClientStatus(client)

            const infoCards = [
              {
                label: "Telefone",
                value: client.phone || "-",
                icon: Phone,
                iconClassName: "text-blue-600",
                toneClassName: "bg-blue-50 dark:bg-blue-950/30",
              },
              {
                label: "Cadastrado em",
                value: formatDate(client.createdAt),
                icon: CalendarDays,
                iconClassName: "text-blue-600",
                toneClassName: "bg-blue-50 dark:bg-blue-950/30",
              },
              {
                label: "Renda",
                value: formatCurrency(client.income),
                icon: DollarSign,
                iconClassName: "text-emerald-600",
                toneClassName: "bg-emerald-50 dark:bg-emerald-950/30",
              },
              {
                label: "Valor solicitado",
                value: formatCurrency(client.requestedAmount),
                icon: FileText,
                iconClassName: "text-blue-600",
                toneClassName: "bg-blue-50 dark:bg-blue-950/30",
              },
              {
                label: "Cidade",
                value: client.city || "-",
                icon: MapPin,
                iconClassName: "text-zinc-500 dark:text-zinc-300",
                toneClassName: "bg-zinc-100 dark:bg-zinc-800",
              },
            ]

            return (
              <div key={client.id} className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => client.photo && setProfileImagePreview({ name: client.name, src: client.photo })}
                      className={`${client.photo ? "cursor-zoom-in" : "cursor-default"} shrink-0`}
                      title={client.photo ? "Ampliar foto" : undefined}
                    >
                      <Avatar name={client.name} src={client.photo} size="lg" className="h-14 w-14 border border-emerald-100 dark:border-emerald-900/40" />
                    </button>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">{client.name}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${displayStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : displayStatus === "DESAPARECIDO" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"}`}>
                      {displayStatus === "ACTIVE" ? "Ativo" : displayStatus === "DESAPARECIDO" ? "Desaparecido" : "Inativo"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="grid gap-3 md:grid-cols-2">
                    {infoCards.slice(0, 2).map((item, index) => (
                      <div
                        key={item.label}
                        className={`flex items-center gap-3 ${index === 0 ? "md:border-r md:border-gray-200 md:pr-3 dark:md:border-zinc-800" : "md:pl-1"}`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.toneClassName}`}>
                          <item.icon className={`h-5 w-5 ${item.iconClassName}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-500 dark:text-zinc-400">{item.label}</p>
                          <p className="truncate text-lg font-semibold text-gray-900 dark:text-zinc-100">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3.5 grid gap-3 md:grid-cols-2">
                  {infoCards.slice(2).map((item) => (
                    <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.toneClassName}`}>
                          <item.icon className={`h-5 w-5 ${item.iconClassName}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-500 dark:text-zinc-400">{item.label}</p>
                          <p className="truncate text-lg font-semibold text-gray-900 dark:text-zinc-100">{item.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-950/30">
                        <Flame className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-500 dark:text-zinc-400">Score de Crédito</p>
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-3xl font-semibold leading-none text-orange-600">{client.score}</span>
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getScoreColor(client.score)}`}>
                            {getScoreLabel(client.score)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 border-t border-gray-100 pt-3.5 dark:border-zinc-800">
                  <div className={`flex items-center gap-2 text-sm font-medium ${hasActiveLoan ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-zinc-400"}`}>
                    <span className="text-base">{getScoreIcon(client.score)}</span>
                    <span>{hasActiveLoan ? "Com empréstimo ativo" : "Sem empréstimo ativo"}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleEdit(client)}
                      title="Editar cliente"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(client.id)}
                      title="Excluir cliente"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog
        open={Boolean(profileImagePreview)}
        onClose={() => setProfileImagePreview(null)}
        title={profileImagePreview?.name || "Foto do perfil"}
        className="max-w-2xl"
      >
        {profileImagePreview && (
          <div className="flex justify-center">
            <img
              src={profileImagePreview.src}
              alt={`Foto de ${profileImagePreview.name}`}
              className="max-h-[82vh] w-auto rounded-xl object-contain"
            />
          </div>
        )}
      </Dialog>

      {/* Dialog Novo / Editar Cliente */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Editar Cliente" : "Novo Cliente"}
        className="max-w-2xl"
      >
        {/* Tabs */}
        <div className="grid grid-cols-1 gap-1 rounded-lg bg-gray-50 p-1 mb-6 dark:bg-zinc-800 sm:grid-cols-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-start gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors sm:justify-center ${
                activeTab === tab.key
                  ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:text-zinc-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit, (formErrors) => {
          // If validation fails, switch to the tab with the error
          if (formErrors.name || formErrors.email || formErrors.phone || formErrors.document || formErrors.profession || formErrors.workplace || formErrors.category || formErrors.income || formErrors.requestedAmount) {
            setActiveTab("dados")
          } else if (formErrors.address || formErrors.city || formErrors.state || formErrors.zipCode || formErrors.neighborhood || formErrors.complement || formErrors.number) {
            setActiveTab("endereco")
          }
          setFormError("Preencha os campos obrigatórios corretamente")
        })} className="space-y-5">
          {/* Tab: Dados Pessoais */}
          {activeTab === "dados" && (
            <div className="space-y-5">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-2">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Foto do cliente"
                    className="h-20 w-20 rounded-full object-cover border-2 border-emerald-500"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-emerald-50 dark:bg-emerald-950/300 flex items-center justify-center text-white text-2xl font-bold">
                    {watchName ? watchName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "CL"}
                  </div>
                )}
                <span className="text-xs text-gray-400 dark:text-zinc-500">Avatar gerado automaticamente</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 dark:border-zinc-700 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-colors"
                >
                  <Camera className="h-4 w-4" />
                  Adicionar foto
                </button>
                <span className="text-xs text-gray-400 dark:text-zinc-500">A foto será enviada ao salvar o cliente</span>
              </div>

              {/* Nome Completo */}
              <div>
                <Label className="flex items-center gap-1">Nome Completo *</Label>
                <Input {...register("name")} className="mt-1" />
                {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
              </div>

              {/* CPF */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> CPF
                </Label>
                <Input
                  {...register("document")}
                  placeholder="000.000.000-00"
                  className="mt-1"
                  onChange={(e) => setValue("document", cpfMask(e.target.value))}
                />
              </div>

              {/* Telefone */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="font-medium">Telefone (com DDD)</Label>
                  <Input
                    {...register("phone")}
                    placeholder="(00) 00000-0000"
                    className="mt-1"
                    onChange={(e) => setValue("phone", phoneMask(e.target.value))}
                  />
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Inclua o DDD para envio de mensagens via WhatsApp</p>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Instagram className="h-3.5 w-3.5" /> Instagram
                  </Label>
                  <Input
                    {...register("instagram")}
                    placeholder="@usuario"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Profissão e Local de Trabalho */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Profissão
                  </Label>
                  <Input
                    {...register("profession")}
                    placeholder="Ex: Eletricista, Comerciante..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Local de Trabalho</Label>
                  <Input
                    {...register("workplace")}
                    placeholder="Ex: Empresa X, Loja Y..."
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Renda e Valor Solicitado */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Renda</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register("income", { valueAsNumber: true })}
                    placeholder="R$ 0,00"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Valor Solicitado</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register("requestedAmount", { valueAsNumber: true })}
                    placeholder="R$ 0,00"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Categoria */}
              <div>
                <Label>Categoria</Label>
                <select
                  {...register("category")}
                  className="flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <option value="">Selecione...</option>
                  <option value="CARTEIRA_ASSINADA">Carteira assinada</option>
                  <option value="CLT_SEM_REGISTRO">CLT sem registro</option>
                  <option value="AUTONOMO">Autônomo</option>
                  <option value="BENEFICIARIO">Beneficiário</option>
                  <option value="ESTAGIARIO">Estagiário</option>
                  <option value="SEM_COMPROVACAO">Não consigo comprovação renda</option>
                </select>
              </div>

              {/* Cliente veio por indicação */}
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-zinc-800 cursor-pointer hover:bg-white dark:bg-zinc-900 transition-colors"
                onClick={() => {
                  const nextReferral = !watchReferral
                  setValue("referral", nextReferral)
                  if (!nextReferral) {
                    setValue("referralName", "")
                    setValue("referralPhone", "")
                  }
                }}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className={`h-5 w-5 transition-opacity ${watchReferral ? "opacity-100" : "opacity-30"}`} />
                </div>
                <Users className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                <span className="text-sm text-gray-700 dark:text-zinc-300">Cliente veio por indicação</span>
              </div>

              {watchReferral && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Nome de quem indicou</Label>
                      <Input
                        {...register("referralName")}
                        placeholder="Nome do indicador"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Telefone de quem indicou</Label>
                      <Input
                        {...register("referralPhone")}
                        placeholder="(00) 00000-0000"
                        className="mt-1"
                        onChange={(e) => setValue("referralPhone", phoneMask(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tipo de Cliente - removed */}

              <div>
                <Label className="font-medium">Status do Cliente</Label>
                <select
                  {...register("status")}
                  className="mt-1 flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                  <option value="DESAPARECIDO">Desaparecido</option>
                </select>
                <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
                  {watchStatus === "DESAPARECIDO"
                    ? "Clientes desaparecidos saem da listagem principal e aparecem na página Desaparecido."
                    : watchStatus === "INACTIVE"
                      ? "Clientes inativos continuam cadastrados, mas sem novas operações no fluxo normal."
                      : "Clientes ativos seguem disponíveis para novos empréstimos."}
                </p>
              </div>

              {/* Observações */}
              <div>
                <Label className="font-semibold text-gray-800 dark:text-zinc-200">Observações</Label>
                <Textarea
                  {...register("notes")}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Tab: Endereço */}
          {activeTab === "endereco" && (
            <div className="space-y-4">
              {/* CEP com botão Buscar */}
              <div>
                <Label className="font-semibold">CEP</Label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <Input
                    {...register("zipCode")}
                    placeholder="00000-000"
                    className="flex-1"
                    onChange={(e) => setValue("zipCode", cepMask(e.target.value))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchCep() } }}
                  />
                  <button
                    type="button"
                    onClick={searchCep}
                    disabled={cepLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-700 transition-colors disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:w-auto"
                  >
                    <Search className="h-4 w-4" />
                    {cepLoading ? "Buscando..." : "Buscar"}
                  </button>
                </div>
              </div>

              {/* Rua / Logradouro */}
              <div>
                <Label className="font-semibold">Rua / Logradouro</Label>
                <Input {...register("address")} placeholder="Preenchido automaticamente pelo CEP" className="mt-1" />
              </div>

              {/* Número e Complemento */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="font-semibold">Número</Label>
                  <Input {...register("number")} placeholder="123" className="mt-1" />
                </div>
                <div>
                  <Label className="font-semibold">Complemento</Label>
                  <Input {...register("complement")} placeholder="Apto 101" className="mt-1" />
                </div>
              </div>

              {/* Bairro */}
              <div>
                <Label className="font-semibold">Bairro</Label>
                <Input {...register("neighborhood")} placeholder="Preenchido automaticamente pelo CEP" className="mt-1" />
              </div>

              {/* Cidade e Estado */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="font-semibold">Cidade</Label>
                  <Input {...register("city")} placeholder="Preenchido automaticamente" className="mt-1" />
                </div>
                <div>
                  <Label className="font-semibold">Estado (UF)</Label>
                  <Input {...register("state")} placeholder="UF" className="mt-1" />
                </div>
              </div>
            </div>
          )}

          {/* Tab: Documentos */}
          {activeTab === "documentos" && (
            <div className="space-y-4">
              {!editing ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-500 dark:text-zinc-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-zinc-400 text-sm">Salve o cliente primeiro para adicionar documentos</p>
                  <p className="text-gray-400 dark:text-zinc-500 text-xs mt-1">Crie o cliente e depois edite para enviar documentos</p>
                </div>
              ) : (
                <>
                  {/* Upload area */}
                  <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-700 p-6 text-center hover:border-gray-300 dark:border-zinc-700 transition-colors">
                    <Upload className="h-10 w-10 text-gray-400 dark:text-zinc-500 mx-auto mb-3" />
                    <p className="text-sm text-gray-700 dark:text-zinc-300 mb-1">Enviar documento</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">PDF, imagens (JPG, PNG) — máx. 5MB</p>

                    <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                      <select
                        value={selectedDocType}
                        onChange={(e) => setSelectedDocType(e.target.value)}
                        className="h-9 rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        {DOC_TYPES.map((dt) => (
                          <option key={dt.value} value={dt.value}>{dt.label}</option>
                        ))}
                      </select>

                      <input
                        type="file"
                        ref={docFileInputRef}
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={handleDocUpload}
                      />
                      <button
                        type="button"
                        onClick={() => docFileInputRef.current?.click()}
                        disabled={uploadingDoc}
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingDoc ? "Enviando..." : "Selecionar Arquivo"}
                      </button>
                    </div>
                  </div>

                  {/* Document list */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">Documentos enviados</h4>
                    {docsLoading ? (
                      <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-4">Carregando documentos...</p>
                    ) : clientDocs.length === 0 ? (
                      <div className="text-center py-6 rounded-lg bg-white dark:bg-zinc-900">
                        <FileText className="h-8 w-8 text-gray-500 dark:text-zinc-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-400 dark:text-zinc-500">Nenhum documento enviado</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {clientDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-center gap-3">
                              {getDocIcon(doc.fileType)}
                              <div>
                                <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{doc.name}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/300/10 px-2 py-0.5 rounded">
                                    {getDocTypeLabel(doc.type)}
                                  </span>
                                  <span className="text-xs text-gray-400 dark:text-zinc-500">
                                    {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDocDelete(doc.id)}
                                className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:bg-red-950/300/10 transition-colors"
                                title="Excluir documento"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Botões de ação */}
          {formError && (
            <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/300/10 border border-red-500/30 text-red-600 text-sm">
              {formError}
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setFormError(null) }}>
              Cancelar
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              {activeTab === "dados" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab("endereco")}
                  className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:bg-emerald-950/300/10"
                >
                  Próximo: Endereço →
                </Button>
              )}
              {activeTab === "endereco" && (
                <>
                  <Button type="button" variant="outline" onClick={() => setActiveTab("dados")}>
                    ← Voltar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab("documentos")}
                    className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:bg-emerald-950/300/10"
                  >
                    Próximo: Documentos →
                  </Button>
                </>
              )}
              {activeTab === "documentos" && (
                <Button type="button" variant="outline" onClick={() => setActiveTab("endereco")}>
                  ← Voltar
                </Button>
              )}
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editing ? "Salvar" : "Criar Cliente"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

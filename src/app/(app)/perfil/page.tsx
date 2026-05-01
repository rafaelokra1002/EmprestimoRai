"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar } from "@/components/avatar"
import { Dialog } from "@/components/ui/dialog"
import {
  AlertTriangle,
  Calendar,
  Crown,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  QrCode,
  TrendingUp,
  Upload,
  User,
  Users,
  Wallet,
  Image as ImageIcon,
  Pencil,
  Clock3,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type ProfileData = {
  id: string
  name: string
  email: string
  phone?: string
  pixKey?: string
  chargeName?: string
  paymentLink?: string
  logoUrl?: string
  whatsappConnected?: boolean
  createdAt: string
  stats?: {
    totalClients: number
    totalLoaned: number
    totalReceived: number
  }
  subscription?: {
    plan: string
    validUntil: string
    remainingDays: number
  }
}

type EditType = "profile" | "pix" | "charge" | "payment"

export default function PerfilPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const [editOpen, setEditOpen] = useState(false)
  const [editType, setEditType] = useState<EditType>("profile")

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [chargeName, setChargeName] = useState("")
  const [paymentLink, setPaymentLink] = useState("")

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [whatsappBusy, setWhatsappBusy] = useState(false)
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [whatsappQrLoading, setWhatsappQrLoading] = useState(false)
  const [whatsappQrImage, setWhatsappQrImage] = useState("")
  const [whatsappState, setWhatsappState] = useState("idle")
  const [whatsappError, setWhatsappError] = useState("")

  const logoInputRef = useRef<HTMLInputElement>(null)

  const refreshProfile = async () => {
    const response = await fetch("/api/profile")
    const data = await response.json()
    if (response.ok && !data.error) {
      setProfile(data)
      setName(data.name || "")
      setPhone(data.phone || "")
      setPixKey(data.pixKey || "")
      setChargeName(data.chargeName || data.name || "")
      setPaymentLink(data.paymentLink || "")
    }
  }

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false))
  }, [])

  const saveProfilePatch = async (payload: any, successMessage: string) => {
    setSaving(true)
    setMessage("")
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok || data?.error) {
        throw new Error(data?.error || "Erro ao salvar")
      }
      await refreshProfile()
      setMessage(successMessage)
    } catch (error: any) {
      setMessage(error.message || "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEditDialog = async () => {
    if (editType === "profile") {
      await saveProfilePatch({ name, phone }, "Perfil atualizado com sucesso!")
    }
    if (editType === "pix") {
      await saveProfilePatch({ pixKey }, "Chave PIX salva com sucesso!")
    }
    if (editType === "charge") {
      await saveProfilePatch({ chargeName }, "Nome de cobrança salvo com sucesso!")
    }
    if (editType === "payment") {
      await saveProfilePatch({ paymentLink }, "Link de pagamento salvo com sucesso!")
    }
    setEditOpen(false)
  }

  const handleRenewSubscription = async () => {
    await saveProfilePatch({ renewSubscription: true }, "Assinatura renovada com sucesso!")
  }

  const updateWhatsappConnectedFlag = async (connected: boolean) => {
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappConnected: connected }),
    })
  }

  const callWhatsappAction = async (
    action: "start" | "disconnect",
    successMessage: string
  ) => {
    setWhatsappBusy(true)
    setMessage("")
    setWhatsappError("")
    try {
      const url = action === "start" ? "/api/whatsapp/connect" : "/api/whatsapp/disconnect"
      const response = await fetch(url, { method: "POST" })
      const data = await response.json()
      if (!response.ok || data?.error) {
        throw new Error(data?.error || "Erro na conexão do WhatsApp")
      }
      if (action === "start") {
        const qr = data?.qrCode || ""
        setWhatsappQrImage(qr)
        setWhatsappState(data?.state || "connecting")
        if (!qr && !data?.connected) {
          setWhatsappError("Não foi possível gerar o QR Code. Verifique se a API do WhatsApp está rodando (docker compose up -d).")
        }
      } else {
        setWhatsappQrImage("")
        setWhatsappState("disconnected")
        await updateWhatsappConnectedFlag(false)
      }
      await refreshProfile()
      setMessage(successMessage)
    } catch (error: any) {
      const msg = error.message || "Erro na conexão do WhatsApp"
      setMessage(msg)
      setWhatsappError(msg)
    } finally {
      setWhatsappBusy(false)
    }
  }

  const startWhatsappConnection = async () => {
    setWhatsappModalOpen(true)
    setWhatsappQrLoading(true)
    setWhatsappError("")
    setWhatsappQrImage("")
    await callWhatsappAction("start", "Código de conexão gerado")
    setWhatsappQrLoading(false)
  }

  const checkWhatsappStatus = async () => {
    try {
      const response = await fetch("/api/whatsapp/status", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok || data?.error) return

      setWhatsappState(data?.state || "unknown")
      if (data?.qrCode) {
        setWhatsappQrImage(data.qrCode)
      }

      if (data?.connected) {
        await updateWhatsappConnectedFlag(true)
        await refreshProfile()
        setMessage("WhatsApp conectado")
        setWhatsappModalOpen(false)
      }
    } catch {
    }
  }

  useEffect(() => {
    if (!whatsappModalOpen) return
    checkWhatsappStatus()
    const interval = setInterval(() => {
      checkWhatsappStatus()
    }, 3000)
    return () => clearInterval(interval)
  }, [whatsappModalOpen])

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      setMessage("A senha deve ter pelo menos 6 caracteres")
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage("As senhas não conferem")
      return
    }

    await saveProfilePatch({ password: newPassword }, "Senha alterada com sucesso!")
    setNewPassword("")
    setConfirmPassword("")
  }

  const handleLogoFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const result = String(reader.result || "")
      await saveProfilePatch({ logoUrl: result }, "Logo atualizada com sucesso!")
    }
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  const cardClass = "border-emerald-200/80 dark:border-emerald-800 bg-white dark:bg-zinc-900"

  const memberSince = useMemo(() => {
    if (!profile?.createdAt) return "-"
    return new Date(profile.createdAt).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
  }, [profile?.createdAt])

  const subscriptionValidUntil = useMemo(() => {
    if (!profile?.subscription?.validUntil) return "-"
    return new Date(profile.subscription.validUntil).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }, [profile?.subscription?.validUntil])

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6 pt-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[1.7rem] font-bold tracking-[-0.02em] text-slate-700 dark:text-zinc-100 sm:text-[1.85rem]">Meu Perfil</h1>
          <p className="text-sm font-medium text-slate-400 dark:text-zinc-400">Informações da sua conta</p>
        </div>
        <Button
          variant="outline"
          className="h-11 gap-2 rounded-xl border-gray-200 px-5 text-slate-500 shadow-sm hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => {
            setEditType("profile")
            setEditOpen(true)
          }}
        >
          <Edit3 className="h-4 w-4" /> Editar Perfil
        </Button>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${message.toLowerCase().includes("erro") ? "border-red-500/30 bg-red-50 dark:bg-red-950/300/10 text-red-300" : "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/300/10 text-emerald-300"}`}>
          {message}
        </div>
      )}

      <Card className="overflow-hidden rounded-[22px] border border-emerald-100 bg-white shadow-[0_18px_40px_-28px_rgba(16,185,129,0.45)] dark:border-emerald-900/60 dark:bg-zinc-900">
        <div className="h-20 bg-gradient-to-r from-emerald-600 via-emerald-600 to-green-600 sm:h-24" />
        <CardContent className="relative -mt-8 px-5 pb-5 sm:px-7 sm:pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Avatar
            name={profile?.name || "Usuário"}
            src={profile?.logoUrl || undefined}
            size="lg"
                className="h-20 w-20 border-4 border-white bg-emerald-600 text-2xl text-white shadow-lg dark:border-zinc-900 sm:h-24 sm:w-24"
          />
              <div className="space-y-1.5">
                <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-slate-600 dark:text-zinc-100 sm:text-[1.2rem]">{profile?.name || "Usuário"}</h2>
                <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Ativo
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-[18px] border border-emerald-100 bg-white shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
          <CardHeader className="pb-5">
            <CardTitle className="flex items-center gap-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-slate-600 dark:text-zinc-100">
              <User className="h-4 w-4 text-emerald-600" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-slate-600 dark:text-zinc-200">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-slate-400/90 dark:text-zinc-500">Email</p>
                <p className="text-[1.05rem] font-semibold leading-tight text-slate-600 dark:text-zinc-100 sm:text-lg">{profile?.email}</p>
                <p className="text-[12px] text-slate-400/90 dark:text-zinc-500">Não pode ser alterado</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-slate-400/90 dark:text-zinc-500">WhatsApp</p>
                <p className="text-[1.12rem] font-semibold leading-tight tracking-[-0.02em] text-slate-600 dark:text-zinc-100 sm:text-[1.18rem]">{profile?.phone || "Não informado"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-slate-400/90 dark:text-zinc-500">Membro desde</p>
                <p className="text-[1.12rem] font-semibold leading-tight tracking-[-0.02em] text-slate-600 dark:text-zinc-100 sm:text-[1.18rem]">{memberSince}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[18px] border border-emerald-100 bg-white shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
          <CardHeader className="pb-5">
            <CardTitle className="flex items-center gap-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-slate-600 dark:text-zinc-100">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Estatísticas da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-slate-600 dark:text-zinc-200">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-slate-400/90 dark:text-zinc-500">Total de Clientes</p>
                <p className="text-[1.12rem] font-semibold tabular-nums leading-tight tracking-[-0.02em] text-slate-600 dark:text-zinc-100 sm:text-[1.18rem]">{profile?.stats?.totalClients || 0}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-slate-400/90 dark:text-zinc-500">Total Emprestado</p>
                <p className="text-[1.12rem] font-semibold tabular-nums leading-tight tracking-[-0.02em] text-slate-600 dark:text-zinc-100 sm:text-[1.18rem]">{formatCurrency(profile?.stats?.totalLoaned || 0)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-slate-400/90 dark:text-zinc-500">Total Recebido</p>
                <p className="text-[1.12rem] font-semibold tabular-nums leading-tight tracking-[-0.02em] text-slate-600 dark:text-zinc-100 sm:text-[1.18rem]">{formatCurrency(profile?.stats?.totalReceived || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={cardClass}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-900 dark:text-zinc-100">Chave PIX para Cobranças</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => { setEditType("pix"); setEditOpen(true) }}><Pencil className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">Configure sua chave PIX. Ela será incluída automaticamente nas mensagens de cobrança com o valor exato da parcela.</p>
          <div className="flex items-center gap-3 text-gray-800 dark:text-zinc-200"><QrCode className="h-4 w-4 text-emerald-600" /><div><p className="text-[11px] text-gray-400 dark:text-zinc-500">Chave Cadastrada</p><p className="text-sm font-semibold">{profile?.pixKey || "Nenhuma chave cadastrada"}</p></div></div>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-900 dark:text-zinc-100">Nome nas Cobranças</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => { setEditType("charge"); setEditOpen(true) }}><Pencil className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">Este nome será exibido no final das mensagens de cobrança enviadas aos seus clientes via WhatsApp.</p>
          <div className="flex items-center gap-3 text-gray-800 dark:text-zinc-200"><User className="h-4 w-4 text-emerald-600" /><div><p className="text-[11px] text-gray-400 dark:text-zinc-500">Nome Configurado</p><p className="text-sm font-semibold">{profile?.chargeName || "Nenhum nome cadastrado"}</p></div></div>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-900 dark:text-zinc-100">Link de Pagamento (Opcional)</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => { setEditType("payment"); setEditOpen(true) }}><Pencil className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">Configure um link de pagamento adicional (PagSeguro, Mercado Pago, etc). Será incluído nas mensagens junto com a chave PIX.</p>
          <div className="flex items-center gap-3 text-gray-800 dark:text-zinc-200"><LinkIcon className="h-4 w-4 text-emerald-600" /><div><p className="text-[11px] text-gray-400 dark:text-zinc-500">Link Cadastrado</p><p className="text-sm font-semibold break-all">{profile?.paymentLink || "Nenhum link cadastrado"}</p></div></div>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-zinc-100">Logo da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 flex items-center justify-center">
              {profile?.logoUrl ? <img src={profile.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-gray-400 dark:text-zinc-500" />}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Esta logo será usada nos PDFs de comprovantes e contratos.</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500">Recomendado: PNG transparente, até 2MB</p>
            </div>
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
          <Button variant="outline" className="gap-2" onClick={() => logoInputRef.current?.click()}><Upload className="h-4 w-4" /> Enviar Logo</Button>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-zinc-100"><MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp para Clientes</CardTitle>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${profile?.whatsappConnected ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600" : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"}`}>{profile?.whatsappConnected ? "✓ Conectado" : "✗ Não Conectado"}</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 p-6 text-center">
            <p className="text-base font-bold text-gray-900 dark:text-zinc-100">Conecte seu WhatsApp</p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Escaneie um QR Code para conectar seu WhatsApp e enviar mensagens diretamente aos seus clientes.</p>

            {profile?.whatsappConnected ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-emerald-300">Sessão conectada com sucesso</p>
                <Button
                  className="gap-2"
                  variant="outline"
                  onClick={() => callWhatsappAction("disconnect", "WhatsApp desconectado")}
                  disabled={whatsappBusy}
                >
                  {whatsappBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Desconectar WhatsApp
                </Button>
              </div>
            ) : (
              <Button
                className="mt-4 gap-2"
                onClick={startWhatsappConnection}
                disabled={whatsappBusy}
              >
                {whatsappBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Conectar WhatsApp
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        title="Conectar WhatsApp"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="-mt-2 text-gray-500 dark:text-zinc-400">Conecte seu WhatsApp para enviar mensagens aos clientes</p>

          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            {whatsappQrLoading ? (
              <div className="flex h-[260px] flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <p className="text-gray-700 dark:text-zinc-300">Gerando QR Code...</p>
              </div>
            ) : whatsappError ? (
              <div className="flex h-[260px] flex-col items-center justify-center gap-3 px-4">
                <AlertTriangle className="h-10 w-10 text-red-500" />
                <p className="text-center text-sm text-red-600 dark:text-red-400">{whatsappError}</p>
                <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={startWhatsappConnection} disabled={whatsappBusy}>
                  <Loader2 className={`h-4 w-4 ${whatsappBusy ? "animate-spin" : "hidden"}`} />
                  Tentar Novamente
                </Button>
              </div>
            ) : whatsappQrImage ? (
              <div className="space-y-3">
                <div className="mx-auto h-[220px] w-[220px] overflow-hidden rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 p-2">
                  <img
                    src={whatsappQrImage}
                    alt="QR Code de conexão WhatsApp"
                    className="h-full w-full rounded bg-white dark:bg-zinc-900 object-contain"
                  />
                </div>
                <p className="text-center text-xs text-gray-500 dark:text-zinc-400">Estado atual: <span className="font-semibold text-emerald-300">{whatsappState}</span></p>
              </div>
            ) : (
              <div className="flex h-[260px] flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <p className="text-gray-700 dark:text-zinc-300">Aguardando...</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/300/10 p-3 text-sm text-amber-300">
            <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4" /> Importante: Se você tiver outras sessões do WhatsApp Web ativas, feche-as primeiro para evitar desconexões.</p>
          </div>

          <div className="space-y-2">
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 p-3">
              <p className="font-semibold text-gray-900 dark:text-zinc-100">1. Abra o WhatsApp</p>
              <p className="text-sm text-gray-500 dark:text-zinc-400">No seu celular</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 p-3">
              <p className="font-semibold text-gray-900 dark:text-zinc-100">2. Aparelhos conectados</p>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Menu → Aparelhos conectados</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 p-3">
              <p className="font-semibold text-gray-900 dark:text-zinc-100">3. Escaneie o QR Code</p>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Toque em "Conectar um aparelho" e escaneie o QR acima</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => callWhatsappAction("start", "Novo código de conexão gerado")} disabled={whatsappBusy || whatsappQrLoading}>Gerar novo QR</Button>
            <Button onClick={checkWhatsappStatus} disabled={whatsappBusy || whatsappQrLoading}>
              {whatsappBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock3 className="mr-2 h-4 w-4" />} Verificar conexão
            </Button>
          </div>
        </div>
      </Dialog>

      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-zinc-100"><KeyRound className="h-4 w-4 text-amber-600" /> Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-zinc-400">Digite uma nova senha para sua conta. A senha deve ter pelo menos 6 caracteres.</p>
          <div>
            <Label>Nova Senha</Label>
            <div className="relative mt-1"><Input type={showPassword ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Digite a nova senha" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          </div>
          <div>
            <Label>Confirmar Nova Senha</Label>
            <div className="relative mt-1"><Input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirme a nova senha" /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-400">{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          </div>
          <Button className="gap-2" onClick={handlePasswordChange} disabled={saving || !newPassword || !confirmPassword}><KeyRound className="h-4 w-4" /> Alterar Senha</Button>
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={
          editType === "profile"
            ? "Editar Perfil"
            : editType === "pix"
              ? "Editar Chave PIX"
              : editType === "charge"
                ? "Editar Nome de Cobrança"
                : "Editar Link de Pagamento"
        }
        className="max-w-lg"
      >
        <div className="space-y-4">
          {editType === "profile" && (
            <>
              <div><Label>Nome</Label><Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} /></div>
              <div><Label>Email</Label><Input className="mt-1 opacity-70" value={profile?.email || ""} readOnly /></div>
              <div><Label>WhatsApp</Label><Input className="mt-1" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
            </>
          )}
          {editType === "pix" && (
            <div><Label>Chave PIX</Label><Input className="mt-1" value={pixKey} onChange={(event) => setPixKey(event.target.value)} placeholder="CPF, e-mail, telefone ou aleatória" /></div>
          )}
          {editType === "charge" && (
            <div><Label>Nome para cobrança</Label><Input className="mt-1" value={chargeName} onChange={(event) => setChargeName(event.target.value)} placeholder="Ex.: SP Cobrança Fácil" /></div>
          )}
          {editType === "payment" && (
            <div><Label>Link de pagamento</Label><Input className="mt-1" value={paymentLink} onChange={(event) => setPaymentLink(event.target.value)} placeholder="https://..." /></div>
          )}
          <Button className="w-full" onClick={handleSaveEditDialog} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar</Button>
        </div>
      </Dialog>
    </div>
  )
}

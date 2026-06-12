"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, User, Building2, Phone, ExternalLink, Info, MessageCircle, Settings2, Lock, Eye, Shield, Cog, Users, RotateCcw, Save, ChevronDown, Palette, Check } from "lucide-react"
import { useTheme } from "@/lib/theme-provider"
import { ACCENT_PRESETS } from "@/lib/accent-color"

/* ─── Default template contents ─── */
const DEFAULT_TEMPLATES: Record<string, string> = {
  ATRASO: `Cliente: {CLIENTE}

────────────────
🚨 PAGAMENTO EM ATRASO

📅 Vencimento: {DATA}
📆 Atraso: {DIAS_ATRASO} dias

💰 Pagamento Total: {TOTAL}
🔄 Regularização (juros): {JUROS}

⚠️ Atraso:
R$ 15,00 por dia até regularização.

────────────────
👤 Titular: {NOME_PIX}

💠 Chave Pix: {PIX}`,
  VENCE_HOJE: `👤 {CLIENTE}

───────────────

🟡 VENCIMENTO HOJE

📅 Data: {DATA}

💰 Valor total: {TOTAL}
📈 Juros: {JUROS}

🔄 Renove seu prazo
Pague apenas os juros e tenha mais 30 dias para quitar o valor total.

⚠️ Em caso de atraso:
Será cobrado R$ 15,00 por dia.

───────────────

👤 {NOME_PIX}

💠 Chave Pix: {PIX}`,
  ANTECIPADA: `Olá {CLIENTE}

📌 LEMBRETE DE PAGAMENTO

📅 Vencimento: {DATA}
⏳ Restam: {DIAS_PARA_VENCER} dias

💰 Valor total: {VALOR}

🔄 Renovação disponível:
Pague {JUROS} (juros) e receba +30 dias de prazo.

─────────────────
👤 Titular : {NOME_PIX}

💠 Chave Pix: {PIX}`,
}

/* ─── Pre-built template options ─── */
const PRESET_TEMPLATES: Record<string, { icon: string; label: string; desc: string; content: string }[]> = {
  ATRASO: [
    {
      icon: "📋",
      label: "Padrão do Sistema",
      desc: "Template completo de cobrança em atraso",
      content: DEFAULT_TEMPLATES.ATRASO,
    },
    {
      icon: "📄",
      label: "Parcelado",
      desc: "Cobrança detalhada por parcela com status",
      content: `👤 Cliente: {CLIENTE}\n\n────────────────\n🚨 {N_ATRASO} PARCELAS EM ATRASO\n\n{PARCELAS_ATRASO}\n💵 TOTAL A PAGAR: {TOTAL}\n────────────────\n\n📊 STATUS DAS PARCELAS\n{STATUS_PARCELAS}\n\n────────────────\n👤 Titular: {NOME_PIX}\n\n💳 Chave PIX: {PIX}`,
    },
  ],
  VENCE_HOJE: [
    {
      icon: "📋",
      label: "Padrão do Sistema",
      desc: "Template completo de vencimento hoje",
      content: DEFAULT_TEMPLATES.VENCE_HOJE,
    },
    {
      icon: "📄",
      label: "Parcelado",
      desc: "Vencimento hoje com status de todas as parcelas",
      content: `👤 Cliente: {CLIENTE}\n\n────────────────\n⚠️ VENCIMENTO HOJE\n\n📌 Parcela: {PARCELA}\n💵 Valor da parcela: {VALOR}\n📅 Vencimento: {DATA}\n\n📊 STATUS DAS PARCELAS:\n{STATUS_PARCELAS}\n\n⚠️ Atraso: multa de R$ 15,00 por dia\n\n────────────────\n👤 Titular: {NOME_PIX}\n\n💳 Chave PIX: {PIX}`,
    },
  ],
  ANTECIPADA: [
    {
      icon: "📋",
      label: "Padrão do Sistema",
      desc: "Lembrete antecipado com renovação e PIX",
      content: DEFAULT_TEMPLATES.ANTECIPADA,
    },
    {
      icon: "📄",
      label: "Parcelado",
      desc: "Lembrete antecipado com status de todas as parcelas",
      content: `👤 Cliente: {CLIENTE}\n\n────────────────\n📋 LEMBRETE DE PAGAMENTO\n\n📌 Parcela: {PARCELA}\n💰 Valor: {VALOR}\n📅 Vencimento: {DATA}\n⏳ Faltam: {DIAS_PARA_VENCER} dias)\n\n📊 STATUS DAS PARCELAS:\n{STATUS_PARCELAS}\n\n────────────────\n👤 Titular: {NOME_PIX}\n\n💳 Chave PIX:\n{PIX}`,
    },
  ],
}

const AVAILABLE_VARIABLES = [
  "{CLIENTE}", "{VALOR}", "{PARCELA}", "{DATA}", "{DIAS_ATRASO}", "{DIAS_PARA_VENCER}",
  "{JUROS_CONTRATO}", "{MULTA}", "{JUROS}", "{JUROS_MULTA}", "{TOTAL}", "{PROGRESSO}",
  "{PIX}", "{NOME_PIX}", "{N_ATRASO}", "{PARCELAS_ATRASO}", "{STATUS_PARCELAS}",
  "{ASSINATURA}", "{FECHAMENTO}",
]

type BaseTabKey = "ATRASO" | "VENCE_HOJE" | "ANTECIPADA"
type TabKey = BaseTabKey | "ATRASO_PARCELADO" | "VENCE_HOJE_PARCELADO" | "ANTECIPADA_PARCELADO"

const TAB_CONFIG: { key: BaseTabKey; label: string; dot: string }[] = [
  { key: "ATRASO", label: "Atraso", dot: "bg-red-500" },
  { key: "VENCE_HOJE", label: "Vence Hoje", dot: "bg-yellow-400" },
  { key: "ANTECIPADA", label: "Antecipada", dot: "bg-green-500" },
]

const PARCELADO_DEFAULTS: Record<BaseTabKey, string> = {
  ATRASO: PRESET_TEMPLATES.ATRASO[1].content,
  VENCE_HOJE: PRESET_TEMPLATES.VENCE_HOJE[1].content,
  ANTECIPADA: PRESET_TEMPLATES.ANTECIPADA[1].content,
}

/* ─── Custom Preset Dropdown with icons + descriptions ─── */
function PresetDropdown({ presets, onSelect }: { presets: { icon: string; label: string; desc: string; content: string }[]; onSelect: (label: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <label className="text-xs text-gray-400 dark:text-zinc-500 mb-1 block">Escolher template pronto</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full bg-gray-100 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-500 dark:text-zinc-400 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/40 flex items-center justify-between"
        >
          <span>Selecione um template pronto...</span>
          <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute z-50 mt-1 w-full bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { onSelect(p.label); setOpen(false) }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-200 dark:hover:bg-zinc-700 dark:bg-zinc-700/60 transition flex items-start gap-3 border-b border-gray-300 dark:border-zinc-700/30 last:border-b-0"
                >
                  <span className="text-lg mt-0.5">{p.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">{p.label}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{p.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  const router = useRouter()
  const { accentColor, setAccentColor } = useTheme()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTemplates, setSavingTemplates] = useState(false)
  const [message, setMessage] = useState("")
  const [templateMsg, setTemplateMsg] = useState("")

  // Profile form
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [companyName, setCompanyName] = useState("")

  // Template state
  const [activeTab, setActiveTab] = useState<BaseTabKey>("ATRASO")
  const [isParcelado, setIsParcelado] = useState(false)
  const activeKey: TabKey = isParcelado ? `${activeTab}_PARCELADO` as TabKey : activeTab
  const [templates, setTemplates] = useState<Record<TabKey, string>>({
    ATRASO: DEFAULT_TEMPLATES.ATRASO,
    VENCE_HOJE: DEFAULT_TEMPLATES.VENCE_HOJE,
    ANTECIPADA: DEFAULT_TEMPLATES.ANTECIPADA,
    ATRASO_PARCELADO: PARCELADO_DEFAULTS.ATRASO,
    VENCE_HOJE_PARCELADO: PARCELADO_DEFAULTS.VENCE_HOJE,
    ANTECIPADA_PARCELADO: PARCELADO_DEFAULTS.ANTECIPADA,
  })
  const [templateIds, setTemplateIds] = useState<Record<TabKey, string | null>>({
    ATRASO: null,
    VENCE_HOJE: null,
    ANTECIPADA: null,
    ATRASO_PARCELADO: null,
    VENCE_HOJE_PARCELADO: null,
    ANTECIPADA_PARCELADO: null,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, templatesRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/templates"),
        ])
        const profileData = await profileRes.json()
        const templatesData = await templatesRes.json()

        if (profileData && !profileData.error) {
          setName(profileData.name || "")
          setEmail(profileData.email || "")
          setPhone(profileData.phone || "")
          setCompanyName(profileData.companyName || "")
        }

        if (Array.isArray(templatesData)) {
          const ALL_KEYS: TabKey[] = ["ATRASO", "VENCE_HOJE", "ANTECIPADA", "ATRASO_PARCELADO", "VENCE_HOJE_PARCELADO", "ANTECIPADA_PARCELADO"]
          const tMap: Record<TabKey, string> = { ATRASO: "", VENCE_HOJE: "", ANTECIPADA: "", ATRASO_PARCELADO: "", VENCE_HOJE_PARCELADO: "", ANTECIPADA_PARCELADO: "" }
          const tIds: Record<TabKey, string | null> = { ATRASO: null, VENCE_HOJE: null, ANTECIPADA: null, ATRASO_PARCELADO: null, VENCE_HOJE_PARCELADO: null, ANTECIPADA_PARCELADO: null }
          for (const t of templatesData) {
            if (t.type === "COBRANCA" && ALL_KEYS.includes(t.name as TabKey) && !tIds[t.name as TabKey]) {
              tMap[t.name as TabKey] = t.content
              tIds[t.name as TabKey] = t.id
            }
          }
          setTemplates((prev) => {
            const next = { ...prev }
            for (const k of ALL_KEYS) { if (tMap[k]) next[k] = tMap[k] }
            return next
          })
          setTemplateIds(tIds)
        }
      } catch { }
      setLoading(false)
    }
    fetchData()
  }, [])

  /* ─── Profile save ─── */
  const handleSaveProfile = async () => {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, companyName }),
      })
      setMessage(res.ok ? "Alterações salvas com sucesso!" : "Erro ao salvar")
    } catch {
      setMessage("Erro ao salvar")
    }
    setSaving(false)
    setTimeout(() => setMessage(""), 3000)
  }

  /* ─── Templates save ─── */
  const handleSaveTemplates = async () => {
    setSavingTemplates(true)
    setTemplateMsg("")
    try {
      const ALL_KEYS: TabKey[] = ["ATRASO", "VENCE_HOJE", "ANTECIPADA", "ATRASO_PARCELADO", "VENCE_HOJE_PARCELADO", "ANTECIPADA_PARCELADO"]
      const newIds = { ...templateIds }
      for (const key of ALL_KEYS) {
        const content = templates[key]
        if (!content.trim()) continue
        const id = newIds[key]
        if (id) {
          await fetch(`/api/templates/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: key, content, type: "COBRANCA" }),
          })
        } else {
          const res = await fetch("/api/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: key, content, type: "COBRANCA" }),
          })
          if (res.ok) {
            const created = await res.json()
            newIds[key] = created.id
          }
        }
      }
      // Re-fetch to confirm what was persisted
      const res = await fetch("/api/templates")
      const saved = await res.json()
      if (Array.isArray(saved)) {
        const ALL_KEYS: TabKey[] = ["ATRASO", "VENCE_HOJE", "ANTECIPADA", "ATRASO_PARCELADO", "VENCE_HOJE_PARCELADO", "ANTECIPADA_PARCELADO"]
        const tMap: Record<TabKey, string> = { ATRASO: "", VENCE_HOJE: "", ANTECIPADA: "", ATRASO_PARCELADO: "", VENCE_HOJE_PARCELADO: "", ANTECIPADA_PARCELADO: "" }
        const tIds: Record<TabKey, string | null> = { ATRASO: null, VENCE_HOJE: null, ANTECIPADA: null, ATRASO_PARCELADO: null, VENCE_HOJE_PARCELADO: null, ANTECIPADA_PARCELADO: null }
        for (const t of saved) {
          if (t.type === "COBRANCA" && ALL_KEYS.includes(t.name as TabKey) && !tIds[t.name as TabKey]) {
            tMap[t.name as TabKey] = t.content
            tIds[t.name as TabKey] = t.id
          }
        }
        setTemplates((prev) => {
          const next = { ...prev }
          for (const k of ALL_KEYS) { if (tMap[k]) next[k] = tMap[k] }
          return next
        })
        setTemplateIds(tIds)
      }

      setTemplateMsg("Templates salvos com sucesso!")
    } catch {
      setTemplateMsg("Erro ao salvar templates")
    }
    setSavingTemplates(false)
    setTimeout(() => setTemplateMsg(""), 3000)
  }

  const handleResetAll = () => {
    setTemplates({
      ATRASO: DEFAULT_TEMPLATES.ATRASO,
      VENCE_HOJE: DEFAULT_TEMPLATES.VENCE_HOJE,
      ANTECIPADA: DEFAULT_TEMPLATES.ANTECIPADA,
      ATRASO_PARCELADO: PARCELADO_DEFAULTS.ATRASO,
      VENCE_HOJE_PARCELADO: PARCELADO_DEFAULTS.VENCE_HOJE,
      ANTECIPADA_PARCELADO: PARCELADO_DEFAULTS.ANTECIPADA,
    })
  }

  const handleResetCurrent = () => {
    const defaultContent = isParcelado ? PARCELADO_DEFAULTS[activeTab] : DEFAULT_TEMPLATES[activeTab]
    setTemplates((prev) => ({ ...prev, [activeKey]: defaultContent }))
  }

  const handleSelectPreset = (value: string) => {
    if (!value) return
    const presets = PRESET_TEMPLATES[activeTab]
    const found = presets?.find((p) => p.label === value)
    if (found) {
      setTemplates((prev) => ({ ...prev, [activeKey]: found.content }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6 pt-6 pb-10">
      {/* ─── Header ─── */}
      <div className="flex flex-col items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Configurações</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm">Gerencie seu perfil e preferências</p>
        </div>
        <button
          onClick={() => router.push("/perfil")}
          className="flex items-center gap-2 text-sm text-primary border border-primary/40 rounded-full px-4 py-2 hover:bg-primary/5 dark:bg-primary/150/10 transition"
        >
          <ExternalLink className="h-4 w-4" />
          Perfil Completo
        </button>
      </div>

      {/* ─── Message feedback ─── */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.includes("sucesso") ? "bg-primary/5 dark:bg-primary/150/10 text-primary border border-primary/30 dark:border-primary/30" : "bg-red-50 dark:bg-red-950/300/10 text-red-600 border border-red-500/20"}`}>
          {message}
        </div>
      )}

      {/* ═══════════════════════════ APARÊNCIA ═══════════════════════════ */}
      <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Aparência</h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Cor do menu lateral e botões do sistema</p>
          </div>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-13 gap-3">
          {ACCENT_PRESETS.map((preset) => {
            const active = accentColor === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setAccentColor(preset.id)}
                className="flex flex-col items-center gap-1.5 group"
                title={preset.name}
              >
                <div
                  className={`relative w-10 h-10 rounded-full transition-all duration-150 group-hover:scale-110 ${active ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-zinc-500 scale-110" : ""}`}
                  style={{ background: `linear-gradient(135deg, ${preset.gradient[0]}, ${preset.gradient[2]})` }}
                >
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white drop-shadow" />
                    </span>
                  )}
                </div>
                <span className={`text-[11px] font-medium ${active ? "text-gray-900 dark:text-zinc-100" : "text-gray-400 dark:text-zinc-500"}`}>{preset.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══════════════════════════ PERFIL ═══════════════════════════ */}
      <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Perfil</h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Informações pessoais da sua conta</p>
          </div>
        </div>

        {/* Nome Completo */}
        <div>
          <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
            Nome Completo <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full bg-gray-100 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-800 dark:text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Email */}
        <div>
          <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="mt-1 w-full bg-gray-100 dark:bg-zinc-800/40 border border-gray-300 dark:border-zinc-700/50 rounded-xl px-4 py-3 text-gray-400 dark:text-zinc-500 text-sm cursor-not-allowed"
          />
        </div>

        {/* WhatsApp */}
        <div>
          <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-primary" />
            WhatsApp <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(55) 99999-0000"
            className="mt-1 w-full bg-gray-100 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-800 dark:text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            Você receberá notificações para te auxiliar na gestão com seus clientes
          </p>
        </div>
      </div>

      {/* ═══════════════════════════ EMPRESA ═══════════════════════════ */}
      <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Empresa</h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Informações da sua empresa (opcional)</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Nome da Empresa</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Minha Empresa Ltda"
            className="mt-1 w-full bg-gray-100 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-800 dark:text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* ─── Salvar Alterações ─── */}
      <button
        onClick={handleSaveProfile}
        disabled={saving}
        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar Alterações
      </button>

      {/* ═══════════════════════════ MENSAGEM DE COBRANÇA ═══════════════════════════ */}
      <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/5 dark:bg-primary/150/10 flex items-center justify-center">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Mensagem de Cobrança</h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Edite os templates de mensagem para cada tipo de cobrança. Use as variáveis para inserir dados dinâmicos.</p>
          </div>
        </div>

        {/* Template feedback */}
        {templateMsg && (
          <div className={`p-3 rounded-lg text-sm ${templateMsg.includes("sucesso") ? "bg-primary/5 dark:bg-primary/150/10 text-primary border border-primary/30 dark:border-primary/30" : "bg-red-50 dark:bg-red-950/300/10 text-red-600 border border-red-500/20"}`}>
            {templateMsg}
          </div>
        )}

        {/* ─── Tabs: Atraso / Vence Hoje / Antecipada ─── */}
        <div className="flex gap-2">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl border transition-all ${
                activeTab === tab.key
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-white dark:bg-zinc-800/60 border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${tab.dot}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Toggle Simples / Parcelado ─── */}
        <div className="flex items-center gap-1 self-start bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setIsParcelado(false)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${!isParcelado ? "bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm" : "text-gray-400 dark:text-zinc-500"}`}
          >
            Simples
          </button>
          <button
            type="button"
            onClick={() => setIsParcelado(true)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${isParcelado ? "bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm" : "text-gray-400 dark:text-zinc-500"}`}
          >
            Parcelado
          </button>
        </div>

        {/* ─── Template pronto dropdown ─── */}
        <PresetDropdown
          presets={PRESET_TEMPLATES[activeTab] || []}
          onSelect={handleSelectPreset}
        />

        {/* ─── Textarea ─── */}
        <div className="relative">
          <textarea
            value={templates[activeKey]}
            onChange={(e) => setTemplates((prev) => ({ ...prev, [activeKey]: e.target.value }))}
            rows={14}
            className="w-full bg-gray-100 dark:bg-zinc-800/40 border border-gray-300 dark:border-zinc-700/40 rounded-xl px-4 py-4 text-gray-800 dark:text-zinc-200 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={handleResetCurrent}
            className="absolute top-3 right-3 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300 transition"
            title="Resetar este template"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* ─── Variáveis disponíveis ─── */}
        <div className="bg-gray-100 dark:bg-zinc-800/40 border border-gray-300 dark:border-zinc-700/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
            <Info className="h-3.5 w-3.5" />
            <span className="font-semibold">Variáveis disponíveis</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_VARIABLES.map((v) => (
              <button
                key={v}
                onClick={() => {
                  setTemplates((prev) => ({
                    ...prev,
                    [activeTab]: prev[activeTab] + v,
                  }))
                }}
                className="text-xs bg-gray-200 dark:bg-zinc-700/50 border border-gray-300 dark:border-zinc-700/40 text-primary font-mono px-2.5 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 dark:bg-zinc-700/50 transition cursor-pointer"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Action buttons ─── */}
        <div className="flex gap-3">
          <button
            onClick={handleResetAll}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 font-semibold text-sm py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 dark:bg-zinc-700 transition"
          >
            <RotateCcw className="h-4 w-4" />
            Resetar Todos
          </button>
          <button
            onClick={handleSaveTemplates}
            disabled={savingTemplates}
            className="flex-[2] flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold text-sm py-3 rounded-xl transition disabled:opacity-50"
          >
            {savingTemplates ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Templates
          </button>
        </div>
      </div>

      {/* ═══════════════════════════ FUNCIONÁRIOS ═══════════════════════════ */}
      <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
        {/* Icon + Title centered */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="w-20 h-20 rounded-full bg-primary/5 dark:bg-primary/150/10 border-2 border-primary/30 dark:border-primary/30 flex items-center justify-center">
            <Users className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Expanda seu Negócio com Funcionários</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Adicione colaboradores com total controle sobre o que eles podem ver e acessar!</p>
          </div>
        </div>

        {/* 2x2 Feature grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Lock, title: "Visibilidade Controlada", desc: "Você define se ele vê só os dele ou todos" },
            { icon: Eye, title: "Dashboard Bloqueado", desc: "Oculte seus lucros e totais financeiros" },
            { icon: Shield, title: "Permissões por Função", desc: "Defina exatamente o que cada um pode acessar" },
            { icon: Cog, title: "Controle Flexível", desc: 'Libere "ver todos" apenas quando necessário' },
          ].map((feat) => (
            <div key={feat.title} className="bg-gray-100 dark:bg-zinc-800/40 border border-gray-300 dark:border-zinc-700/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <feat.icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200">{feat.title}</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500">{feat.desc}</p>
            </div>
          ))}
        </div>

        {/* Info box */}
        <div className="bg-gray-100 dark:bg-zinc-800/40 border border-gray-300 dark:border-zinc-700/30 rounded-xl p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Você controla o que cada funcionário pode ver!</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              Por padrão, ele só vê os empréstimos que ele mesmo criou. Mas você pode liberar a permissão &quot;Ver Todos os Empréstimos&quot; individualmente se precisar.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

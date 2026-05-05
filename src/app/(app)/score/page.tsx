"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/avatar"
import { Dialog } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Search, Trophy, Pencil, ChevronDown, ChevronUp, Clock, AlertCircle,
  DollarSign, ThumbsUp, ThumbsDown, Sparkles, RefreshCw, Save, Star,
  CheckCircle2, ShieldAlert, BookOpen,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Installment {
  id: string
  amount: number
  paidAmount: number
  status: string
  dueDate: string
}

interface Loan {
  id: string
  amount: number
  totalAmount: number
  profit: number
  status: string
  installments: Installment[]
}

interface Client {
  id: string
  name: string
  photo: string | null
  score: number
  status: string
  loans: Loan[]
}

type SortMode = "score" | "lucro"

const SCORE_MAX = 150

export default function ScorePage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("score")
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editScore, setEditScore] = useState(100)
  const [savingScore, setSavingScore] = useState(false)

  useEffect(() => {
    fetch("/api/clients?includeInstallments=true")
      .then((res) => res.json())
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  const handleEditScore = (client: Client) => {
    setEditingClient(client)
    setEditScore(client.score)
  }

  const handleSaveScore = async () => {
    if (!editingClient) return
    setSavingScore(true)
    try {
      const res = await fetch(`/api/clients/${editingClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: editScore }),
      })
      if (res.ok) {
        setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, score: editScore } : c))
        setEditingClient(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSavingScore(false)
    }
  }

  const getScoreLabel = (score: number) => {
    if (score >= 120) return "Excelente"
    if (score >= 100) return "Bom"
    if (score >= 70) return "Regular"
    return "Crítico"
  }

  const getScoreIcon = (score: number) => {
    if (score >= 120) return "⭐"
    if (score >= 100) return "👍"
    if (score >= 70) return "🔥"
    return "⚠️"
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 120) return "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400"
    if (score >= 100) return "bg-primary/5 dark:bg-primary/10 text-green-500 dark:text-green-400"
    if (score >= 70) return "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400"
    return "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400"
  }

  const getScoreBorderColor = (score: number) => {
    if (score >= 120) return "border-yellow-500/30"
    if (score >= 100) return "border-green-500/30"
    if (score >= 70) return "border-blue-500/30"
    return "border-red-500/30"
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 120) return "bg-yellow-400"
    if (score >= 100) return "bg-primary/50"
    if (score >= 70) return "bg-blue-500"
    return "bg-red-500"
  }

  const getClientStats = (client: Client) => {
    const allInstallments = client.loans.flatMap(l => l.installments || [])
    const now = new Date()
    const emDia = allInstallments.filter(i => i.status === "PAID" || (i.status === "PENDING" && new Date(i.dueDate) >= now)).length
    const atrasados = allInstallments.filter(i => i.status === "OVERDUE" || (i.status === "PENDING" && new Date(i.dueDate) < now)).length
    const totalPrincipal = client.loans.reduce((s, l) => s + l.amount, 0)
    const completedLoans = client.loans.filter(l => l.status === "COMPLETED")
    const activeLoans = client.loans.filter(l => l.status === "ACTIVE")
    const totalQuitados = completedLoans.reduce((s, l) => s + l.totalAmount, 0)
    const totalAtivos = activeLoans.reduce((s, l) => s + l.totalAmount, 0)
    const totalProfit = client.loans.reduce((s, l) => s + l.profit, 0)
    const lucroExtra = allInstallments.reduce((s, i) => {
      const diff = i.paidAmount - i.amount
      return diff > 0 ? s + diff : s
    }, 0)
    const recoveryPoints = Math.min(10, Math.floor(lucroExtra / 50) * 2)
    return { emDia, atrasados, totalPrincipal, completedCount: completedLoans.length, activeCount: activeLoans.length, totalQuitados, totalAtivos, totalProfit, lucroExtra, recoveryPoints }
  }

  const getClientTotalProfit = (client: Client) => client.loans.reduce((s, l) => s + l.profit, 0)

  const getColorPriority = (score: number) => {
    if (score >= 100 && score < 120) return 1  // green
    if (score >= 70 && score < 100) return 2   // blue
    if (score >= 120) return 3                  // yellow
    return 4                                    // red
  }

  const filtered = clients
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortMode === "lucro") return getClientTotalProfit(b) - getClientTotalProfit(a)
      const pa = getColorPriority(a.score)
      const pb = getColorPriority(b.score)
      if (pa !== pb) return pa - pb
      return b.score - a.score
    })

  // Global stats
  const avgScore = clients.length ? Math.round(clients.reduce((s, c) => s + c.score, 0) / clients.length) : 0
  const allInstallments = clients.flatMap(c => c.loans.flatMap(l => l.installments || []))
  const now = new Date()
  const globalEmDia = allInstallments.filter(i => i.status === "PAID").length
  const globalAtrasados = allInstallments.filter(i => i.status === "OVERDUE" || (i.status === "PENDING" && new Date(i.dueDate) < now)).length
  const globalTotal = clients.reduce((s, c) => s + c.loans.reduce((ls, l) => ls + l.totalAmount, 0), 0)
  const globalProfit = clients.reduce((s, c) => s + c.loans.reduce((ls, l) => ls + l.profit, 0), 0)
  const approvalCount = clients.filter(c => c.score >= 100).length
  const approvalPct = clients.length ? Math.round((approvalCount / clients.length) * 100) : 0
  const excelentesCount = clients.filter(c => c.score >= 120).length
  const atencaoCount = clients.filter(c => c.score >= 70 && c.score < 120).length
  const criticosCount = clients.filter(c => c.score < 70).length
  const lucroPrevisto = globalProfit
  const lucroRealizado = clients.reduce((s, c) =>
    s + c.loans.filter(l => l.status === "COMPLETED").reduce((ls, l) => ls + l.profit, 0), 0)
  const lucroExtra = allInstallments.reduce((s, i) => {
    const diff = i.paidAmount - i.amount
    return diff > 0 ? s + diff : s
  }, 0)
  const lucroPct = lucroPrevisto > 0 ? Math.round((lucroRealizado / lucroPrevisto) * 100) : 0
  const totalPagamentos = globalEmDia + globalAtrasados
  const pctEmDia = totalPagamentos > 0 ? Math.round((globalEmDia / totalPagamentos) * 100) : 0
  const pctAtrasados = totalPagamentos > 0 ? Math.round((globalAtrasados / totalPagamentos) * 100) : 0

  const ScoreCircle = ({ score, size = 64 }: { score: number; size?: number }) => {
    const radius = (size - 10) / 2
    const circumference = 2 * Math.PI * radius
    const pct = Math.min(score / SCORE_MAX, 1)
    const offset = circumference * (1 - pct)
    const color = score >= 120 ? "#facc15" : score >= 100 ? "#4ade80" : score >= 70 ? "#60a5fa" : "#f87171"
    return (
      <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 absolute inset-0">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth={5} fill="none" className="dark:stroke-zinc-700" />
          <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={5} fill="none"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="relative flex flex-col items-center justify-center leading-none">
          <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">{score}</span>
          <span className="text-[9px] text-gray-400 dark:text-zinc-500">/{SCORE_MAX}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Score de Clientes
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">
            Acompanhe a pontuação de confiabilidade dos seus clientes atualizada automaticamente
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
          <Input placeholder="Buscar cliente..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Summary bar + expandable stats */}
      <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
        {/* Compact stats row */}
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-gray-500 dark:text-zinc-400">Score:</span>
            <span className="font-bold text-gray-900 dark:text-zinc-100">{avgScore}</span>
          </span>
          <span className="flex items-center gap-1.5 text-green-500 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="font-medium">{excelentesCount}</span>
          </span>
          <span className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium">{atencaoCount}</span>
          </span>
          <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span className="font-medium">{criticosCount}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
            <span className="font-semibold text-gray-900 dark:text-zinc-100">{formatCurrency(globalTotal)}</span>
          </span>
          <span className="font-semibold text-primary">+{formatCurrency(lucroExtra)}</span>
          <span className="flex items-center gap-1.5">
            <ThumbsUp className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-gray-700 dark:text-zinc-300">{approvalCount} ({approvalPct}%)</span>
          </span>
          <button
            onClick={() => setSummaryOpen(!summaryOpen)}
            className="ml-auto flex items-center gap-1 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors text-sm font-medium"
          >
            {summaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {summaryOpen ? "Menos" : "Mais"}
          </button>
        </div>

        {summaryOpen && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800 space-y-3">

            {/* Row 1: 4 score category cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Score Médio */}
              <div className="rounded-xl border border-primary/20 border-l-4 border-l-primary bg-primary/5 dark:bg-primary/10 p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium leading-tight">Score<br/>Médio</p>
                  <div className="h-9 w-9 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                    <Star className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{avgScore}</p>
                <div className="mt-2 h-1.5 rounded-full bg-primary/20 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(avgScore / SCORE_MAX * 100, 100)}%` }} />
                </div>
              </div>

              {/* Excelentes */}
              <div className="rounded-xl border border-green-500/20 border-l-4 border-l-green-500 bg-primary/5 dark:bg-primary/10 p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Excelentes</p>
                  <div className="h-9 w-9 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-green-500 dark:text-green-400">{excelentesCount}</p>
                <div className="mt-2 h-1.5 rounded-full bg-primary/10 dark:bg-primary/20 overflow-hidden">
                  <div className="h-full bg-primary/50 rounded-full" style={{ width: `${clients.length ? (excelentesCount / clients.length) * 100 : 0}%` }} />
                </div>
              </div>

              {/* Atenção */}
              <div className="rounded-xl border border-yellow-500/20 border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Atenção</p>
                  <div className="h-9 w-9 rounded-full bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{atencaoCount}</p>
                <div className="mt-2 h-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-yellow-500 rounded-full" style={{ width: `${clients.length ? (atencaoCount / clients.length) * 100 : 0}%` }} />
                </div>
              </div>

              {/* Críticos */}
              <div className="rounded-xl border border-red-500/20 border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20 p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Críticos</p>
                  <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{criticosCount}</p>
                <div className="mt-2 h-1.5 rounded-full bg-red-100 dark:bg-red-900/40 overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${clients.length ? (criticosCount / clients.length) * 100 : 0}%` }} />
                </div>
              </div>
            </div>

            {/* Row 2: Lucro Previsto / Realizado / Extra */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Lucro Previsto */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-800/30 bg-gradient-to-br from-blue-50 to-blue-100/60 dark:from-blue-950/30 dark:to-blue-900/20 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Lucro Previsto Total</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1 truncate">{formatCurrency(lucroPrevisto)}</p>
                  <p className="text-xs text-blue-500/70 dark:text-blue-400/60 mt-1">Soma de juros de todos os contratos</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-200/60 dark:bg-blue-800/40 flex items-center justify-center shrink-0">
                  <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              {/* Lucro Realizado */}
              <div className="rounded-xl border border-green-200 dark:border-green-800/30 bg-gradient-to-br from-green-50 to-green-100/60 dark:from-green-950/30 dark:to-green-900/20 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-green-500 dark:text-green-400 font-medium">Lucro Realizado Total</p>
                  <p className="text-2xl font-bold text-green-500 dark:text-green-400 mt-1 truncate">{formatCurrency(lucroRealizado)}</p>
                  <p className="text-xs text-green-500/70 dark:text-green-400/60 mt-1">{lucroPct}% do previsto</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-200/60 dark:bg-green-800/40 flex items-center justify-center shrink-0">
                  <DollarSign className="h-6 w-6 text-green-500 dark:text-green-400" />
                </div>
              </div>

              {/* Lucro Extra */}
              <div className="rounded-xl border border-purple-200 dark:border-purple-800/30 bg-gradient-to-br from-purple-50 to-purple-100/60 dark:from-purple-950/30 dark:to-purple-900/20 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Lucro Extra</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1 truncate">+{formatCurrency(lucroExtra)}</p>
                  <p className="text-xs text-purple-500/70 dark:text-purple-400/60 mt-1">Multas e penalidades</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-200/60 dark:bg-purple-800/40 flex items-center justify-center shrink-0">
                  <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>

            {/* Row 3: Pagamentos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 dark:bg-primary/15 flex items-center justify-center shrink-0">
                  <ThumbsUp className="h-6 w-6 text-green-500 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Pagamentos em Dia</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{globalEmDia}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-400 dark:text-zinc-500">do total</p>
                  <p className="text-lg font-bold text-green-500 dark:text-green-400">{pctEmDia}%</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <ThumbsDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Pagamentos Atrasados</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{globalAtrasados}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-400 dark:text-zinc-500">do total</p>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{pctAtrasados}%</p>
                </div>
              </div>
            </div>

            {/* Row 4: Como o Score é Calculado */}
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/60 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                Como o Score é Calculado
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/50 shrink-0" />
                  <span className="text-gray-700 dark:text-zinc-300"><strong>120-150:</strong> Excelente ⭐</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-gray-700 dark:text-zinc-300"><strong>100-119:</strong> Bom 👍</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 shrink-0" />
                  <span className="text-gray-700 dark:text-zinc-300"><strong>70-99:</strong> Regular 🔥</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-gray-700 dark:text-zinc-300"><strong>0-69:</strong> Crítico 🚨</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 leading-relaxed">
                +3 pontos por pagamento em dia &bull; -20 pontos por atraso &bull; -30 pontos por atraso crítico (+30d) &bull; +15 bônus fidelidade
              </p>
              <p className="text-xs text-primary">
                🔄 <strong>Bônus Recuperação:</strong> +2 pontos a cada R$50 pagos em multas/juros extras (máx. +10 pts)
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 italic">
                ✏️ Você pode editar o score manualmente clicando no ícone de lápis
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Ranking Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
          Ranking de Clientes ({filtered.length})
        </h2>
        <div className="flex bg-gray-50 dark:bg-zinc-800 rounded-lg p-1 border border-gray-200 dark:border-zinc-700">
          <button
            onClick={() => setSortMode("score")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sortMode === "score" ? "bg-primary text-white" : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200"
            }`}
          >
            Por Score
          </button>
          <button
            onClick={() => setSortMode("lucro")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sortMode === "lucro" ? "bg-primary text-white" : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200"
            }`}
          >
            Por Lucro
          </button>
        </div>
      </div>

      {/* Client Cards — white background */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-zinc-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-zinc-400">Nenhum cliente encontrado</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {filtered.map((client, index) => {
            const stats = getClientStats(client)
            return (
              <div
                key={client.id}
                className={`rounded-xl overflow-hidden border ${getScoreBorderColor(client.score)} bg-white dark:bg-zinc-900`}
              >
                <div className={`h-1 w-full ${getScoreBarColor(client.score)}`} />
                <div className="p-5">
                {/* Top row: rank + avatar + name + score circle */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400 dark:text-zinc-500 font-medium">#{index + 1}</span>
                      <Avatar name={client.name} src={client.photo} size="sm" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-zinc-100">{client.name}</h3>
                        <button onClick={() => handleEditScore(client)}>
                          <Pencil className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors" />
                        </button>
                      </div>
                      <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getScoreBadgeColor(client.score)}`}>
                        {getScoreIcon(client.score)} {getScoreLabel(client.score)}
                      </span>
                    </div>
                  </div>
                  <ScoreCircle score={client.score} />
                </div>

                <div className="my-3 border-t border-gray-100 dark:border-zinc-800" />

                {/* Loan info or empty state */}
                {client.loans.length === 0 || !client.loans.some(l => l.status === "ACTIVE") ? (
                  <p className="text-center text-xs text-gray-400 dark:text-zinc-500 py-2">Sem empréstimos ativos</p>
                ) : (
                  <>
                    {client.loans.filter(l => l.status === "ACTIVE").slice(0, 1).map(loan => {
                      const remaining = loan.totalAmount - loan.installments.filter(i => i.status === "PAID").reduce((s, i) => s + i.paidAmount, 0)
                      const totalPaid = loan.installments.filter(i => i.status === "PAID").reduce((s, i) => s + i.paidAmount, 0)
                      return (
                        <div key={loan.id}>
                          <p className="text-[10px] uppercase font-semibold text-gray-400 dark:text-zinc-500 tracking-wide">A receber</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-zinc-100 mt-0.5">{formatCurrency(Math.max(0, remaining))}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-zinc-500 flex-wrap">
                            <span>Emprestado {formatCurrency(loan.amount)}</span>
                            <span className="text-gray-300 dark:text-zinc-700">•</span>
                            <span>Recebido {formatCurrency(totalPaid)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Extra profit tag */}
                {stats.lucroExtra > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      <Sparkles className="h-3 w-3" />
                      Lucro Extra: {formatCurrency(stats.lucroExtra)}
                    </span>
                    {stats.recoveryPoints > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/20 text-blue-600 border border-blue-500/20">
                        <RefreshCw className="h-3 w-3" />
                        +{stats.recoveryPoints} pts
                      </span>
                    )}
                  </div>
                )}

                {/* Installment stats */}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-green-500" />
                    {stats.emDia} em dia
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    {stats.atrasados} atrasados
                  </span>
                </div>
                </div>{/* end p-5 */}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit score dialog */}
      <Dialog open={!!editingClient} onClose={() => setEditingClient(null)} title={`Editar Score — ${editingClient?.name || ""}`}>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Label>Score (0 – {SCORE_MAX})</Label>
              <Input
                type="number"
                min={0}
                max={SCORE_MAX}
                value={editScore}
                onChange={(e) => setEditScore(Math.max(0, Math.min(SCORE_MAX, parseInt(e.target.value) || 0)))}
              />
            </div>
            <ScoreCircle score={editScore} size={72} />
          </div>
          <div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getScoreBadgeColor(editScore)}`}>
              {getScoreIcon(editScore)} {editScore} — {getScoreLabel(editScore)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={SCORE_MAX}
            value={editScore}
            onChange={(e) => setEditScore(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-gray-400 dark:text-zinc-500">
            <span>0 – Crítico</span>
            <span>{Math.round(SCORE_MAX * 0.33)}</span>
            <span>{Math.round(SCORE_MAX * 0.67)}</span>
            <span>{SCORE_MAX}</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingClient(null)}>Cancelar</Button>
            <Button onClick={handleSaveScore} disabled={savingScore}>
              <Save className="h-4 w-4 mr-2" />
              {savingScore ? "Salvando..." : "Salvar Score"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

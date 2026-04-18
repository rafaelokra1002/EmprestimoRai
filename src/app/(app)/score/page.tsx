"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/avatar"
import { Dialog } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, Trophy, Pencil, ChevronDown, ChevronUp, Clock, AlertCircle, DollarSign, ThumbsUp, Sparkles, RefreshCw, Save } from "lucide-react"
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
      .then((data) => {
        setClients(Array.isArray(data) ? data : [])
      })
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
        setClients(prev =>
          prev.map(c => c.id === editingClient.id ? { ...c, score: editScore } : c)
        )
        setEditingClient(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSavingScore(false)
    }
  }

  const getScoreLabel = (score: number) => {
    if (score >= 150) return "Excelente"
    if (score >= 100) return "Bom"
    if (score >= 80) return "Regular"
    if (score >= 50) return "Ruim"
    return "Crítico"
  }

  const getScoreIcon = (score: number) => {
    if (score >= 150) return "⭐"
    if (score >= 100) return "🔥"
    if (score >= 80) return "👍"
    if (score >= 50) return "😐"
    return "⚠️"
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 150) return "bg-yellow-50 dark:bg-yellow-950/300/20 text-yellow-600"
    if (score >= 100) return "bg-green-500/20 text-green-400"
    if (score >= 80) return "bg-blue-50 dark:bg-blue-950/300/20 text-blue-600"
    if (score >= 50) return "bg-orange-50 dark:bg-orange-950/300/20 text-orange-600"
    return "bg-red-50 dark:bg-red-950/300/20 text-red-600"
  }

  const getScoreBorderColor = (score: number) => {
    if (score >= 150) return "border-yellow-500/30"
    if (score >= 100) return "border-green-500/30"
    if (score >= 80) return "border-blue-500/30"
    if (score >= 50) return "border-orange-500/30"
    return "border-red-500/30"
  }

  // Compute client stats  
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
    
    // Lucro extra: soma de (paidAmount - amount) quando paidAmount > amount (multas/juros extras)
    const lucroExtra = allInstallments.reduce((s, i) => {
      const diff = i.paidAmount - i.amount
      return diff > 0 ? s + diff : s
    }, 0)

    // Pontos de recuperação: +2 a cada R$50 pagos em extras (máx. +10)
    const recoveryPoints = Math.min(10, Math.floor(lucroExtra / 50) * 2)
    
    return {
      emDia,
      atrasados,
      totalPrincipal,
      completedCount: completedLoans.length,
      activeCount: activeLoans.length,
      totalQuitados,
      totalAtivos,
      totalProfit,
      lucroExtra,
      recoveryPoints,
    }
  }

  const getClientTotalProfit = (client: Client) => {
    return client.loans.reduce((s, l) => s + l.profit, 0)
  }

  // Filter and sort
  const filtered = clients
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortMode === "score") return b.score - a.score
      return getClientTotalProfit(b) - getClientTotalProfit(a)
    })

  // Global summary
  const avgScore = clients.length ? Math.round(clients.reduce((s, c) => s + c.score, 0) / clients.length) : 0
  const allInstallments = clients.flatMap(c => c.loans.flatMap(l => l.installments || []))
  const now = new Date()
  const globalEmDia = allInstallments.filter(i => i.status === "PAID").length
  const globalAtrasados = allInstallments.filter(i => i.status === "OVERDUE" || (i.status === "PENDING" && new Date(i.dueDate) < now)).length
  const globalPending = allInstallments.filter(i => i.status === "PENDING" && new Date(i.dueDate) >= now).length
  const globalTotal = clients.reduce((s, c) => s + c.loans.reduce((ls, l) => ls + l.totalAmount, 0), 0)
  const globalProfit = clients.reduce((s, c) => s + c.loans.reduce((ls, l) => ls + l.profit, 0), 0)
  const approvalCount = clients.filter(c => c.score >= 100).length
  const approvalPct = clients.length ? Math.round((approvalCount / clients.length) * 100) : 0
  const excelentesCount = clients.filter(c => c.score >= 120).length
  const atencaoCount = clients.filter(c => c.score >= 70 && c.score < 120).length
  const criticosCount = clients.filter(c => c.score < 70).length
  // Lucro Previsto = soma dos juros (profit) de todos os contratos
  const lucroPrevisto = globalProfit
  // Lucro Realizado = soma dos juros apenas de empréstimos COMPLETED
  const lucroRealizado = clients.reduce((s, c) =>
    s + c.loans.filter(l => l.status === "COMPLETED").reduce((ls, l) => ls + l.profit, 0), 0)
  // Lucro Extra = soma de (paidAmount - amount) quando cliente pagou a mais (multas/penalidades)
  const lucroExtra = allInstallments.reduce((s, i) => {
    const diff = i.paidAmount - i.amount
    return diff > 0 ? s + diff : s
  }, 0)
  const lucroPct = lucroPrevisto > 0 ? Math.round((lucroRealizado / lucroPrevisto) * 100) : 0
  const totalPagamentos = globalEmDia + globalAtrasados
  const pctEmDia = totalPagamentos > 0 ? Math.round((globalEmDia / totalPagamentos) * 100) : 0
  const pctAtrasados = totalPagamentos > 0 ? Math.round((globalAtrasados / totalPagamentos) * 100) : 0

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // SVG circular progress
  const ScoreCircle = ({ score, size = 56 }: { score: number; size?: number }) => {
    const radius = (size - 8) / 2
    const circumference = 2 * Math.PI * radius
    const pct = Math.min(score / 200, 1)
    const offset = circumference * (1 - pct)
    const color = score >= 150 ? "#facc15" : score >= 100 ? "#4ade80" : score >= 80 ? "#60a5fa" : score >= 50 ? "#fb923c" : "#f87171"

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} stroke="#e5e7eb" strokeWidth={4} fill="none" />
          <circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth={4} fill="none"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">{score}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Score de Clientes
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">
            Acompanhe a pontuação de confiabilidade dos seus clientes<br />
            atualizada automaticamente
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
          <Input
            placeholder="Buscar cliente..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Summary Bar */}
      <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <span className="flex items-center gap-1.5">
            <span className="text-yellow-500">☆</span>
            <span className="text-gray-500 dark:text-zinc-400">Score:</span>
            <span className="font-bold text-gray-900 dark:text-zinc-100">{avgScore}</span>
          </span>
          <span className="flex items-center gap-1.5 text-green-400">
            <Clock className="h-3.5 w-3.5" /> {globalEmDia}
          </span>
          <span className="flex items-center gap-1.5 text-orange-600">
            <Clock className="h-3.5 w-3.5" /> {globalPending}
          </span>
          <span className="flex items-center gap-1.5 text-red-600">
            <AlertCircle className="h-3.5 w-3.5" /> {globalAtrasados}
          </span>
          <span className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-gray-500 dark:text-zinc-400" />
            <span className="text-gray-900 dark:text-zinc-100">{formatCurrency(globalTotal)}</span>
          </span>
          <span className="text-emerald-600 font-medium">{formatCurrency(globalProfit)}</span>
          <span className="flex items-center gap-1.5">
            <ThumbsUp className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-gray-900 dark:text-zinc-100">{approvalCount} ({approvalPct}%)</span>
          </span>
          <button
            onClick={() => setSummaryOpen(!summaryOpen)}
            className="ml-auto flex items-center gap-1 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200 transition-colors"
          >
            {summaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {summaryOpen ? "Menos" : "Mais"}
          </button>
        </div>
        {summaryOpen && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800 space-y-4">
            {/* Row 1: Score Médio, Excelentes, Atenção, Críticos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-green-500/20 bg-gray-50 dark:bg-zinc-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Score<br/>Médio</span>
                  <span className="text-yellow-500 text-lg">☆</span>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{avgScore}</p>
              </div>
              <div className="rounded-xl border border-green-500/20 bg-gray-50 dark:bg-zinc-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Excelentes</span>
                  <span className="text-green-400">✓</span>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-green-400">{excelentesCount}</p>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${clients.length ? (excelentesCount / clients.length) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-yellow-500/20 bg-gray-50 dark:bg-zinc-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Atenção</span>
                  <span className="text-yellow-600">⏱</span>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-yellow-600">{atencaoCount}</p>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-yellow-500 rounded-full" style={{ width: `${clients.length ? (atencaoCount / clients.length) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-gray-50 dark:bg-zinc-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Críticos</span>
                  <span className="text-red-600">⚠</span>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-red-600">{criticosCount}</p>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-red-50 dark:bg-red-950/300 rounded-full" style={{ width: `${clients.length ? (criticosCount / clients.length) * 100 : 0}%` }} />
                </div>
              </div>
            </div>

            {/* Row 2: Lucro Previsto, Lucro Realizado, Lucro Extra */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-green-500/20 bg-gray-50 dark:bg-zinc-800 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Lucro Previsto Total</span>
                  <span className="text-green-400">💰</span>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-green-400">{formatCurrency(lucroPrevisto)}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Soma de juros de todos os contratos</p>
              </div>
              <div className="rounded-xl border border-yellow-500/20 bg-gray-50 dark:bg-zinc-800 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Lucro Realizado Total</span>
                  <span className="text-yellow-600">$</span>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-red-600">{formatCurrency(lucroRealizado)}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{lucroPct}% do previsto</p>
              </div>
              <div className="rounded-xl border border-purple-500/20 bg-gray-50 dark:bg-zinc-800 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Lucro Extra</span>
                  <span className="text-purple-600">✨</span>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600">{formatCurrency(lucroExtra)}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Multas e penalidades</p>
              </div>
            </div>

            {/* Row 3: Pagamentos em Dia / Atrasados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-blue-500/20 bg-gray-50 dark:bg-zinc-800 p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-950/300/10 flex items-center justify-center">
                  <ThumbsUp className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Pagamentos em Dia</p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{globalEmDia}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-400 dark:text-zinc-500">do total</p>
                  <p className="text-lg font-bold text-blue-600">{pctEmDia}%</p>
                </div>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-gray-50 dark:bg-zinc-800 p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-950/300/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Pagamentos Atrasados</p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">{globalAtrasados}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-400 dark:text-zinc-500">do total</p>
                  <p className="text-lg font-bold text-red-600">{pctAtrasados}%</p>
                </div>
              </div>
            </div>

            {/* Row 4: Como o Score é Calculado */}
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 flex items-center gap-2">
                ⚠️ Como o Score é Calculado
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-gray-700 dark:text-zinc-300"><strong>120-150:</strong> Excelente ⭐</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-50 dark:bg-blue-950/300" />
                  <span className="text-gray-700 dark:text-zinc-300"><strong>100-119:</strong> Bom 🔥</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-50 dark:bg-orange-950/300" />
                  <span className="text-gray-700 dark:text-zinc-300"><strong>70-99:</strong> Regular 👍</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-50 dark:bg-red-950/300" />
                  <span className="text-gray-700 dark:text-zinc-300"><strong>0-69:</strong> Crítico 🚨</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 leading-relaxed">
                +3 pontos por pagamento em dia &bull; -20 pontos por atraso &bull; -30 pontos por atraso crítico (+30d) &bull; +15 bônus fidelidade
              </p>
              <p className="text-xs text-emerald-600">
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
        <div className="flex bg-gray-50 dark:bg-zinc-800 rounded-lg p-1 border border-gray-200 dark:border-zinc-800">
          <button
            onClick={() => setSortMode("score")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sortMode === "score" ? "bg-emerald-600 text-white" : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200"
            }`}
          >
            Por Score
          </button>
          <button
            onClick={() => setSortMode("lucro")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sortMode === "lucro" ? "bg-emerald-600 text-white" : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 dark:text-zinc-200"
            }`}
          >
            Por Lucro
          </button>
        </div>
      </div>

      {/* Client Cards Grid */}
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
                className={`rounded-xl border ${getScoreBorderColor(client.score)} bg-gray-50 dark:bg-zinc-800/60 p-5 relative`}
              >
                {/* Top section */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {/* Rank + Avatar */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400 dark:text-zinc-500 font-medium">#{index + 1}</span>
                      <Avatar name={client.name} src={client.photo} size="sm" />
                    </div>
                    {/* Name + Score badge */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-zinc-100">{client.name}</h3>
                        <Pencil className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 cursor-pointer hover:text-gray-700 dark:text-zinc-300" onClick={() => handleEditScore(client)} />
                      </div>
                      <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getScoreBadgeColor(client.score)}`}>
                        {getScoreIcon(client.score)} {client.score} - {getScoreLabel(client.score)}
                      </span>
                    </div>
                  </div>

                  {/* Score circle */}
                  <ScoreCircle score={client.score} />
                </div>

                {/* Em dia / Atrasados */}
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-green-400" />
                    {stats.emDia} em dia
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                    {stats.atrasados} atrasados
                  </span>
                </div>

                {/* Loan summary pills */}
                {client.loans.length > 0 && (
                  <>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-zinc-800/80 border border-gray-300 dark:border-zinc-700/50 text-center min-w-[100px]">
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase">Principal</p>
                        <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-zinc-100">{formatCurrency(stats.totalPrincipal)}</p>
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-zinc-800/80 border border-gray-300 dark:border-zinc-700/50 text-center min-w-[100px]">
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase">L. Quitados ({stats.completedCount})</p>
                        <p className="text-sm font-bold tabular-nums text-green-400">{formatCurrency(stats.totalQuitados)}</p>
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-zinc-800/80 border border-gray-300 dark:border-zinc-700/50 text-center min-w-[100px]">
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase">L. Ativos ({stats.activeCount})</p>
                        <p className="text-sm font-bold tabular-nums text-blue-600">{formatCurrency(stats.totalAtivos)}</p>
                      </div>
                    </div>

                    {/* Extra profit + recovery */}
                    {(stats.lucroExtra > 0 || stats.totalProfit > 0) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {stats.lucroExtra > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/300/10 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                            <Sparkles className="h-3 w-3" />
                            Lucro Extra: {formatCurrency(stats.lucroExtra)}
                          </span>
                        )}
                        {stats.recoveryPoints > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/300/10 text-blue-600 border border-blue-500/20">
                            <RefreshCw className="h-3 w-3" />
                            +{stats.recoveryPoints} pts recuperação
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog para editar score */}
      <Dialog open={!!editingClient} onClose={() => setEditingClient(null)} title={`Editar Score - ${editingClient?.name || ""}`}>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Label>Score (0 - 200)</Label>
              <Input
                type="number"
                min={0}
                max={200}
                value={editScore}
                onChange={(e) => setEditScore(Math.max(0, Math.min(200, parseInt(e.target.value) || 0)))}
              />
            </div>
            <ScoreCircle score={editScore} size={72} />
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getScoreBadgeColor(editScore)}`}>
              {getScoreIcon(editScore)} {editScore} - {getScoreLabel(editScore)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            value={editScore}
            onChange={(e) => setEditScore(parseInt(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-gray-400 dark:text-zinc-500">
            <span>0 - Crítico</span>
            <span>50</span>
            <span>100</span>
            <span>150</span>
            <span>200</span>
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

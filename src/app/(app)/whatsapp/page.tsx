"use client"

import { useEffect, useState } from "react"
import { MessageCircle, Wifi, RefreshCw, Unlink, CheckCircle2, WifiOff } from "lucide-react"

export default function WhatsAppPage() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reconnecting, setReconnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [notifyClients, setNotifyClients] = useState(true)

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/status")
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus({ connected: false })
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleRecriar = async () => {
    setReconnecting(true)
    try {
      await fetch("/api/whatsapp/disconnect", { method: "POST" })
      await new Promise(r => setTimeout(r, 1000))
      await fetch("/api/whatsapp/connect", { method: "POST" })
      await fetchStatus()
    } catch {}
    setReconnecting(false)
  }

  const handleDesconectar = async () => {
    if (!confirm("Deseja desconectar o WhatsApp?")) return
    setDisconnecting(true)
    try {
      await fetch("/api/whatsapp/disconnect", { method: "POST" })
      await fetchStatus()
    } catch {}
    setDisconnecting(false)
  }

  const connected = status?.connected === true
  const phone = status?.phone || status?.number || ""
  const connectedDays = status?.connectedSince
    ? Math.floor((Date.now() - new Date(status.connectedSince).getTime()) / 86400000)
    : 0

  return (
    <div className="max-w-2xl pt-6 pb-12">
      <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-zinc-100">WhatsApp para Clientes</h1>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Envie mensagens diretamente aos seus clientes pelo seu WhatsApp</p>
            </div>
          </div>
          {!loading && (
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
              connected
                ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400"
            }`}>
              {connected ? <><span>✓</span> Conectado</> : <><WifiOff className="h-3 w-3" /> Desconectado</>}
            </span>
          )}
        </div>

        {/* ── Status box ── */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 p-4 text-sm text-gray-400 dark:text-zinc-500">
              Verificando conexão...
            </div>
          ) : connected ? (
            <div className="rounded-xl border border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-green-950/20 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-700 dark:text-green-400">WhatsApp Conectado</p>
                  {phone && <p className="text-xs text-green-600 dark:text-green-500">Número: {phone}</p>}
                </div>
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 pl-12">
                Conectado há {connectedDays} {connectedDays === 1 ? "dia" : "dias"}
              </p>
              <div className="rounded-lg border border-green-200 dark:border-green-800/50 px-3 py-2">
                <span className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                  <Wifi className="h-3.5 w-3.5 shrink-0" />
                  Conexão persistente ativa — permanece conectado mesmo com navegador fechado
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                  <WifiOff className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">WhatsApp Desconectado</p>
                  <p className="text-xs text-red-500 dark:text-red-500">Use "Recriar Instância" para conectar.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Enviar para clientes ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Enviar para clientes</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Permite enviar cobranças e comprovantes</p>
          </div>
          <button
            onClick={() => setNotifyClients(v => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${notifyClients ? "bg-green-500" : "bg-gray-200 dark:bg-zinc-700"}`}
          >
            <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${notifyClients ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* ── Buttons ── */}
        <div className="grid grid-cols-2 gap-3 px-6 pb-4">
          <button
            onClick={handleRecriar}
            disabled={reconnecting}
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-400 dark:border-amber-600 px-4 py-3 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${reconnecting ? "animate-spin" : ""}`} />
            {reconnecting ? "Reconectando..." : "Recriar Instância"}
          </button>
          <button
            onClick={handleDesconectar}
            disabled={disconnecting || !connected}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-300 dark:border-red-700 px-4 py-3 text-sm font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-40"
          >
            <Unlink className="h-4 w-4" />
            {disconnecting ? "Desconectando..." : "Desconectar"}
          </button>
        </div>

        <p className="px-6 pb-5 text-center text-xs text-gray-400 dark:text-zinc-500">
          Se sua conexão estiver instável ou desconectando, use "Recriar Instância" para gerar uma nova conexão.
        </p>
      </div>
    </div>
  )
}

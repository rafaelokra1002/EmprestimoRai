"use client"

import { useState } from "react"
import { Wrench, MessageSquareText, AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { showToast } from "@/lib/toast"

export default function TemplatesPage() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [resetting, setResetting] = useState(false)

  const handleReset = async () => {
    if (confirmText !== "RESETAR") return
    setResetting(true)
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESETAR" }),
      })
      if (res.ok) {
        showToast("Sistema resetado! Todos os dados foram apagados.")
        setConfirmOpen(false)
        setConfirmText("")
        setTimeout(() => window.location.reload(), 1200)
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data?.error || "Erro ao resetar o sistema", "error")
      }
    } catch {
      showToast("Erro de conexão ao resetar", "error")
    }
    setResetting(false)
  }

  return (
    <div className="space-y-6 pt-6 pb-12">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageSquareText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">Templates</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Mensagens do sistema</p>
        </div>
      </div>

      {/* Editor em manutenção */}
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-amber-300 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 px-6 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
          <Wrench className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-amber-700 dark:text-amber-400">Editor de mensagens em manutenção</h2>
          <p className="mt-1 max-w-md text-sm text-gray-600 dark:text-zinc-400">
            Estamos fazendo ajustes nesta área. Em breve você poderá editar as mensagens do sistema por aqui.
          </p>
        </div>
      </div>

      {/* ───────────── Zona de perigo: Resetar Sistema ───────────── */}
      <div className="rounded-2xl border border-red-300 dark:border-red-800/60 bg-red-50/60 dark:bg-red-950/20 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-700 dark:text-red-400">Resetar Sistema</h2>
            <p className="text-xs text-red-600/80 dark:text-red-400/80">Apaga todos os clientes, empréstimos, vendas, veículos e despesas. Esta ação não pode ser desfeita.</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-zinc-400">
          Use esta opção para começar do zero. Seu <span className="font-semibold">perfil</span>, <span className="font-semibold">funcionários</span> e <span className="font-semibold">templates de mensagem</span> serão mantidos.
        </p>

        <button
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-red-300 dark:border-red-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <Trash2 className="h-4 w-4" /> Resetar todos os dados
        </button>
      </div>

      {/* Modal de confirmação */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4">
          <button type="button" aria-label="Fechar" className="absolute inset-0 cursor-default" onClick={() => { setConfirmOpen(false); setConfirmText("") }} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-red-300 dark:border-red-800/60 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Tem certeza?</h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              Você vai apagar <span className="font-semibold text-gray-800 dark:text-zinc-200">todos os clientes, empréstimos, vendas, veículos e despesas</span> permanentemente.
            </p>
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              Para confirmar, digite <span className="font-mono font-bold text-red-600 dark:text-red-400">RESETAR</span>:
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite RESETAR"
              autoFocus
              className="w-full rounded-xl border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2.5 text-sm text-gray-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-red-400/40"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setConfirmOpen(false); setConfirmText("") }}
                className="flex-1 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-zinc-300 transition hover:bg-gray-50 dark:hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                disabled={confirmText !== "RESETAR" || resetting}
                className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Apagar tudo definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

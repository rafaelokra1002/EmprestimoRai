"use client"

import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DollarSign } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

type Mode = "full" | "partial" | "total" | null
type PayMethod = "Dinheiro" | "Pix" | "Cartão"

interface InterestRenegotiateBodyProps {
  loan: any
  mode: Mode
  setMode: (m: Mode) => void
  amount: number
  setAmount: (v: number) => void
  notes: string
  setNotes: (v: string) => void
  date: string
  setDate: (v: string) => void
  newDueDate: string
  setNewDueDate: (v: string) => void
  installmentId: string
  setInstallmentId: (v: string) => void
  payMethod: PayMethod
  setPayMethod: (m: PayMethod) => void
  paying: boolean
  onSubmit: () => void
  onCancel: () => void
  getNextDueInst: (loan: any) => any
  interestPerInst: (loan: any) => number
  getRemaining: (loan: any) => number
  getCurrentOverdueCharge: (loan: any) => number
  getCurrentOverdueDays: (loan: any) => number
}

export function InterestRenegotiateBody(props: InterestRenegotiateBodyProps) {
  const {
    loan: currentLoan, mode, setMode, amount, setAmount, notes, setNotes,
    date, setDate, newDueDate, setNewDueDate, installmentId, setInstallmentId,
    payMethod, setPayMethod, paying, onSubmit, onCancel,
    getNextDueInst, interestPerInst, getRemaining, getCurrentOverdueCharge, getCurrentOverdueDays,
  } = props

  const nextInstallment = getNextDueInst(currentLoan)
  const currentInterest = interestPerInst(currentLoan)
  const currentRemaining = getRemaining(currentLoan)
  const partialPayments = currentLoan.payments.filter((payment: any) => {
    const n = (payment.notes || "").toLowerCase()
    return n.includes("parcial de juros")
  })
  const totalPartialPaid = partialPayments.reduce((sum: number, payment: any) => sum + payment.amount, 0)
  const cyclePaid = currentInterest > 0 ? totalPartialPaid % currentInterest : 0
  const pendingPartialInterest = currentInterest > 0 ? Math.max(currentInterest - cyclePaid, 0) : 0
  const amountAfterInterestPayment = Math.max(currentRemaining - amount, currentLoan.totalAmount)

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gray-50 p-4 dark:bg-[#222A26]/50">
        <div className="flex items-center gap-3">
          <Avatar name={currentLoan.client.name} src={currentLoan.client.photo} size="lg" />
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-zinc-100">{currentLoan.client.name}</p>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Saldo devedor: {formatCurrency(getRemaining(currentLoan))}</p>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Valor por parcela: {formatCurrency(nextInstallment?.amount || currentLoan.installmentValue)}</p>
          </div>
        </div>
      </div>

      {!mode && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setMode("full")
              const overdueCharge = getCurrentOverdueCharge(currentLoan)
              if (overdueCharge > 0) {
                const overdueDays = getCurrentOverdueDays(currentLoan)
                const cyclesMissed = Math.max(0, Math.floor(overdueDays / 30))
                setAmount(currentInterest * (cyclesMissed + 1) + overdueCharge)
              } else {
                setAmount(currentInterest)
              }
            }}
            className="w-full rounded-2xl border p-4 text-left transition-colors border-primary/40 bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-primary">Cliente pagou só os juros</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400">Registrar pagamento apenas dos juros da parcela</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("partial")
              setAmount(pendingPartialInterest || currentInterest)
            }}
            className="w-full rounded-2xl border p-4 text-left transition-colors border-cyan-500/50 bg-cyan-50/40 hover:bg-cyan-50 dark:border-cyan-900/50 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-500 dark:bg-cyan-500/20">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-cyan-600 dark:text-cyan-400">Pagamento parcial de juros</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400">Registrar pagamento de parte dos juros de uma parcela</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {mode === "full" && (
        <>
        <div className="space-y-3 rounded-xl border-2 border-[#22C35D] bg-white p-4 dark:bg-[#0F172A]">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-base font-semibold text-primary">
              <DollarSign className="h-5 w-5" /> Cliente pagou só os juros
            </p>
            <button type="button" onClick={() => setMode(null)} className="text-sm font-medium text-[#9DAFA6] transition-colors hover:text-primary">
              ← Voltar
            </button>
          </div>

          <div className="rounded-xl border border-[#22C35D] bg-[#22C35D]/20 p-3 text-xs space-y-1">
            {(() => {
              const overdueDaysSJ = getCurrentOverdueDays(currentLoan)
              const overdueChargeSJ = getCurrentOverdueCharge(currentLoan)
              const cyclesSJ = overdueDaysSJ > 0 ? Math.max(0, Math.floor(overdueDaysSJ / 30)) : 0
              return (
                <>
                  <p className="font-semibold text-gray-900 dark:text-zinc-100">
                    Resumo: Cliente paga <span className="text-primary">{formatCurrency(amount || currentInterest)}</span> de juros agora.
                  </p>
                  {overdueDaysSJ > 0 && (
                    <div className="pt-1 space-y-0.5 border-t border-primary/10">
                      <div className="flex justify-between text-gray-600 dark:text-zinc-300">
                        <span>Juros ({cyclesSJ + 1} ciclo{cyclesSJ + 1 !== 1 ? "s" : ""}):</span>
                        <span className="font-semibold text-primary">{formatCurrency(currentInterest * (cyclesSJ + 1))}</span>
                      </div>
                      {overdueChargeSJ > 0 && (
                        <div className="flex justify-between text-gray-600 dark:text-zinc-300">
                          <span>Multa ({overdueDaysSJ}d):</span>
                          <span className="font-semibold text-red-500">+{formatCurrency(overdueChargeSJ)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="mt-0.5 text-gray-600 dark:text-zinc-300">No próximo vencimento, o valor a cobrar será: <span className="font-semibold text-primary">{formatCurrency(amountAfterInterestPayment)}</span></p>
                </>
              )
            })()}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <Label>Valor Pago (Juros) (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 h-10 rounded-[10px] border-[#22C35D] dark:border-[#22C35D] dark:bg-[#1E293B]"
              />
              <p className="mt-1.5 text-[11px] leading-tight text-gray-500 dark:text-zinc-400">Valor calculado automaticamente, editavel</p>
            </div>
            <div>
              <Label>Valor Total que Falta (R$)</Label>
              <Input type="text" readOnly value={formatCurrency(amountAfterInterestPayment)} className="mt-1 h-10 rounded-[10px] border-[#22C35D] dark:border-[#22C35D] bg-gray-50 dark:bg-[#1E293B]" />
              <p className="mt-1.5 text-[11px] leading-tight text-gray-500 dark:text-zinc-400">So diminui se pagar mais que o juros</p>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <Label>Data do Pagamento *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-10 rounded-[10px] border-[#22C35D] dark:border-[#22C35D] cal-green dark:bg-[#1E293B]" />
              <p className="mt-1.5 text-[11px] leading-tight text-gray-500 dark:text-zinc-400">Quando o cliente pagou os juros</p>
            </div>
            <div>
              <Label>Nova Data de Vencimento *</Label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="mt-1 h-10 rounded-[10px] border-[#22C35D] dark:border-[#22C35D] cal-green dark:bg-[#1E293B]" />
              <p className="mt-1.5 text-[11px] leading-tight text-gray-500 dark:text-zinc-400">Proxima data de cobranca</p>
            </div>
          </div>

          <div>
            <Label className="text-xs">Forma de Pagamento</Label>
            <div className="mt-1.5 flex gap-2">
              {(["Dinheiro", "Pix", "Cartão"] as PayMethod[]).map((method) => (
                <Button
                  key={method}
                  type="button"
                  variant={payMethod === method ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setPayMethod(method)}
                >
                  {method === "Dinheiro" ? "💵" : method === "Pix" ? "📲" : "💳"} {method}
                </Button>
              ))}
            </div>
          </div>

        </div>

        <div>
          <Label>Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 min-h-[80px] rounded-[10px] border-[#29322E] dark:bg-[#121614]"
            placeholder="Motivo da renegociação..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" className="rounded-[10px] dark:bg-[#121614] dark:border-[#29322E]" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="rounded-[10px] bg-[#22C35D] text-white hover:bg-[#22C35D]/90" onClick={onSubmit} disabled={paying}>
            {paying ? "Registrando..." : "Registrar Pagamento de Juros"}
          </Button>
        </div>
        </>
      )}

      {mode === "partial" && (
        <div className="space-y-4">
          {(() => {
            const pendingInstallments = currentLoan.installments
              .filter((installment: any) => installment.status !== "PAID")
              .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            const selectedInstallment = pendingInstallments.find((installment: any) => installment.id === installmentId) || pendingInstallments[0]
            const partialPaidNow = amount || 0
            const partialRemaining = Math.max((pendingPartialInterest || currentInterest) - partialPaidNow, 0)

            return (
              <>
              <div className="space-y-4 rounded-xl border-2 border-[#06B6D4] bg-white p-4 dark:bg-[#0D252C]">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-base font-semibold text-[#06B6D4]">
                    <DollarSign className="h-5 w-5" /> Pagamento parcial de juros
                  </p>
                  <button type="button" onClick={() => setMode(null)} className="text-sm font-medium text-[#9DAFA6] transition-colors hover:text-[#06B6D4]">
                    ← Voltar
                  </button>
                </div>

                {pendingInstallments.length <= 1 ? (
                  <div className="rounded-xl border border-[#06B6D4]/30 bg-[#06B6D4]/10 p-3">
                    <p className="text-xs font-medium text-[#67E8F9]">Parcela única</p>
                    <p className="text-[15px] font-semibold text-gray-900 dark:text-[#FAFAFA]">
                      {selectedInstallment ? `${formatDate(selectedInstallment.dueDate)} · Juros: ${formatCurrency(currentInterest)}` : ""}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs text-[#67E8F9] dark:text-[#67E8F9]">Parcela referente:</Label>
                    <select
                      value={selectedInstallment?.id || ""}
                      onChange={(e) => setInstallmentId(e.target.value)}
                      className="mt-2 flex h-10 w-full rounded-[10px] border border-[#06B6D4] bg-white px-3 text-sm text-gray-900 dark:border-[#06B6D4] dark:bg-[#083344] dark:text-zinc-100"
                    >
                      {pendingInstallments.map((installment: any) => (
                        <option key={installment.id} value={installment.id}>
                          {`Parcela ${installment.number}/${currentLoan.installmentCount} - ${formatDate(installment.dueDate)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-[#5DD3E4] dark:text-[#5DD3E4]">Valor pago agora (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={amount || ""}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="mt-2 h-10 rounded-[10px] border-[#06B6D4] dark:border-[#06B6D4] dark:bg-[#083344]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#5DD3E4] dark:text-[#5DD3E4]">Data do pagamento *</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-2 h-10 rounded-[10px] border-[#06B6D4] dark:border-[#06B6D4] cal-green dark:bg-[#083344]" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-[#5DD3E4] dark:text-[#5DD3E4]">Forma de Pagamento</Label>
                  <div className="mt-2 flex gap-2">
                    {(["Dinheiro", "Pix", "Cartão"] as PayMethod[]).map((method) => (
                      <Button
                        key={method}
                        type="button"
                        variant={payMethod === method ? "default" : "outline"}
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setPayMethod(method)}
                      >
                        {method === "Dinheiro" ? "💵" : method === "Pix" ? "📲" : "💳"} {method}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[#06B6D4] bg-[#06B6D4]/20 p-4">
                  <div className="flex items-center justify-between gap-3 py-0.5 text-[15px]">
                    <span className="text-[#5DD3E4]">Juros total da parcela:</span>
                    <span className="font-bold text-gray-900 dark:text-[#FAFAFA]">{formatCurrency(currentInterest)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-0.5 text-[15px]">
                    <span className="text-[#5DD3E4]">Valor pago agora:</span>
                    <span className="font-bold text-[#22C35D]">- {formatCurrency(partialPaidNow)}</span>
                  </div>
                  <hr className="my-2.5 border-t border-[#06B6D4]/40" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base text-[#06B6D4]">Juros pendente final:</span>
                    <span className="text-lg font-bold text-[#EAB308]">{formatCurrency(partialRemaining)}</span>
                  </div>
                </div>

                <p className="text-xs leading-4 text-[#67E8F9]/70">O saldo devedor e datas de vencimento não serão alterados. Apenas será registrado o pagamento parcial dos juros.</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-800 dark:text-zinc-100">Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-2 min-h-[80px] rounded-[10px] border-[#29322E] dark:bg-[#121614]"
                  placeholder="Motivo da renegociação..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" className="h-9 rounded-[10px] dark:bg-[#121614] dark:border-[#29322E]" onClick={() => setMode(null)}>
                  Voltar
                </Button>
                <Button className="rounded-[10px] bg-[#22C35D] text-white hover:bg-[#22C35D]/90" onClick={onSubmit} disabled={paying}>
                  {paying ? "Registrando..." : "Registrar Pagamento Parcial"}
                </Button>
              </div>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

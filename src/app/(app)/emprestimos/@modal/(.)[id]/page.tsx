"use client"

import { useParams, useRouter } from "next/navigation"
import { PaymentHistoryContent } from "@/app/(app)/emprestimos/_components/payment-history-content"

const loanIdPattern = /^c[a-z0-9]{24,}$/i

export default function EmprestimoDetalhesModalPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const routeLoanId = params?.id

  if (!routeLoanId || !loanIdPattern.test(routeLoanId)) {
    return null
  }

  const handleClose = () => {
    if (window.history.length > 1) {
      router.back()
      return
    }

    router.replace("/emprestimos")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-2 sm:p-4">
      <button type="button" aria-label="Fechar detalhes" className="absolute inset-0 cursor-default" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-2xl">
        <PaymentHistoryContent onClose={handleClose} />
      </div>
    </div>
  )
}
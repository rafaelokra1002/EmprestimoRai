"use client"

import { useRouter } from "next/navigation"
import { LoanEditContent } from "@/app/(app)/emprestimos/_components/loan-edit-content"

export default function EditarEmprestimoModalPage() {
  const router = useRouter()

  const handleClose = () => {
    if (window.history.length > 1) {
      router.back()
      return
    }

    router.replace("/emprestimos")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-2 sm:p-4">
      <button type="button" aria-label="Fechar edição" className="absolute inset-0 cursor-default" onClick={handleClose} />
      <div className="relative z-10 max-h-[96vh] w-full max-w-[560px] overflow-hidden">
        <LoanEditContent presentation="modal" onClose={handleClose} />
      </div>
    </div>
  )
}
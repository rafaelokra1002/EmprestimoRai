import { Sidebar } from "@/components/sidebar"
import { HeaderActions } from "@/components/header-actions"
import { ToastHost } from "@/components/toast-host"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { UserCheck } from "lucide-react"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const email = (session.user as any).email ?? null

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:pl-72 flex flex-col min-h-screen">
        <header className="flex h-20 items-center justify-between border-b border-gray-200 dark:border-white/10 bg-white/80 dark:bg-[#191F1C] px-8 sm:px-12">
          <div className="hidden items-center gap-3 md:flex">
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Bem-vindo de volta!</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Gerencie seus empréstimos</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1 text-xs font-medium text-[#059669] dark:text-[#34d399]">
              <UserCheck className="h-3.5 w-3.5" /> Dono (acesso total)
            </span>
          </div>
          <HeaderActions email={email} />
        </header>
        <main className="flex-1">
          <div className="px-4 pt-2 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
            {children}
          </div>
        </main>
      </div>
      <ToastHost />
    </div>
  )
}

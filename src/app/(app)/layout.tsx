import { Sidebar } from "@/components/sidebar"
import { HeaderActions } from "@/components/header-actions"
import { ToastHost } from "@/components/toast-host"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const email = (session.user as any).email ?? null

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <header className="flex h-20 items-center justify-end border-b border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 px-8 sm:px-12">
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

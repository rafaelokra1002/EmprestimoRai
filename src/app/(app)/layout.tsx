import { Sidebar } from "@/components/sidebar"
import { HeaderActions } from "@/components/header-actions"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Sidebar />
      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/95 backdrop-blur">
          <div className="flex h-16 items-center justify-end px-4 sm:px-6 lg:px-8">
            <HeaderActions email={session.user.email} />
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 pt-4 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme-provider"
import {
  LayoutDashboard,
  Users,
  Star,
  Banknote,
  FileText,
  Calendar,
  Receipt,
  ShoppingCart,
  Car,
  BarChart3,
  Calculator,
  CreditCard,
  UserCog,
  Settings,
  MessageSquare,
  User,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  ChevronRight,
  CheckCircle,
  XCircle,
  MapPin,
  HardDrive,
} from "lucide-react"
import { useState } from "react"

const topItems = [
  { href: "/perfil", label: "Meu Perfil", subtitle: "Ver informações", icon: User },
  { href: "/funcionarios", label: "Funcionários", subtitle: "Cadastrar funcionários", icon: UserCog },
]

const highlightItem = {
  href: "/whatsapp",
  label: "Relatórios Diário",
  subtitle: "Relatórios via WhatsApp",
  icon: FileText,
}

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/clientes/desaparecido", label: "Desaparecido", icon: XCircle },
  { href: "/score", label: "Score de Clientes", icon: Star },
  { href: "/emprestimos", label: "Empréstimos", icon: Banknote },
  { href: "/emprestimos/tabela-price", label: "Tabela Price", icon: Calculator },
  { href: "/emprestimos/recebimentos", label: "Recebimentos", icon: MessageSquare },
  { href: "/emprestimos/relatorio", label: "Relatório Empréstimos", icon: FileText },
  { href: "/calendario", label: "Calendário de Cobranças", icon: Calendar },
  { href: "/simulador", label: "Simulador", icon: Calculator },
  { href: "/contas", label: "Caixa", icon: CreditCard },
  { href: "/despesas", label: "Despesas", icon: Receipt },
  { href: "/backup", label: "Backup", icon: HardDrive },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

const hardNavigationRoutes = new Set(["/emprestimos/tabela-price", "/emprestimos/recebimentos"])

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-green-600 border border-green-500 rounded-md p-2 text-white"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-64 bg-green-600 transition-transform duration-300 ease-in-out overflow-y-auto flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-2 p-6 border-b border-green-500">
          <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Banknote className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-white">EmprestimoRAI</span>
            <p className="text-[11px] text-emerald-200">Gestão Financeira</p>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {/* Top special items */}
          <div className="space-y-1 mb-3">
            {topItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all",
                    isActive
                      ? "bg-white/20 text-white shadow-sm"
                      : "bg-green-500/50 text-white/90 hover:bg-green-500/70"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight">{item.label}</p>
                    <p className={cn("text-[11px] leading-tight", isActive ? "text-white/70" : "text-green-200")}>{item.subtitle}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
                </Link>
              )
            })}

            {/* Highlighted item */}
            {(() => {
              const isActive = pathname === highlightItem.href || pathname?.startsWith(highlightItem.href + "/")
              return (
                <Link
                  href={highlightItem.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all border-2",
                    isActive
                      ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                      : "bg-amber-400/20 border-amber-400/50 text-white hover:bg-amber-400/30"
                  )}
                >
                  <highlightItem.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-amber-300")} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight">{highlightItem.label}</p>
                    <p className={cn("text-[11px] leading-tight", isActive ? "text-white/70" : "text-green-200")}>{highlightItem.subtitle}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
                </Link>
              )
            })()}
          </div>

          <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-green-300">Menu</p>

          {/* Regular menu items */}
          {menuItems.map((item) => {
            const isClientesRoot = item.href === "/clientes"
            const isActive = isClientesRoot
              ? pathname === "/clientes"
              : pathname === item.href || pathname?.startsWith(item.href + "/")
            const className = cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "bg-white/20 text-white shadow-sm"
                : "text-green-100 hover:text-white hover:bg-white/10"
            )

            if (hardNavigationRoutes.has(item.href)) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={className}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </a>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={className}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Theme toggle + Sair */}
        <div className="p-3 border-t border-green-500 mt-auto space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-green-100 hover:text-white hover:bg-white/10 transition-all w-full"
          >
            {theme === "light" ? <Moon className="h-4 w-4 shrink-0" /> : <Sun className="h-4 w-4 shrink-0" />}
            <span>{theme === "light" ? "Modo Escuro" : "Modo Claro"}</span>
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-all w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  )
}

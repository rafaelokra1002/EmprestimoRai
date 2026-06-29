"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme-provider"
import {
  LayoutGrid,
  Award,
  DollarSign,
  Download,
  Users,
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
  User,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  Sparkles,
  ChevronRight,
  CheckCircle,
  XCircle,
  MapPin,
  GraduationCap,
  MessageSquareText,
} from "lucide-react"
import { useState } from "react"

// Cor de fundo (gradiente) + badge do ícone por card
const cardColors: Record<string, { card: string; badge: string; icon: string }> = {
  blue: { card: "border-blue-500/30 bg-gradient-to-br from-blue-900/60 to-blue-950/20", badge: "bg-blue-500/20 ring-blue-500/30", icon: "text-blue-400" },
  green: { card: "border-green-500/30 bg-gradient-to-br from-green-900/60 to-green-950/20", badge: "bg-green-500/20 ring-green-500/30", icon: "text-green-400" },
  amber: { card: "border-amber-500/30 bg-gradient-to-br from-amber-900/60 to-amber-950/20", badge: "bg-amber-500/20 ring-amber-500/30", icon: "text-amber-400" },
}

const topItems = [
  { href: "/perfil", label: "Meu Perfil", subtitle: "Ver informações", icon: User, color: "blue" },
  { href: "/funcionarios", label: "Funcionários", subtitle: "Cadastrar funcionários", icon: UserCog, color: "green" },
]

const highlightItem = {
  href: "/whatsapp",
  label: "Relatórios Diário",
  subtitle: "Relatórios via WhatsApp",
  icon: FileText,
  color: "amber",
}

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/score", label: "Score de Clientes", icon: Award },
  { href: "/emprestimos", label: "Empréstimos", icon: DollarSign },
  { href: "/emprestimos/relatorio", label: "Relatório Empréstimos", icon: BarChart3 },
  { href: "/calendario", label: "Calendário de Cobranças", icon: Calendar },
  { href: "/simulador", label: "Simulador", icon: Calculator },
  { href: "/contas", label: "Caixa", icon: CreditCard },
  { href: "/despesas", label: "Despesas", icon: Receipt },
  { href: "/templates", label: "Templates", icon: MessageSquareText },
  { href: "/backup", label: "Backup", icon: Download },
  { href: "/clientes/desaparecido", label: "Desaparecido", icon: XCircle },
  { href: "/aulas", label: "Aulas", icon: GraduationCap },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

const hardNavigationRoutes = new Set(["/emprestimos/tabela-price", "/emprestimos/recebimentos", "/emprestimos/relatorio"])

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{ background: theme === "purple" ? "linear-gradient(180deg, #2c2553 0%, #15102a 100%)" : theme === "dark" ? "linear-gradient(180deg, #27272a 0%, #1c1c1f 100%)" : "linear-gradient(180deg, #0f4a34 0%, #0a3322 100%)" }}
        className="fixed top-4 left-4 z-50 rounded-md border border-white/20 p-2 text-white shadow-lg shadow-black/30 lg:hidden"
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
          "fixed top-0 left-0 z-40 flex h-full w-64 flex-col overflow-y-auto transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ background: theme === "purple" ? "linear-gradient(180deg, #2c2553 0%, #15102a 100%)" : theme === "dark" ? "linear-gradient(180deg, #27272a 0%, #1c1c1f 100%)" : "linear-gradient(180deg, #0f4a34 0%, #0a3322 100%)" }}
      >
        <div className="flex flex-col border-b border-white/10 p-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="SP Cobrança Fácil" className="h-9 w-9 shrink-0" />
            <span className="text-lg font-bold text-white leading-tight">SP Cobrança Fácil</span>
          </div>
          <span className="pl-[2.875rem] text-[11px] text-violet-200 leading-tight">Gestão Financeira</span>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {/* Top special items */}
          <div className="space-y-2.5 mb-3">
            {topItems.map((item) => {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2.5 py-3 text-sm transition-all border",
                    cardColors[item.color].card
                  )}
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1", cardColors[item.color].badge)}>
                    <item.icon className={cn("h-4 w-4", cardColors[item.color].icon)} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold text-[13px] leading-tight text-white">{item.label}</p>
                    <p className="truncate text-[10px] leading-tight text-white/60">{item.subtitle}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
                </Link>
              )
            })}

            {/* Highlighted item */}
            {highlightItem && (() => {
              return (
                <Link
                  href={highlightItem.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2.5 py-3 text-sm transition-all border",
                    cardColors[highlightItem.color].card
                  )}
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1", cardColors[highlightItem.color].badge)}>
                    <highlightItem.icon className={cn("h-4 w-4", cardColors[highlightItem.color].icon)} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold text-[13px] leading-tight text-white">{highlightItem.label}</p>
                    <p className="truncate text-[10px] leading-tight text-white/60">{highlightItem.subtitle}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
                </Link>
              )
            })()}
          </div>

          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-violet-200/80">Menu</p>

          {/* Regular menu items */}
          {menuItems.map((item) => {
            const isClientesRoot = item.href === "/clientes"
            const isActive = isClientesRoot
              ? pathname === "/clientes"
              : pathname === item.href || pathname?.startsWith(item.href + "/")
            const className = cn(
              "flex items-center gap-2 rounded-lg px-2 py-2.5 text-[13px] transition-all overflow-hidden",
              isActive
                ? "border border-amber-500/40 border-l-[3px] border-l-amber-500 bg-gradient-to-r from-amber-950/50 via-zinc-900/40 to-zinc-900/10 text-white font-semibold shadow-sm"
                : "font-normal text-violet-50/90 hover:bg-white/10 hover:text-white"
            )
            const iconCls = cn("h-6 w-6 shrink-0", isActive && "text-amber-400")

            if (hardNavigationRoutes.has(item.href)) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={className}
                >
                  <item.icon className={iconCls} />
                  <span className="whitespace-nowrap">{item.label}</span>
                  {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-400" />}
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
                <item.icon className={iconCls} />
                <span className="whitespace-nowrap">{item.label}</span>
                {isActive && <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-amber-400" />}
              </Link>
            )
          })}
        </nav>

      </aside>
    </>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
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
  ChevronDown,
  CheckCircle,
  XCircle,
  MapPin,
  GraduationCap,
  MessageSquareText,
  Search,
  Headphones,
  FileCheck,
  LifeBuoy,
  Crown,
  UserPlus,
  TrendingUp,
} from "lucide-react"
import { useState } from "react"

// Cor de fundo (gradiente) + badge do ícone por card
const cardColors: Record<string, { card: string; badge: string; icon: string }> = {
  blue: { card: "border-white/10 bg-gradient-to-br from-[#0E9BA8] to-[#0A7B86] dark:border-blue-500/30 dark:from-blue-900/60 dark:to-blue-950/20", badge: "bg-black/20 ring-white/10 dark:bg-blue-500/20 dark:ring-blue-500/30", icon: "text-white dark:text-blue-400" },
  green: { card: "border-white/10 bg-gradient-to-br from-[#0A6E4C] to-[#08573D] dark:border-green-500/30 dark:from-green-900/60 dark:to-green-950/20", badge: "bg-black/20 ring-white/10 dark:bg-green-500/20 dark:ring-green-500/30", icon: "text-white dark:text-green-400" },
  amber: { card: "border-white/10 bg-gradient-to-br from-[#635826] to-[#4A431A] dark:border-amber-500/30 dark:from-amber-900/60 dark:to-amber-950/20", badge: "bg-black/20 ring-white/10 dark:bg-amber-500/20 dark:ring-amber-500/30", icon: "text-white dark:text-amber-400" },
  purple: { card: "border-white/10 bg-gradient-to-br from-[#71317A] to-[#58255E] dark:border-purple-500/30 dark:from-purple-900/60 dark:to-purple-950/20", badge: "bg-black/20 ring-white/10 dark:bg-purple-500/20 dark:ring-purple-500/30", icon: "text-white dark:text-purple-400" },
}

const topItems = [
  { href: "/funcionarios", label: "Funcionários", subtitle: "Cadastrar funcionários", icon: UserPlus, color: "green" },
  { href: "/whatsapp", label: "Relatórios Diário", subtitle: "Relatórios via WhatsApp", icon: FileCheck, color: "amber" },
  { href: "/perfil", label: "Meu Perfil", subtitle: "Gerenciar dados e plano", icon: User, color: "blue" },
  { href: "#", label: "Meus Planos", subtitle: "Assinatura e upgrades", icon: Crown, color: "amber" },
  { href: "#", label: "Consultas", subtitle: "SPC, Serasa, CPF e mais", icon: Search, color: "purple" },
]

const highlightItem = null

type LeafItem = { href: string; label: string; icon: any; badge?: string }
type MenuItem = LeafItem | { label: string; icon: any; children: LeafItem[] }

const menuItems: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "#", label: "Central de Atendimento", icon: Headphones, badge: "Beta" },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "#", label: "Consultas", icon: Search },
  {
    label: "Empréstimos",
    icon: DollarSign,
    children: [
      { href: "/emprestimos", label: "Empréstimos", icon: DollarSign },
      { href: "/emprestimos/relatorio", label: "Relatório de Empréstimos", icon: BarChart3 },
      { href: "/simulador", label: "Simulador", icon: Calculator },
      { href: "/score", label: "Score de Clientes", icon: Award },
      { href: "/calendario", label: "Calendário de Cobranças", icon: Calendar },
    ],
  },
  {
    label: "Vendas e Contratos",
    icon: ShoppingCart,
    children: [
      { href: "/vendas", label: "Vendas de Produtos", icon: ShoppingCart },
      { href: "#", label: "Contratos", icon: FileText },
      { href: "#", label: "Rel. Vendas", icon: TrendingUp },
      { href: "#", label: "Veículos Registrados", icon: Car },
    ],
  },
  { href: "/contas", label: "Caixa", icon: CreditCard },
  { href: "/despesas", label: "Despesas", icon: Receipt },
  { href: "#", label: "Desconto de Cheque", icon: FileCheck },
  { href: "/templates", label: "Templates", icon: MessageSquareText },
  { href: "/backup", label: "Backup", icon: Download },
  { href: "/clientes/desaparecido", label: "Desaparecido", icon: XCircle },
  { href: "#", label: "Suporte", icon: LifeBuoy },
  { href: "/aulas", label: "Aulas", icon: GraduationCap },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

const hardNavigationRoutes = new Set(["/emprestimos/tabela-price", "/emprestimos/recebimentos", "/emprestimos/relatorio"])

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Só o item mais específico (href mais longo) que casa com a rota fica ativo,
  // para não marcar "Empréstimos" e "Relatório de Empréstimos" ao mesmo tempo.
  const allLeaves: LeafItem[] = menuItems.flatMap((item) => ("children" in item ? item.children : [item]))
  const activeHref = allLeaves
    .filter((leaf) => pathname === leaf.href || (pathname?.startsWith(leaf.href + "/") ?? false))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  const renderLeaf = (item: LeafItem, sub = false) => {
    const isActive = item.href === activeHref
    const className = cn(
      "flex items-center gap-2 rounded-lg text-[13px] transition-all overflow-hidden",
      sub ? "px-2 py-2" : "px-2 py-2.5",
      isActive
        ? "border-l-[3px] border-l-amber-400 bg-gradient-to-r from-amber-500/10 via-white/[0.03] to-transparent text-white font-semibold"
        : "font-normal text-violet-50/90 hover:bg-white/10 hover:text-white"
    )
    const iconCls = cn(sub ? "h-5 w-5" : "h-6 w-6", "shrink-0")
    const inner = (
      <>
        <item.icon className={iconCls} />
        <span className="whitespace-nowrap">{item.label}</span>
        {item.badge && (
          <span className="ml-auto rounded-full bg-green-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-green-300">{item.badge}</span>
        )}
        {isActive && <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-white/60" />}
      </>
    )
    if (hardNavigationRoutes.has(item.href)) {
      return (
        <a key={item.label} href={item.href} onClick={() => setIsOpen(false)} className={className}>{inner}</a>
      )
    }
    return (
      <Link key={item.label} href={item.href} onClick={() => setIsOpen(false)} className={className}>{inner}</Link>
    )
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 rounded-md border border-white/20 bg-[#16A249] p-2 text-white shadow-lg shadow-black/30 dark:bg-[#0F141A] lg:hidden"
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
          "fixed top-0 left-0 z-40 flex h-full w-72 flex-col overflow-y-auto bg-[#16A249] transition-transform duration-300 ease-in-out dark:bg-[#0F141A]",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col p-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="SP Cobrança Fácil" className="h-9 w-9 shrink-0" />
            <span className="text-lg font-bold text-white leading-tight">SP Cobrança Fácil</span>
          </div>
          <span className="pl-[2.875rem] text-[11px] text-violet-200 leading-tight">Gestão Financeira</span>
        </div>

        <nav className="p-3 space-y-1">
          {/* Top special items */}
          <div className="space-y-2.5 mb-3">
            {topItems.map((item) => {
              return (
                <Link
                  key={item.label}
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

          </div>

          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-violet-200/80">Menu</p>

          {/* Regular menu items */}
          {menuItems.map((item) => {
            if ("children" in item) {
              const groupActive = item.children.some((c) => c.href === activeHref)
              const isGroupOpen = openGroups[item.label] ?? groupActive
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => setOpenGroups((g) => ({ ...g, [item.label]: !isGroupOpen }))}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-[13px] transition-all",
                      groupActive ? "text-white font-semibold" : "font-normal text-violet-50/90 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <item.icon className="h-6 w-6 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-semibold text-white">{item.children.length}</span>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isGroupOpen && "rotate-180")} />
                    </span>
                  </button>
                  {isGroupOpen && (
                    <div className="mt-1 space-y-1 pl-4">
                      {item.children.map((child) => renderLeaf(child, true))}
                    </div>
                  )}
                </div>
              )
            }
            return renderLeaf(item)
          })}
        </nav>

      </aside>
    </>
  )
}

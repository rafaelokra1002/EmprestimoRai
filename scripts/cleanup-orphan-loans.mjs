// Limpa empréstimos ÓRFÃOS: loans com deleted=false cujo CLIENTE já está deleted=true.
// Só marca o loan como deleted=true (soft-delete) — NÃO apaga pagamentos nem parcelas,
// e NÃO toca em loans de clientes ativos.
//
// Por padrão roda em DRY-RUN (só mostra o que faria). Para aplicar de verdade, passe --apply.
//
// Uso no container Coolify (DATABASE_URL já está no ambiente do app):
//   node scripts/cleanup-orphan-loans.mjs           <- só mostra (dry-run)
//   node scripts/cleanup-orphan-loans.mjs --apply   <- aplica
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const APPLY = process.argv.includes("--apply")

const orphans = await prisma.loan.findMany({
  where: { deleted: false, client: { deleted: true } },
  select: {
    id: true, amount: true, totalAmount: true, status: true,
    client: { select: { name: true } },
    _count: { select: { installments: true, payments: true } },
  },
  orderBy: { createdAt: "desc" },
})

console.log(`Empréstimos órfãos (deleted=false, cliente deleted=true): ${orphans.length}`)
for (const l of orphans) {
  console.log(`- ${l.client?.name || "??"} | ${l.id.slice(0, 8)} | amount ${l.amount} total ${l.totalAmount} | status ${l.status} | inst ${l._count.installments} pay ${l._count.payments}`)
}

if (orphans.length === 0) {
  console.log("\nNada a fazer.")
} else if (!APPLY) {
  console.log("\nDRY-RUN: nada foi alterado. Rode de novo com --apply para marcar esses loans como deleted=true.")
} else {
  const ids = orphans.map((l) => l.id)
  const res = await prisma.loan.updateMany({ where: { id: { in: ids } }, data: { deleted: true } })
  console.log(`\nAPLICADO: ${res.count} empréstimo(s) marcado(s) como deleted=true. Pagamentos e parcelas foram mantidos.`)
}

await prisma.$disconnect()

// SOMENTE LEITURA — só faz contagens e SELECTs. Não altera/apaga nada.
// Uso (PowerShell):
//   $env:DATABASE_URL="<URL_DO_BANCO_COOLIFY>"; node scripts/inspect-prod.mjs
// Uso (bash / git-bash):
//   DATABASE_URL="<URL_DO_BANCO_COOLIFY>" node scripts/inspect-prod.mjs
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const r = {}
r.users = await prisma.user.count()
r.clients_total = await prisma.client.count()
r.clients_notDeleted = await prisma.client.count({ where: { deleted: false } })
r.clients_deleted = await prisma.client.count({ where: { deleted: true } })
r.loans_total = await prisma.loan.count()
r.loans_notDeleted = await prisma.loan.count({ where: { deleted: false } })
r.loans_deleted = await prisma.loan.count({ where: { deleted: true } })
r.loans_active = await prisma.loan.count({ where: { deleted: false, status: "ACTIVE" } })
r.payments_total = await prisma.payment.count()
r.installments_total = await prisma.installment.count()

console.log("COUNTS:", JSON.stringify(r, null, 2))

const loans = await prisma.loan.findMany({
  where: { deleted: false },
  select: {
    id: true, amount: true, totalAmount: true, profit: true, status: true, deleted: true, createdAt: true,
    client: { select: { id: true, name: true, status: true, deleted: true } },
    _count: { select: { installments: true, payments: true } },
  },
  orderBy: { createdAt: "desc" },
})
console.log(`\nLOANS (deleted=false) — total ${loans.length}:`)
for (const l of loans) {
  console.log(`- ${l.client?.name || "??"} | loan ${l.id.slice(0, 8)} | amount ${l.amount} total ${l.totalAmount} | status ${l.status} | clientDeleted=${l.client?.deleted} clientStatus=${l.client?.status} | inst ${l._count.installments} pay ${l._count.payments}`)
}

const pays = await prisma.payment.findMany({
  select: { id: true, amount: true, date: true, loan: { select: { deleted: true, status: true, client: { select: { name: true, deleted: true } } } } },
  orderBy: { date: "desc" },
  take: 50,
})
console.log(`\nPAYMENTS (até 50) — total no banco ${r.payments_total}:`)
for (const p of pays) {
  console.log(`- ${p.amount} | ${p.date.toISOString().slice(0, 10)} | loanDeleted=${p.loan?.deleted} loanStatus=${p.loan?.status} | client=${p.loan?.client?.name} clientDeleted=${p.loan?.client?.deleted}`)
}

await prisma.$disconnect()

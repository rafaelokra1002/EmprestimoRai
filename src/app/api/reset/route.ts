import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Apaga todos os dados operacionais do usuário (reset do sistema).
// Mantém: conta/perfil, funcionários e templates de mensagem.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const userId = (session.user as any).id

    const body = await request.json().catch(() => ({}))
    if (body?.confirm !== "RESETAR") {
      return NextResponse.json({ error: "Confirmação inválida" }, { status: 400 })
    }

    // Loan/Sale cascateiam para parcelas e pagamentos; Client cascateia documentos.
    await prisma.$transaction([
      prisma.loan.deleteMany({ where: { userId } }),
      prisma.sale.deleteMany({ where: { userId } }),
      prisma.vehicle.deleteMany({ where: { userId } }),
      prisma.expense.deleteMany({ where: { userId } }),
      prisma.clientDocument.deleteMany({ where: { client: { userId } } }),
      prisma.client.deleteMany({ where: { userId } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

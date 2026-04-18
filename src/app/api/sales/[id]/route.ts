import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()

    // Payment mode: pay a specific installment
    if (body.payInstallmentId) {
      const installment = await prisma.saleInstallment.findFirst({
        where: { id: body.payInstallmentId },
        include: { sale: true },
      })

      if (!installment || installment.sale.userId !== (session.user as any).id) {
        return NextResponse.json({ error: "Parcela não encontrada" }, { status: 404 })
      }

      const payAmount = body.payAmount || installment.amount
      const payDate = body.payDate ? new Date(body.payDate) : new Date()

      await prisma.saleInstallment.update({
        where: { id: body.payInstallmentId },
        data: {
          paidAmount: payAmount,
          paidDate: payDate,
          status: "PAID",
        },
      })

      // Update sale paidAmount
      const allInstallments = await prisma.saleInstallment.findMany({
        where: { saleId: params.id },
      })
      const totalPaid = allInstallments.reduce((s, i) => s + i.paidAmount, 0)
      const allPaid = allInstallments.every((i) => i.status === "PAID")

      await prisma.sale.update({
        where: { id: params.id },
        data: {
          paidAmount: totalPaid,
          status: allPaid ? "COMPLETED" : "ACTIVE",
        },
      })

      return NextResponse.json({ success: true })
    }

    // Edit mode: update sale info
    const sale = await prisma.sale.update({
      where: { id: params.id, userId: (session.user as any).id },
      data: {
        description: body.description,
        notes: body.notes,
      },
    })

    return NextResponse.json(sale)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    await prisma.sale.deleteMany({
      where: { id: params.id, userId: (session.user as any).id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

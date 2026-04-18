import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { expenseSchema } from "@/lib/validations"

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

    // handle paying an expense
    if (body.action === "pay") {
      const expense = await prisma.expense.updateMany({
        where: { id: params.id, userId: (session.user as any).id },
        data: { status: "PAID", paidDate: new Date() },
      })
      return NextResponse.json(expense)
    }

    // handle unpaying an expense
    if (body.action === "unpay") {
      const expense = await prisma.expense.updateMany({
        where: { id: params.id, userId: (session.user as any).id },
        data: { status: "PENDING", paidDate: null },
      })
      return NextResponse.json(expense)
    }

    const data = expenseSchema.parse(body)
    const expense = await prisma.expense.updateMany({
      where: { id: params.id, userId: (session.user as any).id },
      data: {
        description: data.description,
        supplier: data.supplier,
        pixKey: data.pixKey,
        accountType: data.accountType,
        amount: data.amount,
        category: data.category,
        dueDate: new Date(data.dueDate),
        recurring: data.recurring,
        notes: data.notes,
      },
    })

    return NextResponse.json(expense)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
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

    await prisma.expense.deleteMany({
      where: { id: params.id, userId: (session.user as any).id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

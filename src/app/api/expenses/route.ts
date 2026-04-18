import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { expenseSchema } from "@/lib/validations"
import { ZodError } from "zod"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const expenses = await prisma.expense.findMany({
      where: { userId: (session.user as any).id },
      orderBy: { dueDate: "asc" },
    })

    return NextResponse.json(expenses)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const data = expenseSchema.parse(body)

    const expense = await prisma.expense.create({
      data: {
        description: data.description,
        supplier: data.supplier,
        pixKey: data.pixKey,
        accountType: data.accountType || "PESSOAL",
        amount: data.amount,
        category: data.category,
        dueDate: new Date(data.dueDate),
        recurring: data.recurring || false,
        notes: data.notes,
        userId: (session.user as any).id,
      },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error: any) {
    if (error instanceof ZodError) {
      const details = error.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join("; ")
      return NextResponse.json({ error: details }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

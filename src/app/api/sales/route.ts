import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { saleSchema } from "@/lib/validations"
import { generateInstallmentDates } from "@/lib/utils"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const sales = await prisma.sale.findMany({
      where: { userId: (session.user as any).id },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        saleInstallments: { orderBy: { number: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(sales)
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
    const data = saleSchema.parse(body)

    const startDate = new Date(data.startDate.includes("T") ? data.startDate : data.startDate + "T12:00:00")
    const modality = data.modality || "MONTHLY"
    const installmentDates = generateInstallmentDates(startDate, data.installmentCount, modality)
    const downPayment = Math.min(data.downPayment || 0, data.totalAmount)
    const installmentAmount = (data.totalAmount - downPayment) / data.installmentCount

    const sale = await prisma.sale.create({
      data: {
        clientId: data.clientId,
        userId: (session.user as any).id,
        description: data.description,
        totalAmount: data.totalAmount,
        installmentCount: data.installmentCount,
        startDate,
        notes: data.notes,
        type: data.type || "PRODUCT",
        saleInstallments: {
          create: installmentDates.map((date, index) => ({
            number: index + 1,
            amount: Math.round(installmentAmount * 100) / 100,
            dueDate: date,
          })),
        },
      },
      include: { saleInstallments: true, client: { select: { name: true } } },
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

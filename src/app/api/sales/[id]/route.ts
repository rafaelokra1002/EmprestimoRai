import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateInstallmentDates } from "@/lib/utils"

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
    const existing = await prisma.sale.findFirst({
      where: { id: params.id, userId: (session.user as any).id },
      include: { saleInstallments: { orderBy: { number: "asc" } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 })
    }

    const updateData: any = {
      description: body.description,
      notes: body.notes,
    }
    if (typeof body.clientId === "string" && body.clientId) {
      updateData.clientId = body.clientId
    }

    // Só reconstrói o cronograma de parcelas se o valor, nº de parcelas ou data
    // de vencimento realmente vierem no payload (edição completa do formulário).
    const wantsScheduleUpdate =
      typeof body.totalAmount === "number" &&
      typeof body.installmentCount === "number" &&
      typeof body.startDate === "string" && body.startDate

    const scheduleWrites: any[] = []

    if (wantsScheduleUpdate) {
      const paidInstallments = existing.saleInstallments.filter((i) => i.status === "PAID")
      const paidCount = paidInstallments.length
      const newCount = body.installmentCount

      if (newCount < paidCount) {
        return NextResponse.json(
          { error: `Não é possível reduzir para ${newCount} parcela(s): ${paidCount} já foram pagas.` },
          { status: 400 }
        )
      }

      const newTotal = body.totalAmount
      const downPayment = Math.min(Math.max(body.downPayment || 0, 0), newTotal)
      const sumPaidOriginal = paidInstallments.reduce((s, i) => s + i.amount, 0)
      const unpaidCount = newCount - paidCount
      const remaining = Math.max(0, newTotal - downPayment - sumPaidOriginal)
      const newUnpaidAmount = unpaidCount > 0 ? remaining / unpaidCount : 0

      const modality = typeof body.modality === "string" && body.modality ? body.modality : "MONTHLY"
      const newStartDate = new Date(body.startDate.includes("T") ? body.startDate : body.startDate + "T12:00:00")
      const allDates = generateInstallmentDates(newStartDate, newCount, modality)

      updateData.totalAmount = newTotal
      updateData.installmentCount = newCount
      updateData.startDate = newStartDate

      // Parcelas já pagas nunca são tocadas (mantém valor/data/status originais).
      // Parcelas não pagas existentes são recalculadas; parcelas extras são criadas;
      // parcelas que sobraram além da nova contagem são removidas (só entre as não pagas).
      const existingUnpaid = existing.saleInstallments.filter((i) => i.status !== "PAID")
      const roundedAmount = Math.round(newUnpaidAmount * 100) / 100

      for (let idx = paidCount; idx < newCount; idx++) {
        const number = idx + 1
        const dueDate = allDates[idx]
        const current = existingUnpaid.find((i) => i.number === number)
        if (current) {
          scheduleWrites.push(
            prisma.saleInstallment.update({
              where: { id: current.id },
              data: { amount: roundedAmount, dueDate },
            })
          )
        } else {
          scheduleWrites.push(
            prisma.saleInstallment.create({
              data: { saleId: params.id, number, amount: roundedAmount, dueDate },
            })
          )
        }
      }

      // Remove parcelas não pagas que ficaram fora da nova contagem
      const toRemove = existingUnpaid.filter((i) => i.number > newCount)
      for (const inst of toRemove) {
        scheduleWrites.push(prisma.saleInstallment.delete({ where: { id: inst.id } }))
      }
    }

    const [sale] = await prisma.$transaction([
      prisma.sale.update({ where: { id: params.id }, data: updateData }),
      ...scheduleWrites,
    ])

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

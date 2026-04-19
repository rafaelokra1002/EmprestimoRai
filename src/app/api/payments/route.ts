import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { loanId, amount, date, notes, installmentId, newDueDate, discount } = body

    if (!loanId || !amount || !date) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    // Register payment
    const payment = await prisma.payment.create({
      data: {
        loanId,
        amount: parseFloat(amount),
        date: new Date(date.includes("T") ? date : date + "T12:00:00"),
        notes,
      },
    })

    // Update installment if provided
    if (installmentId) {
      const installment = await prisma.installment.findUnique({
        where: { id: installmentId },
      })

      if (installment) {
        const notesCheck = (notes || "").toLowerCase()
        const isInterestOnly = notesCheck.includes("só juros") || notesCheck.includes("parcial de juros")

        if (isInterestOnly) {
          // Interest-only payment: do NOT add to paidAmount (don't reduce capital)
          // Just update the due date to renew for next month
          const updateData: any = {}
          if (newDueDate) {
            updateData.dueDate = new Date(newDueDate.includes("T") ? newDueDate : newDueDate + "T12:00:00")
          }
          // Reset paidAmount to 0 so installment stays with same full value
          updateData.paidAmount = 0
          updateData.status = "PENDING"

          await prisma.installment.update({
            where: { id: installmentId },
            data: updateData,
          })
        } else {
          const effectiveAmount = discount ? installment.amount - parseFloat(discount) : installment.amount
          const newPaidAmount = installment.paidAmount + parseFloat(amount)
          const newStatus = newPaidAmount >= effectiveAmount ? "PAID" : "PENDING"

          const updateData: any = {
            paidAmount: newPaidAmount,
            paidDate: newStatus === "PAID" ? new Date(date) : null,
            status: newStatus,
          }

          // Update due date if provided and installment not fully paid
          if (newDueDate && newStatus !== "PAID") {
            updateData.dueDate = new Date(newDueDate.includes("T") ? newDueDate : newDueDate + "T12:00:00")
          }

          await prisma.installment.update({
            where: { id: installmentId },
            data: updateData,
          })
        }

        // Update client score
        const loan = await prisma.loan.findUnique({
          where: { id: loanId },
          select: { clientId: true },
        })

        if (loan) {
          const isOnTime = new Date(date) <= installment.dueDate
          const scoreChange = isOnTime ? 10 : -15

          await prisma.client.update({
            where: { id: loan.clientId },
            data: { score: { increment: scoreChange } },
          })
        }
      }
    }

    // Update lateCycles on the loan if this is an interest-only or full payment
    const notesLower = (notes || "").toLowerCase()
    if (notesLower.includes("só juros")) {
      // Interest-only payment: reset lateCycles to 0
      await prisma.loan.update({
        where: { id: loanId },
        data: { lateCycles: 0 },
      })
    }

    // Check if all installments are paid → mark loan as completed
    const allInstallments = await prisma.installment.findMany({
      where: { loanId },
    })
    const allPaid = allInstallments.every((i) => i.status === "PAID")
    if (allPaid) {
      await prisma.loan.update({
        where: { id: loanId },
        data: { status: "COMPLETED" },
      })
    }

    return NextResponse.json(payment, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID do pagamento é obrigatório" }, { status: 400 })
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { loan: { select: { id: true, clientId: true } } },
    })

    if (!payment) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 })
    }

    await prisma.payment.delete({ where: { id } })

    // Recheck loan status after deleting payment
    const allInstallments = await prisma.installment.findMany({
      where: { loanId: payment.loanId },
    })
    const allPaid = allInstallments.every((i) => i.status === "PAID")
    if (!allPaid) {
      await prisma.loan.update({
        where: { id: payment.loanId },
        data: { status: "ACTIVE" },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

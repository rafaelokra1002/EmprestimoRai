import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateClientScore } from "@/lib/score"

function parsePaymentDate(value: string) {
  return new Date(value.includes("T") ? value : `${value}T12:00:00`)
}

/** Recalcula e persiste o score do cliente a partir de todos os seus empréstimos. */
async function recalcClientScore(clientId: string) {
  const loans = await prisma.loan.findMany({
    where: { clientId, deleted: false },
    select: {
      status: true,
      profit: true,
      installments: {
        select: { status: true, dueDate: true, paidDate: true, amount: true, paidAmount: true },
      },
      payments: { select: { amount: true, notes: true } },
    },
  })
  const newScore = calculateClientScore(loans)
  await prisma.client.update({ where: { id: clientId }, data: { score: newScore } })
}

function extractTaggedAmount(notes: string | undefined, tag: string) {
  if (!notes) return 0

  const match = notes.match(new RegExp(`\\[${tag}:([\\d.]+)\\]`, "i"))
  return match ? parseFloat(match[1]) || 0 : 0
}

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

    // Segurança: só permite registrar pagamento em empréstimo do próprio usuário.
    const userId = (session.user as any).id
    const ownedLoan = await prisma.loan.findFirst({
      where: { id: loanId, userId },
      select: { id: true },
    })
    if (!ownedLoan) {
      return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 })
    }

    const paymentDate = parsePaymentDate(date)

    // Register payment
    const payment = await prisma.payment.create({
      data: {
        loanId,
        amount: parseFloat(amount),
        date: paymentDate,
        notes,
      },
    })

    // Update installment if provided
    if (installmentId) {
      // Escopo ao empréstimo já validado como do usuário — evita mexer em parcela de outro contrato.
      const installment = await prisma.installment.findFirst({
        where: { id: installmentId, loanId },
      })

      if (installment) {
        const notesCheck = (notes || "").toLowerCase()
        const isInterestOnly = notesCheck.includes("só juros") || notesCheck.includes("parcial de juros")
        const taggedLateFee = extractTaggedAmount(notes, "lateFee")
        const taggedDailyFee = extractTaggedAmount(notes, "dailyFee")
        const lateFeeAmount = taggedLateFee > 0 ? taggedLateFee : taggedDailyFee

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
          const principalPaymentAmount = Math.max(0, parseFloat(amount) - lateFeeAmount)
          const newPaidAmount = installment.paidAmount + principalPaymentAmount
          const newStatus = newPaidAmount >= effectiveAmount ? "PAID" : "PENDING"

          const updateData: any = {
            paidAmount: newPaidAmount,
            paidDate: newStatus === "PAID" ? paymentDate : null,
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

        // Recalcula o score do cliente seguindo a referência documentada
        const loan = await prisma.loan.findUnique({
          where: { id: loanId },
          select: { clientId: true },
        })

        if (loan) {
          await recalcClientScore(loan.clientId)
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
      include: { loan: { select: { id: true, clientId: true, userId: true } } },
    })

    // Segurança: só permite excluir recebimento de empréstimo do próprio usuário.
    if (!payment || payment.loan?.userId !== (session.user as any).id) {
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

    // Recalcula o score do cliente após remover o pagamento
    if (payment.loan?.clientId) {
      await recalcClientScore(payment.loan.clientId)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { id, date, amount } = body

    if (!id || (!date && amount === undefined)) {
      return NextResponse.json({ error: "ID e ao menos um campo para atualizar são obrigatórios" }, { status: 400 })
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { id },
      include: {
        loan: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!existingPayment || existingPayment.loan.userId !== (session.user as any).id) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 })
    }

    const updateData: any = {}
    if (date) updateData.date = parsePaymentDate(date)
    if (amount !== undefined) updateData.amount = parseFloat(amount)

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updatedPayment)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

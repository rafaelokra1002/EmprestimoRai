import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { loanSchema } from "@/lib/validations"
import { calculateLoan, generateInstallmentDates, resolveDailyInterestAmount } from "@/lib/utils"
import { normalizeInstallmentsFromPayments } from "@/lib/loan-logic"

async function resolveSessionUserId(session: any) {
  const sessionUserId = (session?.user as any)?.id as string | undefined
  const sessionUserEmail = (session?.user as any)?.email as string | undefined

  if (sessionUserId) return sessionUserId
  if (!sessionUserEmail) return null

  const user = await prisma.user.findUnique({
    where: { email: sessionUserEmail },
    select: { id: true },
  })

  return user?.id ?? null
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json({ error: "Sessão inválida. Faça login novamente." }, { status: 401 })
    }

    const loan = await prisma.loan.findFirst({
      where: { id: params.id, userId },
      include: {
        client: true,
        user: { select: { pixKey: true } },
        installments: { orderBy: { number: "asc" } },
        payments: { orderBy: { date: "desc" } },
      },
    })

    if (!loan) {
      return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      ...loan,
      installments: normalizeInstallmentsFromPayments(loan.installments, loan.payments),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json({ error: "Sessão inválida. Faça login novamente." }, { status: 401 })
    }

    const body = await request.json()
    const isFullLoanEdit =
      typeof body?.clientId === "string" &&
      typeof body?.amount === "number" &&
      typeof body?.interestRate === "number" &&
      typeof body?.installmentCount === "number" &&
      typeof body?.contractDate === "string" &&
      typeof body?.firstInstallmentDate === "string"

    if (isFullLoanEdit) {
      const data = loanSchema.parse(body)

      const existingLoan = await prisma.loan.findFirst({
        where: { id: params.id, userId },
        include: {
          installments: true,
          payments: true,
        },
      })

      if (!existingLoan) {
        return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 })
      }

      const hasPayments = existingLoan.payments.length > 0 || existingLoan.installments.some((i) => i.paidAmount > 0)
      if (hasPayments) {
        // Metadata (tags, notes, etc.) can always be updated even when financial fields are blocked
        const metadataUpdate: Record<string, any> = {}
        if (Array.isArray(body.tags)) {
          metadataUpdate.tags = body.tags.filter((t: unknown) => typeof t === "string" && (t as string).trim())
        }
        if (typeof body.notes === "string" || body.notes === null) {
          metadataUpdate.notes = body.notes && (body.notes as string).trim() ? (body.notes as string).trim() : null
        }
        if (typeof body.whatsappNotify === "boolean") {
          metadataUpdate.whatsappNotify = body.whatsappNotify
        }
        if (typeof body.dailyInterest === "boolean") {
          metadataUpdate.dailyInterest = body.dailyInterest
        }
        if (typeof body.dailyInterestAmount === "number") {
          metadataUpdate.dailyInterestAmount = body.dailyInterestAmount
        }
        if (Object.keys(metadataUpdate).length > 0) {
          await prisma.loan.update({ where: { id: params.id }, data: metadataUpdate })
        }
        return NextResponse.json(
          { error: "Não é possível alterar valores/datas de um empréstimo que já possui pagamentos." },
          { status: 400 }
        )
      }

      const { totalAmount, profit, installmentAmount, totalInterest } = calculateLoan(
        data.amount,
        data.interestRate,
        data.installmentCount,
        data.interestType,
        data.totalInterestAmount
      )
      const dailyInterestAmount = resolveDailyInterestAmount(
        data.dailyInterest ?? false,
        data.dailyInterestAmount,
        data.amount,
        data.interestRate,
        data.modality
      )

      const firstDate = new Date(data.firstInstallmentDate)
      const contractDate = new Date(data.contractDate)

      let installmentDates: Date[]
      if (data.installmentDates && data.installmentDates.length === data.installmentCount) {
        installmentDates = data.installmentDates.map((d) => new Date(d))
      } else {
        installmentDates = generateInstallmentDates(
          firstDate,
          data.installmentCount,
          data.modality,
          data.skipSaturday,
          data.skipSunday,
          data.skipHolidays
        )
      }

      await prisma.$transaction(async (tx) => {
        await tx.installment.deleteMany({ where: { loanId: params.id } })

        await tx.loan.update({
          where: { id: params.id },
          data: {
            clientId: data.clientId,
            amount: data.amount,
            interestRate: data.interestRate,
            interestType: data.interestType,
            modality: data.modality,
            totalInterest,
            installmentValue: installmentAmount,
            totalAmount,
            profit,
            installmentCount: data.installmentCount,
            contractDate,
            firstInstallmentDate: firstDate,
            startDate: contractDate,
            skipSaturday: data.skipSaturday ?? false,
            skipSunday: data.skipSunday ?? false,
            skipHolidays: data.skipHolidays ?? false,
            dailyInterest: data.dailyInterest ?? false,
            dailyInterestAmount,
            whatsappNotify: data.whatsappNotify ?? false,
            notes: data.notes,
            tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string" && (t as string).trim()) : undefined,
          },
        })

        await tx.installment.createMany({
          data: installmentDates.map((date, index) => ({
            loanId: params.id,
            number: index + 1,
            amount: installmentAmount,
            dueDate: date,
          })),
        })
      })

      const loan = await prisma.loan.findFirst({
        where: { id: params.id, userId },
        include: {
          client: true,
          user: { select: { pixKey: true } },
          installments: { orderBy: { number: "asc" } },
          payments: { orderBy: { date: "desc" } },
        },
      })

      return NextResponse.json({
        ...loan,
        installments: normalizeInstallmentsFromPayments(loan.installments, loan.payments),
      })
    }

    const allowedStatus = ["ACTIVE", "COMPLETED", "DEFAULTED", "CANCELLED"]

    const updateData: Record<string, any> = {}
    if (typeof body.notes === "string" || body.notes === null) {
      updateData.notes = body.notes && body.notes.trim() ? body.notes.trim() : null
    }
    if (typeof body.status === "string" && allowedStatus.includes(body.status)) {
      updateData.status = body.status
    }
    if (typeof body.whatsappNotify === "boolean") {
      updateData.whatsappNotify = body.whatsappNotify
    }
    if (typeof body.dailyInterest === "boolean") {
      updateData.dailyInterest = body.dailyInterest
    }
    if (typeof body.dailyInterestAmount === "number") {
      updateData.dailyInterestAmount = body.dailyInterestAmount
    }
    if (Array.isArray(body.tags)) {
      updateData.tags = body.tags.filter((t: unknown) => typeof t === "string" && (t as string).trim())
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 })
    }

    const updated = await prisma.loan.updateMany({
      where: { id: params.id, userId },
      data: updateData,
    })

    if (!updated.count) {
      return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 })
    }

    const loan = await prisma.loan.findFirst({
      where: { id: params.id, userId },
      include: {
        client: true,
        installments: { orderBy: { number: "asc" } },
        payments: { orderBy: { date: "desc" } },
      },
    })

    return NextResponse.json(loan)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao atualizar empréstimo" }, { status: 500 })
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

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json({ error: "Sessão inválida. Faça login novamente." }, { status: 401 })
    }

    await prisma.loan.deleteMany({
      where: { id: params.id, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

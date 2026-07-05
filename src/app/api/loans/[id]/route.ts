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
      where: { id: params.id, userId, deleted: false },
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

    // Atualização leve: apenas datas de vencimento das parcelas (edição inline no card)
    if (!isFullLoanEdit && Array.isArray(body?.installmentDates) && body.installmentDates.length > 0) {
      const existingLoan = await prisma.loan.findFirst({
        where: { id: params.id, userId, deleted: false },
        include: { installments: true },
      })
      if (!existingLoan) {
        return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 })
      }
      const sorted = [...existingLoan.installments].sort((a, b) => a.number - b.number)
      for (let i = 0; i < Math.min(body.installmentDates.length, sorted.length); i++) {
        const d = body.installmentDates[i] as string | null
        if (!d) continue
        await prisma.installment.update({
          where: { id: sorted[i].id },
          data: { dueDate: new Date(d.includes("T") ? d : d + "T12:00:00") },
        })
      }
      return NextResponse.json({ success: true })
    }

    if (isFullLoanEdit) {
      const data = loanSchema.parse(body)

      const existingLoan = await prisma.loan.findFirst({
        where: { id: params.id, userId, deleted: false },
        include: {
          installments: true,
          payments: true,
        },
      })

      if (!existingLoan) {
        return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 })
      }

      // Só bloqueia a edição completa (recalc de valor/juros) quando o PRINCIPAL já foi
      // amortizado (alguma parcela com paidAmount > 0). Empréstimo "Só Juros" tem pagamento
      // de juros mas paidAmount = 0 nas parcelas → segue para a edição completa abaixo,
      // recalculando valor/juros e preservando os vencimentos atuais.
      const hasPrincipalPaid = existingLoan.installments.some((i) => i.paidAmount > 0)
      if (hasPrincipalPaid) {
        // Allow metadata + date updates even when loan has principal paid
        const allowedUpdate: Record<string, any> = {}
        if (Array.isArray(body.tags)) {
          allowedUpdate.tags = body.tags.filter((t: unknown) => typeof t === "string" && (t as string).trim())
        }
        if (typeof body.notes === "string" || body.notes === null) {
          allowedUpdate.notes = body.notes && (body.notes as string).trim() ? (body.notes as string).trim() : null
        }
        if (typeof body.whatsappNotify === "boolean") {
          allowedUpdate.whatsappNotify = body.whatsappNotify
        }
        if (typeof body.dailyInterest === "boolean") {
          allowedUpdate.dailyInterest = body.dailyInterest
        }
        if (typeof body.dailyInterestAmount === "number") {
          allowedUpdate.dailyInterestAmount = body.dailyInterestAmount
        }
        if (typeof body.contractDate === "string") {
          allowedUpdate.contractDate = new Date(body.contractDate.includes("T") ? body.contractDate : body.contractDate + "T12:00:00")
        }
        if (typeof body.firstInstallmentDate === "string") {
          allowedUpdate.firstInstallmentDate = new Date(body.firstInstallmentDate.includes("T") ? body.firstInstallmentDate : body.firstInstallmentDate + "T12:00:00")
        }

        if (Object.keys(allowedUpdate).length > 0) {
          await prisma.loan.update({ where: { id: params.id }, data: allowedUpdate })
        }

        // Update individual installment due dates if provided
        if (Array.isArray(body.installmentDates) && body.installmentDates.length > 0) {
          const sorted = [...existingLoan.installments].sort((a, b) => a.number - b.number)
          for (let i = 0; i < Math.min(body.installmentDates.length, sorted.length); i++) {
            const d = body.installmentDates[i] as string
            await prisma.installment.update({
              where: { id: sorted[i].id },
              data: { dueDate: new Date(d.includes("T") ? d : d + "T12:00:00") },
            })
          }
        }

        return NextResponse.json({ success: true })
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

      const firstDate = new Date(data.firstInstallmentDate + (data.firstInstallmentDate.includes("T") ? "" : "T12:00:00"))
      const contractDate = new Date(data.contractDate + (data.contractDate.includes("T") ? "" : "T12:00:00"))

      let installmentDates: Date[]
      if (data.installmentDates && data.installmentDates.length === data.installmentCount) {
        installmentDates = data.installmentDates.map((d) => new Date(d.includes("T") ? d : d + "T12:00:00"))
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

      // As datas vêm do formulário (que preserva os vencimentos renovados quando não são
      // editados, e aplica as alterações quando o usuário edita) — então usamos installmentDates
      // direto, sem forçar de volta os vencimentos existentes.

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
        where: { id: params.id, userId, deleted: false },
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
      where: { id: params.id, userId, deleted: false },
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

    const hasPayments = await prisma.payment.count({ where: { loanId: params.id } })

    if (hasPayments > 0) {
      // Soft delete: mantém os pagamentos (recebimentos) no histórico. O empréstimo some
      // do dashboard (que filtra deleted:false), mas os recebimentos só são apagados quando
      // o próprio recebimento é excluído.
      await prisma.$transaction([
        prisma.installment.deleteMany({ where: { loanId: params.id } }),
        prisma.loan.updateMany({ where: { id: params.id, userId }, data: { deleted: true } }),
      ])
    } else {
      // Sem pagamentos: hard delete (não há recebimento a preservar)
      await prisma.loan.deleteMany({ where: { id: params.id, userId } })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { loanSchema } from "@/lib/validations"
import { calculateLoan, generateInstallmentDates, resolveDailyInterestAmount } from "@/lib/utils"
import { normalizeInstallmentsFromPayments } from "@/lib/loan-logic"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeDeleted = searchParams.get("includeDeleted") === "true"

    const loans = await prisma.loan.findMany({
      where: { userId: (session.user as any).id, ...(includeDeleted ? {} : { deleted: false }), client: { status: { not: "DESAPARECIDO" } } },
      include: {
        client: { select: { id: true, name: true, photo: true, city: true, status: true } },
        installments: { orderBy: { number: "asc" } },
        payments: { orderBy: { date: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    })

    const normalizedLoans = loans.map((loan) => ({
      ...loan,
      installments: normalizeInstallmentsFromPayments(loan.installments, loan.payments),
    }))

    return NextResponse.json(normalizedLoans)
  } catch (error: any) {
    console.error("GET /api/loans error:", error)
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
    const data = loanSchema.parse(body)

    const loanCalc = calculateLoan(
      data.amount,
      data.interestRate,
      data.installmentCount,
      data.interestType,
      data.totalInterestAmount,
      data.customInstallmentAmounts
    )
    const { totalAmount, profit, installmentAmount, totalInterest } = loanCalc
    const sacInstallments = (loanCalc as any).sacInstallments as number[] | undefined
    const dailyInterestAmount = resolveDailyInterestAmount(
      data.dailyInterest ?? false,
      data.dailyInterestAmount,
      data.amount,
      data.interestRate,
      data.modality
    )

    // Valores por parcela. Para tipos de parcela igual, a última parcela absorve
    // a diferença de arredondamento para que a soma bata exatamente com totalAmount
    // (evita, p.ex., 3× R$166,67 = R$500,01 quando o total é R$500,00).
    const installmentAmounts: number[] = Array.from({ length: data.installmentCount }, (_, index) => {
      if (data.interestType === "SAC" && sacInstallments) return sacInstallments[index]
      if (data.interestType === "CUSTOM" && data.customInstallmentAmounts) return data.customInstallmentAmounts[index]
      if (index === data.installmentCount - 1) {
        const sumOthers = Math.round(installmentAmount * (data.installmentCount - 1) * 100) / 100
        return Math.round((totalAmount - sumOthers) * 100) / 100
      }
      return installmentAmount
    })

    const firstDate = new Date(data.firstInstallmentDate + (data.firstInstallmentDate.includes("T") ? "" : "T12:00:00"))
    const contractDate = new Date(data.contractDate + (data.contractDate.includes("T") ? "" : "T12:00:00"))

    // Use custom dates if provided, otherwise generate
    let installmentDates: Date[]
    if (data.installmentDates && data.installmentDates.length === data.installmentCount) {
      installmentDates = data.installmentDates.map((d: string) => new Date(d.includes("T") ? d : d + "T12:00:00"))
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

    const loan = await prisma.$transaction(async (tx) => {
      const createdLoan = await tx.loan.create({
        data: {
          clientId: data.clientId,
          userId: (session.user as any).id,
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
          penaltyFee: data.penaltyFee ?? 0,
          lateCycles: 0,
          dueDay: firstDate.getDate(),
          whatsappNotify: data.whatsappNotify ?? false,
          notes: data.notes,
          tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string" && (t as string).trim()) : [],
          installments: {
            create: installmentDates.map((date, index) => ({
              number: index + 1,
              amount: installmentAmounts[index],
              dueDate: date,
            })),
          },
        },
        include: {
          installments: true,
          client: { select: { name: true } },
        },
      })

      await tx.client.update({
        where: { id: data.clientId },
        data: { status: "ACTIVE" },
      })

      return createdLoan
    })

    return NextResponse.json(loan, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/loans error:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

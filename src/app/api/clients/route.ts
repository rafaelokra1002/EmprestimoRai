import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { clientSchema } from "@/lib/validations"
import { calculateLoan } from "@/lib/utils"
import { ZodError } from "zod"

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

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json({ error: "Sessão inválida. Faça login novamente." }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeInstallments = searchParams.get("includeInstallments") === "true"

    const clients = await prisma.client.findMany({
      where: { userId },
      include: {
        loans: includeInstallments
          ? {
              select: {
                id: true,
                amount: true,
                totalAmount: true,
                profit: true,
                interestRate: true,
                interestType: true,
                modality: true,
                installmentCount: true,
                dailyInterest: true,
                dailyInterestAmount: true,
                dueDay: true,
                firstInstallmentDate: true,
                status: true,
                payments: {
                  select: {
                    amount: true,
                    notes: true,
                  },
                },
                installments: {
                  select: {
                    id: true,
                    number: true,
                    amount: true,
                    paidAmount: true,
                    status: true,
                    dueDate: true,
                  },
                },
              },
            }
          : { select: { id: true, amount: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(clients)
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

    let userId = (await resolveSessionUserId(session)) ?? undefined
    const userEmail = (session.user as any).email as string | undefined
    if (!userId) {
      return NextResponse.json({ error: "Sessão inválida. Faça login novamente." }, { status: 401 })
    }

    const body = await request.json()
    const rawRequestedAmount = body.requestedAmount
    const rawDisappearedInterestRate = body.disappearedInterestRate

    // Strip empty strings to undefined before validation
    const sanitized = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [
        key,
        typeof value === "string" && value.trim() === "" ? undefined : value,
      ])
    )

    const data = clientSchema.parse(sanitized)

    const requestedAmount =
      rawRequestedAmount === "" || rawRequestedAmount === undefined || rawRequestedAmount === null
        ? undefined
        : Number(rawRequestedAmount)
    const disappearedInterestRate =
      rawDisappearedInterestRate === "" || rawDisappearedInterestRate === undefined || rawDisappearedInterestRate === null
        ? undefined
        : Number(rawDisappearedInterestRate)

    if (requestedAmount !== undefined && (!Number.isFinite(requestedAmount) || requestedAmount < 0)) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
    }

    if (disappearedInterestRate !== undefined && (!Number.isFinite(disappearedInterestRate) || disappearedInterestRate < 0)) {
      return NextResponse.json({ error: "Taxa de juros inválida" }, { status: 400 })
    }

    if ((requestedAmount === undefined) !== (disappearedInterestRate === undefined)) {
      return NextResponse.json(
        { error: "Informe valor e taxa de juros para cadastrar o empréstimo do desaparecido." },
        { status: 400 }
      )
    }

    const createData = {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      document: data.document || null,
      rg: data.rg || null,
      instagram: data.instagram || null,
      facebook: data.facebook || null,
      profession: data.profession || null,
      workplace: data.workplace || null,
      category: data.category || null,
      income: data.income ?? null,
      requestedAmount: requestedAmount ?? data.requestedAmount ?? null,
      referral: data.referral ?? false,
      referralName: data.referral ? data.referralName || null : null,
      referralPhone: data.referral ? data.referralPhone || null : null,
      photo: data.photo || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      neighborhood: data.neighborhood || null,
      complement: data.complement || null,
      number: data.number || null,
      notes: data.notes || null,
      status: data.status ?? "INACTIVE",
      userId,
    }

    let client
    try {
      client = await prisma.client.create({ data: createData })
    } catch (error: any) {
      const isForeignKeyError = error?.code === "P2003"
      if (!isForeignKeyError || !userEmail) {
        throw error
      }

      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true },
      })
      if (!user?.id) {
        return NextResponse.json({ error: "Usuário da sessão não encontrado. Faça login novamente." }, { status: 401 })
      }

      userId = user.id
      client = await prisma.client.create({
        data: {
          ...createData,
          userId,
        },
      })
    }

    let createdLoan = null
    if (requestedAmount !== undefined && disappearedInterestRate !== undefined) {
      const installmentCount = 1
      const interestType = "PER_INSTALLMENT"
      const modality = "MONTHLY"
      const loanCalc = calculateLoan(requestedAmount, disappearedInterestRate, installmentCount, interestType)
      const contractDate = new Date()
      const firstInstallmentDate = new Date(contractDate)
      const dueDay = firstInstallmentDate.getDate()

      createdLoan = await prisma.loan.create({
        data: {
          clientId: client.id,
          userId,
          amount: requestedAmount,
          interestRate: disappearedInterestRate,
          interestType,
          modality,
          totalInterest: loanCalc.totalInterest,
          installmentValue: loanCalc.installmentAmount,
          totalAmount: loanCalc.totalAmount,
          profit: loanCalc.profit,
          installmentCount,
          contractDate,
          firstInstallmentDate,
          startDate: contractDate,
          dueDay,
          installments: {
            create: [
              {
                number: 1,
                amount: loanCalc.installmentAmount,
                dueDate: firstInstallmentDate,
              },
            ],
          },
        },
        include: {
          payments: {
            select: {
              amount: true,
              notes: true,
            },
          },
          installments: {
            select: {
              id: true,
              number: true,
              amount: true,
              paidAmount: true,
              status: true,
              dueDate: true,
            },
          },
        },
      })
    }

    return NextResponse.json(
      {
        ...client,
        loans: createdLoan ? [createdLoan] : [],
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("[POST /api/clients] Error:", error)
    if (error instanceof ZodError) {
      const msg = error.issues.map((i) => i.message).join(", ")
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || "Erro interno ao criar cliente" },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const parseProfileMeta = (companyDoc?: string | null) => {
  if (!companyDoc) return {}
  try {
    const parsed = JSON.parse(companyDoc)
    return typeof parsed === "object" && parsed ? parsed : {}
  } catch {
    return {}
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const userId = (session.user as any).id

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        companyDoc: true,
        pixKey: true,
        image: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const [clientsCountResult, loansResult] = await Promise.all([
      prisma.client.count({ where: { userId } }),
      prisma.loan.findMany({
        where: { userId },
        select: {
          amount: true,
          payments: { select: { amount: true } },
        },
      }),
    ])

    const clientsCount = Number(clientsCountResult || 0)
    const loans = loansResult || []

    const totalLoaned = loans.reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0)
    const totalReceived = loans.reduce(
      (sum: number, loan: any) =>
        sum + (loan.payments || []).reduce((acc: number, payment: any) => acc + Number(payment.amount || 0), 0),
      0
    )

    const meta: any = parseProfileMeta(user.companyDoc)
    const now = new Date()
    const defaultSubscriptionEnd = new Date(user.createdAt)
    defaultSubscriptionEnd.setDate(defaultSubscriptionEnd.getDate() + 30)
    const subscriptionEndsAt = meta.subscriptionEndsAt
      ? new Date(meta.subscriptionEndsAt)
      : defaultSubscriptionEnd
    const remainingDays = Math.max(
      0,
      Math.ceil((subscriptionEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    )

    return NextResponse.json({
      ...user,
      chargeName: meta.chargeName || user.companyName || "",
      paymentLink: meta.paymentLink || "",
      logoUrl: user.image || "",
      whatsappConnected: Boolean(meta.whatsappConnected),
      whatsappPairingCode: meta.whatsappPairingCode || "",
      whatsappPairingExpiresAt: meta.whatsappPairingExpiresAt || null,
      subscription: {
        plan: meta.plan || "Mensal",
        validUntil: subscriptionEndsAt.toISOString(),
        remainingDays,
      },
      stats: {
        totalClients: clientsCount,
        totalLoaned,
        totalReceived,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, phone, companyName, companyDoc, pixKey, password, chargeName, paymentLink, logoUrl, whatsappConnected, renewSubscription } = body

    const current = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { companyDoc: true },
    })
    const meta: any = parseProfileMeta(current?.companyDoc)
    const updateData: any = {}

    if (chargeName !== undefined) {
      meta.chargeName = String(chargeName || "")
      updateData.companyName = String(chargeName || "")
    }

    if (paymentLink !== undefined) {
      meta.paymentLink = String(paymentLink || "")
    }

    if (typeof whatsappConnected === "boolean") {
      meta.whatsappConnected = whatsappConnected
    }

    if (renewSubscription) {
      const now = new Date()
      const currentEnd = meta.subscriptionEndsAt ? new Date(meta.subscriptionEndsAt) : now
      const baseDate = currentEnd > now ? currentEnd : now
      baseDate.setDate(baseDate.getDate() + 30)
      meta.subscriptionEndsAt = baseDate.toISOString()
      meta.plan = meta.plan || "Mensal"
    }

    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (companyName !== undefined) updateData.companyName = companyName
    if (companyDoc !== undefined && !paymentLink && !chargeName && whatsappConnected === undefined && !renewSubscription) {
      updateData.companyDoc = companyDoc
    }
    if (pixKey !== undefined) updateData.pixKey = pixKey
    if (password) updateData.password = await bcrypt.hash(password, 12)
    if (logoUrl !== undefined) updateData.image = logoUrl

    updateData.companyDoc = JSON.stringify(meta)

    const user = await prisma.user.update({
      where: { id: (session.user as any).id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, companyName: true, pixKey: true, image: true, companyDoc: true },
    })

    return NextResponse.json(user)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

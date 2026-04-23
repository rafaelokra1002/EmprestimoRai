import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { clientSchema } from "@/lib/validations"
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
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 })
    }

    const client = await prisma.client.findFirst({
      where: { id: params.id, userId },
      include: {
        loans: {
          include: { installments: true, payments: true },
          orderBy: { createdAt: "desc" },
        },
        sales: { include: { saleInstallments: true } },
      },
    })

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    }

    return NextResponse.json(client)
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
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 })
    }

    const body = await request.json()

    // Strip empty strings to undefined before validation
    const sanitized = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [
        key,
        typeof value === "string" && value.trim() === "" ? undefined : value,
      ])
    )

    const data = clientSchema.parse(sanitized)

    const client = await prisma.client.updateMany({
      where: { id: params.id, userId },
      data: {
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
        requestedAmount: data.requestedAmount ?? null,
        referral: data.referral ?? false,
        photo: data.photo || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
        neighborhood: data.neighborhood || null,
        complement: data.complement || null,
        number: data.number || null,
        notes: data.notes || null,
        status: data.status ?? "ACTIVE",
      },
    })

    return NextResponse.json(client)
  } catch (error: any) {
    console.error("[PUT /api/clients/:id] Error:", error)
    if (error instanceof ZodError) {
      const msg = error.issues.map((i) => i.message).join(", ")
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || "Erro interno ao atualizar cliente" },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 })
    }

    const body = await request.json()

    // Only allow specific partial updates (e.g. score, status)
    const allowedFields: Record<string, any> = {}
    if (typeof body.score === "number") {
      allowedFields.score = Math.max(0, Math.min(200, body.score))
    }
    if (typeof body.status === "string" && ["ACTIVE", "INACTIVE", "DESAPARECIDO"].includes(body.status)) {
      allowedFields.status = body.status
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 })
    }

    const client = await prisma.client.updateMany({
      where: { id: params.id, userId },
      data: allowedFields,
    })

    return NextResponse.json(client)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
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
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 })
    }

    await prisma.client.deleteMany({
      where: { id: params.id, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

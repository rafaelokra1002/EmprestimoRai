import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { templateSchema } from "@/lib/validations"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const templates = await prisma.whatsAppTemplate.findMany({
      where: { userId: (session.user as any).id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(templates)
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
    const data = templateSchema.parse(body)

    const template = await prisma.whatsAppTemplate.create({
      data: {
        ...data,
        userId: (session.user as any).id,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

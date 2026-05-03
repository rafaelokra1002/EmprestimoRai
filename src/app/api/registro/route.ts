import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { token, name, phone, document, email, city, profession, income } = await request.json()

    if (!token || !name || !phone) {
      return NextResponse.json({ error: "Nome e telefone são obrigatórios" }, { status: 400 })
    }

    const userId = Buffer.from(token, "base64").toString("utf-8")

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Link de cadastro inválido" }, { status: 404 })
    }

    await prisma.client.create({
      data: {
        userId: user.id,
        name: name.trim(),
        phone: phone || null,
        document: document || null,
        email: email || null,
        city: city || null,
        profession: profession || null,
        income: income ? parseFloat(income) : null,
        status: "INACTIVE",
        score: 100,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao cadastrar" }, { status: 500 })
  }
}

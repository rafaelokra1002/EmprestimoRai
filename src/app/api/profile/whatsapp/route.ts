import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const parseProfileMeta = (companyDoc?: string | null) => {
  if (!companyDoc) return {}
  try {
    const parsed = JSON.parse(companyDoc)
    return typeof parsed === "object" && parsed ? parsed : {}
  } catch {
    return {}
  }
}

const randomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let index = 0; index < 8; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const action = String(body?.action || "")
    const userId = (session.user as any).id

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyDoc: true },
    })

    const meta: any = parseProfileMeta(current?.companyDoc)

    if (action === "start") {
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + 5)
      meta.whatsappConnected = false
      meta.whatsappPairingCode = randomCode()
      meta.whatsappPairingExpiresAt = expiresAt.toISOString()
    } else if (action === "confirm") {
      meta.whatsappConnected = true
      meta.whatsappPairingCode = ""
      meta.whatsappPairingExpiresAt = null
    } else if (action === "disconnect") {
      meta.whatsappConnected = false
      meta.whatsappPairingCode = ""
      meta.whatsappPairingExpiresAt = null
    } else {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        companyDoc: JSON.stringify(meta),
      },
    })

    return NextResponse.json({
      whatsappConnected: Boolean(meta.whatsappConnected),
      whatsappPairingCode: meta.whatsappPairingCode || "",
      whatsappPairingExpiresAt: meta.whatsappPairingExpiresAt || null,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

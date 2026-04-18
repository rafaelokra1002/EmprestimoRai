import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { whatsappService } from "@/lib/whatsapp-service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { phone, message } = body

    if (!phone || !message) {
      return NextResponse.json({ error: "Telefone e mensagem são obrigatórios" }, { status: 400 })
    }

    await whatsappService.sendMessage(phone, message)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

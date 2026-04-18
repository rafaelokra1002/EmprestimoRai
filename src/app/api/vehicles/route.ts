import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { vehicleSchema } from "@/lib/validations"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { userId: (session.user as any).id },
      include: { client: { select: { id: true, name: true, phone: true, email: true, document: true, rg: true, address: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(vehicles)
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
    const data = vehicleSchema.parse(body)

    const vehicle = await prisma.vehicle.create({
      data: {
        brand: data.brand,
        model: data.model,
        year: data.year,
        plate: data.plate,
        color: data.color,
        chassis: data.chassis,
        purchasePrice: data.purchasePrice,
        salePrice: data.salePrice,
        downPayment: data.downPayment || 0,
        installmentCount: data.installmentCount,
        modality: data.modality || "MONTHLY",
        saleDate: data.saleDate ? new Date(data.saleDate) : null,
        firstDueDate: data.firstDueDate ? new Date(data.firstDueDate) : null,
        originName: data.originName,
        buyerName: data.buyerName,
        buyerPhone: data.buyerPhone,
        buyerEmail: data.buyerEmail,
        buyerCpf: data.buyerCpf,
        buyerRg: data.buyerRg,
        buyerAddress: data.buyerAddress,
        whatsappNotify: data.whatsappNotify || false,
        notes: data.notes,
        paidAmount: data.downPayment || 0,
        sold: !!(data.salePrice && data.salePrice > 0),
        userId: (session.user as any).id,
        clientId: data.clientId || null,
      },
    })

    return NextResponse.json(vehicle, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()

    // Payment mode
    if (body.addPayment) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: params.id, userId: (session.user as any).id },
      })
      if (!vehicle) {
        return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 })
      }

      const newPaid = (vehicle.paidAmount || 0) + (body.addPayment || 0)
      const allPaid = vehicle.salePrice ? newPaid >= vehicle.salePrice : false

      const updated = await prisma.vehicle.update({
        where: { id: params.id },
        data: {
          paidAmount: newPaid,
          sold: allPaid ? true : vehicle.sold,
        },
      })
      return NextResponse.json(updated)
    }

    // Edit mode
    const vehicle = await prisma.vehicle.update({
      where: { id: params.id, userId: (session.user as any).id },
      data: {
        brand: body.brand,
        model: body.model,
        year: body.year,
        plate: body.plate,
        color: body.color,
        chassis: body.chassis,
        purchasePrice: body.purchasePrice,
        salePrice: body.salePrice,
        downPayment: body.downPayment,
        installmentCount: body.installmentCount,
        modality: body.modality,
        saleDate: body.saleDate ? new Date(body.saleDate) : null,
        firstDueDate: body.firstDueDate ? new Date(body.firstDueDate) : null,
        clientId: body.clientId || null,
        originName: body.originName,
        buyerName: body.buyerName,
        buyerPhone: body.buyerPhone,
        buyerEmail: body.buyerEmail,
        buyerCpf: body.buyerCpf,
        buyerRg: body.buyerRg,
        buyerAddress: body.buyerAddress,
        whatsappNotify: body.whatsappNotify,
        notes: body.notes,
      },
    })

    return NextResponse.json(vehicle)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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

    await prisma.vehicle.deleteMany({
      where: { id: params.id, userId: (session.user as any).id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Verify client belongs to user
    const client = await prisma.client.findFirst({
      where: { id: params.id, userId: (session.user as any).id },
    })

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const docId = searchParams.get("docId")

    if (docId) {
      const document = await prisma.clientDocument.findFirst({
        where: { id: docId, clientId: params.id },
        select: {
          id: true,
          name: true,
          type: true,
          fileType: true,
          fileData: true,
          createdAt: true,
        },
      })

      if (!document) {
        return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 })
      }

      return NextResponse.json(document)
    }

    const documents = await prisma.clientDocument.findMany({
      where: { clientId: params.id },
      select: {
        id: true,
        name: true,
        type: true,
        fileType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(documents)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Verify client belongs to user
    const client = await prisma.client.findFirst({
      where: { id: params.id, userId: (session.user as any).id },
    })

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    }

    const body = await request.json()
    const { name, type, fileData, fileType } = body

    if (!name || !fileData || !fileType) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const document = await prisma.clientDocument.create({
      data: {
        clientId: params.id,
        name,
        type: type || "OUTRO",
        fileData,
        fileType,
      },
    })

    return NextResponse.json({
      id: document.id,
      name: document.name,
      type: document.type,
      fileType: document.fileType,
      createdAt: document.createdAt,
    }, { status: 201 })
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

    const { searchParams } = new URL(request.url)
    const docId = searchParams.get("docId")

    if (!docId) {
      return NextResponse.json({ error: "ID do documento não informado" }, { status: 400 })
    }

    // Verify client belongs to user
    const client = await prisma.client.findFirst({
      where: { id: params.id, userId: (session.user as any).id },
    })

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    }

    await prisma.clientDocument.delete({
      where: { id: docId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

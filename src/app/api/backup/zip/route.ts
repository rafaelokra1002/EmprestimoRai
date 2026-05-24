import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import JSZip from "jszip"

export const runtime = "nodejs"

async function resolveSessionUserId(session: any) {
  const sessionUserId = (session?.user as any)?.id as string | undefined
  const sessionUserEmail = (session?.user as any)?.email as string | undefined
  if (sessionUserId) return sessionUserId
  if (!sessionUserEmail) return null
  const user = await prisma.user.findUnique({ where: { email: sessionUserEmail }, select: { id: true } })
  return user?.id ?? null
}

function sanitizeName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 60)
}

function fmtDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : ""
}

function fmtCurrency(value: number | null | undefined) {
  return value != null
    ? `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : ""
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") === "desaparecido" ? "desaparecido" : "clients"

    const clients = await prisma.client.findMany({
      where: { userId, ...(type === "desaparecido" ? { status: "DESAPARECIDO" } : {}) },
      include: {
        documents: true,
        loans: {
          include: { installments: true, payments: true },
        },
      },
      orderBy: { name: "asc" },
    })

    const zip = new JSZip()
    const clientesFolder = zip.folder("Clientes")!

    for (const client of clients) {
      const folderName = sanitizeName(client.name || `cliente-${client.id}`)
      const clientFolder = clientesFolder.folder(folderName)!

      // Dados do cliente em texto
      const statusMap: Record<string, string> = {
        ACTIVE: "Ativo",
        INACTIVE: "Inativo",
        DESAPARECIDO: "Desaparecido",
      }

      const lines: string[] = [
        `============================`,
        `  DADOS DO CLIENTE`,
        `============================`,
        `Nome:        ${client.name || ""}`,
        `CPF:         ${client.document || ""}`,
        `Telefone:    ${client.phone || ""}`,
        `Email:       ${client.email || ""}`,
        `Instagram:   ${client.instagram || ""}`,
        `Profissão:   ${client.profession || ""}`,
        `Renda:       ${fmtCurrency(client.income)}`,
        `Status:      ${statusMap[client.status] ?? client.status}`,
        `Membro desde: ${fmtDate(client.createdAt)}`,
        ``,
        `--- ENDEREÇO ---`,
        `CEP:         ${client.zipCode || ""}`,
        `Rua:         ${client.address || ""}`,
        `Número:      ${client.number || ""}`,
        `Bairro:      ${client.neighborhood || ""}`,
        `Complemento: ${client.complement || ""}`,
        `Cidade:      ${client.city || ""}`,
        `UF:          ${client.state || ""}`,
      ]

      if (client.loans.length > 0) {
        lines.push(``, `--- EMPRÉSTIMOS (${client.loans.length}) ---`)
        for (const loan of client.loans) {
          const paid = loan.payments.reduce((s, p) => s + Number(p.amount), 0)
          lines.push(
            ``,
            `  Contrato: ${fmtDate(loan.contractDate)}`,
            `  Valor:    ${fmtCurrency(loan.amount)}`,
            `  Total:    ${fmtCurrency(loan.totalAmount)}`,
            `  Pago:     ${fmtCurrency(paid)}`,
            `  Parcelas: ${loan.installments.filter(i => i.status === "PAID").length}/${loan.installmentCount}`,
            `  Status:   ${loan.status}`,
          )
        }
      }

      clientFolder.file("dados.txt", lines.join("\n"))

      // Fotos e documentos
      if (client.photo) {
        try {
          const base64 = client.photo.includes(",") ? client.photo.split(",")[1] : client.photo
          clientFolder.file("selfie.jpg", base64, { base64: true })
        } catch {}
      }

      if (client.documents.length > 0) {
        const docsFolder = clientFolder.folder("documentos")!
        for (const doc of client.documents) {
          try {
            const base64 = doc.fileData.includes(",") ? doc.fileData.split(",")[1] : doc.fileData
            const ext = doc.fileType?.includes("pdf") ? "pdf" : "jpg"
            const filename = `${sanitizeName(doc.name || doc.type)}.${ext}`
            docsFolder.file(filename, base64, { base64: true })
          } catch {}
        }
      }
    }

    const buffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" })
    const blob = new Blob([buffer], { type: "application/zip" })

    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const filename = `backup-${type}-${dateStr}.zip`

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao gerar backup ZIP" }, { status: 500 })
  }
}

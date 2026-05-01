import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { localDateStr } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

type BackupType = "clients" | "loans" | "installment-loans" | "contracts"

function parseBackupType(request: Request): BackupType {
  const { searchParams } = new URL(request.url)
  const value = searchParams.get("type")
  if (value === "clients" || value === "loans" || value === "installment-loans" || value === "contracts") {
    return value
  }
  return "clients"
}

function fmtDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : ""
}

function fmtCurrency(value: number | null | undefined) {
  return value != null ? `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""
}

function nextInstallment(installments: Array<{ dueDate: Date; status: string }>) {
  return installments
    .filter((item) => item.status !== "PAID")
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())[0]
}

async function buildPdfTable(userId: string, type: BackupType) {
  if (type === "clients") {
    const clients = await prisma.client.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })

    return {
      title: "Backup - Clientes",
      head: [["Cliente", "CPF", "Telefone", "Cidade", "Status", "Criado Em"]],
      body: clients.map((client) => [
        client.name,
        client.document || "",
        client.phone || "",
        client.city || "",
        client.status,
        fmtDate(client.createdAt),
      ]),
    }
  }

  const loans = await prisma.loan.findMany({
    where: {
      userId,
      ...(type === "loans" ? { installmentCount: { lte: 1 } } : {}),
      ...(type === "installment-loans" ? { installmentCount: { gt: 1 } } : {}),
    },
    include: {
      client: true,
      installments: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  })

  if (type === "contracts") {
    return {
      title: "Backup - Contratos",
      head: [["Cliente", "CPF", "Modalidade", "Parcelas", "Valor Principal", "Valor Total", "Data Contrato", "Primeiro Venc.", "Status"]],
      body: loans.map((loan) => [
        loan.client.name,
        loan.client.document || "",
        loan.modality,
        String(loan.installmentCount),
        fmtCurrency(loan.amount),
        fmtCurrency(loan.totalAmount),
        fmtDate(loan.contractDate),
        fmtDate(loan.firstInstallmentDate),
        loan.status,
      ]),
    }
  }

  if (type === "installment-loans") {
    return {
      title: "Backup - Empréstimos Parcelados",
      head: [["Cliente", "CPF", "Telefone", "Parcelas", "Valor Parcela", "Valor Total", "Pago", "Restante", "Próx. Venc.", "Status"]],
      body: loans.map((loan) => {
        const paid = loan.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0)
        const remaining = loan.totalAmount - paid
        const nextDue = nextInstallment(loan.installments)
        return [
          loan.client.name,
          loan.client.document || "",
          loan.client.phone || "",
          `${loan.installments.filter((item) => item.status === "PAID").length}/${loan.installmentCount}`,
          fmtCurrency(loan.installmentValue),
          fmtCurrency(loan.totalAmount),
          fmtCurrency(paid),
          fmtCurrency(remaining),
          nextDue ? fmtDate(nextDue.dueDate) : fmtDate(loan.firstInstallmentDate),
          loan.status,
        ]
      }),
    }
  }

  return {
    title: "Backup - Empréstimos",
    head: [["Cliente", "CPF", "Telefone", "Valor Principal", "Valor Final", "Restante", "Status", "Data Venc.", "Criado Em"]],
    body: loans.map((loan) => {
      const paid = loan.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0)
      const remaining = loan.totalAmount - paid
      const nextDue = nextInstallment(loan.installments)
      return [
        loan.client.name,
        loan.client.document || "",
        loan.client.phone || "",
        fmtCurrency(loan.amount),
        fmtCurrency(loan.totalAmount),
        fmtCurrency(remaining),
        loan.status,
        nextDue ? fmtDate(nextDue.dueDate) : fmtDate(loan.firstInstallmentDate),
        fmtDate(loan.createdAt),
      ]
    }),
  }
}

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

    const type = parseBackupType(request)
    const table = await buildPdfTable(userId, type)

    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(16)
    doc.text(table.title, 14, 15)
    doc.setFontSize(9)
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 22)

    autoTable(doc, {
      startY: 28,
      head: table.head,
      body: table.body,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    })

    const buf = Buffer.from(doc.output("arraybuffer"))
    const filename = `backup-${type}-${localDateStr()}.pdf`

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao gerar PDF" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

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

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const clients = await prisma.client.findMany({
      where: { userId },
      include: {
        loans: {
          include: {
            installments: true,
            payments: true,
          },
        },
      },
    })

    const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : ""
    const fmtCurrency = (v: number) => v != null ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""

    const rows: string[][] = []
    clients.forEach((c: any) => {
      if (c.loans && c.loans.length > 0) {
        c.loans.forEach((l: any) => {
          const paid = l.payments?.reduce((s: number, p: any) => s + (p.amount || 0), 0) || 0
          const remaining = l.totalAmount - paid
          const nextInst = l.installments
            ?.filter((i: any) => i.status !== "PAID")
            .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
          const status = l.status === "COMPLETED" ? "Pago" : l.status === "DEFAULTED" ? "Inadimplente" : "Ativo"

          rows.push([
            c.name,
            c.document || "",
            c.phone || "",
            fmtCurrency(l.amount),
            fmtCurrency(l.totalAmount),
            fmtCurrency(remaining),
            status,
            nextInst ? fmtDate(nextInst.dueDate) : fmtDate(l.firstInstallmentDate),
            fmtDate(l.createdAt),
          ])
        })
      } else {
        rows.push([
          c.name,
          c.document || "",
          c.phone || "",
          "",
          "",
          "",
          "",
          "",
          fmtDate(c.createdAt),
        ])
      }
    })

    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(16)
    doc.text("Backup - Relatório de Empréstimos", 14, 15)
    doc.setFontSize(9)
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 22)

    autoTable(doc, {
      startY: 28,
      head: [["Cliente", "CPF", "Telefone", "Valor Principal", "Valor Final", "Valor Restante", "Status", "Data Vencimento", "Data Criação"]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 40 },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "center" },
        7: { halign: "center" },
        8: { halign: "center" },
      },
    })

    const buf = Buffer.from(doc.output("arraybuffer"))
    const filename = `backup-${new Date().toISOString().split("T")[0]}.pdf`

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

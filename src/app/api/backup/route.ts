import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

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
        sales: true,
        vehicles: true,
      },
    })

    const expenses = await prisma.expense.findMany({ where: { userId } })

    const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : ""
    const fmtCurrency = (v: number) => v != null ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""

    // Formato flat: cada empréstimo é uma linha com dados do cliente
    const rows: any[] = []
    clients.forEach((c: any) => {
      if (c.loans && c.loans.length > 0) {
        c.loans.forEach((l: any) => {
          const paid = l.payments?.reduce((s: number, p: any) => s + (p.amount || 0), 0) || 0
          const remaining = l.totalAmount - paid
          const nextInst = l.installments
            ?.filter((i: any) => i.status !== "PAID")
            .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
          const status = l.status === "COMPLETED" ? "Pago" : l.status === "DEFAULTED" ? "Inadimplente" : "Ativo"

          rows.push({
            Cliente: c.name,
            CPF: c.document || "",
            Telefone: c.phone || "",
            "Valor Principal": fmtCurrency(l.amount),
            "Valor Final": fmtCurrency(l.totalAmount),
            "Valor Restante": fmtCurrency(remaining),
            Status: status,
            "Data Vencimento": nextInst ? fmtDate(nextInst.dueDate) : fmtDate(l.firstInstallmentDate),
            "Data Criação": fmtDate(l.createdAt),
          })
        })
      } else {
        rows.push({
          Cliente: c.name,
          CPF: c.document || "",
          Telefone: c.phone || "",
          "Valor Principal": "",
          "Valor Final": "",
          "Valor Restante": "",
          Status: "",
          "Data Vencimento": "",
          "Data Criação": fmtDate(c.createdAt),
        })
      }
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}])

    // Definir largura das colunas
    ws["!cols"] = [
      { wch: 30 }, // Cliente
      { wch: 18 }, // CPF
      { wch: 18 }, // Telefone
      { wch: 18 }, // Valor Principal
      { wch: 18 }, // Valor Final
      { wch: 18 }, // Valor Restante
      { wch: 14 }, // Status
      { wch: 18 }, // Data Vencimento
      { wch: 18 }, // Data Criação
    ]

    // Habilitar filtro automático nas colunas
    ws["!autofilter"] = { ref: `A1:I${rows.length + 1}` }

    XLSX.utils.book_append_sheet(wb, ws, "Backup")

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    const filename = `backup-${new Date().toISOString().split("T")[0]}.xlsx`

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao gerar backup" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const backup = await request.json()

    if (!backup || !backup.clients || !Array.isArray(backup.clients)) {
      return NextResponse.json({ error: "Arquivo de backup inválido" }, { status: 400 })
    }

    // Delete existing data
    await prisma.payment.deleteMany({ where: { loan: { client: { userId } } } })
    await prisma.installment.deleteMany({ where: { loan: { client: { userId } } } })
    await prisma.loan.deleteMany({ where: { client: { userId } } })
    await prisma.sale.deleteMany({ where: { client: { userId } } })
    await prisma.vehicle.deleteMany({ where: { client: { userId } } })
    await prisma.client.deleteMany({ where: { userId } })
    await prisma.expense.deleteMany({ where: { userId } })

    // Restore clients with related data
    for (const client of backup.clients) {
      const { loans, sales, vehicles, documents, ...clientData } = client
      const createdClient = await prisma.client.create({
        data: {
          ...clientData,
          id: undefined,
          userId,
          createdAt: new Date(clientData.createdAt),
          updatedAt: new Date(clientData.updatedAt),
        },
      })

      if (loans) {
        for (const loan of loans) {
          const { installments, payments, ...loanData } = loan
          const createdLoan = await prisma.loan.create({
            data: {
              ...loanData,
              id: undefined,
              clientId: createdClient.id,
              createdAt: new Date(loanData.createdAt),
              updatedAt: new Date(loanData.updatedAt),
              startDate: new Date(loanData.startDate),
              contractDate: loanData.contractDate ? new Date(loanData.contractDate) : null,
              firstInstallmentDate: loanData.firstInstallmentDate ? new Date(loanData.firstInstallmentDate) : null,
            },
          })

          if (installments) {
            for (const inst of installments) {
              await prisma.installment.create({
                data: {
                  ...inst,
                  id: undefined,
                  loanId: createdLoan.id,
                  dueDate: new Date(inst.dueDate),
                  paidAt: inst.paidAt ? new Date(inst.paidAt) : null,
                },
              })
            }
          }

          if (payments) {
            for (const payment of payments) {
              await prisma.payment.create({
                data: {
                  ...payment,
                  id: undefined,
                  loanId: createdLoan.id,
                  paidAt: new Date(payment.paidAt),
                  createdAt: new Date(payment.createdAt),
                },
              })
            }
          }
        }
      }

      if (sales) {
        for (const sale of sales) {
          await prisma.sale.create({
            data: {
              ...sale,
              id: undefined,
              clientId: createdClient.id,
              createdAt: new Date(sale.createdAt),
              updatedAt: new Date(sale.updatedAt),
            },
          })
        }
      }

      if (vehicles) {
        for (const vehicle of vehicles) {
          await prisma.vehicle.create({
            data: {
              ...vehicle,
              id: undefined,
              clientId: createdClient.id,
              createdAt: new Date(vehicle.createdAt),
              updatedAt: new Date(vehicle.updatedAt),
            },
          })
        }
      }
    }

    // Restore expenses
    if (backup.expenses) {
      for (const expense of backup.expenses) {
        await prisma.expense.create({
          data: {
            ...expense,
            id: undefined,
            userId,
            createdAt: new Date(expense.createdAt),
            updatedAt: new Date(expense.updatedAt),
            dueDate: expense.dueDate ? new Date(expense.dueDate) : null,
            paidAt: expense.paidAt ? new Date(expense.paidAt) : null,
          },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao restaurar backup" }, { status: 500 })
  }
}

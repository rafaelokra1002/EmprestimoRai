import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { localDateStr } from "@/lib/utils"
import * as XLSX from "xlsx"

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

function buildSheetName(type: BackupType) {
  if (type === "clients") return "Clientes"
  if (type === "loans") return "Emprestimos"
  if (type === "installment-loans") return "Emprestimos Parcelados"
  return "Contratos"
}

async function buildRows(userId: string, type: BackupType) {
  if (type === "clients") {
    const clients = await prisma.client.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })

    return clients.map((client) => ({
      Cliente: client.name,
      CPF: client.document || "",
      Telefone: client.phone || "",
      Cidade: client.city || "",
      Status: client.status,
      "Criado Em": fmtDate(client.createdAt),
    }))
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
    return loans.map((loan) => ({
      Cliente: loan.client.name,
      CPF: loan.client.document || "",
      Modalidade: loan.modality,
      Parcelas: loan.installmentCount,
      "Valor Principal": fmtCurrency(loan.amount),
      "Valor Total": fmtCurrency(loan.totalAmount),
      "Data Contrato": fmtDate(loan.contractDate),
      "Primeiro Vencimento": fmtDate(loan.firstInstallmentDate),
      Status: loan.status,
    }))
  }

  if (type === "installment-loans") {
    return loans.map((loan) => {
      const paid = loan.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0)
      const remaining = loan.totalAmount - paid
      const nextDue = nextInstallment(loan.installments)
      return {
        Cliente: loan.client.name,
        CPF: loan.client.document || "",
        Telefone: loan.client.phone || "",
        Parcelas: `${loan.installments.filter((item) => item.status === "PAID").length}/${loan.installmentCount}`,
        "Valor Parcela": fmtCurrency(loan.installmentValue),
        "Valor Total": fmtCurrency(loan.totalAmount),
        Pago: fmtCurrency(paid),
        Restante: fmtCurrency(remaining),
        "Proximo Vencimento": nextDue ? fmtDate(nextDue.dueDate) : fmtDate(loan.firstInstallmentDate),
        Status: loan.status,
      }
    })
  }

  return loans.map((loan) => {
    const paid = loan.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0)
    const remaining = loan.totalAmount - paid
    const nextDue = nextInstallment(loan.installments)
    return {
      Cliente: loan.client.name,
      CPF: loan.client.document || "",
      Telefone: loan.client.phone || "",
      "Valor Principal": fmtCurrency(loan.amount),
      "Valor Final": fmtCurrency(loan.totalAmount),
      Restante: fmtCurrency(remaining),
      Status: loan.status,
      "Data Vencimento": nextDue ? fmtDate(nextDue.dueDate) : fmtDate(loan.firstInstallmentDate),
      "Criado Em": fmtDate(loan.createdAt),
    }
  })
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
    const rows = await buildRows(userId, type)

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}])

    const headers = Object.keys(rows[0] || { Registro: "" })
    ws["!cols"] = headers.map((header) => ({ wch: Math.max(16, header.length + 4) }))
    const endColumn = XLSX.utils.encode_col(Math.max(0, headers.length - 1))
    ws["!autofilter"] = { ref: `A1:${endColumn}${rows.length + 1}` }

    XLSX.utils.book_append_sheet(wb, ws, buildSheetName(type))

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    const filename = `backup-${type}-${localDateStr()}.xlsx`

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

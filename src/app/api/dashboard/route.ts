import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildLoanData, getOverdueDailyAmountBRL } from "@/lib/loan-logic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const userId = (session.user as any).id

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const startOfWeek = new Date(startOfToday)
    const day = startOfWeek.getDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday)
    const startOfPrevWeek = new Date(startOfWeek)
    startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7)
    const endOfPrevWeek = new Date(startOfWeek)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 7)
    const thirtyDaysAgo = new Date(startOfToday)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [loansResult, overdueCountResult, overdueAmountResult, dueTodayCountResult, activeClientsResult, inactiveClientsResult, totalClientsResult, salesResult, vehiclesResult, monthlyExpensesResult] = await Promise.all([
      prisma.loan.findMany({
        where: { userId, status: "ACTIVE", client: { status: { not: "DESAPARECIDO" } } },
        include: { installments: true, payments: true, client: { select: { name: true } } },
      }),
      prisma.installment.count({
        where: {
          loan: { userId, client: { status: { not: "DESAPARECIDO" } } },
          status: { not: "PAID" },
          dueDate: { lt: startOfToday },
        },
      }),
      prisma.installment.aggregate({
        where: {
          loan: { userId, client: { status: { not: "DESAPARECIDO" } } },
          status: { not: "PAID" },
          dueDate: { lt: startOfToday },
        },
        _sum: { amount: true },
      }),
      prisma.installment.count({
        where: {
          loan: { userId, client: { status: { not: "DESAPARECIDO" } } },
          status: "PENDING",
          dueDate: { gte: startOfToday, lt: endOfToday },
        },
      }),
      prisma.client.count({ where: { userId, status: "ACTIVE" } }),
      prisma.client.count({ where: { userId, status: "INACTIVE" } }),
      prisma.client.count({ where: { userId, status: { not: "DESAPARECIDO" } } }),
      prisma.sale.findMany({ where: { userId }, select: { id: true } }),
      prisma.vehicle.findMany({ where: { userId }, select: { id: true } }),
      prisma.expense.aggregate({
        where: { userId, dueDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
    ])

    const loans = loansResult || []
    const monthlyExpenses = Number(monthlyExpensesResult._sum.amount || 0)
    const overdueCount = Number(overdueCountResult || 0)
    const overdueAmount = Number(overdueAmountResult._sum.amount || 0)
    const dueTodayCount = Number(dueTodayCountResult || 0)
    const activeClients = Number(activeClientsResult || 0)
    const inactiveClients = Number(inactiveClientsResult || 0)
    const totalClients = Number(totalClientsResult || 0)
    const sales = salesResult || []
    const vehicles = vehiclesResult || []

    const totalPrincipal = loans.reduce((acc, loan) => acc + Number(loan.amount || 0), 0)
    const totalToReceive = loans.reduce((acc, loan) => acc + Number(loan.totalAmount || 0), 0)
    const totalReceived = loans.reduce(
      (acc, loan) =>
        acc +
        loan.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      0
    )
    const dueTodayInstallments = loans.flatMap((loan) =>
      loan.installments
        .filter(
          (inst) =>
            inst.status !== "PAID" &&
            new Date(inst.dueDate) >= startOfToday &&
            new Date(inst.dueDate) < endOfToday
        )
        .map((inst) => ({ clientId: loan.clientId, amount: Number(inst.amount || 0) }))
    )
    const dueTodayAmount = dueTodayInstallments.reduce((acc, item) => acc + item.amount, 0)
    const dueTodayClients = new Set(dueTodayInstallments.map((item) => item.clientId)).size
    // Vencem esta semana (de hoje até fim da semana)
    const dueThisWeekInstallments = loans.flatMap((loan) =>
      loan.installments
        .filter((inst) => inst.status === "PENDING" && new Date(inst.dueDate) >= startOfToday && new Date(inst.dueDate) < endOfWeek)
        .map((inst) => Number(inst.amount || 0))
    )
    const dueThisWeekCount = dueThisWeekInstallments.length
    const dueThisWeekAmount = dueThisWeekInstallments.reduce((s, a) => s + a, 0)

    // Atrasados há +30 dias (clientes únicos)
    const overdue30DaysLoans = loans.filter((loan) =>
      loan.installments.some((inst) => inst.status !== "PAID" && new Date(inst.dueDate) < thirtyDaysAgo)
    )
    const overdue30DaysCount = new Set(overdue30DaysLoans.map((l) => l.clientId)).size
    const overdue30DaysAmount = overdue30DaysLoans.flatMap((loan) =>
      loan.installments.filter((inst) => inst.status !== "PAID" && new Date(inst.dueDate) < thirtyDaysAgo).map((inst) => Number(inst.amount || 0))
    ).reduce((s, a) => s + a, 0)

    const capitalOnStreet = Math.max(totalToReceive - totalReceived, 0)
    const totalProfit = loans.reduce((acc, loan) => acc + Number(loan.profit || 0), 0)

    const pendingInterest = totalProfit

    // Multas de atraso: juros diários acumulados + penaltyFee por parcela vencida não paga
    const totalPendingLateFees = loans.reduce((acc, loan) => {
      const loanData = buildLoanData({
        amount: Number(loan.amount),
        interestRate: Number(loan.interestRate),
        interestType: loan.interestType,
        totalAmount: Number(loan.totalAmount),
        dailyInterest: loan.dailyInterest,
        dailyInterestAmount: Number(loan.dailyInterestAmount || 0),
        dueDay: loan.dueDay ?? undefined,
        modality: loan.modality,
        firstInstallmentDate: loan.firstInstallmentDate,
        installments: loan.installments.map((i) => ({
          number: i.number,
          dueDate: i.dueDate,
          status: i.status,
          amount: Number(i.amount),
          paidAmount: Number((i as any).paidAmount || 0),
        })),
        payments: loan.payments.map((p) => ({ amount: Number(p.amount), notes: p.notes })),
      })
      const dailyRate = getOverdueDailyAmountBRL(loanData)
      return acc + loan.installments
        .filter((i) => i.status !== "PAID" && new Date(i.dueDate) < startOfToday)
        .reduce((sum, i) => {
          const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0)
          const daysOver = Math.max(0, Math.floor((startOfToday.getTime() - due.getTime()) / 86400000))
          return sum + dailyRate * daysOver + Number(loan.penaltyFee || 0)
        }, 0)
    }, 0)

    // Valores diários em atraso por empréstimo
    const overdueByLoan = loans
      .map((loan) => {
        const loanData = buildLoanData({
          amount: Number(loan.amount),
          interestRate: Number(loan.interestRate),
          interestType: loan.interestType,
          totalAmount: Number(loan.totalAmount),
          dailyInterest: loan.dailyInterest,
          dailyInterestAmount: Number(loan.dailyInterestAmount || 0),
          dueDay: loan.dueDay ?? undefined,
          modality: loan.modality,
          firstInstallmentDate: loan.firstInstallmentDate,
          installments: loan.installments.map((i) => ({
            number: i.number,
            dueDate: i.dueDate,
            status: i.status,
            amount: Number(i.amount),
            paidAmount: Number((i as any).paidAmount || 0),
          })),
          payments: loan.payments.map((p) => ({ amount: Number(p.amount), notes: p.notes })),
        })
        const dailyRate = getOverdueDailyAmountBRL(loanData)
        const overdueInstallments = loan.installments.filter(
          (i) => i.status !== "PAID" && new Date(i.dueDate) < startOfToday
        )
        if (overdueInstallments.length === 0) return null
        const totalCharge = overdueInstallments.reduce((sum, i) => {
          const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0)
          const daysOver = Math.max(0, Math.floor((startOfToday.getTime() - due.getTime()) / 86400000))
          return sum + dailyRate * daysOver + Number(loan.penaltyFee || 0)
        }, 0)
        return {
          clientName: loan.client?.name || "—",
          dailyRate,
          totalCharge,
          overdueCount: overdueInstallments.length,
        }
      })
      .filter(Boolean) as { clientName: string; dailyRate: number; totalCharge: number; overdueCount: number }[]

    // Parcelas pendentes agrupadas por dia do mês
    const dayMap = new Map<number, number>()
    loans.forEach((loan) => {
      loan.installments
        .filter((inst) => inst.status !== "PAID")
        .forEach((inst) => {
          const day = new Date(inst.dueDate).getDate()
          dayMap.set(day, (dayMap.get(day) || 0) + Number(inst.amount || 0))
        })
    })
    const paymentsByDay = Array.from(dayMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, amount]) => ({ day, amount }))

    // Próximos 7 dias com vencimentos
    const dueNextSevenDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfToday)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      const items = loans.flatMap((loan) =>
        loan.installments
          .filter((inst) => {
            const due = new Date(inst.dueDate)
            return inst.status !== "PAID" && due >= dayStart && due < dayEnd
          })
          .map((inst) => ({
            clientName: loan.client?.name || "—",
            installmentNumber: inst.number,
            installmentCount: loan.installmentCount,
            amount: Number(inst.amount || 0),
            loanId: loan.id,
          }))
      )
      return { date: dateStr, count: items.length, amount: items.reduce((s, it) => s + it.amount, 0), items }
    })

    // Juros efetivamente recebidos neste mês
    const monthlyReceivedInterest = loans.reduce((acc, loan) => {
      const loanTotal = Number(loan.totalAmount || 0)
      const loanProfit = Number(loan.profit || 0)
      if (loanTotal <= 0) return acc
      const interestRatio = loanProfit / loanTotal
      return acc + loan.payments
        .filter((p) => {
          const d = new Date(p.date)
          return d >= startOfMonth && d <= endOfMonth
        })
        .reduce((sum, p) => {
          const notes = (p.notes || "").toLowerCase()
          const isSoJuros = notes.includes("só juros") || notes.includes("parcial de juros")
          return sum + (isSoJuros ? Number(p.amount) : Number(p.amount) * interestRatio)
        }, 0)
    }, 0)

    const activeInstallments = loans.reduce(
      (acc, loan) => acc + loan.installments.filter((inst) => inst.status !== "PAID").length,
      0
    )

    const contractsThisWeek = loans.filter((loan) => new Date(loan.createdAt) >= startOfWeek).length
    const contractsPrevWeek = loans.filter((loan) => {
      const createdAt = new Date(loan.createdAt)
      return createdAt >= startOfPrevWeek && createdAt < endOfPrevWeek
    }).length

    const receivedThisWeek = loans.reduce((acc, loan) => {
      const weeklyFromLoan = loan.payments
        .filter((payment) => new Date(payment.date) >= startOfWeek)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
      return acc + weeklyFromLoan
    }, 0)
    const receivedPrevWeek = loans.reduce((acc, loan) => {
      const weeklyFromLoan = loan.payments
        .filter((payment) => {
          const paymentDate = new Date(payment.date)
          return paymentDate >= startOfPrevWeek && paymentDate < endOfPrevWeek
        })
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
      return acc + weeklyFromLoan
    }, 0)

    const toPercentDelta = (current: number, previous: number) => {
      if (previous <= 0) {
        return current > 0 ? 100 : 0
      }
      return ((current - previous) / previous) * 100
    }

    const monthKey = (date: Date) => date.getFullYear() * 12 + date.getMonth()
    const currentMonthKey = monthKey(now)
    const monthlyData = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return {
        month: date.toLocaleString("pt-BR", { month: "short" }),
        emprestado: 0,
        recebido: 0,
      }
    })

    loans.forEach((loan) => {
      const idx = 5 - (currentMonthKey - monthKey(new Date(loan.createdAt)))
      if (idx >= 0 && idx < 6) {
        monthlyData[idx].emprestado += Number(loan.amount || 0)
      }

      loan.payments.forEach((payment) => {
        const paymentIdx = 5 - (currentMonthKey - monthKey(new Date(payment.date)))
        if (paymentIdx >= 0 && paymentIdx < 6) {
          monthlyData[paymentIdx].recebido += Number(payment.amount || 0)
        }
      })
    })

    const interestBuckets = Array.from({ length: 6 }, (_, index) => ({
      month: monthlyData[index].month,
      juros: 0,
    }))

    loans.forEach((loan) => {
      const idx = 5 - (currentMonthKey - monthKey(new Date(loan.createdAt)))
      if (idx >= 0 && idx < 6) {
        interestBuckets[idx].juros += Number(loan.profit || 0)
      }
    })

    const interestTrend = interestBuckets

    const collectionRate = totalToReceive > 0 ? (totalReceived / totalToReceive) * 100 : 0
    const defaultRate = activeInstallments > 0 ? (overdueCount / activeInstallments) * 100 : 0
    const healthScore = Math.round(
      Math.max(
        0,
        Math.min(100, 60 + collectionRate * 0.3 - defaultRate * 1.5 - dueTodayCount * 0.2)
      )
    )

    const alerts = [
      overdueCount > 0
        ? {
            title: "Parcelas em atraso",
            description: `${overdueCount} parcela(s) pendente(s) fora do prazo`,
            severity: "high",
          }
        : null,
      dueTodayCount > 0
        ? {
            title: "Vencimentos de hoje",
            description: `${dueTodayCount} parcela(s) vencem hoje`,
            severity: "medium",
          }
        : null,
      collectionRate < 50 && totalToReceive > 0
        ? {
            title: "Baixa recuperação",
            description: `Taxa de recebimento em ${collectionRate.toFixed(1)}%`,
            severity: "medium",
          }
        : null,
    ].filter(Boolean)

    return NextResponse.json({
      totalPrincipal,
      totalToReceive,
      totalReceived,
      capitalOnStreet,
      totalProfit,
      overdueCount,
      overdueAmount,
      inactiveClients,
      activeClients,
      monthlyData,
      totalLoans: loans.length,
      weeklySummary: {
        contractsThisWeek,
        receivedThisWeek,
        dueToday: dueTodayCount,
        dueTodayAmount,
        dueTodayClients,
        deltas: {
          contractsPct: toPercentDelta(contractsThisWeek, contractsPrevWeek),
          receivedPct: toPercentDelta(receivedThisWeek, receivedPrevWeek),
        },
      },
      counters: {
        activeLoans: loans.length,
        totalContracts: loans.length,
        totalClients,
        activeClients,
        totalSales: sales.length,
        totalVehicles: vehicles.length,
      },
      financials: {
        pendingInterest,
        monthlyExpenses,
        monthlyReceivedInterest,
      },
      charts: {
        interestTrend,
      },
      operationHealth: {
        score: healthScore,
        collectionRate,
        defaultRate,
      },
      alerts,
      dueThisWeekCount,
      dueThisWeekAmount,
      overdue30DaysCount,
      overdue30DaysAmount,
      dueNextSevenDays,
      totalPendingLateFees,
      overdueByLoan,
      paymentsByDay,
      updatedAt: now.toISOString(),
    })
  } catch (error: any) {
    console.error("GET /api/dashboard error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

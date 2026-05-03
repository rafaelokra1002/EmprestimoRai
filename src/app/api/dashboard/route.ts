import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    const [loansResult, overdueCountResult, dueTodayCountResult, activeClientsResult, totalClientsResult, salesResult, vehiclesResult, monthlyExpensesResult] = await Promise.all([
      prisma.loan.findMany({
        where: { userId, status: "ACTIVE" },
        include: { installments: true, payments: true },
      }),
      prisma.installment.count({
        where: {
          loan: { userId },
          status: "PENDING",
          dueDate: { lt: startOfToday },
        },
      }),
      prisma.installment.count({
        where: {
          loan: { userId },
          status: "PENDING",
          dueDate: { gte: startOfToday, lt: endOfToday },
        },
      }),
      prisma.client.count({ where: { userId, status: "ACTIVE" } }),
      prisma.client.count({ where: { userId } }),
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
    const dueTodayCount = Number(dueTodayCountResult || 0)
    const activeClients = Number(activeClientsResult || 0)
    const totalClients = Number(totalClientsResult || 0)
    const sales = salesResult || []
    const vehicles = vehiclesResult || []

    const totalToReceive = loans.reduce((acc, loan) => acc + Number(loan.totalAmount || 0), 0)
    const totalReceived = loans.reduce(
      (acc, loan) =>
        acc +
        loan.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      0
    )
    const capitalOnStreet = Math.max(totalToReceive - totalReceived, 0)
    const totalProfit = loans.reduce((acc, loan) => acc + Number(loan.profit || 0), 0)

    const totalPrincipal = loans.reduce((acc, loan) => acc + Number(loan.amount || 0), 0)
    // Juros a receber: para cada empréstimo, calcula o juros pendente proporcionalmente
    const pendingInterest = loans.reduce((acc, loan) => {
      const loanTotal = Number(loan.totalAmount || 0)
      const loanProfit = Number(loan.profit || 0)
      const loanPaid = loan.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
      const remaining = Math.max(loanTotal - loanPaid, 0)
      if (loanTotal <= 0) return acc
      // Proporção de juros no que falta receber
      const interestRatio = loanProfit / loanTotal
      return acc + remaining * interestRatio
    }, 0)

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
      (acc, loan) => acc + loan.installments.filter((inst) => inst.status === "PENDING").length,
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
      totalToReceive,
      totalReceived,
      capitalOnStreet,
      totalProfit,
      overdueCount,
      activeClients,
      monthlyData,
      totalLoans: loans.length,
      weeklySummary: {
        contractsThisWeek,
        receivedThisWeek,
        dueToday: dueTodayCount,
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
      updatedAt: now.toISOString(),
    })
  } catch (error: any) {
    console.error("GET /api/dashboard error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

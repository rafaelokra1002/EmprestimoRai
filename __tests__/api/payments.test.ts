/**
 * Tests for API: /api/payments
 */
import { mockPrisma, mockSession } from "./__mocks__"
import { getServerSession } from "next-auth"
import { POST } from "@/app/api/payments/route"

const getServerSessionMock = getServerSession as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("POST /api/payments", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const req = new Request("http://localhost:3000/api/payments", {
      method: "POST",
      body: JSON.stringify({ loanId: "l1", amount: 100, date: "2025-03-10" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 for missing required fields", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const req = new Request("http://localhost:3000/api/payments", {
      method: "POST",
      body: JSON.stringify({ loanId: "l1" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Dados incompletos")
  })

  it("creates a payment with valid data", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const payment = { id: "pay1", loanId: "l1", amount: 200, date: new Date() }
    mockPrisma.payment.create.mockResolvedValue(payment)
    mockPrisma.installment.findMany.mockResolvedValue([])

    const req = new Request("http://localhost:3000/api/payments", {
      method: "POST",
      body: JSON.stringify({
        loanId: "l1",
        amount: 200,
        date: "2025-03-10",
      }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loanId: "l1",
          amount: 200,
        }),
      })
    )
  })

  it("updates installment when installmentId is provided", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    mockPrisma.payment.create.mockResolvedValue({ id: "pay2" })
    mockPrisma.installment.findUnique.mockResolvedValue({
      id: "inst1",
      amount: 200,
      paidAmount: 0,
      dueDate: new Date("2025-12-31"),
    })
    mockPrisma.installment.update.mockResolvedValue({})
    mockPrisma.loan.findUnique.mockResolvedValue({ clientId: "c1" })
    mockPrisma.client.update.mockResolvedValue({})
    mockPrisma.installment.findMany.mockResolvedValue([
      { status: "PAID" },
    ])

    const req = new Request("http://localhost:3000/api/payments", {
      method: "POST",
      body: JSON.stringify({
        loanId: "l1",
        amount: 200,
        date: "2025-03-10",
        installmentId: "inst1",
      }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockPrisma.installment.update).toHaveBeenCalled()
  })

  it("does not add tagged late fee to installment paidAmount", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    mockPrisma.payment.create.mockResolvedValue({ id: "pay3" })
    mockPrisma.installment.findUnique.mockResolvedValue({
      id: "inst1",
      amount: 500,
      paidAmount: 100,
      dueDate: new Date("2025-03-01"),
    })
    mockPrisma.installment.update.mockResolvedValue({})
    mockPrisma.loan.findUnique.mockResolvedValue({ clientId: "c1" })
    mockPrisma.client.update.mockResolvedValue({})
    mockPrisma.installment.findMany.mockResolvedValue([
      { status: "PENDING" },
    ])

    const req = new Request("http://localhost:3000/api/payments", {
      method: "POST",
      body: JSON.stringify({
        loanId: "l1",
        amount: 911.63,
        date: "2026-05-05",
        installmentId: "inst1",
        notes: "Parcela 2 de 4 [lateFee:450.00][dailyFee:450.00]",
      }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(mockPrisma.installment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inst1" },
        data: expect.objectContaining({
          paidAmount: 111.63,
          status: "PENDING",
        }),
      })
    )
  })
})

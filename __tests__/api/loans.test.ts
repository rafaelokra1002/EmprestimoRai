/**
 * Tests for API: /api/loans
 */
import { mockPrisma, mockSession } from "./__mocks__"
import { getServerSession } from "next-auth"
import { GET, POST } from "@/app/api/loans/route"

const getServerSessionMock = getServerSession as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/loans", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns loans for authenticated user", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const loans = [
      {
        id: "loan1",
        amount: 1000,
        totalAmount: 1100,
        client: { id: "c1", name: "João" },
        installments: [],
        payments: [],
      },
    ]
    mockPrisma.loan.findMany.mockResolvedValue(loans)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].amount).toBe(1000)
  })

  it("queries with correct userId", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    mockPrisma.loan.findMany.mockResolvedValue([])

    await GET()
    expect(mockPrisma.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-test-123" },
      })
    )
  })
})

describe("POST /api/loans", () => {
  const validLoan = {
    clientId: "client-1",
    amount: 1000,
    interestRate: 10,
    installmentCount: 5,
    interestType: "PER_INSTALLMENT",
    modality: "MONTHLY",
    contractDate: "2025-01-15",
    firstInstallmentDate: "2025-02-15",
  }

  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const req = new Request("http://localhost:3000/api/loans", {
      method: "POST",
      body: JSON.stringify(validLoan),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("creates a loan with valid data", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const createdLoan = { id: "loan-new", ...validLoan, totalAmount: 1500 }
    mockPrisma.loan.create.mockResolvedValue(createdLoan)
    mockPrisma.installment.createMany.mockResolvedValue({ count: 5 })

    const req = new Request("http://localhost:3000/api/loans", {
      method: "POST",
      body: JSON.stringify(validLoan),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockPrisma.loan.create).toHaveBeenCalled()
  })

  it("returns 400 for invalid data", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const req = new Request("http://localhost:3000/api/loans", {
      method: "POST",
      body: JSON.stringify({ amount: 0 }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

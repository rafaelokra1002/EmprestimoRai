/**
 * Tests for API: /api/clients
 */
import { mockPrisma, mockSession } from "./__mocks__"
import { getServerSession } from "next-auth"
import { GET, POST } from "@/app/api/clients/route"

const getServerSessionMock = getServerSession as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/clients", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const req = new Request("http://localhost:3000/api/clients")
    const res = await GET(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it("returns clients for authenticated user", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const clients = [
      { id: "c1", name: "João", loans: [] },
      { id: "c2", name: "Maria", loans: [] },
    ]
    mockPrisma.client.findMany.mockResolvedValue(clients)

    const req = new Request("http://localhost:3000/api/clients")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
    expect(data[0].name).toBe("João")
  })

  it("queries with correct userId", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    mockPrisma.client.findMany.mockResolvedValue([])

    const req = new Request("http://localhost:3000/api/clients")
    await GET(req)
    expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-test-123" },
      })
    )
  })
})

describe("POST /api/clients", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const req = new Request("http://localhost:3000/api/clients", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("creates a client with valid data", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const newClient = { id: "new-c1", name: "Carlos", userId: "user-test-123" }
    mockPrisma.client.create.mockResolvedValue(newClient)

    const req = new Request("http://localhost:3000/api/clients", {
      method: "POST",
      body: JSON.stringify({ name: "Carlos" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe("Carlos")
  })

  it("creates a disappeared client with initial loan data", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const newClient = {
      id: "new-c1",
      name: "Carlos",
      userId: "user-test-123",
      requestedAmount: 1500,
      status: "DESAPARECIDO",
    }
    const newLoan = {
      id: "loan-1",
      amount: 1500,
      interestRate: 12,
      totalAmount: 1680,
      profit: 180,
      installmentCount: 1,
      payments: [],
      installments: [
        {
          id: "inst-1",
          number: 1,
          amount: 1680,
          paidAmount: 0,
          status: "PENDING",
          dueDate: new Date("2026-04-29T12:00:00.000Z"),
        },
      ],
    }
    mockPrisma.client.create.mockResolvedValue(newClient)
    mockPrisma.loan.create.mockResolvedValue(newLoan)

    const req = new Request("http://localhost:3000/api/clients", {
      method: "POST",
      body: JSON.stringify({
        name: "Carlos",
        status: "DESAPARECIDO",
        requestedAmount: 1500,
        disappearedInterestRate: 12,
      }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)

    expect(mockPrisma.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestedAmount: 1500,
          status: "DESAPARECIDO",
        }),
      })
    )
    expect(mockPrisma.loan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "new-c1",
          amount: 1500,
          interestRate: 12,
        }),
      })
    )

    const data = await res.json()
    expect(data.loans).toHaveLength(1)
    expect(data.loans[0].interestRate).toBe(12)
  })

  it("returns 400 for invalid data (short name)", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)

    const req = new Request("http://localhost:3000/api/clients", {
      method: "POST",
      body: JSON.stringify({ name: "X" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

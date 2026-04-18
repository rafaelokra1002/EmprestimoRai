/**
 * Tests for API: /api/sales
 */
import { mockPrisma, mockSession } from "./__mocks__"
import { getServerSession } from "next-auth"
import { GET, POST } from "@/app/api/sales/route"

const getServerSessionMock = getServerSession as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/sales", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns sales for authenticated user", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const sales = [
      { id: "s1", description: "Produto A", totalAmount: 1000 },
    ]
    mockPrisma.sale.findMany.mockResolvedValue(sales)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].description).toBe("Produto A")
  })
})

describe("POST /api/sales", () => {
  const validSale = {
    clientId: "client123",
    description: "Produto X",
    totalAmount: 1000,
    installmentCount: 3,
    startDate: "2026-03-01",
  }

  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const req = new Request("http://localhost:3000/api/sales", {
      method: "POST",
      body: JSON.stringify(validSale),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("creates a sale with valid data", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    mockPrisma.sale.create.mockResolvedValue({ id: "s-new", ...validSale })

    const req = new Request("http://localhost:3000/api/sales", {
      method: "POST",
      body: JSON.stringify(validSale),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.description).toBe("Produto X")
  })

  it("returns 400 for invalid data", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)

    const req = new Request("http://localhost:3000/api/sales", {
      method: "POST",
      body: JSON.stringify({ description: "X" }), // missing fields
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

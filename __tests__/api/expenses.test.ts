/**
 * Tests for API: /api/expenses
 */
import { mockPrisma, mockSession } from "./__mocks__"
import { getServerSession } from "next-auth"
import { GET, POST } from "@/app/api/expenses/route"

const getServerSessionMock = getServerSession as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/expenses", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns expenses for authenticated user", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const expenses = [
      { id: "e1", description: "Energia", amount: 200 },
      { id: "e2", description: "Água", amount: 80 },
    ]
    mockPrisma.expense.findMany.mockResolvedValue(expenses)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
    expect(data[0].description).toBe("Energia")
  })
})

describe("POST /api/expenses", () => {
  const validExpense = {
    description: "Conta de luz",
    amount: 150.5,
    category: "Energia",
    dueDate: "2026-03-10",
  }

  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const req = new Request("http://localhost:3000/api/expenses", {
      method: "POST",
      body: JSON.stringify(validExpense),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("creates an expense with valid data", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const created = { id: "e-new", ...validExpense, status: "PENDING" }
    mockPrisma.expense.create.mockResolvedValue(created)

    const req = new Request("http://localhost:3000/api/expenses", {
      method: "POST",
      body: JSON.stringify(validExpense),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.description).toBe("Conta de luz")
  })

  it("returns 400 for missing description", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)

    const req = new Request("http://localhost:3000/api/expenses", {
      method: "POST",
      body: JSON.stringify({ amount: 100, category: "Outros", dueDate: "2026-03-10" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 for amount = 0", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)

    const req = new Request("http://localhost:3000/api/expenses", {
      method: "POST",
      body: JSON.stringify({ ...validExpense, amount: 0 }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("accepts optional fields (supplier, pixKey, accountType)", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const fullExpense = {
      ...validExpense,
      supplier: "CPFL",
      pixKey: "12345678900",
      accountType: "EMPRESA",
      recurring: true,
      notes: "Mensal",
    }
    mockPrisma.expense.create.mockResolvedValue({ id: "e-full", ...fullExpense })

    const req = new Request("http://localhost:3000/api/expenses", {
      method: "POST",
      body: JSON.stringify(fullExpense),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

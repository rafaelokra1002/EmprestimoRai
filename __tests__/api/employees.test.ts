/**
 * Tests for API: /api/employees
 */
import { mockPrisma, mockSession } from "./__mocks__"
import { getServerSession } from "next-auth"
import { GET, POST } from "@/app/api/employees/route"

const getServerSessionMock = getServerSession as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/employees", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns employees for authenticated user", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const employees = [
      { id: "emp1", name: "Pedro", email: "pedro@test.com", role: "USER" },
    ]
    mockPrisma.employee.findMany.mockResolvedValue(employees)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe("Pedro")
  })
})

describe("POST /api/employees", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const req = new Request("http://localhost:3000/api/employees", {
      method: "POST",
      body: JSON.stringify({ name: "Ana", email: "ana@test.com" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("creates an employee with valid data", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    mockPrisma.employee.create.mockResolvedValue({ id: "emp-new", name: "Marcos", email: "marcos@test.com" })

    const req = new Request("http://localhost:3000/api/employees", {
      method: "POST",
      body: JSON.stringify({ name: "Marcos", email: "marcos@test.com" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe("Marcos")
  })

  it("returns 400 for invalid email", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)

    const req = new Request("http://localhost:3000/api/employees", {
      method: "POST",
      body: JSON.stringify({ name: "João", email: "invalid" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

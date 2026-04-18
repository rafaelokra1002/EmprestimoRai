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

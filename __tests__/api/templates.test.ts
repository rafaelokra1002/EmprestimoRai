/**
 * Tests for API: /api/templates
 */
import { mockPrisma, mockSession } from "./__mocks__"
import { getServerSession } from "next-auth"
import { GET, POST } from "@/app/api/templates/route"

const getServerSessionMock = getServerSession as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/templates", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns templates for authenticated user", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const templates = [
      { id: "t1", name: "ATRASO", content: "Olá {CLIENTE}", type: "COBRANCA" },
    ]
    mockPrisma.whatsAppTemplate.findMany.mockResolvedValue(templates)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe("ATRASO")
  })
})

describe("POST /api/templates", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const req = new Request("http://localhost:3000/api/templates", {
      method: "POST",
      body: JSON.stringify({ name: "Test", content: "Hello world", type: "COBRANCA" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("creates a template with valid data", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const created = { id: "t-new", name: "VENCE_HOJE", content: "Sua parcela vence hoje!", type: "COBRANCA" }
    mockPrisma.whatsAppTemplate.create.mockResolvedValue(created)

    const req = new Request("http://localhost:3000/api/templates", {
      method: "POST",
      body: JSON.stringify({ name: "VENCE_HOJE", content: "Sua parcela vence hoje!", type: "COBRANCA" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe("VENCE_HOJE")
  })

  it("returns 400 for short name", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)

    const req = new Request("http://localhost:3000/api/templates", {
      method: "POST",
      body: JSON.stringify({ name: "A", content: "Hello world", type: "COBRANCA" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 for short content", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)

    const req = new Request("http://localhost:3000/api/templates", {
      method: "POST",
      body: JSON.stringify({ name: "ATRASO", content: "Hi", type: "COBRANCA" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

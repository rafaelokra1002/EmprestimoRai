/**
 * Tests for API: /api/profile
 */
import { mockPrisma, mockSession } from "./__mocks__"
import { getServerSession } from "next-auth"
import { GET, PUT } from "@/app/api/profile/route"

const getServerSessionMock = getServerSession as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

// Mock bcryptjs
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
}))

describe("GET /api/profile", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns user profile for authenticated user", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const user = {
      id: "user-test-123",
      name: "Test User",
      email: "test@test.com",
      phone: "(11) 99999-0000",
      companyName: "My Company",
      companyDoc: null,
      pixKey: "test@pix.com",
      role: "ADMIN",
      createdAt: new Date(),
    }
    mockPrisma.user.findUnique.mockResolvedValue(user)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe("Test User")
    expect(data.email).toBe("test@test.com")
  })
})

describe("PUT /api/profile", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const req = new Request("http://localhost:3000/api/profile", {
      method: "PUT",
      body: JSON.stringify({ name: "New Name" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PUT(req)
    expect(res.status).toBe(401)
  })

  it("updates user profile", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const updated = { id: "user-test-123", name: "Updated Name", email: "test@test.com", phone: "(11) 99999" }
    mockPrisma.user.update.mockResolvedValue(updated)

    const req = new Request("http://localhost:3000/api/profile", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated Name", phone: "(11) 99999" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe("Updated Name")
  })

  it("updates with correct user id", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    mockPrisma.user.update.mockResolvedValue({})

    const req = new Request("http://localhost:3000/api/profile", {
      method: "PUT",
      body: JSON.stringify({ name: "Test" }),
      headers: { "Content-Type": "application/json" },
    })
    await PUT(req)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-test-123" },
      })
    )
  })
})

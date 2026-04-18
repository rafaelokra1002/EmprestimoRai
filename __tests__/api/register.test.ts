/**
 * Tests for API: /api/register
 */
import { mockPrisma } from "./__mocks__"
import { POST } from "@/app/api/register/route"

// Mock bcryptjs
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe("POST /api/register", () => {
  const validData = {
    name: "Novo Usuário",
    email: "novo@test.com",
    password: "senha123",
  }

  it("creates a new user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user",
      email: "novo@test.com",
    })

    const req = new Request("http://localhost:3000/api/register", {
      method: "POST",
      body: JSON.stringify(validData),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.email).toBe("novo@test.com")
  })

  it("rejects duplicate email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" })

    const req = new Request("http://localhost:3000/api/register", {
      method: "POST",
      body: JSON.stringify(validData),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Email já cadastrado")
  })

  it("returns 400 for invalid data", async () => {
    const req = new Request("http://localhost:3000/api/register", {
      method: "POST",
      body: JSON.stringify({ name: "A", email: "bad", password: "12" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("hashes the password", async () => {
    const bcrypt = require("bcryptjs")
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: "u1", email: "novo@test.com" })

    const req = new Request("http://localhost:3000/api/register", {
      method: "POST",
      body: JSON.stringify(validData),
      headers: { "Content-Type": "application/json" },
    })
    await POST(req)
    expect(bcrypt.hash).toHaveBeenCalledWith("senha123", 12)
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          password: "hashed-password",
        }),
      })
    )
  })
})

/**
 * Tests for API: /api/registro
 */
import { mockPrisma } from "./__mocks__"
import { POST } from "@/app/api/registro/route"

beforeEach(() => {
  jest.clearAllMocks()
})

const makeRequest = (body: unknown) =>
  new Request("http://localhost:3000/api/registro", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })

const makeToken = (userId: string) =>
  Buffer.from(userId, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

describe("POST /api/registro", () => {
  it("creates a client from a registration link", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-test-123" })
    mockPrisma.client.create.mockResolvedValue({ id: "client-1", name: "Carlos" })

    const res = await POST(
      makeRequest({
        token: makeToken("user-test-123"),
        name: "Carlos",
        phone: "(11) 99999-9999",
        income: "1234,56",
      })
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-test-123",
          name: "Carlos",
          phone: "(11) 99999-9999",
          income: 1234.56,
          status: "INACTIVE",
        }),
      })
    )
  })

  it("returns 400 when token is missing", async () => {
    const res = await POST(
      makeRequest({
        token: "",
        name: "Carlos",
        phone: "(11) 99999-9999",
      })
    )

    expect(res.status).toBe(400)
  })

  it("does not fail the client registration when document save fails", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-test-123" })
    mockPrisma.client.create.mockResolvedValue({ id: "client-1", name: "Carlos" })
    mockPrisma.clientDocument.create.mockRejectedValue(new Error("Arquivo muito grande"))

    const res = await POST(
      makeRequest({
        token: makeToken("user-test-123"),
        name: "Carlos",
        phone: "(11) 99999-9999",
        photos: {
          selfie: {
            name: "selfie.jpg",
            type: "image/jpeg",
            dataUrl: "data:image/jpeg;base64,abc123",
          },
        },
      })
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.client.create).toHaveBeenCalled()
    expect(mockPrisma.clientDocument.create).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})

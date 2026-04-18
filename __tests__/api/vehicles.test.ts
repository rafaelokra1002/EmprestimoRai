/**
 * Tests for API: /api/vehicles
 */
import { mockPrisma, mockSession } from "./__mocks__"
import { getServerSession } from "next-auth"
import { GET, POST } from "@/app/api/vehicles/route"

const getServerSessionMock = getServerSession as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/vehicles", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns vehicles for authenticated user", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    const vehicles = [
      { id: "v1", brand: "Toyota", model: "Corolla", year: 2024, client: null },
    ]
    mockPrisma.vehicle.findMany.mockResolvedValue(vehicles)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].brand).toBe("Toyota")
  })
})

describe("POST /api/vehicles", () => {
  const validVehicle = {
    brand: "Honda",
    model: "Civic",
    year: 2025,
    purchasePrice: 95000,
  }

  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const req = new Request("http://localhost:3000/api/vehicles", {
      method: "POST",
      body: JSON.stringify(validVehicle),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("creates a vehicle with valid data", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    mockPrisma.vehicle.create.mockResolvedValue({ id: "v-new", ...validVehicle })

    const req = new Request("http://localhost:3000/api/vehicles", {
      method: "POST",
      body: JSON.stringify(validVehicle),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.brand).toBe("Honda")
  })

  it("returns 400 for missing brand", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)

    const req = new Request("http://localhost:3000/api/vehicles", {
      method: "POST",
      body: JSON.stringify({ model: "Civic", year: 2025, purchasePrice: 95000 }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

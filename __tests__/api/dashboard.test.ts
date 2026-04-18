/**
 * Tests for API: /api/dashboard
 */
import { mockPrisma, mockSession } from "./__mocks__"
import { getServerSession } from "next-auth"
import { GET } from "@/app/api/dashboard/route"

const getServerSessionMock = getServerSession as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/dashboard", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns dashboard stats", async () => {
    getServerSessionMock.mockResolvedValue(mockSession)
    mockPrisma.loan.findMany.mockResolvedValue([
      {
        id: "loan1",
        amount: 1000,
        totalAmount: 1100,
        profit: 100,
        createdAt: new Date(),
        installments: [
          { dueDate: new Date("2020-01-01"), status: "PENDING" },
        ],
        payments: [{ amount: 500, date: new Date() }],
      },
    ])
    mockPrisma.installment.count.mockResolvedValue(1)
    mockPrisma.client.count.mockResolvedValue(10)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("totalToReceive")
    expect(data).toHaveProperty("totalReceived")
    expect(data).toHaveProperty("capitalOnStreet")
    expect(data).toHaveProperty("totalProfit")
  })
})

/**
 * @jest-environment jsdom
 */

/**
 * Page component smoke tests
 * Verify each page renders without crashing
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"

// ─── Global mocks ──────────────────────────────────────────────
const mockPush = jest.fn()
const mockRefresh = jest.fn()

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, back: jest.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "u1", name: "Test User", email: "test@test.com" } },
    status: "authenticated",
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
}))

// Mock recharts to avoid canvas errors
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => null,
}))

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => [],
  })
})

// ─── Login page ────────────────────────────────────────────────
describe("LoginPage", () => {
  let LoginPage: any

  beforeAll(async () => {
    const mod = await import("@/app/login/page")
    LoginPage = mod.default
  })

  it("renders without crashing", () => {
    const { container } = render(<LoginPage />)
    expect(container.querySelector("form")).toBeTruthy()
  })

  it("shows app name and entry form", () => {
    render(<LoginPage />)
    expect(screen.getByText("SP Cobrança Fácil")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("seu@email.com")).toBeInTheDocument()
  })

  it("shows validation errors for empty submission", async () => {
    render(<LoginPage />)
    const submitBtn = screen.getByRole("button", { name: /entrar/i })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      const errors = screen.getAllByText(/inválido|obrigatór/i)
      expect(errors.length).toBeGreaterThan(0)
    })
  })
})

// ─── Register page ─────────────────────────────────────────────
describe("RegisterPage", () => {
  let RegisterPage: any

  beforeAll(async () => {
    const mod = await import("@/app/register/page")
    RegisterPage = mod.default
  })

  it("renders without crashing", () => {
    const { container } = render(<RegisterPage />)
    expect(container.querySelector("form")).toBeTruthy()
  })

  it("shows registration fields", () => {
    render(<RegisterPage />)
    expect(screen.getByText("SP Cobrança Fácil")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("seu@email.com")).toBeInTheDocument()
  })
})

// ─── Dashboard page ────────────────────────────────────────────
describe("DashboardPage", () => {
  let DashboardPage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/dashboard/page")
    DashboardPage = mod.default
  })

  it("renders and fetches data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        totalToReceive: 10000,
        totalReceived: 5000,
        capitalOnStreet: 3000,
        totalProfit: 2000,
        overdueCount: 3,
        activeClients: 15,
        monthlyData: [],
        totalLoans: 20,
      }),
    })
    const { container } = render(<DashboardPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/dashboard")
    })
    expect(container.firstChild).toBeTruthy()
  })
})

// ─── Clientes page ─────────────────────────────────────────────
describe("ClientesPage", () => {
  let ClientesPage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/clientes/page")
    ClientesPage = mod.default
  })

  it("renders and calls API", async () => {
    const { container } = render(<ClientesPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeTruthy()
  })
})

describe("ClientesDesaparecidosPage", () => {
  let ClientesDesaparecidosPage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/clientes/desaparecido/page")
    ClientesDesaparecidosPage = mod.default
  })

  it("renders and calls API", async () => {
    const { container } = render(<ClientesDesaparecidosPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeTruthy()
  })
})

// ─── Empréstimos page ──────────────────────────────────────────
describe("EmprestimosPage", () => {
  let EmprestimosPage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/emprestimos/page")
    EmprestimosPage = mod.default
  })

  it("renders and calls API", async () => {
    const { container } = render(<EmprestimosPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeTruthy()
  })

  it("does not list loans for disappeared clients", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === "/api/loans") {
        return {
          ok: true,
          json: async () => [
            {
              id: "l1",
              amount: 1000,
              interestRate: 10,
              interestType: "PER_INSTALLMENT",
              modality: "MONTHLY",
              totalAmount: 1100,
              totalInterest: 100,
              installmentValue: 1100,
              profit: 100,
              installmentCount: 1,
              contractDate: "2026-04-01T00:00:00.000Z",
              firstInstallmentDate: "2026-05-01T00:00:00.000Z",
              startDate: "2026-04-01T00:00:00.000Z",
              status: "ACTIVE",
              dailyInterest: false,
              dailyInterestAmount: 0,
              penaltyFee: 0,
              lateCycles: 0,
              dueDay: 1,
              whatsappNotify: false,
              notes: null,
              tags: [],
              createdAt: "2026-04-01T00:00:00.000Z",
              client: { id: "c1", name: "Cliente Ativo", photo: null, status: "ACTIVE" },
              installments: [{ id: "i1", number: 1, amount: 1100, paidAmount: 0, status: "PENDING", dueDate: "2099-05-01T00:00:00.000Z" }],
              payments: [],
            },
            {
              id: "l2",
              amount: 900,
              interestRate: 10,
              interestType: "PER_INSTALLMENT",
              modality: "MONTHLY",
              totalAmount: 990,
              totalInterest: 90,
              installmentValue: 990,
              profit: 90,
              installmentCount: 1,
              contractDate: "2026-04-01T00:00:00.000Z",
              firstInstallmentDate: "2026-05-01T00:00:00.000Z",
              startDate: "2026-04-01T00:00:00.000Z",
              status: "ACTIVE",
              dailyInterest: false,
              dailyInterestAmount: 0,
              penaltyFee: 0,
              lateCycles: 0,
              dueDay: 1,
              whatsappNotify: false,
              notes: null,
              tags: [],
              createdAt: "2026-04-01T00:00:00.000Z",
              client: { id: "c2", name: "Cliente Desaparecido", photo: null, status: "DESAPARECIDO" },
              installments: [{ id: "i2", number: 1, amount: 990, paidAmount: 0, status: "PENDING", dueDate: "2099-05-01T00:00:00.000Z" }],
              payments: [],
            },
          ],
        }
      }

      if (url === "/api/clients") {
        return {
          ok: true,
          json: async () => [],
        }
      }

      if (url === "/api/profile") {
        return {
          ok: true,
          json: async () => ({ pixKey: "", phone: "" }),
        }
      }

      return {
        ok: true,
        json: async () => [],
      }
    })

    render(<EmprestimosPage />)

    expect(await screen.findByText("Cliente Ativo")).toBeInTheDocument()
    expect(screen.queryByText("Cliente Desaparecido")).not.toBeInTheDocument()
  })

  it("does not show disappeared clients in the picker", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === "/api/loans") {
        return {
          ok: true,
          json: async () => [],
        }
      }

      if (url === "/api/clients") {
        return {
          ok: true,
          json: async () => [
            { id: "c1", name: "Cliente Ativo", phone: null, document: null, photo: null, status: "ACTIVE" },
            { id: "c2", name: "Cliente Desaparecido", phone: null, document: null, photo: null, status: "DESAPARECIDO" },
          ],
        }
      }

      if (url === "/api/profile") {
        return {
          ok: true,
          json: async () => ({ pixKey: "", phone: "" }),
        }
      }

      return {
        ok: true,
        json: async () => [],
      }
    })

    render(<EmprestimosPage />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/clients")
    })

    fireEvent.click(screen.getByRole("button", { name: /novo empréstimo/i }))
    expect(await screen.findByRole("heading", { name: /novo empréstimo/i })).toBeInTheDocument()

    expect(await screen.findByText("Cliente Ativo")).toBeInTheDocument()
    expect(screen.queryByText("Cliente Desaparecido")).not.toBeInTheDocument()
  })

  it("shows installment loan as paid this month and resets next month", async () => {
    jest.useFakeTimers()

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === "/api/loans") {
        return {
          ok: true,
          json: async () => [
            {
              id: "l1",
              amount: 1000,
              interestRate: 10,
              interestType: "PER_INSTALLMENT",
              modality: "MONTHLY",
              totalAmount: 1100,
              totalInterest: 100,
              installmentValue: 550,
              profit: 100,
              installmentCount: 2,
              contractDate: "2026-04-01T00:00:00.000Z",
              firstInstallmentDate: "2026-04-10T00:00:00.000Z",
              startDate: "2026-04-01T00:00:00.000Z",
              status: "ACTIVE",
              dailyInterest: false,
              dailyInterestAmount: 0,
              penaltyFee: 0,
              lateCycles: 0,
              dueDay: 10,
              whatsappNotify: false,
              notes: null,
              tags: [],
              createdAt: "2026-04-01T00:00:00.000Z",
              client: { id: "c1", name: "Cliente Parcelado", photo: null, status: "ACTIVE" },
              installments: [
                { id: "i1", number: 1, amount: 550, paidAmount: 550, status: "PAID", dueDate: "2026-04-10T00:00:00.000Z" },
                { id: "i2", number: 2, amount: 550, paidAmount: 0, status: "PENDING", dueDate: "2026-05-30T00:00:00.000Z" },
              ],
              payments: [{ id: "p1", amount: 550, date: "2026-04-10T00:00:00.000Z", notes: null }],
            },
          ],
        }
      }

      if (url === "/api/clients") {
        return {
          ok: true,
          json: async () => [],
        }
      }

      if (url === "/api/profile") {
        return {
          ok: true,
          json: async () => ({ pixKey: "", phone: "" }),
        }
      }

      return {
        ok: true,
        json: async () => [],
      }
    })

    jest.setSystemTime(new Date("2026-04-15T12:00:00.000Z"))
    const { unmount } = render(<EmprestimosPage />)

    expect(await screen.findByText("Pago no Mês")).toBeInTheDocument()

    unmount()
    jest.clearAllMocks()
    jest.setSystemTime(new Date("2026-05-15T12:00:00.000Z"))

    render(<EmprestimosPage />)

    expect(await screen.findByText("Pendente")).toBeInTheDocument()
    expect(screen.queryByText("Pago no Mês")).not.toBeInTheDocument()

    jest.useRealTimers()
  })
})

// ─── Vendas page ───────────────────────────────────────────────
describe("VendasPage", () => {
  let VendasPage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/vendas/page")
    VendasPage = mod.default
  })

  it("renders and calls API", async () => {
    const { container } = render(<VendasPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeTruthy()
  })
})

// ─── Veículos page ─────────────────────────────────────────────
describe("VeiculosPage", () => {
  let VeiculosPage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/veiculos/page")
    VeiculosPage = mod.default
  })

  it("renders and calls API", async () => {
    const { container } = render(<VeiculosPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeTruthy()
  })
})

// ─── Contas page ───────────────────────────────────────────────
describe("ContasPage", () => {
  let ContasPage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/contas/page")
    ContasPage = mod.default
  })

  it("renders and calls API", async () => {
    const { container } = render(<ContasPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeTruthy()
  })
})

describe("DespesasPage", () => {
  let DespesasPage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/despesas/page")
    DespesasPage = mod.default
  })

  it("renders and calls API", async () => {
    const { container } = render(<DespesasPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeTruthy()
  })
})

// ─── Score page ────────────────────────────────────────────────
describe("ScorePage", () => {
  let ScorePage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/score/page")
    ScorePage = mod.default
  })

  it("renders and calls API", async () => {
    const { container } = render(<ScorePage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeTruthy()
  })
})

// ─── Simulador page ────────────────────────────────────────────
describe("SimuladorPage", () => {
  let SimuladorPage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/simulador/page")
    SimuladorPage = mod.default
  })

  it("renders without crashing", () => {
    const { container } = render(<SimuladorPage />)
    expect(container.firstChild).toBeTruthy()
  })
})

// ─── Configurações page ────────────────────────────────────────
describe("ConfiguracoesPage", () => {
  let ConfiguracoesPage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/configuracoes/page")
    ConfiguracoesPage = mod.default
  })

  it("renders and calls API", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
    const { container } = render(<ConfiguracoesPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeTruthy()
  })
})

// ─── Calendário page ───────────────────────────────────────────
describe("CalendarioPage", () => {
  let CalendarioPage: any

  beforeAll(async () => {
    const mod = await import("@/app/(app)/calendario/page")
    CalendarioPage = mod.default
  })

  it("renders and calls API", async () => {
    const { container } = render(<CalendarioPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeTruthy()
  })
})

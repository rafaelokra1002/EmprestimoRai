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
    expect(screen.getByText("EmprestimoRAI")).toBeInTheDocument()
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
    expect(screen.getByText("EmprestimoRAI")).toBeInTheDocument()
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

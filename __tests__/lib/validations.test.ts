/**
 * Tests for src/lib/validations.ts
 * Covers all Zod schemas: client, loan, payment, sale, vehicle, expense, employee, template, register, login
 */
import {
  clientSchema,
  loanSchema,
  paymentSchema,
  saleSchema,
  vehicleSchema,
  expenseSchema,
  employeeSchema,
  templateSchema,
  registerSchema,
  loginSchema,
} from "@/lib/validations"

/* ─── clientSchema ─── */
describe("clientSchema", () => {
  it("validates a minimal valid client", () => {
    const result = clientSchema.safeParse({ name: "João" })
    expect(result.success).toBe(true)
  })

  it("rejects name shorter than 2 chars", () => {
    const result = clientSchema.safeParse({ name: "J" })
    expect(result.success).toBe(false)
  })

  it("accepts empty email", () => {
    const result = clientSchema.safeParse({ name: "Maria", email: "" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email", () => {
    const result = clientSchema.safeParse({ name: "Maria", email: "bad-email" })
    expect(result.success).toBe(false)
  })

  it("accepts valid email", () => {
    const result = clientSchema.safeParse({ name: "Maria", email: "maria@test.com" })
    expect(result.success).toBe(true)
  })

  it("applies defaults correctly", () => {
    const result = clientSchema.parse({ name: "Carlos" })
    expect(result.referral).toBe(false)
    expect(result.clientType).toBe("EMPRESTIMO")
    expect(result.status).toBe("ACTIVE")
  })

  it("validates status enum", () => {
    const valid = clientSchema.safeParse({ name: "Ana", status: "ACTIVE" })
    expect(valid.success).toBe(true)
    const invalid = clientSchema.safeParse({ name: "Ana", status: "BLOCKED" })
    expect(invalid.success).toBe(false)
  })

  it("accepts full client data", () => {
    const result = clientSchema.safeParse({
      name: "João Silva",
      email: "joao@test.com",
      phone: "(11) 99999-0000",
      document: "123.456.789-00",
      rg: "12.345.678-9",
      profession: "Engenheiro",
      address: "Rua Teste, 123",
      city: "São Paulo",
      state: "SP",
      zipCode: "01234-000",
      neighborhood: "Centro",
      notes: "Observação",
    })
    expect(result.success).toBe(true)
  })
})

/* ─── loanSchema ─── */
describe("loanSchema", () => {
  const validLoan = {
    clientId: "client123",
    amount: 5000,
    interestRate: 5,
    installmentCount: 10,
    contractDate: "2026-01-15",
    firstInstallmentDate: "2026-02-15",
  }

  it("validates a valid loan", () => {
    const result = loanSchema.safeParse(validLoan)
    expect(result.success).toBe(true)
  })

  it("applies defaults", () => {
    const result = loanSchema.parse(validLoan)
    expect(result.interestType).toBe("PER_INSTALLMENT")
    expect(result.modality).toBe("MONTHLY")
    expect(result.skipSaturday).toBe(false)
    expect(result.skipSunday).toBe(false)
    expect(result.dailyInterest).toBe(false)
  })

  it("rejects empty clientId", () => {
    const result = loanSchema.safeParse({ ...validLoan, clientId: "" })
    expect(result.success).toBe(false)
  })

  it("rejects amount = 0", () => {
    const result = loanSchema.safeParse({ ...validLoan, amount: 0 })
    expect(result.success).toBe(false)
  })

  it("rejects negative interest rate", () => {
    const result = loanSchema.safeParse({ ...validLoan, interestRate: -1 })
    expect(result.success).toBe(false)
  })

  it("rejects installmentCount = 0", () => {
    const result = loanSchema.safeParse({ ...validLoan, installmentCount: 0 })
    expect(result.success).toBe(false)
  })

  it("rejects missing contractDate", () => {
    const result = loanSchema.safeParse({ ...validLoan, contractDate: "" })
    expect(result.success).toBe(false)
  })

  it("validates all interest types", () => {
    for (const type of ["PER_INSTALLMENT", "TOTAL", "FIXED_AMOUNT"]) {
      const result = loanSchema.safeParse({ ...validLoan, interestType: type })
      expect(result.success).toBe(true)
    }
  })

  it("validates all modalities", () => {
    for (const mod of ["MONTHLY", "BIWEEKLY", "WEEKLY", "DAILY"]) {
      const result = loanSchema.safeParse({ ...validLoan, modality: mod })
      expect(result.success).toBe(true)
    }
  })
})

/* ─── paymentSchema ─── */
describe("paymentSchema", () => {
  it("validates a valid payment", () => {
    const result = paymentSchema.safeParse({
      loanId: "loan123",
      amount: 500,
      date: "2026-02-15",
    })
    expect(result.success).toBe(true)
  })

  it("rejects amount = 0", () => {
    const result = paymentSchema.safeParse({
      loanId: "loan123",
      amount: 0,
      date: "2026-02-15",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing loanId", () => {
    const result = paymentSchema.safeParse({
      loanId: "",
      amount: 100,
      date: "2026-02-15",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing date", () => {
    const result = paymentSchema.safeParse({
      loanId: "loan123",
      amount: 100,
      date: "",
    })
    expect(result.success).toBe(false)
  })
})

/* ─── saleSchema ─── */
describe("saleSchema", () => {
  const validSale = {
    clientId: "client123",
    description: "Produto X",
    totalAmount: 1000,
    installmentCount: 3,
    startDate: "2026-03-01",
  }

  it("validates a valid sale", () => {
    const result = saleSchema.safeParse(validSale)
    expect(result.success).toBe(true)
  })

  it("rejects short description", () => {
    const result = saleSchema.safeParse({ ...validSale, description: "X" })
    expect(result.success).toBe(false)
  })

  it("rejects zero totalAmount", () => {
    const result = saleSchema.safeParse({ ...validSale, totalAmount: 0 })
    expect(result.success).toBe(false)
  })

  it("rejects zero installmentCount", () => {
    const result = saleSchema.safeParse({ ...validSale, installmentCount: 0 })
    expect(result.success).toBe(false)
  })
})

/* ─── vehicleSchema ─── */
describe("vehicleSchema", () => {
  const validVehicle = {
    brand: "Toyota",
    model: "Corolla",
    year: 2024,
    purchasePrice: 80000,
  }

  it("validates a valid vehicle", () => {
    const result = vehicleSchema.safeParse(validVehicle)
    expect(result.success).toBe(true)
  })

  it("rejects missing brand", () => {
    const result = vehicleSchema.safeParse({ ...validVehicle, brand: "" })
    expect(result.success).toBe(false)
  })

  it("rejects year before 1900", () => {
    const result = vehicleSchema.safeParse({ ...validVehicle, year: 1800 })
    expect(result.success).toBe(false)
  })

  it("rejects negative purchasePrice", () => {
    const result = vehicleSchema.safeParse({ ...validVehicle, purchasePrice: -1 })
    expect(result.success).toBe(false)
  })

  it("applies defaults", () => {
    const result = vehicleSchema.parse(validVehicle)
    expect(result.downPayment).toBe(0)
    expect(result.installmentCount).toBe(1)
    expect(result.modality).toBe("MONTHLY")
    expect(result.whatsappNotify).toBe(false)
  })

  it("accepts full vehicle with buyer data", () => {
    const result = vehicleSchema.safeParse({
      ...validVehicle,
      plate: "ABC-1234",
      color: "Prata",
      salePrice: 90000,
      buyerName: "Carlos",
      buyerPhone: "(11) 99999",
      buyerCpf: "123.456.789-00",
    })
    expect(result.success).toBe(true)
  })
})

/* ─── expenseSchema ─── */
describe("expenseSchema", () => {
  const validExpense = {
    description: "Conta de luz",
    amount: 150.5,
    category: "Energia",
    dueDate: "2026-03-10",
  }

  it("validates a valid expense", () => {
    const result = expenseSchema.safeParse(validExpense)
    expect(result.success).toBe(true)
  })

  it("rejects short description", () => {
    const result = expenseSchema.safeParse({ ...validExpense, description: "C" })
    expect(result.success).toBe(false)
  })

  it("rejects amount = 0", () => {
    const result = expenseSchema.safeParse({ ...validExpense, amount: 0 })
    expect(result.success).toBe(false)
  })

  it("rejects missing category", () => {
    const result = expenseSchema.safeParse({ ...validExpense, category: "" })
    expect(result.success).toBe(false)
  })

  it("rejects missing dueDate", () => {
    const result = expenseSchema.safeParse({ ...validExpense, dueDate: "" })
    expect(result.success).toBe(false)
  })

  it("applies defaults", () => {
    const result = expenseSchema.parse(validExpense)
    expect(result.accountType).toBe("PESSOAL")
    expect(result.recurring).toBe(false)
  })

  it("accepts optional fields", () => {
    const result = expenseSchema.safeParse({
      ...validExpense,
      supplier: "CPFL",
      pixKey: "12345678900",
      accountType: "EMPRESA",
      recurring: true,
      notes: "Mensal",
    })
    expect(result.success).toBe(true)
  })
})

/* ─── employeeSchema ─── */
describe("employeeSchema", () => {
  it("validates a valid employee", () => {
    const result = employeeSchema.safeParse({
      name: "Pedro",
      email: "pedro@test.com",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email", () => {
    const result = employeeSchema.safeParse({
      name: "Pedro",
      email: "invalid",
    })
    expect(result.success).toBe(false)
  })

  it("rejects short name", () => {
    const result = employeeSchema.safeParse({
      name: "P",
      email: "p@test.com",
    })
    expect(result.success).toBe(false)
  })

  it("validates role enum", () => {
    expect(employeeSchema.safeParse({ name: "Ana", email: "a@t.com", role: "ADMIN" }).success).toBe(true)
    expect(employeeSchema.safeParse({ name: "Ana", email: "a@t.com", role: "MANAGER" }).success).toBe(false)
  })

  it("applies default role", () => {
    const result = employeeSchema.parse({ name: "Ana", email: "a@t.com" })
    expect(result.role).toBe("USER")
  })
})

/* ─── templateSchema ─── */
describe("templateSchema", () => {
  it("validates a valid template", () => {
    const result = templateSchema.safeParse({
      name: "ATRASO",
      content: "Olá {CLIENTE}, sua parcela está em atraso!",
      type: "COBRANCA",
    })
    expect(result.success).toBe(true)
  })

  it("rejects short name", () => {
    const result = templateSchema.safeParse({
      name: "A",
      content: "Olá {CLIENTE}",
    })
    expect(result.success).toBe(false)
  })

  it("rejects short content", () => {
    const result = templateSchema.safeParse({
      name: "ATRASO",
      content: "Oi",
    })
    expect(result.success).toBe(false)
  })

  it("validates type enum", () => {
    for (const type of ["COBRANCA", "LEMBRETE", "CONFIRMACAO", "CUSTOM"]) {
      expect(
        templateSchema.safeParse({ name: "Test", content: "Hello world", type }).success
      ).toBe(true)
    }
  })

  it("applies default type", () => {
    const result = templateSchema.parse({ name: "Test", content: "Hello world test" })
    expect(result.type).toBe("COBRANCA")
  })
})

/* ─── registerSchema ─── */
describe("registerSchema", () => {
  it("validates valid registration", () => {
    const result = registerSchema.safeParse({
      name: "João",
      email: "joao@test.com",
      password: "123456",
    })
    expect(result.success).toBe(true)
  })

  it("rejects short password", () => {
    const result = registerSchema.safeParse({
      name: "João",
      email: "joao@test.com",
      password: "123",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      name: "João",
      email: "invalid",
      password: "123456",
    })
    expect(result.success).toBe(false)
  })

  it("rejects short name", () => {
    const result = registerSchema.safeParse({
      name: "J",
      email: "j@test.com",
      password: "123456",
    })
    expect(result.success).toBe(false)
  })
})

/* ─── loginSchema ─── */
describe("loginSchema", () => {
  it("validates valid login", () => {
    const result = loginSchema.safeParse({
      email: "user@test.com",
      password: "123",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "123",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@test.com",
      password: "",
    })
    expect(result.success).toBe(false)
  })
})

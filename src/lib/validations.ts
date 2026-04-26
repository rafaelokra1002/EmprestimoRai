import { z } from "zod"

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val

export const clientSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.preprocess(
    emptyToUndefined,
    z.string().email("Email inválido").optional()
  ),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  document: z.preprocess(emptyToUndefined, z.string().optional()),
  rg: z.preprocess(emptyToUndefined, z.string().optional()),
  instagram: z.preprocess(emptyToUndefined, z.string().optional()),
  facebook: z.preprocess(emptyToUndefined, z.string().optional()),
  profession: z.preprocess(emptyToUndefined, z.string().optional()),
  workplace: z.preprocess(emptyToUndefined, z.string().optional()),
  category: z.preprocess(emptyToUndefined, z.string().optional()),
  income: z.preprocess((val) => (val === "" || val === undefined || val === null || (typeof val === "number" && isNaN(val)) ? undefined : Number(val)), z.number().min(0, "Valor inválido").optional()),
  requestedAmount: z.preprocess((val) => (val === "" || val === undefined || val === null || (typeof val === "number" && isNaN(val)) ? undefined : Number(val)), z.number().min(0, "Valor inválido").optional()),
  referral: z.boolean().default(false),
  referralName: z.preprocess(emptyToUndefined, z.string().optional()),
  referralPhone: z.preprocess(emptyToUndefined, z.string().optional()),
  clientType: z.string().default("EMPRESTIMO"),
  photo: z.preprocess(emptyToUndefined, z.string().optional()),
  address: z.preprocess(emptyToUndefined, z.string().optional()),
  city: z.preprocess(emptyToUndefined, z.string().optional()),
  state: z.preprocess(emptyToUndefined, z.string().optional()),
  zipCode: z.preprocess(emptyToUndefined, z.string().optional()),
  neighborhood: z.preprocess(emptyToUndefined, z.string().optional()),
  complement: z.preprocess(emptyToUndefined, z.string().optional()),
  number: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.enum(["ACTIVE", "INACTIVE", "DESAPARECIDO"]).default("ACTIVE"),
})

export const loanSchema = z.object({
  clientId: z.string().min(1, "Selecione um cliente"),
  amount: z.number().min(1, "Valor deve ser maior que zero"),
  interestRate: z.number().min(0, "Taxa de juros inválida"),
  interestType: z.enum(["PER_INSTALLMENT", "TOTAL", "FIXED_AMOUNT", "CUSTOM", "COMPOUND", "SAC", "PRICE"]).default("PER_INSTALLMENT"),
  modality: z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY", "DAILY"]).default("MONTHLY"),
  installmentCount: z.number().min(1, "Mínimo 1 parcela"),
  totalInterestAmount: z.number().optional(),
  customInstallmentAmounts: z.array(z.number()).optional(),
  contractDate: z.string().min(1, "Data do contrato obrigatória"),
  firstInstallmentDate: z.string().min(1, "Data da 1ª parcela obrigatória"),
  skipSaturday: z.boolean().default(false),
  skipSunday: z.boolean().default(false),
  skipHolidays: z.boolean().default(false),
  dailyInterest: z.boolean().default(false),
  dailyInterestAmount: z.number().min(0).default(0),
  penaltyFee: z.number().min(0).default(0),
  whatsappNotify: z.boolean().default(false),
  installmentDates: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

export const paymentSchema = z.object({
  loanId: z.string().min(1, "Selecione um empréstimo"),
  amount: z.number().min(0.01, "Valor deve ser maior que zero"),
  date: z.string().min(1, "Selecione a data"),
  notes: z.string().optional(),
})

export const saleSchema = z.object({
  clientId: z.string().min(1, "Selecione um cliente"),
  description: z.string().min(2, "Descrição obrigatória"),
  totalAmount: z.number().min(1, "Valor deve ser maior que zero"),
  installmentCount: z.number().min(1, "Mínimo 1 parcela"),
  startDate: z.string().min(1, "Selecione a data"),
  notes: z.string().optional(),
})

export const vehicleSchema = z.object({
  brand: z.string().min(1, "Marca obrigatória"),
  model: z.string().min(1, "Modelo obrigatório"),
  year: z.number().min(1900, "Ano inválido"),
  plate: z.string().optional(),
  color: z.string().optional(),
  chassis: z.string().optional(),
  purchasePrice: z.number().min(0, "Preço de compra inválido"),
  salePrice: z.number().optional(),
  downPayment: z.number().default(0),
  clientId: z.string().optional(),
  installmentCount: z.number().min(1).default(1),
  modality: z.string().default("MONTHLY"),
  saleDate: z.string().optional(),
  firstDueDate: z.string().optional(),
  originName: z.string().optional(),
  buyerName: z.string().optional(),
  buyerPhone: z.string().optional(),
  buyerEmail: z.string().optional(),
  buyerCpf: z.string().optional(),
  buyerRg: z.string().optional(),
  buyerAddress: z.string().optional(),
  whatsappNotify: z.boolean().default(false),
  notes: z.string().optional(),
})

export const expenseSchema = z.object({
  description: z.string().min(2, "Descrição obrigatória"),
  supplier: z.string().optional(),
  pixKey: z.string().optional(),
  accountType: z.string().default("PESSOAL"),
  amount: z.number().min(0.01, "Valor deve ser maior que zero"),
  category: z.string().min(1, "Categoria obrigatória"),
  dueDate: z.string().min(1, "Data de vencimento obrigatória"),
  recurring: z.boolean().default(false),
  notes: z.string().optional(),
})

export const employeeSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
  salary: z.number().optional(),
})

export const templateSchema = z.object({
  name: z.string().min(2, "Nome do template obrigatório"),
  content: z.string().min(5, "Conteúdo obrigatório"),
  type: z.enum(["COBRANCA", "LEMBRETE", "CONFIRMACAO", "CUSTOM"]).default("COBRANCA"),
})

export const registerSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
})

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
})

export type ClientFormData = z.infer<typeof clientSchema>
export type LoanFormData = z.infer<typeof loanSchema>
export type PaymentFormData = z.infer<typeof paymentSchema>
export type SaleFormData = z.infer<typeof saleSchema>
export type VehicleFormData = z.infer<typeof vehicleSchema>
export type ExpenseFormData = z.infer<typeof expenseSchema>
export type EmployeeFormData = z.infer<typeof employeeSchema>
export type TemplateFormData = z.infer<typeof templateSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type LoginFormData = z.infer<typeof loginSchema>

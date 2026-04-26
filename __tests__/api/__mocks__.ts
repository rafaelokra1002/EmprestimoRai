/**
 * Shared mocks for API route tests
 */

// Mock session data
export const mockSession = {
  user: {
    id: "user-test-123",
    name: "Test User",
    email: "test@test.com",
  },
  expires: "2100-01-01T00:00:00.000Z",
}

type MockFn = jest.MockedFunction<(...args: any[]) => any>

type MockPrisma = {
  user: {
    findUnique: MockFn
    create: MockFn
    update: MockFn
  }
  client: {
    findMany: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    delete: MockFn
    count: MockFn
  }
  loan: {
    findMany: MockFn
    findFirst: MockFn
    findUnique: MockFn
    create: MockFn
    update: MockFn
    delete: MockFn
  }
  installment: {
    createMany: MockFn
    findUnique: MockFn
    findMany: MockFn
    update: MockFn
    updateMany: MockFn
    findFirst: MockFn
    count: MockFn
  }
  payment: {
    create: MockFn
    findMany: MockFn
  }
  sale: {
    findMany: MockFn
    create: MockFn
    update: MockFn
    delete: MockFn
  }
  vehicle: {
    findMany: MockFn
    create: MockFn
    update: MockFn
    delete: MockFn
  }
  expense: {
    findMany: MockFn
    create: MockFn
    update: MockFn
    delete: MockFn
  }
  employee: {
    findMany: MockFn
    create: MockFn
    update: MockFn
    delete: MockFn
  }
  whatsAppTemplate: {
    findMany: MockFn
    create: MockFn
    updateMany: MockFn
    deleteMany: MockFn
  }
  $transaction: MockFn
}

// Mock Prisma client
export const mockPrisma: MockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  client: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  loan: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  installment: {
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  sale: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  vehicle: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  expense: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  employee: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  whatsAppTemplate: {
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
}

mockPrisma.$transaction.mockImplementation((fn: (tx: MockPrisma) => unknown) => fn(mockPrisma))

// Setup module mocks
jest.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}))

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}))

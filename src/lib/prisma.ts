import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

// Retry helper for Neon wakeup (P1001 = can't reach DB)
export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 2000): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const isWakeup = err?.code === "P1001" || err?.message?.includes("Can't reach database")
      if (isWakeup && attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * attempt))
        continue
      }
      throw err
    }
  }
  throw new Error("Max retries exceeded")
}

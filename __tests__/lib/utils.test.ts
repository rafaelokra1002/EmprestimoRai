/**
 * Tests for src/lib/utils.ts
 * Covers: cn, formatCurrency, formatDate, getInitials, calculateScore, calculateLoan, generateInstallmentDates
 */
import {
  cn,
  formatCurrency,
  formatDate,
  getInitials,
  calculateScore,
  calculateLoan,
  generateInstallmentDates,
} from "@/lib/utils"

/* ─── cn (class merging) ─── */
describe("cn()", () => {
  it("merges simple class names", () => {
    expect(cn("bg-red-500", "text-white")).toBe("bg-red-500 text-white")
  })

  it("deduplicates conflicting Tailwind classes", () => {
    const result = cn("bg-red-500", "bg-blue-500")
    expect(result).toBe("bg-blue-500")
  })

  it("handles undefined/null/false values", () => {
    expect(cn("px-4", undefined, null, false, "py-2")).toBe("px-4 py-2")
  })
})

/* ─── formatCurrency ─── */
describe("formatCurrency()", () => {
  it("formats integer value in BRL", () => {
    const result = formatCurrency(1000)
    expect(result).toMatch(/1\.000/)
    expect(result).toMatch(/R\$/)
  })

  it("formats decimal value", () => {
    const result = formatCurrency(1234.56)
    expect(result).toMatch(/1\.234/)
  })

  it("formats zero", () => {
    const result = formatCurrency(0)
    expect(result).toMatch(/0/)
  })

  it("formats negative values", () => {
    const result = formatCurrency(-500)
    expect(result).toMatch(/500/)
  })
})

/* ─── formatDate ─── */
describe("formatDate()", () => {
  it("formats Date object to pt-BR", () => {
    const result = formatDate(new Date(2026, 1, 20)) // Feb 20, 2026
    expect(result).toBe("20/02/2026")
  })

  it("formats ISO string", () => {
    const result = formatDate("2026-02-20T12:00:00Z")
    expect(result).toMatch(/20\/02\/2026/)
  })
})

/* ─── getInitials ─── */
describe("getInitials()", () => {
  it("returns first two initials", () => {
    expect(getInitials("João Silva")).toBe("JS")
  })

  it("handles single name", () => {
    expect(getInitials("Maria")).toBe("M")
  })

  it("returns max 2 characters for long names", () => {
    expect(getInitials("Ana Beatriz Costa Santos")).toBe("AB")
  })

  it("handles uppercase correctly", () => {
    expect(getInitials("carlos eduardo")).toBe("CE")
  })
})

/* ─── calculateScore ─── */
describe("calculateScore()", () => {
  it("increases score with on-time payments", () => {
    const score = calculateScore(500, 10, 0, 5000)
    expect(score).toBeGreaterThan(500)
  })

  it("decreases score with late payments", () => {
    const score = calculateScore(500, 0, 10, 0)
    expect(score).toBeLessThan(500)
  })

  it("never goes below 0", () => {
    const score = calculateScore(0, 0, 100, 0)
    expect(score).toBe(0)
  })

  it("never exceeds 1000", () => {
    const score = calculateScore(900, 100, 0, 100000)
    expect(score).toBeLessThanOrEqual(1000)
  })

  it("returns rounded integer", () => {
    const score = calculateScore(500, 3, 1, 1500)
    expect(Number.isInteger(score)).toBe(true)
  })
})

/* ─── calculateLoan ─── */
describe("calculateLoan()", () => {
  describe("PER_INSTALLMENT interest type", () => {
    it("calculates correctly for 10% per installment over 5 months", () => {
      const result = calculateLoan(1000, 10, 5, "PER_INSTALLMENT")
      // Total interest = 1000 * 0.10 * 5 = 500
      expect(result.totalInterest).toBe(500)
      expect(result.totalAmount).toBe(1500)
      expect(result.installmentAmount).toBe(300)
      expect(result.profit).toBe(500)
    })

    it("handles zero interest", () => {
      const result = calculateLoan(1000, 0, 10)
      expect(result.totalInterest).toBe(0)
      expect(result.totalAmount).toBe(1000)
      expect(result.installmentAmount).toBe(100)
    })
  })

  describe("TOTAL interest type", () => {
    it("calculates total interest correctly", () => {
      const result = calculateLoan(1000, 10, 5, "TOTAL")
      // Total interest = 1000 * 0.10 = 100
      expect(result.totalInterest).toBe(100)
      expect(result.totalAmount).toBe(1100)
      expect(result.installmentAmount).toBe(220)
    })
  })

  describe("FIXED_AMOUNT interest type", () => {
    it("uses the fixed amount as total interest", () => {
      const result = calculateLoan(1000, 0, 5, "FIXED_AMOUNT", 250)
      expect(result.totalInterest).toBe(250)
      expect(result.totalAmount).toBe(1250)
      expect(result.installmentAmount).toBe(250)
    })
  })

  it("rounds values to 2 decimal places", () => {
    const result = calculateLoan(1000, 7, 3, "PER_INSTALLMENT")
    // totalInterest = 1000*0.07*3 = 210; total = 1210; installment = 403.333...
    expect(result.installmentAmount).toBe(403.33)
    expect(result.totalAmount).toBe(1210)
  })
})

/* ─── generateInstallmentDates ─── */
describe("generateInstallmentDates()", () => {
  it("generates correct number of dates", () => {
    const dates = generateInstallmentDates(new Date(2026, 0, 15), 6, "MONTHLY")
    expect(dates).toHaveLength(6)
  })

  it("generates monthly dates", () => {
    const dates = generateInstallmentDates(new Date(2026, 0, 15), 3, "MONTHLY")
    expect(dates[0].getMonth()).toBe(0) // Jan
    expect(dates[1].getMonth()).toBe(1) // Feb
    expect(dates[2].getMonth()).toBe(2) // Mar
  })

  it("generates biweekly dates (15 day intervals)", () => {
    const start = new Date(2026, 0, 1)
    const dates = generateInstallmentDates(start, 3, "BIWEEKLY")
    expect(dates[1].getDate()).toBe(16)
    expect(dates[2].getDate()).toBe(31)
  })

  it("generates weekly dates (7 day intervals)", () => {
    const start = new Date(2026, 0, 5) // Monday
    const dates = generateInstallmentDates(start, 4, "WEEKLY")
    expect(dates[1].getDate()).toBe(12)
    expect(dates[2].getDate()).toBe(19)
    expect(dates[3].getDate()).toBe(26)
  })

  it("generates daily dates", () => {
    const start = new Date(2026, 0, 1)
    const dates = generateInstallmentDates(start, 3, "DAILY")
    expect(dates[0].getDate()).toBe(1)
    expect(dates[1].getDate()).toBe(2)
    expect(dates[2].getDate()).toBe(3)
  })

  it("skips Saturday when configured", () => {
    // 2026-01-10 is a Saturday
    const start = new Date(2026, 0, 10)
    const dates = generateInstallmentDates(start, 1, "MONTHLY", true, false)
    // Should skip to Monday (Jan 12)
    expect(dates[0].getDay()).not.toBe(6) // Not Saturday
  })

  it("skips Sunday when configured", () => {
    // 2026-01-11 is a Sunday
    const start = new Date(2026, 0, 11)
    const dates = generateInstallmentDates(start, 1, "MONTHLY", false, true)
    // Should skip to Monday (Jan 12)
    expect(dates[0].getDay()).not.toBe(0) // Not Sunday
  })
})

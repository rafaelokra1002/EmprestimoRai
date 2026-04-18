import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { employeeSchema } from "@/lib/validations"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const employees = await prisma.employee.findMany({
      where: { userId: (session.user as any).id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(employees)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const data = employeeSchema.parse(body)

    const employee = await prisma.employee.create({
      data: {
        ...data,
        userId: (session.user as any).id,
      },
    })

    return NextResponse.json(employee, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

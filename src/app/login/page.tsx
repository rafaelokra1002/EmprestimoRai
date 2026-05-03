"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, LoginFormData } from "@/lib/validations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Banknote, Loader2 } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true)
    setError("")

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      setError("Email ou senha inválidos")
      setLoading(false)
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div className="relative min-h-screen bg-white dark:bg-zinc-900 flex items-center justify-center p-4 overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-cover"
        style={{ backgroundImage: "url('/money-bg.svg')" }}
      />
      <div className="absolute inset-0 bg-white dark:bg-zinc-900/70" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Banknote className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">SP Cobrança Fácil</h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-2">Gestão Financeira e Crédito</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-6">Entrar</h2>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/300/10 border border-red-500/20 text-red-600 text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} className="mt-1" />
              {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="••••••" {...register("password")} className="mt-1" />
              {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </form>

          <p className="text-sm text-gray-500 dark:text-zinc-400 text-center mt-4">
            Não tem conta?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

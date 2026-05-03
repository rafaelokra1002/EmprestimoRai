"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, User, Phone, FileText, Mail, MapPin, Briefcase, DollarSign } from "lucide-react"

export default function RegistroPage() {
  const { token } = useParams<{ token: string }>()
  const [form, setForm] = useState({
    name: "",
    phone: "",
    document: "",
    email: "",
    city: "",
    profession: "",
    income: "",
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao enviar cadastro")
      } else {
        setSuccess(true)
      }
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white border border-gray-200 shadow-sm p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Cadastro enviado!</h1>
          <p className="mt-2 text-sm text-gray-500">Seus dados foram recebidos com sucesso. Em breve entraremos em contato.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-sm p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Cadastro de Cliente</h1>
          <p className="mt-1 text-sm text-gray-500">Preencha seus dados para se cadastrar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field icon={<User className="h-4 w-4" />} label="Nome completo" required>
            <input
              required
              placeholder="Seu nome completo"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.name}
              onChange={set("name")}
            />
          </Field>

          <Field icon={<Phone className="h-4 w-4" />} label="Telefone" required>
            <input
              required
              placeholder="(00) 00000-0000"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.phone}
              onChange={set("phone")}
            />
          </Field>

          <Field icon={<FileText className="h-4 w-4" />} label="CPF">
            <input
              placeholder="000.000.000-00"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.document}
              onChange={set("document")}
            />
          </Field>

          <Field icon={<Mail className="h-4 w-4" />} label="E-mail">
            <input
              type="email"
              placeholder="seu@email.com"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.email}
              onChange={set("email")}
            />
          </Field>

          <Field icon={<MapPin className="h-4 w-4" />} label="Cidade">
            <input
              placeholder="Sua cidade"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.city}
              onChange={set("city")}
            />
          </Field>

          <Field icon={<Briefcase className="h-4 w-4" />} label="Profissão">
            <input
              placeholder="Sua profissão"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.profession}
              onChange={set("profession")}
            />
          </Field>

          <Field icon={<DollarSign className="h-4 w-4" />} label="Renda mensal">
            <input
              type="number"
              placeholder="0,00"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.income}
              onChange={set("income")}
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Enviando..." : "Enviar Cadastro"}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({
  icon,
  label,
  required,
  children,
}: {
  icon: React.ReactNode
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <span className="text-gray-400">{icon}</span>
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

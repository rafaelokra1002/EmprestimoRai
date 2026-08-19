"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { isValidCPF } from "@/lib/validations"
import { Search, Building2, User, Lock, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

function cnpjMask(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

function cpfMask(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

interface CnpjResult {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  situacao: string
  dataAbertura: string
  porte: string
  naturezaJuridica: string
  capitalSocial: number
  cnae: string
  telefone: string
  email: string
  endereco: { logradouro: string; numero: string; complemento: string; bairro: string; municipio: string; uf: string; cep: string }
  socios: { nome: string; qualificacao: string }[]
}

export default function ConsultasPage() {
  // ── CNPJ ──────────────────────────────────────────────
  const [cnpj, setCnpj] = useState("")
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjError, setCnpjError] = useState<string | null>(null)
  const [cnpjResult, setCnpjResult] = useState<CnpjResult | null>(null)

  const consultarCnpj = async () => {
    const digits = cnpj.replace(/\D/g, "")
    setCnpjError(null)
    setCnpjResult(null)
    if (digits.length !== 14) {
      setCnpjError("Informe um CNPJ com 14 dígitos.")
      return
    }
    setCnpjLoading(true)
    try {
      const res = await fetch(`/api/consultas/cnpj?cnpj=${digits}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Erro na consulta.")
      setCnpjResult(data)
    } catch (e: any) {
      setCnpjError(e.message || "Falha ao consultar CNPJ.")
    }
    setCnpjLoading(false)
  }

  // ── CPF (validação) ───────────────────────────────────
  const [cpf, setCpf] = useState("")
  const [cpfChecked, setCpfChecked] = useState<null | boolean>(null)

  const validarCpf = () => {
    setCpfChecked(isValidCPF(cpf))
  }

  return (
    <div className="space-y-6 pt-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" /> Consultas
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Consultas gratuitas de dados públicos. Crédito (SPC/Serasa) requer contrato com provedor.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── CNPJ ─────────────────────────────── */}
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-zinc-100">Consulta de CNPJ</h2>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Dados públicos da Receita (gratuito)</p>
              </div>
              <Badge variant="success" className="ml-auto">Grátis</Badge>
            </div>

            <div>
              <Label>CNPJ</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(cnpjMask(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && consultarCnpj()}
                  placeholder="00.000.000/0000-00"
                />
                <Button type="button" onClick={consultarCnpj} disabled={cnpjLoading} className="shrink-0">
                  {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-1.5 hidden sm:inline">Consultar</span>
                </Button>
              </div>
              {cnpjError && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> {cnpjError}
                </p>
              )}
            </div>

            {cnpjResult && (
              <div className="rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/40 p-4 space-y-3 text-sm">
                <div>
                  <p className="font-bold text-gray-900 dark:text-zinc-100">{cnpjResult.razaoSocial}</p>
                  {cnpjResult.nomeFantasia && <p className="text-xs text-gray-500 dark:text-zinc-400">{cnpjResult.nomeFantasia}</p>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Situação" value={cnpjResult.situacao} />
                  <Field label="Abertura" value={cnpjResult.dataAbertura ? new Date(cnpjResult.dataAbertura).toLocaleDateString("pt-BR") : "—"} />
                  <Field label="Porte" value={cnpjResult.porte} />
                  <Field label="Natureza" value={cnpjResult.naturezaJuridica} />
                  <div className="col-span-2"><Field label="Atividade (CNAE)" value={cnpjResult.cnae} /></div>
                  <div className="col-span-2">
                    <Field
                      label="Endereço"
                      value={[cnpjResult.endereco.logradouro, cnpjResult.endereco.numero, cnpjResult.endereco.bairro, cnpjResult.endereco.municipio, cnpjResult.endereco.uf]
                        .filter(Boolean)
                        .join(", ")}
                    />
                  </div>
                  {cnpjResult.telefone && <Field label="Telefone" value={cnpjResult.telefone} />}
                  {cnpjResult.email && <Field label="E-mail" value={cnpjResult.email} />}
                </div>
                {cnpjResult.socios.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1">Sócios / Quadro societário</p>
                    <ul className="space-y-0.5">
                      {cnpjResult.socios.map((s, i) => (
                        <li key={i} className="text-xs text-gray-700 dark:text-zinc-300">
                          {s.nome} <span className="text-gray-400 dark:text-zinc-500">— {s.qualificacao}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── CPF (validação) ──────────────────── */}
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-zinc-100">Validação de CPF</h2>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Confere os dígitos verificadores (gratuito)</p>
              </div>
              <Badge variant="success" className="ml-auto">Grátis</Badge>
            </div>

            <div>
              <Label>CPF</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={cpf}
                  onChange={(e) => { setCpf(cpfMask(e.target.value)); setCpfChecked(null) }}
                  onKeyDown={(e) => e.key === "Enter" && validarCpf()}
                  placeholder="000.000.000-00"
                />
                <Button type="button" onClick={validarCpf} className="shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="ml-1.5 hidden sm:inline">Validar</span>
                </Button>
              </div>
              {cpfChecked === true && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> CPF válido (dígitos verificadores conferem).
                </p>
              )}
              {cpfChecked === false && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" /> CPF inválido.
                </p>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              Isso confirma apenas se o número é matematicamente válido — não consulta situação na Receita nem restrições.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Consultas de crédito (em breve) ──────────── */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-zinc-100">Consultas de crédito</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Requer contrato com provedor pago</p>
            </div>
            <Badge variant="warning" className="ml-auto">Em breve</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {["SPC", "Serasa", "Score de Crédito", "SCR (Banco Central)"].map((item) => (
              <div key={item} className="rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 px-3 py-4 text-center text-sm text-gray-500 dark:text-zinc-400">
                <Lock className="mx-auto mb-1.5 h-4 w-4 opacity-60" />
                {item}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400 dark:text-zinc-500">
            Essas consultas não têm API gratuita. Ao fechar contrato com um provedor (Serasa, SPC, Assertiva, etc.), plugamos aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 dark:text-zinc-500">{label}</p>
      <p className="font-medium text-gray-800 dark:text-zinc-200 break-words">{value || "—"}</p>
    </div>
  )
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Consulta gratuita de CNPJ (dados públicos da Receita). Não é consulta de
// crédito/negativação. Tenta BrasilAPI e cai pra cnpj.ws se falhar.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

type CnpjData = {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  situacao: string
  dataAbertura: string
  porte: string
  naturezaJuridica: string
  capitalSocial: number | undefined
  cnae: string
  telefone: string
  email: string
  endereco: { logradouro: string; numero: string; complemento: string; bairro: string; municipio: string; uf: string; cep: string }
  socios: { nome: string; qualificacao: string }[]
}

// Converte número no formato BR ("120000000000,00") para Number.
function parseBRNumber(v: any): number | undefined {
  if (v == null || v === "") return undefined
  const n = Number(String(v).replace(/\./g, "").replace(",", "."))
  return isNaN(n) ? undefined : n
}

// API própria (self-hosted). Fonte principal.
const CNPJ_API = process.env.CNPJ_API_URL || "http://45.159.229.234:3020/cnpj"

async function fromUserApi(cnpj: string): Promise<CnpjData | null> {
  const res = await fetch(`${CNPJ_API}/${cnpj}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  const d = await res.json()
  if (!d || !d.razao_social) return null
  const tel = Array.isArray(d.telefones) ? d.telefones.find((t: any) => !t.is_fax) || d.telefones[0] : null
  return {
    cnpj: d.cnpj || cnpj,
    razaoSocial: d.razao_social,
    nomeFantasia: d.nome_fantasia,
    situacao: d.situacao_cadastral,
    dataAbertura: d.data_inicio_atividade,
    porte: d.porte_empresa,
    naturezaJuridica: d.natureza_juridica,
    capitalSocial: parseBRNumber(d.capital_social),
    cnae: d.cnae_principal,
    telefone: tel ? `(${tel.ddd}) ${tel.numero}` : "",
    email: d.email,
    endereco: {
      logradouro: d.logradouro,
      numero: d.numero,
      complemento: d.complemento,
      bairro: d.bairro,
      municipio: d.municipio,
      uf: d.uf,
      cep: d.cep,
    },
    socios: Array.isArray(d.QSA) ? d.QSA.map((s: any) => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio })) : [],
  }
}

async function fromBrasilApi(cnpj: string): Promise<CnpjData | null> {
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  const d = await res.json()
  return {
    cnpj: d.cnpj,
    razaoSocial: d.razao_social,
    nomeFantasia: d.nome_fantasia,
    situacao: d.descricao_situacao_cadastral,
    dataAbertura: d.data_inicio_atividade,
    porte: d.porte,
    naturezaJuridica: d.natureza_juridica,
    capitalSocial: d.capital_social,
    cnae: d.cnae_fiscal_descricao,
    telefone: d.ddd_telefone_1,
    email: d.email,
    endereco: {
      logradouro: d.logradouro,
      numero: d.numero,
      complemento: d.complemento,
      bairro: d.bairro,
      municipio: d.municipio,
      uf: d.uf,
      cep: d.cep,
    },
    socios: Array.isArray(d.qsa) ? d.qsa.map((s: any) => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio })) : [],
  }
}

async function fromCnpjWs(cnpj: string): Promise<CnpjData | null> {
  const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  const d = await res.json()
  const est = d.estabelecimento || {}
  return {
    cnpj: est.cnpj || cnpj,
    razaoSocial: d.razao_social,
    nomeFantasia: est.nome_fantasia,
    situacao: est.situacao_cadastral,
    dataAbertura: est.data_inicio_atividade,
    porte: d.porte?.descricao,
    naturezaJuridica: d.natureza_juridica?.descricao,
    capitalSocial: d.capital_social ? Number(d.capital_social) : undefined,
    cnae: est.atividade_principal?.descricao,
    telefone: est.telefone1 ? `(${est.ddd1 || ""}) ${est.telefone1}`.trim() : "",
    email: est.email,
    endereco: {
      logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(" "),
      numero: est.numero,
      complemento: est.complemento,
      bairro: est.bairro,
      municipio: est.cidade?.nome,
      uf: est.estado?.sigla,
      cep: est.cep,
    },
    socios: Array.isArray(d.socios) ? d.socios.map((s: any) => ({ nome: s.nome, qualificacao: s.qualificacao_socio?.descricao || "" })) : [],
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const cnpj = (req.nextUrl.searchParams.get("cnpj") || "").replace(/\D/g, "")
  if (cnpj.length !== 14) {
    return NextResponse.json({ error: "CNPJ inválido. Informe 14 dígitos." }, { status: 400 })
  }

  try {
    let data = await fromUserApi(cnpj).catch(() => null)
    if (!data) data = await fromBrasilApi(cnpj).catch(() => null)
    if (!data) data = await fromCnpjWs(cnpj).catch(() => null)
    if (!data) {
      return NextResponse.json(
        { error: "CNPJ não encontrado ou serviço de consulta indisponível no momento. Tente novamente." },
        { status: 404 }
      )
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Falha ao consultar CNPJ." }, { status: 500 })
  }
}

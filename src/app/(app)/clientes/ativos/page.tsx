"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, CheckCircle } from "lucide-react"

interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  address: string | null
  hasActiveLoan: boolean
}

export default function ClientesAtivosPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        const active = (data || []).filter((c: Client) => c.hasActiveLoan)
        setClients(active)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.document?.includes(search) ||
      c.phone?.includes(search)
  )

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pt-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Clientes Ativos</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Clientes com empréstimos ativos</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nome, CPF ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 dark:text-zinc-400 py-8">
                    Nenhum cliente ativo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.document || "—"}</TableCell>
                    <TableCell>{client.phone || "—"}</TableCell>
                    <TableCell>{client.address || "—"}</TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Ativo
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Search, MapPin } from "lucide-react"

interface CityGroup {
  city: string
  count: number
  clients: { id: string; name: string; phone: string | null; document: string | null }[]
}

export default function ClientesCidadesPage() {
  const [cities, setCities] = useState<CityGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        const grouped: Record<string, CityGroup> = {}
        for (const client of data || []) {
          const city = client.city || client.address?.split(",").pop()?.trim() || "Não informado"
          if (!grouped[city]) {
            grouped[city] = { city, count: 0, clients: [] }
          }
          grouped[city].count++
          grouped[city].clients.push({
            id: client.id,
            name: client.name,
            phone: client.phone,
            document: client.document,
          })
        }
        const sorted = Object.values(grouped).sort((a, b) => b.count - a.count)
        setCities(sorted)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = cities.filter((c) =>
    c.city.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Clientes por Cidade</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Distribuição dos clientes por cidade</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por cidade..."
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
                <TableHead>Cidade</TableHead>
                <TableHead>Quantidade de Clientes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-gray-500 dark:text-zinc-400 py-8">
                    Nenhuma cidade encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((city) => (
                  <TableRow key={city.city}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-emerald-500" />
                        {city.city}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {city.count}
                      </span>
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

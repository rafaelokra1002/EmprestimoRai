"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Receipt, Calculator } from "lucide-react"

export default function ChequePage() {
  const [valor, setValor] = useState(0)
  const [taxa, setTaxa] = useState(3)
  const [dias, setDias] = useState(30)
  const [resultado, setResultado] = useState<{ desconto: number; valorLiquido: number; taxaEfetiva: number } | null>(null)

  const calcular = () => {
    const taxaDiaria = taxa / 30
    const desconto = valor * (taxaDiaria / 100) * dias
    const valorLiquido = valor - desconto
    const taxaEfetiva = (desconto / valor) * 100

    setResultado({
      desconto: Math.round(desconto * 100) / 100,
      valorLiquido: Math.round(valorLiquido * 100) / 100,
      taxaEfetiva: Math.round(taxaEfetiva * 100) / 100,
    })
  }

  return (
    <div className="space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          Desconto de Cheque
        </h1>
        <p className="text-gray-500 dark:text-zinc-400">Simule a antecipação de cheques</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados do Cheque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Valor do Cheque (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valor || ""}
                onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
                className="mt-1"
                placeholder="Ex: 1000.00"
              />
            </div>
            <div>
              <Label>Taxa Mensal (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={taxa || ""}
                onChange={(e) => setTaxa(parseFloat(e.target.value) || 0)}
                className="mt-1"
                placeholder="Ex: 3.0"
              />
            </div>
            <div>
              <Label>Dias para Vencimento</Label>
              <Input
                type="number"
                value={dias || ""}
                onChange={(e) => setDias(parseInt(e.target.value) || 0)}
                className="mt-1"
                placeholder="Ex: 30"
              />
            </div>
            <Button onClick={calcular} className="w-full">
              <Calculator className="h-4 w-4 mr-2" /> Calcular Desconto
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            {resultado ? (
              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-gray-100 dark:bg-zinc-800/50 border border-gray-300 dark:border-zinc-700">
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Valor do Cheque</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{formatCurrency(valor)}</p>
                </div>
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/300/5 border border-red-500/20">
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Desconto</p>
                  <p className="text-2xl font-bold text-red-600">- {formatCurrency(resultado.desconto)}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Taxa efetiva: {resultado.taxaEfetiva}%</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/5 dark:bg-primary/150/5 border border-primary/30 dark:border-primary/30">
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Valor Líquido (a pagar)</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(resultado.valorLiquido)}</p>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/300/5 border border-blue-500/20">
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Seu Lucro</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(resultado.desconto)}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                    Taxa: {taxa}% a.m. | {dias} dias
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-zinc-400">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Preencha os dados e clique em calcular</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

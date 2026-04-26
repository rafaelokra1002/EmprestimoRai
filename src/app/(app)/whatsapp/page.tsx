"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { templateSchema, TemplateFormData } from "@/lib/validations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, MessageSquare, Copy, Pencil } from "lucide-react"

const VARIABLES = [
  { name: "{CLIENTE}", desc: "Nome do cliente" },
  { name: "{VALOR}", desc: "Valor da parcela" },
  { name: "{DATA}", desc: "Data de vencimento" },
  { name: "{DIAS_ATRASO}", desc: "Dias de atraso" },
  { name: "{TOTAL}", desc: "Valor total" },
  { name: "{PIX}", desc: "Chave PIX" },
]

const TYPE_LABELS: Record<string, string> = {
  COBRANCA: "Cobrança",
  LEMBRETE: "Lembrete",
  CONFIRMACAO: "Confirmação",
  CUSTOM: "Personalizado",
}

export default function WhatsAppPage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [preview, setPreview] = useState("")
  const [loading, setLoading] = useState(true)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
  })

  const content = watch("content")

  useEffect(() => {
    if (content) {
      let prev = content
      prev = prev.replace("{CLIENTE}", "João Silva")
      prev = prev.replace("{VALOR}", "R$ 500,00")
      prev = prev.replace("{DATA}", "15/03/2026")
      prev = prev.replace("{DIAS_ATRASO}", "5")
      prev = prev.replace("{TOTAL}", "R$ 3.000,00")
      prev = prev.replace("{PIX}", "12.345.678/0001-00")
      setPreview(prev)
    }
  }, [content])

  const fetchTemplates = async () => {
    const res = await fetch("/api/templates")
    const data = await res.json()
    setTemplates(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchTemplates() }, [])

  const onSubmit = async (data: TemplateFormData) => {
    if (editing) {
      await fetch(`/api/templates/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    } else {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    }
    setDialogOpen(false)
    setEditing(null)
    reset()
    fetchTemplates()
  }

  const handleEdit = (template: any) => {
    setEditing(template)
    reset({ name: template.name, content: template.content, type: template.type })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Excluir este template?")) {
      await fetch(`/api/templates/${id}`, { method: "DELETE" })
      fetchTemplates()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-emerald-500" />
            Relatórios Automáticos (WhatsApp)
          </h1>
          <p className="text-gray-500 dark:text-zinc-400">Templates de mensagem para cobranças</p>
        </div>
        <Button onClick={() => { setEditing(null); reset({ name: "", content: "", type: "COBRANCA" }); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Template
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Variáveis Disponíveis</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {VARIABLES.map((v) => (
              <button
                key={v.name}
                onClick={() => copyToClipboard(v.name)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 dark:bg-zinc-700 transition-colors"
                title={v.desc}
              >
                <span className="text-emerald-600 font-mono">{v.name}</span>
                <span className="text-gray-400 dark:text-zinc-500 ml-2">{v.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-gray-500 dark:text-zinc-400 col-span-full text-center py-8">Carregando...</p>
        ) : templates.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-zinc-400">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum template criado</p>
            <p className="text-sm mt-2">Crie templates de mensagem para cobranças via WhatsApp</p>
          </div>
        ) : (
          templates.map((template: any) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <Badge variant="default">{TYPE_LABELS[template.type] || template.type}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 dark:bg-zinc-800/50 rounded-lg p-3 mb-4 text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                  {template.content}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(template.content)}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(template)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                    <Trash2 className="h-3 w-3 mr-1 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? "Editar Template" : "Novo Template"} className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome do Template *</Label>
              <Input {...register("name")} className="mt-1" placeholder="Ex: Cobrança padrão" />
              {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Tipo</Label>
              <select {...register("type")} className="flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 mt-1">
                <option value="COBRANCA">Cobrança</option>
                <option value="LEMBRETE">Lembrete</option>
                <option value="CONFIRMACAO">Confirmação</option>
                <option value="CUSTOM">Personalizado</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Conteúdo da Mensagem *</Label>
            <Textarea
              {...register("content")}
              className="mt-1 min-h-[120px]"
              placeholder={`Olá {CLIENTE}, sua parcela de {VALOR} vence em {DATA}.\nChave PIX: {PIX}`}
            />
            {errors.content && <p className="text-red-600 text-xs mt-1">{errors.content.message}</p>}
          </div>

          {preview && (
            <div>
              <Label>Preview</Label>
              <div className="mt-1 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap">
                {preview}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit">{editing ? "Salvar" : "Criar"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

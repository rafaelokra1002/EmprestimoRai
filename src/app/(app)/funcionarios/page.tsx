"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { employeeSchema, EmployeeFormData } from "@/lib/validations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, UserCog } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default function FuncionariosPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
  })

  const fetchEmployees = async () => {
    const res = await fetch("/api/employees")
    const data = await res.json()
    setEmployees(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchEmployees() }, [])

  const onSubmit = async (data: EmployeeFormData) => {
    await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    setDialogOpen(false)
    reset()
    fetchEmployees()
  }

  const handleDelete = async (id: string) => {
    if (confirm("Excluir este funcionário?")) {
      await fetch(`/api/employees/${id}`, { method: "DELETE" })
      fetchEmployees()
    }
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <UserCog className="h-6 w-6 text-emerald-500" />
            Funcionários
          </h1>
          <p className="text-gray-500 dark:text-zinc-400">Gerencie sua equipe</p>
        </div>
        <Button onClick={() => { reset({ name: "", email: "", phone: "", role: "USER", salary: 0 }); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Funcionário
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Salário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500 dark:text-zinc-400">Carregando...</TableCell></TableRow>
            ) : employees.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500 dark:text-zinc-400">Nenhum funcionário</TableCell></TableRow>
            ) : (
              employees.map((emp: any) => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.name} size="sm" />
                      <span className="font-medium">{emp.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>{emp.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={emp.role === "ADMIN" ? "default" : "outline"}>
                      {emp.role === "ADMIN" ? "Admin" : "Usuário"}
                    </Badge>
                  </TableCell>
                  <TableCell>{emp.salary ? formatCurrency(emp.salary) : "-"}</TableCell>
                  <TableCell>
                    <Badge variant={emp.active ? "success" : "destructive"}>
                      {emp.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Novo Funcionário">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input {...register("name")} className="mt-1" />
            {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email *</Label>
              <Input {...register("email")} className="mt-1" />
              {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label>Telefone</Label>
              <Input {...register("phone")} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Permissão</Label>
              <select {...register("role")} className="flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 mt-1">
                <option value="USER">Usuário</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <Label>Salário</Label>
              <Input type="number" step="0.01" {...register("salary", { valueAsNumber: true })} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit">Cadastrar</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, User, Phone, FileText, MapPin, Briefcase, DollarSign, Instagram, Camera, X, ImageIcon } from "lucide-react"

interface PhotoFile {
  name: string
  type: string
  dataUrl: string
}

interface Photos {
  docFrente: PhotoFile | null
  docVerso: PhotoFile | null
  selfie: PhotoFile | null
}

const MAX_PHOTO_DIMENSION = 1280
const PHOTO_QUALITY = 0.75

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })
}

async function compressImageFile(file: File) {
  const originalDataUrl = await readFileAsDataUrl(file)
  if (!file.type.startsWith("image/")) return originalDataUrl

  try {
    const image = await loadImage(originalDataUrl)
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) return originalDataUrl
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL("image/jpeg", PHOTO_QUALITY)
  } catch {
    return originalDataUrl
  }
}

export default function RegistroPage() {
  const { token } = useParams<{ token: string }>()
  const [form, setForm] = useState({
    name: "",
    phone: "",
    document: "",
    instagram: "",
    income: "",
    zipCode: "",
    address: "",
    number: "",
    neighborhood: "",
    complement: "",
    city: "",
    state: "",
    profession: "",
  })
  const [photos, setPhotos] = useState<Photos>({
    docFrente: null,
    docVerso: null,
    selfie: null,
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handlePhotoChange = (field: keyof Photos) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await compressImageFile(file)
      setPhotos((prev) => ({ ...prev, [field]: { name: file.name, type: "image/jpeg", dataUrl } }))
    } catch {
      setError("Nao foi possivel carregar a foto. Tente novamente.")
    } finally {
      e.target.value = ""
    }
  }

  const removePhoto = (field: keyof Photos) => () =>
    setPhotos((prev) => ({ ...prev, [field]: null }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form, photos }),
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
          {/* Dados pessoais */}
          <Field icon={<User className="h-4 w-4" />} label="Nome completo" required>
            <input
              required
              placeholder="Seu nome completo"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.name}
              onChange={set("name")}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field icon={<Phone className="h-4 w-4" />} label="Telefone (com DDD)" required>
              <input
                required
                placeholder="(11) 91234-5678"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.phone}
                onChange={set("phone")}
              />
            </Field>

            <Field icon={<FileText className="h-4 w-4" />} label="CPF" required>
              <input
                required
                placeholder="000.000.000-00"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.document}
                onChange={set("document")}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field icon={<Instagram className="h-4 w-4" />} label="Instagram">
              <input
                placeholder="@usuario"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.instagram}
                onChange={set("instagram")}
              />
            </Field>

            <Field icon={<DollarSign className="h-4 w-4" />} label="Renda mensal">
              <input
                type="number"
                placeholder="0,00"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.income}
                onChange={set("income")}
              />
            </Field>
          </div>

          <Field icon={<Briefcase className="h-4 w-4" />} label="Profissão">
            <input
              placeholder="Sua profissão"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.profession}
              onChange={set("profession")}
            />
          </Field>

          {/* Endereço */}
          <div className="pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Endereço</p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field icon={<MapPin className="h-4 w-4" />} label="CEP">
                <input
                  placeholder="00000-000"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={form.zipCode}
                  onChange={set("zipCode")}
                />
              </Field>
              <Field icon={null} label="Número">
                <input
                  placeholder="Nº"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={form.number}
                  onChange={set("number")}
                />
              </Field>
            </div>

            <div className="space-y-3">
              <Field icon={null} label="Rua">
                <input
                  placeholder="Nome da rua"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={form.address}
                  onChange={set("address")}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field icon={null} label="Bairro">
                  <input
                    placeholder="Seu bairro"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={form.neighborhood}
                    onChange={set("neighborhood")}
                  />
                </Field>
                <Field icon={null} label="Complemento">
                  <input
                    placeholder="Apto, bloco..."
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={form.complement}
                    onChange={set("complement")}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field icon={null} label="Cidade">
                    <input
                      placeholder="Sua cidade"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={form.city}
                      onChange={set("city")}
                    />
                  </Field>
                </div>
                <Field icon={null} label="UF">
                  <input
                    placeholder="SP"
                    maxLength={2}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                    value={form.state}
                    onChange={set("state")}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Fotos de documentos */}
          <div className="pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Fotos dos Documentos</p>
            <div className="space-y-3">
              <PhotoUpload
                label="RG / CNH — Frente"
                photo={photos.docFrente}
                onSelect={handlePhotoChange("docFrente")}
                onRemove={removePhoto("docFrente")}
              />
              <PhotoUpload
                label="RG / CNH — Verso"
                photo={photos.docVerso}
                onSelect={handlePhotoChange("docVerso")}
                onRemove={removePhoto("docVerso")}
              />
              <PhotoUpload
                label="Selfie segurando o documento"
                photo={photos.selfie}
                onSelect={handlePhotoChange("selfie")}
                onRemove={removePhoto("selfie")}
              />
            </div>
          </div>

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

        <p className="mt-6 text-center text-xs text-gray-400">Powered by CobraFácil</p>
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
        {icon && <span className="text-gray-400">{icon}</span>}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function PhotoUpload({
  label,
  photo,
  onSelect,
  onRemove,
}: {
  label: string
  photo: PhotoFile | null
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-3">
      <p className="mb-2 text-xs font-medium text-gray-600">{label}</p>
      {photo ? (
        <div className="flex items-center gap-2">
          {photo.type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.dataUrl} alt={label} className="h-16 w-24 rounded object-cover border border-gray-200" />
          ) : (
            <div className="flex h-16 w-24 items-center justify-center rounded bg-gray-100 border border-gray-200">
              <ImageIcon className="h-6 w-6 text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 truncate">{photo.name}</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="flex-shrink-0 rounded-full p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Camera className="h-4 w-4" />
          Tirar foto / Selecionar arquivo
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onSelect}
      />
    </div>
  )
}

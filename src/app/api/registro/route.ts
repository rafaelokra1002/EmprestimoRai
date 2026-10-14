import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface PhotoFile {
  name: string
  type: string
  dataUrl: string
}

const PHOTO_TYPE_MAP: Record<string, string> = {
  docFrente: "RG",
  docVerso: "RG",
  selfie: "SELFIE",
}

const PHOTO_NAME_MAP: Record<string, string> = {
  docFrente: "Documento - Frente",
  docVerso: "Documento - Verso",
  selfie: "Selfie com Documento",
}

function decodeRegistrationToken(token: unknown) {
  if (typeof token !== "string" || !token.trim()) return null

  try {
    const decodedToken = decodeURIComponent(token.trim())
    const normalized = decodedToken.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
    const userId = Buffer.from(padded, "base64").toString("utf-8").trim()
    return userId || null
  } catch {
    return null
  }
}

function parseOptionalMoney(value: unknown) {
  if (value === undefined || value === null || value === "") return null
  const normalized = typeof value === "string" ? value.replace(",", ".") : value
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

interface Coordinates {
  latitude: number
  longitude: number
  accuracy: number | null
}

function parseCoordinates(value: unknown): Coordinates | null {
  if (!value || typeof value !== "object") return null
  const { latitude, longitude, accuracy } = value as Record<string, unknown>
  if (typeof latitude !== "number" || typeof longitude !== "number") return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return {
    latitude,
    longitude,
    accuracy: typeof accuracy === "number" && Number.isFinite(accuracy) ? accuracy : null,
  }
}

async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: { "User-Agent": "EmprestimoRai-App/1.0" },
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    const addr = data?.address
    if (!addr) return null

    const line1 = [addr.road, addr.house_number].filter(Boolean).join(", ")
    const neighborhood = addr.suburb || addr.neighbourhood || addr.village
    const line1Full = [line1, neighborhood].filter(Boolean).join(", ")
    const city = addr.city || addr.town || addr.municipality
    const line2 = [city && addr.state ? `${city} - ${addr.state}` : city || addr.state, addr.postcode]
      .filter(Boolean)
      .join(", ")

    return [line1Full, line2].filter(Boolean).join("\n") || null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const {
      token,
      name,
      phone,
      document,
      instagram,
      income,
      zipCode,
      address,
      number,
      neighborhood,
      complement,
      city,
      state,
      profession,
      housingType,
      photos,
      location,
    } = await request.json()

    if (!token || !name || !phone) {
      return NextResponse.json({ error: "Nome e telefone sao obrigatorios" }, { status: 400 })
    }

    const userId = decodeRegistrationToken(token)
    if (!userId) {
      return NextResponse.json({ error: "Link de cadastro invalido" }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Link de cadastro invalido" }, { status: 404 })
    }

    const selfieDataUrl = (photos as Record<string, PhotoFile | null>)?.selfie?.dataUrl || null

    const coordinates = parseCoordinates(location)
    const requestAddressApprox = coordinates
      ? await reverseGeocode(coordinates.latitude, coordinates.longitude)
      : null

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        name: name.trim(),
        phone: phone || null,
        document: document || null,
        instagram: instagram || null,
        income: parseOptionalMoney(income),
        zipCode: zipCode || null,
        address: address || null,
        number: number || null,
        neighborhood: neighborhood || null,
        complement: complement || null,
        city: city || null,
        state: state || null,
        profession: profession || null,
        housingType: housingType || null,
        photo: selfieDataUrl,
        status: "INACTIVE",
        score: 100,
        requestLatitude: coordinates?.latitude ?? null,
        requestLongitude: coordinates?.longitude ?? null,
        requestAccuracy: coordinates?.accuracy ?? null,
        requestLocationAt: coordinates ? new Date() : null,
        requestAddressApprox,
      },
    })

    if (photos && typeof photos === "object") {
      const docEntries = Object.entries(photos as Record<string, PhotoFile | null>)
      for (const [key, photo] of docEntries) {
        if (!photo?.dataUrl) continue
        const base64 = photo.dataUrl.includes(",") ? photo.dataUrl.split(",")[1] : photo.dataUrl
        try {
          await prisma.clientDocument.create({
            data: {
              clientId: client.id,
              name: PHOTO_NAME_MAP[key] ?? photo.name,
              type: PHOTO_TYPE_MAP[key] ?? "OUTRO",
              fileData: base64,
              fileType: photo.type,
            },
          })
        } catch (documentError) {
          console.error("[POST /api/registro] Erro ao salvar documento:", documentError)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao cadastrar" }, { status: 500 })
  }
}

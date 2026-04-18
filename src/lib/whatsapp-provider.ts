type ProviderStatus = {
  connected: boolean
  state: string
  qrCode?: string
}

const getConfig = () => {
  const baseUrl = process.env.WHATSAPP_BASE_URL || ""
  const apiKey = process.env.WHATSAPP_API_KEY || ""
  const instance = process.env.WHATSAPP_INSTANCE || ""
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    instance,
    enabled: Boolean(baseUrl && apiKey && instance),
  }
}

const buildHeaders = (apiKey: string) => ({
  "Content-Type": "application/json",
  apikey: apiKey,
})

const extractQrCode = (payload: any): string | undefined => {
  const raw =
    payload?.base64 ||
    payload?.qrcode?.base64 ||
    payload?.qrcode ||
    payload?.qr ||
    payload?.code ||
    payload?.data?.base64 ||
    payload?.data?.qrcode ||
    payload?.data?.qr ||
    payload?.pairingCode

  if (!raw || typeof raw !== "string") return undefined
  if (raw.startsWith("data:image")) return raw
  if (/^[A-Za-z0-9+/=\n\r]+$/.test(raw) && raw.length > 100) {
    return `data:image/png;base64,${raw.replace(/\s/g, "")}`
  }
  return undefined
}

const normalizeState = (payload: any): string => {
  const state =
    payload?.instance?.state ||
    payload?.state ||
    payload?.status ||
    payload?.data?.state ||
    payload?.data?.status ||
    "unknown"
  return String(state).toLowerCase()
}

const isConnectedState = (state: string) =>
  ["open", "connected", "online"].includes(state.toLowerCase())

const tryRequest = async (
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: any
) => {
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return response.json()
  }
  return null
}

export const whatsappProvider = {
  async ensureInstance(): Promise<void> {
    const config = getConfig()
    if (!config.enabled) return

    const headers = buildHeaders(config.apiKey)

    // Check if instance exists
    try {
      await tryRequest(
        "GET",
        `${config.baseUrl}/instance/connectionState/${config.instance}`,
        headers
      )
      return // instance exists
    } catch {
      // instance doesn't exist, create it
    }

    try {
      await tryRequest(
        "POST",
        `${config.baseUrl}/instance/create`,
        headers,
        {
          instanceName: config.instance,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }
      )
    } catch {
      // May already exist or different API version, continue
    }
  },

  async status(): Promise<ProviderStatus> {
    const config = getConfig()
    if (!config.enabled) {
      return { connected: false, state: "not_configured" }
    }

    const headers = buildHeaders(config.apiKey)

    // Try multiple endpoint patterns (Evolution API v1 and v2)
    const stateEndpoints = [
      `${config.baseUrl}/instance/connectionState/${config.instance}`,
      `${config.baseUrl}/instance/fetchInstances?instanceName=${config.instance}`,
    ]

    let statePayload: any = null
    for (const url of stateEndpoints) {
      try {
        statePayload = await tryRequest("GET", url, headers)
        break
      } catch {
        continue
      }
    }

    // For fetchInstances, extract from array
    if (Array.isArray(statePayload)) {
      statePayload = statePayload[0] || null
    }

    let qrPayload: any = null
    try {
      qrPayload = await tryRequest(
        "GET",
        `${config.baseUrl}/instance/connect/${config.instance}`,
        headers
      )
    } catch {
      // no QR available
    }

    const state = normalizeState(statePayload || qrPayload)
    const qrCode = extractQrCode(qrPayload) || extractQrCode(statePayload)

    return {
      connected: isConnectedState(state),
      state,
      qrCode,
    }
  },

  async connect(): Promise<ProviderStatus> {
    const config = getConfig()
    if (!config.enabled) {
      return { connected: false, state: "not_configured" }
    }

    await this.ensureInstance()

    const headers = buildHeaders(config.apiKey)

    // Try connect endpoints (Evolution API v2 uses GET /instance/connect/)
    const candidates = [
      { method: "GET", url: `${config.baseUrl}/instance/connect/${config.instance}` },
      { method: "POST", url: `${config.baseUrl}/instance/connect/${config.instance}` },
      { method: "GET", url: `${config.baseUrl}/instance/qrcode/${config.instance}` },
    ]

    for (const candidate of candidates) {
      try {
        const payload = await tryRequest(candidate.method, candidate.url, headers)
        const state = normalizeState(payload)
        const qrCode = extractQrCode(payload)
        if (qrCode || isConnectedState(state)) {
          return {
            connected: isConnectedState(state),
            state: state || "connecting",
            qrCode,
          }
        }
      } catch {
        continue
      }
    }

    return this.status()
  },

  async disconnect(): Promise<ProviderStatus> {
    const config = getConfig()
    if (!config.enabled) {
      return { connected: false, state: "not_configured" }
    }

    const headers = buildHeaders(config.apiKey)
    const candidates = [
      { method: "DELETE", url: `${config.baseUrl}/instance/logout/${config.instance}` },
      { method: "POST", url: `${config.baseUrl}/instance/logout/${config.instance}` },
      { method: "DELETE", url: `${config.baseUrl}/instance/disconnect/${config.instance}` },
    ]

    for (const candidate of candidates) {
      try {
        await tryRequest(candidate.method, candidate.url, headers)
        break
      } catch {
        continue
      }
    }

    return this.status()
  },
}

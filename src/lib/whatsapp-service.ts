import { Boom } from "@hapi/boom"
import * as QRCode from "qrcode"
import path from "path"
import fs from "fs"

async function loadBaileys() {
  const baileys = await import("@whiskeysockets/baileys")
  return {
    makeWASocket: baileys.default,
    DisconnectReason: baileys.DisconnectReason,
    useMultiFileAuthState: baileys.useMultiFileAuthState,
    fetchLatestBaileysVersion: baileys.fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore: baileys.makeCacheableSignalKeyStore,
  }
}

type ConnectionState = {
  connected: boolean
  state: string
  qrCode?: string
}

// Use globalThis to survive Next.js HMR reloads (same pattern as Prisma)
const globalForWA = globalThis as unknown as {
  __waState?: {
    sock: any
    currentQr: string | null
    connectionState: "disconnected" | "connecting" | "open"
    connecting: boolean
    reconnectAttempts: number
    initialized: boolean
  }
}

if (!globalForWA.__waState) {
  globalForWA.__waState = {
    sock: null,
    currentQr: null,
    connectionState: "disconnected",
    connecting: false,
    reconnectAttempts: 0,
    initialized: false,
  }
}

const wa = globalForWA.__waState
const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR || path.join(process.cwd(), ".whatsapp-auth")
const MAX_RECONNECT_ATTEMPTS = 3

const ensureAuthDir = () => {
  console.log("[WhatsApp] AUTH_DIR:", AUTH_DIR)
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
    console.log("[WhatsApp] Created auth directory")
  }
}

const cleanupSocket = () => {
  if (wa.sock) {
    try { wa.sock.ev.removeAllListeners("connection.update") } catch {}
    try { wa.sock.ev.removeAllListeners("creds.update") } catch {}
    try { wa.sock.end(undefined) } catch {}
    wa.sock = null
  }
}

const startSocket = async (): Promise<void> => {
  if (wa.connecting) {
    console.log("[WhatsApp] Already connecting, skipping...")
    return
  }
  wa.connecting = true

  try {
    cleanupSocket()
    ensureAuthDir()

    const { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = await loadBaileys()
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion()

    const newSock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, undefined as any),
      },
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
    })

    wa.sock = newSock

    newSock.ev.on("creds.update", saveCreds)

    newSock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        try {
          wa.currentQr = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          })
        } catch {
          wa.currentQr = null
        }
        wa.connectionState = "connecting"
      }

      if (connection === "open") {
        console.log("[WhatsApp] Connected successfully")
        wa.connectionState = "open"
        wa.currentQr = null
        wa.connecting = false
        wa.reconnectAttempts = 0
      }

      if (connection === "close") {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
        console.log("[WhatsApp] Connection closed, reason:", reason)
        wa.connecting = false

        if (reason === DisconnectReason.loggedOut) {
          try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }) } catch {}
          wa.connectionState = "disconnected"
          wa.currentQr = null
          wa.sock = null
          wa.reconnectAttempts = 0
        } else if (reason === 440) {
          // Conflict: another socket replaced this one. Do NOT reconnect.
          console.log("[WhatsApp] Conflict (replaced by another session), stopping reconnect")
          wa.connectionState = "disconnected"
          wa.currentQr = null
          wa.sock = null
        } else if (
          (reason === DisconnectReason.restartRequired || reason === 515) &&
          wa.reconnectAttempts < MAX_RECONNECT_ATTEMPTS
        ) {
          wa.reconnectAttempts++
          wa.connectionState = "connecting"
          wa.sock = null
          console.log(`[WhatsApp] Reconnecting (attempt ${wa.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`)
          setTimeout(() => startSocket(), 2000 * wa.reconnectAttempts)
        } else {
          wa.connectionState = "disconnected"
          wa.currentQr = null
          wa.sock = null
          if (wa.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log("[WhatsApp] Max reconnect attempts reached, stopping")
            wa.reconnectAttempts = 0
          }
        }
      }
    })
  } catch (err: any) {
    console.error("[WhatsApp] Error starting socket:", err?.message || err)
    console.error("[WhatsApp] Stack:", err?.stack)
    wa.connecting = false
    wa.connectionState = "disconnected"
  }
}

export const whatsappService = {
  async connect(): Promise<ConnectionState> {
    if (wa.sock && wa.connectionState === "open") {
      return { connected: true, state: "open" }
    }

    wa.reconnectAttempts = 0
    cleanupSocket()
    wa.connecting = false
    wa.currentQr = null
    wa.connectionState = "connecting"

    await startSocket()

    const start = Date.now()
    const timeout = 25000
    console.log("[WhatsApp] Waiting for QR code or connection...")
    while (Date.now() - start < timeout) {
      if ((wa.connectionState as string) === "open") {
        return { connected: true, state: "open" }
      }
      if (wa.currentQr) {
        return { connected: false, state: "qr_ready", qrCode: wa.currentQr }
      }
      await new Promise((r) => setTimeout(r, 500))
    }

    return {
      connected: false,
      state: wa.currentQr ? "qr_ready" : wa.connectionState,
      qrCode: wa.currentQr || undefined,
    }
  },

  async status(): Promise<ConnectionState> {
    if (wa.connectionState === "open" && wa.sock) {
      return { connected: true, state: "open" }
    }
    if (wa.connecting) {
      return { connected: false, state: "connecting", qrCode: wa.currentQr || undefined }
    }
    if (wa.currentQr) {
      return { connected: false, state: "qr_ready", qrCode: wa.currentQr }
    }
    return { connected: false, state: wa.connectionState }
  },

  async disconnect(): Promise<ConnectionState> {
    wa.reconnectAttempts = MAX_RECONNECT_ATTEMPTS
    if (wa.sock) {
      try { await wa.sock.logout() } catch { cleanupSocket() }
    }
    try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }) } catch {}

    wa.connectionState = "disconnected"
    wa.currentQr = null
    wa.sock = null
    wa.connecting = false
    wa.reconnectAttempts = 0

    return { connected: false, state: "disconnected" }
  },

  async sendMessage(phone: string, text: string): Promise<boolean> {
    if (!wa.sock || wa.connectionState !== "open") {
      if (!wa.connecting && fs.existsSync(path.join(AUTH_DIR, "creds.json"))) {
        console.log("[WhatsApp] Not connected, attempting auto-reconnect...")
        wa.reconnectAttempts = 0
        await startSocket()
        const start = Date.now()
        while (Date.now() - start < 12000) {
          if (wa.connectionState === "open" && wa.sock) break
          await new Promise((r) => setTimeout(r, 500))
        }
      } else if (wa.connecting) {
        const start = Date.now()
        while (Date.now() - start < 12000) {
          if (wa.connectionState === "open" && wa.sock) break
          await new Promise((r) => setTimeout(r, 500))
        }
      }
      if (!wa.sock || wa.connectionState !== "open") {
        throw new Error("WhatsApp não está conectado. Conecte primeiro no Perfil.")
      }
    }

    let num = phone.replace(/\D/g, "")
    if (num.startsWith("0")) num = "55" + num.substring(1)
    if (!num.startsWith("55")) num = "55" + num

    // Brazil numbers: 55 + DDD(2) + phone(8 or 9 digits)
    // WhatsApp may register with or without the 9th digit
    // Try the number as-is first, then try toggling the 9
    const ddd = num.substring(2, 4)
    const phoneNum = num.substring(4)

    const variants: string[] = [num]
    if (phoneNum.length === 9 && phoneNum.startsWith("9")) {
      // Has 9 prefix — also try without it
      variants.push("55" + ddd + phoneNum.substring(1))
    } else if (phoneNum.length === 8) {
      // No 9 prefix — also try with it
      variants.push("55" + ddd + "9" + phoneNum)
    }

    // Check which number exists on WhatsApp
    let jid: string | null = null
    try {
      const results = await wa.sock!.onWhatsApp(variants[0]) || []
      if (results[0]?.exists) {
        jid = results[0].jid
      }
    } catch {}

    if (!jid && variants.length > 1) {
      try {
        const results = await wa.sock!.onWhatsApp(variants[1]) || []
        if (results[0]?.exists) {
          jid = results[0].jid
        }
      } catch {}
    }

    // Fallback: use original number if lookup failed
    if (!jid) {
      jid = num + "@s.whatsapp.net"
    }

    console.log("[WhatsApp] Sending message to:", jid)
    await wa.sock!.sendMessage(jid, { text })
    console.log("[WhatsApp] Message sent successfully to:", jid)
    return true
  },

  isConnected(): boolean {
    return wa.connectionState === "open" && wa.sock !== null
  },
}

// Auto-reconnect on server start - only once thanks to globalThis
if (!wa.initialized) {
  wa.initialized = true
  try {
    if (fs.existsSync(AUTH_DIR) && fs.existsSync(path.join(AUTH_DIR, "creds.json"))) {
      console.log("[WhatsApp] Auth found, auto-reconnecting on startup...")
      startSocket().catch(() => {})
    }
  } catch {}
}

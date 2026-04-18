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

type UserWAState = {
  sock: any
  currentQr: string | null
  connectionState: "disconnected" | "connecting" | "open"
  connecting: boolean
  reconnectAttempts: number
}

const BASE_AUTH_DIR = process.env.WHATSAPP_AUTH_DIR || path.join(process.cwd(), ".whatsapp-auth")
const MAX_RECONNECT_ATTEMPTS = 3

// Per-user state map, survives HMR reloads
const globalForWA = globalThis as unknown as {
  __waUsers?: Map<string, UserWAState>
}

if (!globalForWA.__waUsers) {
  globalForWA.__waUsers = new Map()
}

const users = globalForWA.__waUsers

function getUserState(userId: string): UserWAState {
  if (!users.has(userId)) {
    users.set(userId, {
      sock: null,
      currentQr: null,
      connectionState: "disconnected",
      connecting: false,
      reconnectAttempts: 0,
    })
  }
  return users.get(userId)!
}

function getAuthDir(userId: string): string {
  return path.join(BASE_AUTH_DIR, userId)
}

function ensureAuthDir(userId: string) {
  const dir = getAuthDir(userId)
  console.log(`[WhatsApp][${userId}] AUTH_DIR:`, dir)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`[WhatsApp][${userId}] Created auth directory`)
  }
}

function cleanupSocket(userId: string) {
  const wa = getUserState(userId)
  if (wa.sock) {
    try { wa.sock.ev.removeAllListeners("connection.update") } catch {}
    try { wa.sock.ev.removeAllListeners("creds.update") } catch {}
    try { wa.sock.end(undefined) } catch {}
    wa.sock = null
  }
}

async function startSocket(userId: string): Promise<void> {
  const wa = getUserState(userId)
  if (wa.connecting) {
    console.log(`[WhatsApp][${userId}] Already connecting, skipping...`)
    return
  }
  wa.connecting = true

  try {
    cleanupSocket(userId)
    ensureAuthDir(userId)

    const authDir = getAuthDir(userId)
    const { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = await loadBaileys()
    const { state, saveCreds } = await useMultiFileAuthState(authDir)
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

    newSock.ev.on("connection.update", async (update: any) => {
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
        console.log(`[WhatsApp][${userId}] Connected successfully`)
        wa.connectionState = "open"
        wa.currentQr = null
        wa.connecting = false
        wa.reconnectAttempts = 0
      }

      if (connection === "close") {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
        console.log(`[WhatsApp][${userId}] Connection closed, reason:`, reason)
        wa.connecting = false

        if (reason === DisconnectReason.loggedOut) {
          try { fs.rmSync(getAuthDir(userId), { recursive: true, force: true }) } catch {}
          wa.connectionState = "disconnected"
          wa.currentQr = null
          wa.sock = null
          wa.reconnectAttempts = 0
        } else if (reason === 440) {
          console.log(`[WhatsApp][${userId}] Conflict (replaced by another session), stopping reconnect`)
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
          console.log(`[WhatsApp][${userId}] Reconnecting (attempt ${wa.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`)
          setTimeout(() => startSocket(userId), 2000 * wa.reconnectAttempts)
        } else {
          wa.connectionState = "disconnected"
          wa.currentQr = null
          wa.sock = null
          if (wa.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log(`[WhatsApp][${userId}] Max reconnect attempts reached, stopping`)
            wa.reconnectAttempts = 0
          }
        }
      }
    })
  } catch (err: any) {
    console.error(`[WhatsApp][${userId}] Error starting socket:`, err?.message || err)
    console.error(`[WhatsApp][${userId}] Stack:`, err?.stack)
    const wa = getUserState(userId)
    wa.connecting = false
    wa.connectionState = "disconnected"
  }
}

export const whatsappService = {
  async connect(userId: string): Promise<ConnectionState> {
    const wa = getUserState(userId)

    if (wa.sock && wa.connectionState === "open") {
      return { connected: true, state: "open" }
    }

    wa.reconnectAttempts = 0
    cleanupSocket(userId)
    wa.connecting = false
    wa.currentQr = null
    wa.connectionState = "connecting"

    await startSocket(userId)

    const start = Date.now()
    const timeout = 25000
    console.log(`[WhatsApp][${userId}] Waiting for QR code or connection...`)
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

  async status(userId: string): Promise<ConnectionState> {
    const wa = getUserState(userId)

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

  async disconnect(userId: string): Promise<ConnectionState> {
    const wa = getUserState(userId)
    wa.reconnectAttempts = MAX_RECONNECT_ATTEMPTS
    if (wa.sock) {
      try { await wa.sock.logout() } catch { cleanupSocket(userId) }
    }
    try { fs.rmSync(getAuthDir(userId), { recursive: true, force: true }) } catch {}

    wa.connectionState = "disconnected"
    wa.currentQr = null
    wa.sock = null
    wa.connecting = false
    wa.reconnectAttempts = 0

    return { connected: false, state: "disconnected" }
  },

  async sendMessage(userId: string, phone: string, text: string): Promise<boolean> {
    const wa = getUserState(userId)
    const authDir = getAuthDir(userId)

    if (!wa.sock || wa.connectionState !== "open") {
      if (!wa.connecting && fs.existsSync(path.join(authDir, "creds.json"))) {
        console.log(`[WhatsApp][${userId}] Not connected, attempting auto-reconnect...`)
        wa.reconnectAttempts = 0
        await startSocket(userId)
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

    const ddd = num.substring(2, 4)
    const phoneNum = num.substring(4)

    const variants: string[] = [num]
    if (phoneNum.length === 9 && phoneNum.startsWith("9")) {
      variants.push("55" + ddd + phoneNum.substring(1))
    } else if (phoneNum.length === 8) {
      variants.push("55" + ddd + "9" + phoneNum)
    }

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

    if (!jid) {
      jid = num + "@s.whatsapp.net"
    }

    console.log(`[WhatsApp][${userId}] Sending message to:`, jid)
    await wa.sock!.sendMessage(jid, { text })
    console.log(`[WhatsApp][${userId}] Message sent successfully to:`, jid)
    return true
  },

  isConnected(userId: string): boolean {
    const wa = getUserState(userId)
    return wa.connectionState === "open" && wa.sock !== null
  },
}

// Auto-reconnect on server start for users that have saved credentials
try {
  if (fs.existsSync(BASE_AUTH_DIR)) {
    const userDirs = fs.readdirSync(BASE_AUTH_DIR).filter((d) => {
      const full = path.join(BASE_AUTH_DIR, d)
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "creds.json"))
    })
    for (const userId of userDirs) {
      if (!getUserState(userId).sock) {
        console.log(`[WhatsApp][${userId}] Auth found, auto-reconnecting on startup...`)
        startSocket(userId).catch(() => {})
      }
    }
  }
} catch {}

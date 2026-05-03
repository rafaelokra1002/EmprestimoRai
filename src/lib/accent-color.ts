export interface AccentPreset {
  id: string
  name: string
  primary: string
  primaryDark: string
  gradient: [string, string, string]
  shades: { 50: string; 100: string; 200: string; 300: string; 400: string; 500: string; 600: string; 700: string; 800: string; 900: string; 950: string }
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: "violet", name: "Violeta",
    primary: "270 66% 42%", primaryDark: "274 72% 67%",
    gradient: ["#4c1d95", "#6d28d9", "#5b21b6"],
    shades: { 50:"#f5f3ff",100:"#ede9fe",200:"#ddd6fe",300:"#c4b5fd",400:"#a78bfa",500:"#8b5cf6",600:"#7c3aed",700:"#6d28d9",800:"#5b21b6",900:"#4c1d95",950:"#2e1065" },
  },
  {
    id: "blue", name: "Azul",
    primary: "221 83% 53%", primaryDark: "213 93% 67%",
    gradient: ["#1e3a8a", "#1d4ed8", "#1e40af"],
    shades: { 50:"#eff6ff",100:"#dbeafe",200:"#bfdbfe",300:"#93c5fd",400:"#60a5fa",500:"#3b82f6",600:"#2563eb",700:"#1d4ed8",800:"#1e40af",900:"#1e3a8a",950:"#172554" },
  },
  {
    id: "sky", name: "Ciano",
    primary: "200 98% 39%", primaryDark: "198 89% 60%",
    gradient: ["#0c4a6e", "#0284c7", "#075985"],
    shades: { 50:"#f0f9ff",100:"#e0f2fe",200:"#bae6fd",300:"#7dd3fc",400:"#38bdf8",500:"#0ea5e9",600:"#0284c7",700:"#0369a1",800:"#075985",900:"#0c4a6e",950:"#082f49" },
  },
  {
    id: "indigo", name: "Índigo",
    primary: "239 84% 49%", primaryDark: "226 89% 67%",
    gradient: ["#1e1b4b", "#4f46e5", "#312e81"],
    shades: { 50:"#eef2ff",100:"#e0e7ff",200:"#c7d2fe",300:"#a5b4fc",400:"#818cf8",500:"#6366f1",600:"#4f46e5",700:"#4338ca",800:"#3730a3",900:"#312e81",950:"#1e1b4b" },
  },
  {
    id: "green", name: "Verde",
    primary: "142 76% 36%", primaryDark: "142 68% 58%",
    gradient: ["#14532d", "#16a34a", "#166534"],
    shades: { 50:"#f0fdf4",100:"#dcfce7",200:"#bbf7d0",300:"#86efac",400:"#4ade80",500:"#22c55e",600:"#16a34a",700:"#15803d",800:"#166534",900:"#14532d",950:"#052e16" },
  },
  {
    id: "emerald", name: "Esmeralda",
    primary: "152 69% 31%", primaryDark: "158 64% 52%",
    gradient: ["#064e3b", "#059669", "#065f46"],
    shades: { 50:"#ecfdf5",100:"#d1fae5",200:"#a7f3d0",300:"#6ee7b7",400:"#34d399",500:"#10b981",600:"#059669",700:"#047857",800:"#065f46",900:"#064e3b",950:"#022c22" },
  },
  {
    id: "teal", name: "Teal",
    primary: "174 91% 33%", primaryDark: "172 66% 50%",
    gradient: ["#134e4a", "#0d9488", "#115e59"],
    shades: { 50:"#f0fdfa",100:"#ccfbf1",200:"#99f6e4",300:"#5eead4",400:"#2dd4bf",500:"#14b8a6",600:"#0d9488",700:"#0f766e",800:"#115e59",900:"#134e4a",950:"#042f2e" },
  },
  {
    id: "lime", name: "Lima",
    primary: "84 85% 34%", primaryDark: "84 77% 50%",
    gradient: ["#365314", "#65a30d", "#3f6212"],
    shades: { 50:"#f7fee7",100:"#ecfccb",200:"#d9f99d",300:"#bef264",400:"#a3e635",500:"#84cc16",600:"#65a30d",700:"#4d7c0f",800:"#3f6212",900:"#365314",950:"#1a2e05" },
  },
  {
    id: "rose", name: "Rosa",
    primary: "350 89% 40%", primaryDark: "351 75% 63%",
    gradient: ["#881337", "#e11d48", "#9f1239"],
    shades: { 50:"#fff1f2",100:"#ffe4e6",200:"#fecdd3",300:"#fda4af",400:"#fb7185",500:"#f43f5e",600:"#e11d48",700:"#be123c",800:"#9f1239",900:"#881337",950:"#4c0519" },
  },
  {
    id: "fuchsia", name: "Fúcsia",
    primary: "292 84% 40%", primaryDark: "293 69% 61%",
    gradient: ["#701a75", "#c026d3", "#86198f"],
    shades: { 50:"#fdf4ff",100:"#fae8ff",200:"#f5d0fe",300:"#f0abfc",400:"#e879f9",500:"#d946ef",600:"#c026d3",700:"#a21caf",800:"#86198f",900:"#701a75",950:"#4a044e" },
  },
  {
    id: "orange", name: "Laranja",
    primary: "21 90% 48%", primaryDark: "21 90% 62%",
    gradient: ["#7c2d12", "#ea580c", "#9a3412"],
    shades: { 50:"#fff7ed",100:"#ffedd5",200:"#fed7aa",300:"#fdba74",400:"#fb923c",500:"#f97316",600:"#ea580c",700:"#c2410c",800:"#9a3412",900:"#7c2d12",950:"#431407" },
  },
  {
    id: "amber", name: "Âmbar",
    primary: "43 96% 48%", primaryDark: "38 92% 55%",
    gradient: ["#78350f", "#d97706", "#92400e"],
    shades: { 50:"#fffbeb",100:"#fef3c7",200:"#fde68a",300:"#fcd34d",400:"#fbbf24",500:"#f59e0b",600:"#d97706",700:"#b45309",800:"#92400e",900:"#78350f",950:"#451a03" },
  },
  {
    id: "red", name: "Vermelho",
    primary: "0 72% 51%", primaryDark: "0 91% 71%",
    gradient: ["#7f1d1d", "#dc2626", "#991b1b"],
    shades: { 50:"#fef2f2",100:"#fee2e2",200:"#fecaca",300:"#fca5a5",400:"#f87171",500:"#ef4444",600:"#dc2626",700:"#b91c1c",800:"#991b1b",900:"#7f1d1d",950:"#450a0a" },
  },
  {
    id: "slate", name: "Cinza",
    primary: "215 25% 35%", primaryDark: "215 20% 65%",
    gradient: ["#0f172a", "#475569", "#1e293b"],
    shades: { 50:"#f8fafc",100:"#f1f5f9",200:"#e2e8f0",300:"#cbd5e1",400:"#94a3b8",500:"#64748b",600:"#475569",700:"#334155",800:"#1e293b",900:"#0f172a",950:"#020617" },
  },
]

function hexToRgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)} ${parseInt(hex.slice(3,5),16)} ${parseInt(hex.slice(5,7),16)}`
}

export function applyAccentColor(presetId: string, isDark: boolean) {
  const preset = ACCENT_PRESETS.find((p) => p.id === presetId) ?? ACCENT_PRESETS[0]
  const root = document.documentElement

  root.style.setProperty("--primary", isDark ? preset.primaryDark : preset.primary)
  root.style.setProperty("--ring", isDark ? preset.primaryDark : preset.primary)
  root.style.setProperty("--sidebar-from", preset.gradient[0])
  root.style.setProperty("--sidebar-via", preset.gradient[1])
  root.style.setProperty("--sidebar-to", preset.gradient[2])

  const s = preset.shades
  const keys = [50,100,200,300,400,500,600,700,800,900,950] as const
  keys.forEach((n) => {
    root.style.setProperty(`--ac-${n}`, s[n])
    root.style.setProperty(`--ac-rgb-${n}`, hexToRgb(s[n]))
  })
}

export function saveAccentColor(presetId: string) {
  localStorage.setItem("accent-color", presetId)
}

export function loadAccentColor(): string {
  if (typeof window === "undefined") return "violet"
  return localStorage.getItem("accent-color") ?? "violet"
}

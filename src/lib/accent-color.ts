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
    id: "purple", name: "Roxo",
    primary: "272 72% 47%", primaryDark: "270 89% 72%",
    gradient: ["#3b0764", "#7e22ce", "#581c87"],
    shades: { 50:"#faf5ff",100:"#f3e8ff",200:"#e9d5ff",300:"#d8b4fe",400:"#c084fc",500:"#a855f7",600:"#9333ea",700:"#7e22ce",800:"#6b21a8",900:"#581c87",950:"#3b0764" },
  },
  {
    id: "green", name: "Verde",
    primary: "142 76% 36%", primaryDark: "142 68% 58%",
    gradient: ["#14532d", "#16a34a", "#166534"],
    shades: { 50:"#f0fdf4",100:"#dcfce7",200:"#bbf7d0",300:"#86efac",400:"#4ade80",500:"#22c55e",600:"#16a34a",700:"#15803d",800:"#166534",900:"#14532d",950:"#052e16" },
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
    id: "amber", name: "Âmbar",
    primary: "43 96% 48%", primaryDark: "38 92% 55%",
    gradient: ["#78350f", "#d97706", "#92400e"],
    shades: { 50:"#fffbeb",100:"#fef3c7",200:"#fde68a",300:"#fcd34d",400:"#fbbf24",500:"#f59e0b",600:"#d97706",700:"#b45309",800:"#92400e",900:"#78350f",950:"#451a03" },
  },
  {
    id: "black", name: "Preto",
    primary: "220 9% 12%", primaryDark: "220 9% 78%",
    gradient: ["#09090b", "#27272a", "#18181b"],
    shades: { 50:"#fafafa",100:"#f4f4f5",200:"#e4e4e7",300:"#d4d4d8",400:"#a1a1aa",500:"#71717a",600:"#52525b",700:"#3f3f46",800:"#27272a",900:"#18181b",950:"#09090b" },
  },
  {
    id: "slate", name: "Cinza",
    primary: "215 25% 35%", primaryDark: "215 20% 65%",
    gradient: ["#0f172a", "#475569", "#1e293b"],
    shades: { 50:"#f8fafc",100:"#f1f5f9",200:"#e2e8f0",300:"#cbd5e1",400:"#94a3b8",500:"#64748b",600:"#475569",700:"#334155",800:"#1e293b",900:"#0f172a",950:"#020617" },
  },
]

export function applyAccentColor(presetId: string, _isDark: boolean) {
  const preset = ACCENT_PRESETS.find((p) => p.id === presetId) ?? ACCENT_PRESETS[0]
  const root = document.documentElement

  // Only sidebar changes — buttons/primary color are fixed green
  root.style.setProperty("--sidebar-via", preset.gradient[1])
}

export function saveAccentColor(presetId: string) {
  localStorage.setItem("accent-color", presetId)
}

export function loadAccentColor(): string {
  if (typeof window === "undefined") return "violet"
  return localStorage.getItem("accent-color") ?? "violet"
}

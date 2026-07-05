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
    id: "green", name: "Verde",
    primary: "142 76% 36%", primaryDark: "142 68% 58%",
    gradient: ["#14532d", "#166534", "#0d3f24"],
    shades: { 50:"#f0fdf4",100:"#dcfce7",200:"#bbf7d0",300:"#86efac",400:"#4ade80",500:"#22c55e",600:"#16a34a",700:"#15803d",800:"#166534",900:"#14532d",950:"#052e16" },
  },
  {
    id: "green-dark", name: "Verde Escuro",
    primary: "158 66% 17%", primaryDark: "158 55% 32%",
    gradient: ["#0f4a34", "#0d3f2c", "#0a3322"],
    shades: { 50:"#f0fdf4",100:"#dcfce7",200:"#bbf7d0",300:"#86efac",400:"#4ade80",500:"#22c55e",600:"#16a34a",700:"#15803d",800:"#166534",900:"#14532d",950:"#052e16" },
  },
  {
    id: "purple-dark", name: "Roxo Escuro",
    primary: "250 40% 24%", primaryDark: "250 45% 62%",
    gradient: ["#2c2553", "#211b40", "#15102a"],
    shades: { 50:"#faf5ff",100:"#f3e8ff",200:"#e9d5ff",300:"#d8b4fe",400:"#c084fc",500:"#a855f7",600:"#9333ea",700:"#7e22ce",800:"#6b21a8",900:"#581c87",950:"#3b0764" },
  },
  {
    id: "black", name: "Preto",
    primary: "220 9% 12%", primaryDark: "220 9% 78%",
    gradient: ["#171a20", "#13151b", "#0d0e12"],
    shades: { 50:"#fafafa",100:"#f4f4f5",200:"#e4e4e7",300:"#d4d4d8",400:"#a1a1aa",500:"#71717a",600:"#52525b",700:"#3f3f46",800:"#27272a",900:"#18181b",950:"#09090b" },
  },
]

export function applyAccentColor(presetId: string, _isDark: boolean) {
  const preset = ACCENT_PRESETS.find((p) => p.id === presetId) ?? ACCENT_PRESETS[0]
  const root = document.documentElement

  // Cor do menu lateral (sidebar) conforme a paleta escolhida em Configurações
  root.style.setProperty("--sidebar-from", preset.gradient[0])
  root.style.setProperty("--sidebar-via", preset.gradient[1])
  root.style.setProperty("--sidebar-to", preset.gradient[2])
}

export function saveAccentColor(presetId: string) {
  localStorage.setItem("accent-color", presetId)
}

export function loadAccentColor(): string {
  if (typeof window === "undefined") return "green"
  return localStorage.getItem("accent-color") ?? "green"
}

// Dispara um toast global (ouvido pelo <ToastHost /> montado no layout)
export type ToastType = "success" | "error" | "info"
export type ToastPosition = "corner" | "center"

export function showToast(message: string, type: ToastType = "success", position: ToastPosition = "corner") {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { message, type, position } }))
}

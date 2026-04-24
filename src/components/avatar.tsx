import { getInitials } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface AvatarProps {
  name: string
  src?: string | null
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
}

export function Avatar({ name, src, className, size = "md" }: AvatarProps) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
    xl: "h-24 w-24 text-2xl",
  }

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(
          "rounded-full object-cover",
          sizes[size],
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        "rounded-full bg-emerald-600/20 text-emerald-500 flex items-center justify-center font-semibold",
        sizes[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}

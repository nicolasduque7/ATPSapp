import { getInitials } from "@/lib/utils"

interface AvatarProps {
  name: string
}

export function Avatar({ name }: AvatarProps) {
  return (
    <div
      title={name}
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
    >
      {getInitials(name)}
    </div>
  )
}

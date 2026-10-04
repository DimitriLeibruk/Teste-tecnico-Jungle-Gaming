import { ImageIcon } from 'lucide-react'
import type { User } from '@/api/contracts'
import { cn } from '@/lib/utils'

export function Avatar({ user, size = 40, className }: { user: Pick<User, 'avatarUrl' | 'displayName'> | null; size?: number; className?: string }) {
  const style = { width: size, height: size }
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt="" style={style} className={cn('shrink-0 rounded-full border border-border object-cover', className)} />
  }
  const initial = user?.displayName.trim().charAt(0).toUpperCase()
  return (
    <span style={style} aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-accent text-primary', className)}>
      {initial ? <span className="text-sm font-semibold">{initial}</span> : <ImageIcon className="size-1/2" />}
    </span>
  )
}

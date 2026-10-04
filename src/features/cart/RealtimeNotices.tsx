import { BellRing, X } from 'lucide-react'
import { Alert } from '@/components/ui/misc'
import { realtimeNotices, useRealtimeNotices } from '@/features/realtime/notices-store'

/** Lista de alterações recebidas em tempo real (preço/disponibilidade). */
export function RealtimeNotices() {
  const notices = useRealtimeNotices()
  if (!notices.length) return null
  return (
    <div className="flex flex-col gap-2" data-testid="realtime-notices">
      {notices.map((n) => (
        <Alert key={n.id} variant="warning" role="status">
          <BellRing aria-hidden />
          <p className="flex-1">{n.message}</p>
          <button type="button" onClick={() => realtimeNotices.dismiss(n.id)} aria-label="Dispensar aviso" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-4" aria-hidden />
          </button>
        </Alert>
      ))}
    </div>
  )
}

import type { ReactNode } from 'react'
import { AlertTriangle, PackageOpen, RefreshCw, WifiOff } from 'lucide-react'
import { toApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Estado de erro com mensagem amigável e ação de nova tentativa. */
export function ErrorState({
  error,
  title,
  onRetry,
  retrying,
  className,
}: {
  error: unknown
  title?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  const apiError = toApiError(error)
  const offline = apiError.code === 'NETWORK_ERROR'
  const Icon = offline ? WifiOff : AlertTriangle
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-md border border-destructive/40 bg-card px-6 py-10 text-center', className)}>
      <Icon className="size-8 text-destructive" aria-hidden />
      <p className="text-base font-semibold">{title ?? (offline ? 'Sem conexão' : 'Não foi possível carregar')}</p>
      <p className="max-w-md text-sm text-muted-foreground">{apiError.message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} loading={retrying}>
          {!retrying && <RefreshCw aria-hidden />}
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, description, action, icon, className }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-12 text-center', className)}>
      {icon ?? <PackageOpen className="size-8 text-primary" aria-hidden />}
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}

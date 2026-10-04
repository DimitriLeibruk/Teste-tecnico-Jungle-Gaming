import { useEffect, useRef } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Loader2, WifiOff, XCircle } from 'lucide-react'
import type { Order } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { ErrorState } from '@/components/states'
import { NotFound } from '@/components/NotFound'
import { announce } from '@/components/live-announcer'
import { useOrder } from '@/features/orders/hooks'
import { Receipt } from '@/features/orders/Receipt'
import { useRealtime } from '@/features/realtime/RealtimeProvider'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatEth } from '@/lib/money'

export const Route = createFileRoute('/_auth/pedidos/$orderId')({
  component: OrderPage,
})

function Pending({ order }: { order: Order }) {
  const { status } = useRealtime()
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-md border-b-[10px] border-b-primary bg-card px-6 py-10 text-center" aria-live="polite" data-testid="order-pending">
      <Loader2 className="size-10 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
      <h1 className="text-xl font-bold">Aguardando confirmação da rede</h1>
      <p className="text-sm text-muted-foreground">
        Pedido <strong className="text-foreground">{order.number}</strong> · {formatEth(order.total)}
      </p>
      <p className="text-sm text-muted-foreground">
        O pagamento está sendo processado. Esta página atualiza sozinha — você pode recarregá-la ou fechar o navegador sem risco de compra duplicada.
      </p>
      {status !== 'connected' && (
        <p className="flex items-center gap-2 text-xs text-primary" role="status">
          <WifiOff className="size-4" aria-hidden /> Sem conexão em tempo real: consultando o status periodicamente.
        </p>
      )}
    </section>
  )
}

function Declined({ order }: { order: Order }) {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-md border-b-[10px] border-b-destructive bg-card px-6 py-10 text-center" data-testid="order-declined">
      <XCircle className="size-10 text-destructive" aria-hidden />
      <h1 className="text-xl font-bold">Pagamento recusado</h1>
      <p className="text-sm text-muted-foreground">Pedido {order.number}</p>
      <p className="text-sm text-muted-foreground">{order.failureReason}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/pagamento">Tentar novamente</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/carrinho">Ver carrinho</Link>
        </Button>
      </div>
    </section>
  )
}

function OrderPage() {
  const { orderId } = Route.useParams()
  const navigate = useNavigate()
  const { data: order, error, isPending, refetch, isRefetching } = useOrder(orderId)
  usePageTitle(order?.status === 'confirmed' ? 'Pedido confirmado' : order?.status === 'declined' ? 'Pagamento recusado' : 'Pedido')

  // Anuncia a transição de estado (pendente → confirmado/recusado).
  const lastStatus = useRef(order?.status)
  useEffect(() => {
    if (!order) return
    if (lastStatus.current && lastStatus.current !== order.status) {
      announce(order.status === 'confirmed' ? 'Pagamento confirmado. Recibo disponível.' : 'Pagamento recusado.', 'assertive')
    }
    lastStatus.current = order.status
  }, [order])

  if (isPending) {
    return (
      <div className="container-page py-16" aria-busy="true" aria-label="Carregando pedido">
        <Skeleton className="mx-auto h-72 max-w-lg" />
      </div>
    )
  }
  if (error && !order) {
    const apiError = toApiError(error)
    if (apiError.code === 'NOT_FOUND' || apiError.code === 'FORBIDDEN') {
      return <NotFound title="Pedido não encontrado" description="Este pedido não existe ou pertence a outra conta." />
    }
    return (
      <div className="container-page py-16">
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
      </div>
    )
  }

  return (
    <div className="container-page py-12 md:py-24">
      {order.status === 'pending' && <Pending order={order} />}
      {order.status === 'declined' && <Declined order={order} />}
      {order.status === 'confirmed' && (
        <>
          <h1 className="sr-only">Pedido {order.number} confirmado</h1>
          <Receipt order={order} onClose={() => void navigate({ to: '/conta/atividade' })} />
        </>
      )}
    </div>
  )
}

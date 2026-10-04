import { createFileRoute, Link } from '@tanstack/react-router'
import { CheckCircle2, Clock, History, XCircle } from 'lucide-react'
import type { OrderStatus } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Badge, Skeleton } from '@/components/ui/misc'
import { EmptyState, ErrorState } from '@/components/states'
import { useOrders } from '@/features/orders/hooks'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatEth } from '@/lib/money'
import { formatDate } from '@/lib/utils'

export const Route = createFileRoute('/_auth/conta/atividade')({
  component: ActivityPage,
})

/** Estado com ícone + texto (não depende só de cor). */
const STATUS: Record<OrderStatus, { label: string; variant: 'outline' | 'success' | 'danger'; Icon: typeof Clock }> = {
  pending: { label: 'Pendente', variant: 'outline', Icon: Clock },
  confirmed: { label: 'Confirmado', variant: 'success', Icon: CheckCircle2 },
  declined: { label: 'Recusado', variant: 'danger', Icon: XCircle },
}

function ActivityPage() {
  usePageTitle('Atividade')
  const { data, isPending, error, refetch, isRefetching } = useOrders()

  return (
    <section aria-labelledby="activity-title" className="pb-8">
      <h1 id="activity-title" className="mb-6 text-[15px] font-semibold">
        Atividade — seus pedidos
      </h1>
      {isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando pedidos">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<History className="size-8 text-primary" aria-hidden />}
          title="Nenhum pedido ainda"
          description="Suas compras aparecem aqui com o status de pagamento."
          action={
            <Button asChild>
              <Link to="/mercado">Explorar o mercado</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="orders-list">
          {data.items.map((order) => {
            const s = STATUS[order.status]
            return (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-4 bg-card p-4">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {order.items.slice(0, 3).map((i) => (
                      <img key={i.itemId} src={i.image} alt="" width={44} height={44} className="size-11 rounded-full border-2 border-card object-cover" />
                    ))}
                  </div>
                  <div>
                    <p className="font-semibold">Pedido {order.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {order.items.length}{' '}
                      {order.items.length === 1 ? 'item' : 'itens'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={s.variant}>
                    <s.Icon className="size-3.5" aria-hidden />
                    {s.label}
                  </Badge>
                  <span className="font-bold text-primary">{formatEth(order.total)}</span>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/pedidos/$orderId" params={{ orderId: order.id }}>
                      {order.status === 'confirmed' ? 'Ver recibo' : 'Ver pedido'}
                      <span className="sr-only"> {order.number}</span>
                    </Link>
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

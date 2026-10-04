import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { useSession } from '@/features/session/session-store'
import { useRealtime } from '@/features/realtime/RealtimeProvider'

/**
 * Pedido: atualizado por `order.updated` (Socket.IO). Enquanto pendente, há
 * polling de segurança — mais frequente se o tempo real estiver desconectado.
 */
export function useOrder(orderId: string) {
  const { user } = useSession()
  const { status } = useRealtime()
  return useQuery({
    queryKey: queryKeys.order(user?.id ?? 'anonymous', orderId),
    queryFn: ({ signal }) => ordersApi.get(orderId, { signal }),
    enabled: !!user,
    staleTime: 5_000,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? (status === 'connected' ? 10_000 : 3_000) : false),
  })
}

export function useOrders() {
  const { user } = useSession()
  return useQuery({
    queryKey: queryKeys.orders(user?.id ?? 'anonymous'),
    queryFn: ({ signal }) => ordersApi.list({ signal }),
    enabled: !!user,
  })
}

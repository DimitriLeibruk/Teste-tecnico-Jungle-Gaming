import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { nftUpdatedEventSchema, orderUpdatedEventSchema, SOCKET_EVENTS } from '@/api/contracts'
import { env } from '@/lib/env'
import { whenNetworkReady } from '@/lib/network-gate'
import { announce } from '@/components/live-announcer'
import { sessionStore, useSession } from '@/features/session/session-store'
import { EventLedger } from './event-ledger'
import { applyNftUpdated, applyOrderUpdated, reconcileAfterReconnect } from './cache-sync'
import { realtimeNotices } from './notices-store'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

/**
 * socket.io-client é carregado sob demanda: o engine.io-client captura
 * `globalThis.WebSocket` ao ser avaliado, então só pode ser avaliado depois que
 * o MSW instala a interceptação. Isso também o tira do caminho crítico de render.
 */
let ioModule: Promise<typeof import('socket.io-client')> | null = null
const loadIo = () => (ioModule ??= whenNetworkReady().then(() => import('socket.io-client')))

const RealtimeContext = createContext<{ status: RealtimeStatus; ledger: EventLedger } | null>(null)

/**
 * Conexão Socket.IO ligada ao ciclo de vida da sessão:
 * - nova conexão a cada login/logout/expiração (epoch), autenticada pelo token;
 * - listeners removidos e socket encerrado no cleanup;
 * - eventos de pedido de outra sessão/usuário são ignorados;
 * - após reconexão, os recursos ativos são reconciliados com a API REST.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { token, epoch, user } = useSession()
  const userId = user?.id ?? null
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const [ledger] = useState(() => new EventLedger())

  useEffect(() => {
    let disposed = false
    let socket: Socket | null = null
    let hasConnected = false
    const isCurrent = () => sessionStore.get().epoch === epoch

    const attach = (s: Socket) => {
      s.on('connect', () => {
        setStatus('connected')
        if (hasConnected) {
          reconcileAfterReconnect(queryClient, userId)
          announce('Conexão em tempo real restabelecida. Dados atualizados.')
        }
        hasConnected = true
      })
      s.on('disconnect', (reason) => {
        setStatus(reason === 'io client disconnect' ? 'offline' : 'reconnecting')
      })
      s.on('connect_error', () => setStatus(hasConnected ? 'reconnecting' : 'connecting'))

      s.on(SOCKET_EVENTS.nftUpdated, (payload: unknown) => {
        const parsed = nftUpdatedEventSchema.safeParse(payload)
        if (!parsed.success || !isCurrent()) return
        const event = parsed.data
        if (ledger.check(event)) return
        ledger.record(event)
        const notices = applyNftUpdated(queryClient, event)
        if (notices.length) {
          realtimeNotices.push(notices)
          for (const notice of notices) toast.warning(notice.message, { id: `nft-${notice.nftId}` })
          announce(notices.map((n) => n.message).join(' '), 'assertive')
        }
      })

      s.on(SOCKET_EVENTS.orderUpdated, (payload: unknown) => {
        const parsed = orderUpdatedEventSchema.safeParse(payload)
        if (!parsed.success || !isCurrent() || !userId) return
        const event = parsed.data
        // Defesa em profundidade: nunca aplica evento de outro usuário.
        if (event.data.userId !== userId) return
        if (ledger.check(event)) return
        ledger.record(event)
        applyOrderUpdated(queryClient, userId, event)
        if (event.data.status === 'confirmed') {
          toast.success('Pagamento confirmado! Seus NFTs estão na sua carteira.', { id: `order-${event.data.orderId}` })
        } else if (event.data.status === 'declined') {
          toast.error('Pagamento recusado. Seus itens continuam no carrinho.', { id: `order-${event.data.orderId}` })
        }
      })
    }

    void loadIo().then(({ io }) => {
      if (disposed) return
      socket = io(env.socketUrl, {
        transports: ['websocket'],
        auth: token ? { token } : {},
        reconnectionDelay: 500,
        reconnectionDelayMax: 4_000,
        randomizationFactor: 0.2,
        timeout: 5_000,
      })
      attach(socket)
    })

    return () => {
      disposed = true
      socket?.removeAllListeners()
      socket?.io.removeAllListeners()
      socket?.disconnect()
    }
  }, [queryClient, token, epoch, userId, ledger])

  return <RealtimeContext value={{ status, ledger }}>{children}</RealtimeContext>
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error('useRealtime precisa de <RealtimeProvider>')
  return ctx
}

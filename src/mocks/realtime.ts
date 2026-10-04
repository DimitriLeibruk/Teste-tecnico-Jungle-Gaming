import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, OrderUpdatedEvent, RealtimeEvent } from '@/api/contracts'
import { env } from '@/lib/env'
import { db } from './db/database'
import { subscribeDomainEvents } from './domain/events'
import { settleDueOrders } from './domain/orders'
import { getScenarioConfig } from './scenarios'

/**
 * Servidor Socket.IO simulado.
 *
 * Transporte: o MSW intercepta o WebSocket aberto pelo `socket.io-client`
 * (transports: ['websocket']) e o @mswjs/socket.io-binding faz o
 * encode/decode dos pacotes Engine.IO/Socket.IO. Limitações documentadas em
 * ARCHITECTURE.md (sem long-polling, namespaces, rooms ou acks).
 */

const socketUrl = new URL(env.socketUrl)
socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:'
// O MSW 2.15 remove o prefixo `/socket.io/` do caminho do cliente antes do match;
// por isso o handler aponta para a origem do servidor de tempo real.
const link = ws.link(`${socketUrl.origin}/*`)

interface Peer {
  id: string
  userId: string | null
  io: ReturnType<typeof toSocketIo>
  close: () => void
}

const peers = new Map<string, Peer>()
/** Janela em que o "servidor" recusa conexões (simula queda de rede). */
let blockedUntil = 0
const history: RealtimeEvent[] = []

const HEARTBEAT_MS = 20_000

function userFromToken(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const session = db().sessions[token]
  if (!session || session.revoked || Date.parse(session.expiresAt) <= Date.now()) return null
  return session.userId
}

function deliver(peer: Peer, event: RealtimeEvent) {
  peer.io.client.emit(event.type, event)
}

function broadcastNft(event: NftUpdatedEvent) {
  remember(event)
  const chaos = getScenarioConfig().realtimeChaos
  for (const peer of peers.values()) {
    deliver(peer, event)
    if (chaos) {
      // Duplicata exata + evento antigo (versão anterior) — o cliente deve ignorar ambos.
      deliver(peer, event)
      if (event.version > 1) {
        deliver(peer, { ...event, eventId: `${event.eventId}-stale`, version: event.version - 1, data: { ...event.data, price: '999' } })
      }
    }
  }
}

function sendOrder(event: OrderUpdatedEvent) {
  remember(event)
  // Eventos de pedido só vão para as conexões autenticadas do dono do pedido.
  for (const peer of peers.values()) {
    if (peer.userId === event.data.userId) deliver(peer, event)
  }
}

function remember(event: RealtimeEvent) {
  history.push(event)
  if (history.length > 50) history.shift()
}

subscribeDomainEvents({ nft: broadcastNft, order: sendOrder })

export const realtimeHandler = link.addEventListener('connection', (connection) => {
  const { client } = connection
  if (getScenarioConfig().offline || Date.now() < blockedUntil) {
    queueMicrotask(() => client.close(4000, 'offline'))
    return
  }

  const io = toSocketIo(connection)
  const peer: Peer = { id: client.id, userId: null, io, close: () => client.close(4001, 'server disconnect') }
  peers.set(peer.id, peer)

  // Pacote CONNECT do Socket.IO ("40{...auth}"): identifica o usuário da sessão.
  client.addEventListener('message', (event) => {
    if (typeof event.data !== 'string' || !event.data.startsWith('40')) return
    try {
      const auth = JSON.parse(event.data.slice(2) || '{}') as { token?: string }
      peer.userId = userFromToken(auth.token)
    } catch {
      peer.userId = null
    }
    settleDueOrders()
  })

  // O binding não envia pings do Engine.IO; sem eles o cliente cai após ~30 s.
  const heartbeat = setInterval(() => client.send('2'), HEARTBEAT_MS)
  client.addEventListener('close', () => {
    clearInterval(heartbeat)
    peers.delete(peer.id)
  })

  io.client.on('ping:app', () => io.client.emit('pong:app', { at: new Date().toISOString() }))
})

// ---------------------------------------------------------------- Controles

/** Derruba todas as conexões; opcionalmente recusa reconexões por `blockMs`. */
export function dropConnections(blockMs = 0) {
  blockedUntil = Date.now() + blockMs
  for (const peer of [...peers.values()]) peer.close()
}

/** Desconecta conexões de um usuário (ex.: sessão revogada). */
export function dropUserConnections(userId: string) {
  for (const peer of [...peers.values()]) if (peer.userId === userId) peer.close()
}

/** Reenvia o último evento (duplicata exata) — teste de idempotência do cliente. */
export function replayLastEvent() {
  const last = history.at(-1)
  if (!last) return null
  if (last.type === 'nft.updated') for (const peer of peers.values()) deliver(peer, last)
  else for (const peer of peers.values()) if (peer.userId === last.data.userId) deliver(peer, last)
  return last
}

/** Emite uma versão antiga de um evento nft.updated já enviado. */
export function emitStaleNftEvent(nftId: string) {
  const last = [...history].reverse().find((e): e is NftUpdatedEvent => e.type === 'nft.updated' && e.data.nftId === nftId)
  if (!last) return null
  const stale: NftUpdatedEvent = {
    ...last,
    eventId: `${last.eventId}-old`,
    version: Math.max(1, last.version - 1),
    data: { ...last.data, price: '0.01' },
  }
  for (const peer of peers.values()) deliver(peer, stale)
  return stale
}

export function connectedPeers() {
  return [...peers.values()].map((p) => ({ id: p.id, userId: p.userId }))
}

export function resetRealtime() {
  history.length = 0
  blockedUntil = 0
  dropConnections()
}


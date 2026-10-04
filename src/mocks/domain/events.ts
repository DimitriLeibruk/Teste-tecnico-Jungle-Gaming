import type { NftDetail, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { nextEventId } from '../db/database'

/**
 * Barramento interno do backend simulado. O domínio publica mudanças aqui e o
 * servidor Socket.IO simulado (src/mocks/realtime.ts) as entrega aos clientes.
 * Assim, toda mudança de dado reflete igualmente no REST e nos eventos.
 */
type Listener = { nft: (e: NftUpdatedEvent) => void; order: (e: OrderUpdatedEvent) => void }

const listeners = new Set<Listener>()

export function subscribeDomainEvents(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function buildNftUpdatedEvent(nft: NftDetail): NftUpdatedEvent {
  return {
    eventId: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      nftId: nft.id,
      name: nft.name,
      price: nft.price,
      compareAtPrice: nft.compareAtPrice,
      soldOut: nft.soldOut,
      editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
    },
  }
}

export function publishNftUpdated(nft: NftDetail) {
  const event = buildNftUpdatedEvent(nft)
  listeners.forEach((l) => l.nft(event))
  return event
}

export function publishOrderUpdated(order: Order) {
  const event: OrderUpdatedEvent = {
    eventId: nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    data: {
      orderId: order.id,
      userId: order.userId,
      status: order.status,
      transaction: order.transaction,
      failureReason: order.failureReason,
    },
  }
  listeners.forEach((l) => l.order(event))
  return event
}

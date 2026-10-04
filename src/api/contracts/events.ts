import { z } from 'zod'
import { ethAmountSchema, isoDateSchema } from './common'
import { editionIdSchema } from './nft'
import { orderStatusSchema } from './commerce'

/**
 * Envelope comum dos eventos Socket.IO.
 * - eventId: identidade estável (deduplicação)
 * - resource: recurso afetado
 * - version: versão monotônica do recurso (descarta eventos antigos)
 */
const envelope = <T extends string, R extends string, D extends z.ZodType>(type: T, resource: R, data: D) =>
  z.object({
    eventId: z.string(),
    type: z.literal(type),
    resource: z.object({ type: z.literal(resource), id: z.string() }),
    version: z.number().int().min(1),
    occurredAt: isoDateSchema,
    data,
  })

export const nftUpdatedEventSchema = envelope(
  'nft.updated',
  'nft',
  z.object({
    nftId: z.string(),
    name: z.string(),
    price: ethAmountSchema,
    compareAtPrice: ethAmountSchema.nullable(),
    soldOut: z.boolean(),
    editions: z.array(
      z.object({ id: editionIdSchema, price: ethAmountSchema, available: z.number().int().min(0) }),
    ),
  }),
)
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

export const orderUpdatedEventSchema = envelope(
  'order.updated',
  'order',
  z.object({
    orderId: z.string(),
    userId: z.string(),
    status: orderStatusSchema,
    transaction: z.object({ hash: z.string(), explorerUrl: z.string() }).nullable(),
    failureReason: z.string().nullable(),
  }),
)
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>

export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

export const SOCKET_EVENTS = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
} as const

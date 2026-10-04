import { z } from 'zod'
import { ethAmountSchema, isoDateSchema, networkIdSchema } from './common'
import { editionIdSchema } from './nft'
import { ensSuffixSchema, walletProviderSchema } from './account'

// ---------------------------------------------------------------------------
// Carrinho
// ---------------------------------------------------------------------------

export const cartItemStatusSchema = z.enum(['ok', 'price-changed', 'insufficient', 'sold-out'])
export type CartItemStatus = z.infer<typeof cartItemStatusSchema>

export const cartItemSchema = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: editionIdSchema,
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  alt: z.string(),
  quantity: z.number().int().min(1),
  /** Preço atual da edição no catálogo. */
  unitPrice: ethAmountSchema,
  /** Preço no momento em que o item entrou no carrinho. */
  addedUnitPrice: ethAmountSchema,
  lineTotal: ethAmountSchema,
  available: z.number().int().min(0),
  /** Quantidade máxima permitida para este item (disponibilidade x limite por pedido). */
  maxQuantity: z.number().int().min(0),
  status: cartItemStatusSchema,
  nftVersion: z.number().int(),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const appliedCouponSchema = z.object({
  code: z.string(),
  label: z.string(),
})

export const cartSchema = z.object({
  id: z.string(),
  owner: z.enum(['guest', 'user']),
  items: z.array(cartItemSchema),
  coupon: appliedCouponSchema.nullable(),
  itemCount: z.number().int().min(0),
  subtotal: ethAmountSchema,
  version: z.number().int().min(0),
  updatedAt: isoDateSchema,
})
export type Cart = z.infer<typeof cartSchema>

export const addCartItemInputSchema = z.object({
  nftId: z.string(),
  editionId: editionIdSchema,
  quantity: z.number().int().min(1).max(99),
})
export type AddCartItemInput = z.infer<typeof addCartItemInputSchema>

export const updateCartItemInputSchema = z.object({ quantity: z.number().int().min(1).max(99) })
export const applyCouponInputSchema = z.object({
  code: z.string().trim().min(1, 'Informe o código promocional').max(20, 'Código muito longo'),
})
export const mergeCartInputSchema = z.object({ guestCartId: z.string() })

// ---------------------------------------------------------------------------
// Cotação — referência de valores para fechar o pedido
// ---------------------------------------------------------------------------

export const quoteIssueSchema = z.object({
  type: z.enum(['PRICE_CHANGED', 'INSUFFICIENT_AVAILABILITY', 'SOLD_OUT', 'COUPON_EXPIRED', 'EMPTY_CART']),
  itemId: z.string().optional(),
  message: z.string(),
})
export type QuoteIssue = z.infer<typeof quoteIssueSchema>

export const quoteLineSchema = z.object({
  itemId: z.string(),
  nftId: z.string(),
  editionId: editionIdSchema,
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  alt: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: ethAmountSchema,
  lineTotal: ethAmountSchema,
})
export type QuoteLine = z.infer<typeof quoteLineSchema>

export const quoteSchema = z.object({
  id: z.string(),
  cartVersion: z.number().int(),
  network: networkIdSchema,
  items: z.array(quoteLineSchema),
  subtotal: ethAmountSchema,
  discount: ethAmountSchema,
  networkFee: ethAmountSchema,
  total: ethAmountSchema,
  coupon: appliedCouponSchema.nullable(),
  issues: z.array(quoteIssueSchema),
  /** false quando há pendências (preço alterado, esgotado…) que impedem fechar o pedido. */
  valid: z.boolean(),
  /** Hash do conteúdo — muda sempre que algum valor muda. */
  fingerprint: z.string(),
  createdAt: isoDateSchema,
  expiresAt: isoDateSchema,
})
export type Quote = z.infer<typeof quoteSchema>

export const createQuoteInputSchema = z.object({ network: networkIdSchema })

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export const orderStatusSchema = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const buyerSchema = z.object({
  displayName: z.string(),
  username: z.string(),
  profileName: z.string(),
  email: z.string(),
  ensName: z.string(),
  ensSuffix: ensSuffixSchema,
  referralCode: z.string(),
  secondaryAddress: z.string().optional(),
  note: z.string().max(280, 'Use no máximo 280 caracteres').optional(),
})
export type Buyer = z.infer<typeof buyerSchema>

export const createOrderInputSchema = z.object({
  quoteId: z.string(),
  /** Fingerprint da cotação revisada pelo usuário. */
  quoteFingerprint: z.string(),
  walletId: z.string(),
  connectionId: z.string(),
  provider: walletProviderSchema,
  network: networkIdSchema,
  buyer: buyerSchema,
})
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>

export const orderSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: orderStatusSchema,
  version: z.number().int().min(1),
  userId: z.string(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  settledAt: isoDateSchema.nullable(),
  /** Snapshot imutável dos itens no momento da compra. */
  items: z.array(quoteLineSchema),
  subtotal: ethAmountSchema,
  discount: ethAmountSchema,
  networkFee: ethAmountSchema,
  total: ethAmountSchema,
  coupon: appliedCouponSchema.nullable(),
  network: networkIdSchema,
  wallet: z.object({
    id: z.string(),
    provider: walletProviderSchema,
    address: z.string(),
    label: z.string(),
  }),
  buyer: buyerSchema,
  transaction: z.object({ hash: z.string(), explorerUrl: z.string() }).nullable(),
  failureReason: z.string().nullable(),
})
export type Order = z.infer<typeof orderSchema>

export const ordersResponseSchema = z.object({ items: z.array(orderSchema) })

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

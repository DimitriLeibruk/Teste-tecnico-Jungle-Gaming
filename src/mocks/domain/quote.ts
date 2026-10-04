import type { NetworkId, Quote, QuoteIssue } from '@/api/contracts'
import { addEth, compareEth, formatEth, percentOfEth, subEth } from '@/lib/money'
import { db, nextId, persist, type CartRecord } from '../db/database'
import { stableHash, stableStringify } from '../db/crypto'
import { NETWORK_FEES } from '../db/seed'
import { findCoupon, toCartDto } from './cart'

export const QUOTE_TTL_MS = 5 * 60 * 1000

const BLOCKING: QuoteIssue['type'][] = ['SOLD_OUT', 'INSUFFICIENT_AVAILABILITY', 'EMPTY_CART']

/**
 * Calcula a cotação a partir do estado atual do carrinho e do catálogo.
 * A cotação é a referência de valores para fechar o pedido.
 */
export function computeQuote(cart: CartRecord, network: NetworkId): Omit<Quote, 'id' | 'createdAt' | 'expiresAt'> {
  const dto = toCartDto(cart)
  const issues: QuoteIssue[] = []

  if (dto.items.length === 0) issues.push({ type: 'EMPTY_CART', message: 'Seu carrinho está vazio.' })

  for (const item of dto.items) {
    if (item.status === 'sold-out') {
      issues.push({ type: 'SOLD_OUT', itemId: item.id, message: `${item.name} (${item.editionLabel}) esgotou. Remova o item para continuar.` })
    } else if (item.status === 'insufficient') {
      issues.push({
        type: 'INSUFFICIENT_AVAILABILITY',
        itemId: item.id,
        message: `Restam apenas ${item.maxQuantity} unidade(s) de ${item.name} (${item.editionLabel}).`,
      })
    } else if (item.status === 'price-changed') {
      issues.push({
        type: 'PRICE_CHANGED',
        itemId: item.id,
        message: `O preço de ${item.name} mudou de ${formatEth(item.addedUnitPrice)} para ${formatEth(item.unitPrice)}.`,
      })
    }
  }

  let coupon = dto.coupon
  let percent = 0
  if (cart.couponCode) {
    const found = findCoupon(cart.couponCode)
    if (!found || Date.parse(found.expiresAt) < Date.now()) {
      issues.push({ type: 'COUPON_EXPIRED', message: `O cupom ${cart.couponCode} expirou e foi removido.` })
      cart.couponCode = null
      coupon = null
    } else {
      percent = found.percent
    }
  }

  const lines = dto.items.map((i) => ({
    itemId: i.id,
    nftId: i.nftId,
    editionId: i.editionId,
    editionLabel: i.editionLabel,
    name: i.name,
    tokenId: i.tokenId,
    image: i.image,
    alt: i.alt,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
  }))
  const subtotal = addEth('0', ...lines.map((l) => l.lineTotal))
  const discount = percent ? percentOfEth(subtotal, percent) : '0'
  const networkFee = lines.length ? NETWORK_FEES[network] : '0'
  const total = addEth(subEth(subtotal, discount), networkFee)
  const fingerprint = stableHash(stableStringify({ lines: lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPrice]), discount, networkFee, total, network, coupon: coupon?.code ?? null }))

  return {
    cartVersion: cart.version,
    network,
    items: lines,
    subtotal,
    discount,
    networkFee,
    total,
    coupon,
    issues,
    valid: !issues.some((i) => BLOCKING.includes(i.type)) && compareEth(total, '0') > 0,
    fingerprint,
  }
}

export function createQuote(cart: CartRecord, network: NetworkId, userId: string | null): Quote {
  const now = Date.now()
  const quote: Quote = {
    ...computeQuote(cart, network),
    id: nextId('quo'),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
  }
  const state = db()
  // Mantém só as cotações recentes deste carrinho.
  for (const [id, record] of Object.entries(state.quotes)) {
    if (record.cartId === cart.id && Date.parse(record.quote.expiresAt) < now) delete state.quotes[id]
  }
  state.quotes[quote.id] = { quote, cartId: cart.id, userId }
  persist()
  return quote
}

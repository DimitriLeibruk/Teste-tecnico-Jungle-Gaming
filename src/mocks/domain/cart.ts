import type { Cart, CartItem, EditionId } from '@/api/contracts'
import { addEth, compareEth, mulEth } from '@/lib/money'
import { db, nextId, type CartRecord } from '../db/database'
import { apiError } from '../http'
import { SEED_COUPONS } from '../db/seed'
import { getEdition, getNft } from './catalog'

/**
 * Carrinho no servidor simulado.
 * - Visitante: carrinho identificado pelo header X-Cart-Id (id gerado no cliente).
 * - Autenticado: um carrinho por usuário; o do visitante é mesclado no login.
 */

export function getOrCreateCart(userId: string | null, guestCartId: string | null): CartRecord {
  const state = db()
  if (userId) {
    const existing = state.userCarts[userId]
    if (existing && state.carts[existing]) return state.carts[existing]
    const cart = emptyCart(nextId('cart'), userId)
    state.carts[cart.id] = cart
    state.userCarts[userId] = cart.id
    return cart
  }
  const id = guestCartId && /^[\w-]{8,64}$/.test(guestCartId) ? `guest_${guestCartId}` : null
  if (!id) throw apiError(422, 'VALIDATION_ERROR', 'Identificador de carrinho ausente (X-Cart-Id)')
  state.carts[id] ??= emptyCart(id, null)
  return state.carts[id]
}

function emptyCart(id: string, userId: string | null): CartRecord {
  return { id, userId, lines: [], couponCode: null, version: 0, updatedAt: new Date().toISOString() }
}

export function bumpCart(cart: CartRecord) {
  cart.version += 1
  cart.updatedAt = new Date().toISOString()
}

export function maxQuantityFor(nftId: string, editionId: EditionId) {
  const nft = getNft(nftId)
  const edition = nft && getEdition(nft, editionId)
  if (!edition) return 0
  return Math.min(edition.available, edition.maxPerOrder)
}

export function toCartDto(cart: CartRecord): Cart {
  const items: CartItem[] = []
  for (const line of cart.lines) {
    const nft = getNft(line.nftId)
    const edition = nft && getEdition(nft, line.editionId)
    if (!nft || !edition) continue
    const maxQuantity = Math.min(edition.available, edition.maxPerOrder)
    const status: CartItem['status'] =
      edition.available === 0
        ? 'sold-out'
        : line.quantity > maxQuantity
          ? 'insufficient'
          : compareEth(edition.price, line.addedUnitPrice) !== 0
            ? 'price-changed'
            : 'ok'
    items.push({
      id: line.id,
      nftId: nft.id,
      editionId: edition.id,
      editionLabel: edition.label,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.thumb,
      alt: nft.alt,
      quantity: line.quantity,
      unitPrice: edition.price,
      addedUnitPrice: line.addedUnitPrice,
      lineTotal: mulEth(edition.price, line.quantity),
      available: edition.available,
      maxQuantity,
      status,
      nftVersion: nft.version,
    })
  }
  return {
    id: cart.id,
    owner: cart.userId ? 'user' : 'guest',
    items,
    coupon: cart.couponCode ? { code: cart.couponCode, label: couponLabel(cart.couponCode) } : null,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: addEth('0', ...items.map((i) => i.lineTotal)),
    version: cart.version,
    updatedAt: cart.updatedAt,
  }
}

function couponLabel(code: string) {
  return findCoupon(code)?.label ?? code
}


export function findCoupon(code: string) {
  return SEED_COUPONS.find((c) => c.code === code.trim().toUpperCase())
}

export function addLine(cart: CartRecord, nftId: string, editionId: EditionId, quantity: number) {
  const nft = getNft(nftId)
  if (!nft) throw apiError(404, 'NOT_FOUND', 'NFT não encontrado')
  const edition = getEdition(nft, editionId)
  if (!edition) throw apiError(422, 'VALIDATION_ERROR', 'Edição inválida', { fieldErrors: { editionId: 'Edição inválida' } })
  if (edition.available === 0) throw apiError(409, 'AVAILABILITY_CONFLICT', `A edição ${edition.label} de ${nft.name} está esgotada`)

  const max = Math.min(edition.available, edition.maxPerOrder)
  const existing = cart.lines.find((l) => l.nftId === nftId && l.editionId === editionId)
  const next = (existing?.quantity ?? 0) + quantity
  if (next > max) {
    throw apiError(409, 'AVAILABILITY_CONFLICT', `Limite de ${max} ${max === 1 ? 'unidade' : 'unidades'} para a edição ${edition.label} de ${nft.name}`, {
      details: { maxQuantity: max, inCart: existing?.quantity ?? 0 },
    })
  }
  if (existing) {
    existing.quantity = next
  } else {
    cart.lines.push({
      id: nextId('item'),
      nftId,
      editionId,
      quantity,
      addedUnitPrice: edition.price,
      addedAt: new Date().toISOString(),
    })
  }
  bumpCart(cart)
}

/** Mescla o carrinho do visitante no do usuário respeitando a disponibilidade. */
export function mergeCarts(target: CartRecord, source: CartRecord) {
  for (const line of source.lines) {
    const max = maxQuantityFor(line.nftId, line.editionId)
    if (max === 0) continue
    const existing = target.lines.find((l) => l.nftId === line.nftId && l.editionId === line.editionId)
    if (existing) {
      existing.quantity = Math.min(max, existing.quantity + line.quantity)
    } else {
      target.lines.push({ ...line, id: nextId('item'), quantity: Math.min(max, line.quantity) })
    }
  }
  if (!target.couponCode && source.couponCode) target.couponCode = source.couponCode
  source.lines = []
  source.couponCode = null
  bumpCart(source)
  bumpCart(target)
}

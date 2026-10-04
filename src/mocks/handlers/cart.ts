import { http, HttpResponse } from 'msw'
import {
  addCartItemInputSchema,
  applyCouponInputSchema,
  createQuoteInputSchema,
  mergeCartInputSchema,
  updateCartItemInputSchema,
} from '@/api/contracts'
import { db, persist } from '../db/database'
import { addLine, bumpCart, findCoupon, getOrCreateCart, mergeCarts, toCartDto } from '../domain/cart'
import { getEdition, getNft } from '../domain/catalog'
import { createQuote } from '../domain/quote'
import { apiError, readBody, requireAuth, resolveAuth } from '../http'

function cartFor(request: Request) {
  const auth = resolveAuth(request)
  return { cart: getOrCreateCart(auth?.user.id ?? null, request.headers.get('X-Cart-Id')), auth }
}

function respond(cart: Parameters<typeof toCartDto>[0]) {
  persist()
  return HttpResponse.json(toCartDto(cart))
}

export const cartHandlers = [
  http.get('/api/cart', ({ request }) => {
    const { cart } = cartFor(request)
    return respond(cart)
  }),

  http.post('/api/cart/items', async ({ request }) => {
    const { cart } = cartFor(request)
    const input = await readBody(request, addCartItemInputSchema)
    addLine(cart, input.nftId, input.editionId, input.quantity)
    return respond(cart)
  }),

  http.patch('/api/cart/items/:itemId', async ({ request, params }) => {
    const { cart } = cartFor(request)
    const { quantity } = await readBody(request, updateCartItemInputSchema)
    const line = cart.lines.find((l) => l.id === params.itemId)
    if (!line) return apiError(404, 'NOT_FOUND', 'Item não encontrado no carrinho')
    const nft = getNft(line.nftId)
    const edition = nft && getEdition(nft, line.editionId)
    const max = edition ? Math.min(edition.available, edition.maxPerOrder) : 0
    // Reduzir é sempre permitido (resolve "insuficiente"); aumentar respeita o limite.
    if (quantity > line.quantity && quantity > max) {
      return apiError(409, 'AVAILABILITY_CONFLICT', `Limite de ${max} ${max === 1 ? 'unidade' : 'unidades'} para esta edição`, {
        details: { maxQuantity: max },
      })
    }
    line.quantity = quantity
    bumpCart(cart)
    return respond(cart)
  }),

  http.delete('/api/cart/items/:itemId', ({ request, params }) => {
    const { cart } = cartFor(request)
    const before = cart.lines.length
    cart.lines = cart.lines.filter((l) => l.id !== params.itemId)
    if (cart.lines.length === before) return apiError(404, 'NOT_FOUND', 'Item não encontrado no carrinho')
    bumpCart(cart)
    return respond(cart)
  }),

  /** Aceita os preços atuais (zera o aviso de "preço alterado"). */
  http.post('/api/cart/acknowledge-prices', ({ request }) => {
    const { cart } = cartFor(request)
    for (const line of cart.lines) {
      const nft = getNft(line.nftId)
      const edition = nft && getEdition(nft, line.editionId)
      if (edition) line.addedUnitPrice = edition.price
    }
    bumpCart(cart)
    return respond(cart)
  }),

  http.put('/api/cart/coupon', async ({ request }) => {
    const { cart } = cartFor(request)
    const { code } = await readBody(request, applyCouponInputSchema)
    const coupon = findCoupon(code)
    if (!coupon) {
      return apiError(422, 'COUPON_INVALID', 'Código promocional inválido.', { fieldErrors: { code: 'Código promocional inválido' } })
    }
    if (Date.parse(coupon.expiresAt) < Date.now()) {
      return apiError(422, 'COUPON_EXPIRED', `O cupom ${coupon.code} expirou.`, { fieldErrors: { code: 'Este cupom expirou' } })
    }
    cart.couponCode = coupon.code
    bumpCart(cart)
    return respond(cart)
  }),

  http.delete('/api/cart/coupon', ({ request }) => {
    const { cart } = cartFor(request)
    cart.couponCode = null
    bumpCart(cart)
    return respond(cart)
  }),

  http.post('/api/cart/merge', async ({ request }) => {
    const { user } = requireAuth(request)
    const { guestCartId } = await readBody(request, mergeCartInputSchema)
    const target = getOrCreateCart(user.id, null)
    const source = db().carts[`guest_${guestCartId}`]
    if (source && source.lines.length) mergeCarts(target, source)
    if (source) delete db().carts[source.id]
    return respond(target)
  }),

  http.post('/api/quotes', async ({ request }) => {
    const { cart, auth } = cartFor(request)
    const { network } = await readBody(request, createQuoteInputSchema)
    const quote = createQuote(cart, network, auth?.user.id ?? null)
    return HttpResponse.json(quote, { status: 201 })
  }),
]

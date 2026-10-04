import { NETWORKS, WALLET_PROVIDERS, type CreateOrderInput, type Order } from '@/api/contracts'
import { addEth } from '@/lib/money'
import { db, nextId, persist, type OrderRecord, type UserRecord } from '../db/database'
import { fakeTxHash, stableHash, stableStringify } from '../db/crypto'
import { apiError } from '../http'
import { getScenarioConfig, takeOnce } from '../scenarios'
import { bumpCart, getOrCreateCart } from './cart'
import { getEdition, getNft, touchNft, updateEdition } from './catalog'
import { publishOrderUpdated } from './events'
import { computeQuote, createQuote } from './quote'

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export interface CreateOrderResult {
  order: Order
  replayed: boolean
  /** Cenário order-timeout: o pedido foi criado mas a resposta "se perde". */
  dropResponse: boolean
}

/**
 * Criação idempotente de pedido.
 * - Mesma chave + mesmo conteúdo → devolve o MESMO pedido (replay).
 * - Mesma chave + conteúdo diferente → 409 IDEMPOTENCY_CONFLICT.
 * - Cotação divergente do estado atual → 409 QUOTE_OUTDATED (com a nova cotação).
 * - Disponibilidade insuficiente → 409 AVAILABILITY_CONFLICT.
 */
export function createOrder(user: UserRecord, input: CreateOrderInput, idempotencyKey: string): CreateOrderResult {
  const state = db()
  const config = getScenarioConfig()
  const requestHash = stableHash(stableStringify(input))
  const idemKey = `${user.id}:${idempotencyKey}`

  const existingId = state.idempotency[idemKey]
  if (existingId) {
    const existing = state.orders[existingId]
    if (existing && existing.requestHash === requestHash) {
      return { order: existing.order, replayed: true, dropResponse: false }
    }
    throw apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo de pedido.')
  }

  const quoteRecord = state.quotes[input.quoteId]
  const cart = getOrCreateCart(user.id, null)
  if (!quoteRecord || quoteRecord.cartId !== cart.id) {
    throw apiError(409, 'QUOTE_EXPIRED', 'A cotação não é mais válida. Revise os valores atualizados.', {
      details: { quote: createQuote(cart, input.network, user.id) },
    })
  }
  if (Date.parse(quoteRecord.quote.expiresAt) < Date.now()) {
    throw apiError(409, 'QUOTE_EXPIRED', 'A cotação expirou. Revise os valores atualizados.', {
      details: { quote: createQuote(cart, input.network, user.id) },
    })
  }

  // Cenários de mudança concorrente durante a compra (emitem nft.updated).
  const firstLine = quoteRecord.quote.items[0]
  if (firstLine && config.priceChangeOnOrderOnce && takeOnce('price-change-on-order')) {
    const nft = getNft(firstLine.nftId)!
    const edition = getEdition(nft, firstLine.editionId)!
    updateEdition(nft.id, edition.id, { price: addEth(edition.price, '0.1') })
  }
  if (firstLine && config.soldOutOnOrderOnce && takeOnce('sold-out-on-order')) {
    updateEdition(firstLine.nftId, firstLine.editionId, { available: 0 })
  }

  const current = computeQuote(cart, input.network)
  if (!current.valid) {
    throw apiError(409, 'AVAILABILITY_CONFLICT', 'Um ou mais itens não estão mais disponíveis na quantidade escolhida.', {
      details: { quote: createQuote(cart, input.network, user.id) },
    })
  }
  if (current.fingerprint !== quoteRecord.quote.fingerprint || current.fingerprint !== input.quoteFingerprint) {
    throw apiError(409, 'QUOTE_OUTDATED', 'Os valores do pedido mudaram. Revise e confirme novamente.', {
      details: { quote: createQuote(cart, input.network, user.id) },
    })
  }

  const wallets = state.wallets[user.id]
  const wallet = [wallets?.primary, wallets?.secondary].find((w) => w?.id === input.walletId)
  if (!wallet) {
    throw apiError(422, 'VALIDATION_ERROR', 'Selecione uma carteira cadastrada.', { fieldErrors: { walletId: 'Carteira não encontrada' } })
  }
  const connection = state.connections[input.connectionId]
  if (!connection || connection.userId !== user.id || connection.walletId !== wallet.id || connection.network !== input.network) {
    throw apiError(422, 'VALIDATION_ERROR', 'Conecte a carteira selecionada na rede escolhida antes de confirmar.', {
      fieldErrors: { connectionId: 'Carteira não conectada' },
    })
  }

  // Reserva as unidades enquanto o pagamento está pendente.
  const reservations = current.items.map((l) => ({ nftId: l.nftId, editionId: l.editionId, quantity: l.quantity }))
  for (const r of reservations) {
    const nft = getNft(r.nftId)!
    getEdition(nft, r.editionId)!.available -= r.quantity
    touchNft(nft)
  }

  const now = new Date()
  const id = nextId('ord')
  const order: Order = {
    id,
    number: `KUR-${id.slice(-6)}`,
    status: 'pending',
    version: 1,
    userId: user.id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    settledAt: null,
    items: current.items,
    subtotal: current.subtotal,
    discount: current.discount,
    networkFee: current.networkFee,
    total: current.total,
    coupon: current.coupon,
    network: input.network,
    wallet: {
      id: wallet.id,
      provider: input.provider,
      address: connection.address,
      label: WALLET_PROVIDERS[input.provider].label,
    },
    buyer: input.buyer,
    transaction: null,
    failureReason: null,
  }
  const record: OrderRecord = {
    order,
    idempotencyKey,
    requestHash,
    cartId: cart.id,
    settleAt: now.getTime() + config.settleDelayMs,
    outcome: config.payment,
    reservations,
  }
  state.orders[id] = record
  state.idempotency[idemKey] = id
  persist()
  scheduleSettlement(record)

  const dropResponse = config.orderTimeoutOnce && takeOnce('order-timeout')
  return { order, replayed: false, dropResponse }
}

function scheduleSettlement(record: OrderRecord) {
  const id = record.order.id
  clearTimeout(timers.get(id))
  const wait = Math.max(0, record.settleAt - Date.now())
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id)
      settleOrder(id)
    }, wait),
  )
}

/** Liquida o pagamento (confirmado/recusado). Estados finais são terminais. */
export function settleOrder(orderId: string, outcome?: 'confirmed' | 'declined') {
  const record = db().orders[orderId]
  if (!record || record.order.status !== 'pending') return record?.order
  const order = record.order
  const result = outcome ?? record.outcome
  const now = new Date().toISOString()

  if (result === 'confirmed') {
    const hash = fakeTxHash(order.id)
    order.status = 'confirmed'
    order.transaction = { hash, explorerUrl: `${NETWORKS[order.network].explorerTx}${hash}` }
    // Remove do carrinho apenas os itens e quantidades efetivamente comprados.
    const cart = db().carts[record.cartId]
    if (cart) {
      for (const item of order.items) {
        const line = cart.lines.find((l) => l.nftId === item.nftId && l.editionId === item.editionId)
        if (!line) continue
        line.quantity -= item.quantity
      }
      cart.lines = cart.lines.filter((l) => l.quantity > 0)
      if (order.coupon && cart.couponCode === order.coupon.code) cart.couponCode = null
      bumpCart(cart)
    }
  } else {
    order.status = 'declined'
    order.failureReason = 'O pagamento foi recusado pela carteira. Nenhum valor foi cobrado e seus itens continuam no carrinho.'
    for (const r of record.reservations) {
      const nft = getNft(r.nftId)
      const edition = nft && getEdition(nft, r.editionId)
      if (!nft || !edition) continue
      edition.available += r.quantity
      touchNft(nft)
    }
  }
  order.settledAt = now
  order.updatedAt = now
  order.version += 1
  persist()
  publishOrderUpdated(order)
  return order
}

/** Liquida pedidos vencidos (chamado a cada request e ao iniciar o mock). */
export function settleDueOrders() {
  const now = Date.now()
  for (const record of Object.values(db().orders)) {
    if (record.order.status === 'pending' && record.settleAt <= now) settleOrder(record.order.id)
  }
}

/** Reagenda timers de pedidos pendentes após recarregar a página. */
export function resumePendingOrders() {
  for (const record of Object.values(db().orders)) {
    if (record.order.status === 'pending') scheduleSettlement(record)
  }
}

export function clearSettlementTimers() {
  timers.forEach((t) => clearTimeout(t))
  timers.clear()
}

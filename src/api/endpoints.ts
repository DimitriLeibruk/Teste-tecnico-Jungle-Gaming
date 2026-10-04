import { z } from 'zod'
import {
  authResponseSchema,
  cartSchema,
  catalogResponseSchema,
  featuredResponseSchema,
  IDEMPOTENCY_HEADER,
  nftDetailSchema,
  nftSummarySchema,
  orderSchema,
  ordersResponseSchema,
  quoteSchema,
  relatedResponseSchema,
  sessionResponseSchema,
  userSchema,
  walletConnectionSchema,
  walletsResponseSchema,
  type AddCartItemInput,
  type CatalogQuery,
  type CreateOrderInput,
  type LoginInput,
  type NetworkId,
  type PasswordChangeInput,
  type ProfileUpdateInput,
  type RegisterInput,
  type WalletConnectionInput,
  type WalletInput,
  type WalletSlot,
} from './contracts'
import { http, request } from './http'

/**
 * Funções de transporte tipadas — contrato REST documentado em ARCHITECTURE.md.
 * Cada função valida a resposta com o schema do contrato.
 */

type Signal = { signal?: AbortSignal }

// ------------------------------------------------------------------- Sessão
export const authApi = {
  register: (input: RegisterInput) => request(authResponseSchema, { method: 'POST', url: '/auth/register', data: input }),
  login: (input: LoginInput) => request(authResponseSchema, { method: 'POST', url: '/auth/login', data: input }),
  session: ({ signal }: Signal = {}) => request(sessionResponseSchema, { method: 'GET', url: '/auth/session', signal }),
  logout: () => http.post('/auth/logout').then(() => undefined),
}

// --------------------------------------------------------------------- NFTs
function catalogParams(query: CatalogQuery) {
  return {
    q: query.q || undefined,
    categories: query.categories?.length ? query.categories.join(',') : undefined,
    networks: query.networks?.length ? query.networks.join(',') : undefined,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    sort: query.sort,
    tab: query.tab,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export const nftApi = {
  list: (query: CatalogQuery, { signal }: Signal = {}) =>
    request(catalogResponseSchema, { method: 'GET', url: '/nfts', params: catalogParams(query), signal }),
  featured: ({ signal }: Signal = {}) => request(featuredResponseSchema, { method: 'GET', url: '/nfts/featured', signal }),
  detail: (id: string, { signal }: Signal = {}) => request(nftDetailSchema, { method: 'GET', url: `/nfts/${encodeURIComponent(id)}`, signal }),
  related: (id: string, { signal }: Signal = {}) =>
    request(relatedResponseSchema, { method: 'GET', url: `/nfts/${encodeURIComponent(id)}/related`, signal }),
}

// ---------------------------------------------------------------- Favoritos
export const favoritesResponseSchema = z.object({ ids: z.array(z.string()), items: z.array(nftSummarySchema) })
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>

export const favoritesApi = {
  list: ({ signal }: Signal = {}) => request(favoritesResponseSchema, { method: 'GET', url: '/me/favorites', signal }),
  add: (nftId: string) => request(favoritesResponseSchema, { method: 'PUT', url: `/me/favorites/${encodeURIComponent(nftId)}` }),
  remove: (nftId: string) => request(favoritesResponseSchema, { method: 'DELETE', url: `/me/favorites/${encodeURIComponent(nftId)}` }),
}

// ----------------------------------------------------------------- Carrinho
export const cartApi = {
  get: ({ signal }: Signal = {}) => request(cartSchema, { method: 'GET', url: '/cart', signal }),
  addItem: (input: AddCartItemInput) => request(cartSchema, { method: 'POST', url: '/cart/items', data: input }),
  updateItem: (itemId: string, quantity: number) => request(cartSchema, { method: 'PATCH', url: `/cart/items/${itemId}`, data: { quantity } }),
  removeItem: (itemId: string) => request(cartSchema, { method: 'DELETE', url: `/cart/items/${itemId}` }),
  applyCoupon: (code: string) => request(cartSchema, { method: 'PUT', url: '/cart/coupon', data: { code } }),
  removeCoupon: () => request(cartSchema, { method: 'DELETE', url: '/cart/coupon' }),
  acknowledgePrices: () => request(cartSchema, { method: 'POST', url: '/cart/acknowledge-prices' }),
  /** Usa o token recém-emitido explicitamente: roda antes de a sessão virar "autenticada" no cliente. */
  merge: (guestCartId: string, token: string) =>
    request(cartSchema, { method: 'POST', url: '/cart/merge', data: { guestCartId }, headers: { Authorization: `Bearer ${token}` } }),
}

// ------------------------------------------------------------------ Cotação
export const quoteApi = {
  create: (network: NetworkId, { signal }: Signal = {}) => request(quoteSchema, { method: 'POST', url: '/quotes', data: { network }, signal }),
}

// ------------------------------------------------------------------ Pedidos
export const ORDER_TIMEOUT_MS = 8_000

export const ordersApi = {
  /** Criação idempotente: a mesma chave recupera o mesmo pedido. */
  create: (input: CreateOrderInput, idempotencyKey: string) =>
    request(orderSchema, {
      method: 'POST',
      url: '/orders',
      data: input,
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      timeout: ORDER_TIMEOUT_MS,
    }),
  list: ({ signal }: Signal = {}) => request(ordersResponseSchema, { method: 'GET', url: '/orders', signal }),
  get: (id: string, { signal }: Signal = {}) => request(orderSchema, { method: 'GET', url: `/orders/${encodeURIComponent(id)}`, signal }),
}

// ------------------------------------------------------------------- Perfil
export const profileApi = {
  get: ({ signal }: Signal = {}) => request(userSchema, { method: 'GET', url: '/me/profile', signal }),
  update: (input: ProfileUpdateInput) => request(userSchema, { method: 'PATCH', url: '/me/profile', data: input }),
  uploadAvatar: (file: Blob, filename: string) => {
    const form = new FormData()
    form.append('avatar', file, filename)
    return request(userSchema, { method: 'PUT', url: '/me/avatar', data: form })
  },
  removeAvatar: () => request(userSchema, { method: 'DELETE', url: '/me/avatar' }),
  changePassword: (input: PasswordChangeInput) => http.put('/me/password', input).then(() => undefined),
}

// ---------------------------------------------------------------- Carteiras
export const walletsApi = {
  list: ({ signal }: Signal = {}) => request(walletsResponseSchema, { method: 'GET', url: '/me/wallets', signal }),
  save: (slot: WalletSlot, input: WalletInput) => request(walletsResponseSchema, { method: 'PUT', url: `/me/wallets/${slot}`, data: input }),
  connect: (input: WalletConnectionInput) => request(walletConnectionSchema, { method: 'POST', url: '/wallet-connections', data: input }),
  disconnect: (connectionId: string) => http.delete(`/wallet-connections/${connectionId}`).then(() => undefined),
}

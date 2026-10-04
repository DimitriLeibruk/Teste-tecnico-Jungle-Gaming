import type { CatalogQuery, NetworkId } from './contracts'

/**
 * Fábrica de chaves do TanStack Query.
 *
 * Isolamento:
 * - Dados públicos: ['nfts', ...]
 * - Dados privados: ['me', userId, ...] — removidos em logout/troca de usuário.
 * - Carrinho/cotação: escopo `user:<id>` ou `guest:<cartId>`.
 */
export const queryKeys = {
  session: ['session'] as const,

  nfts: ['nfts'] as const,
  catalog: (query: CatalogQuery) => ['nfts', 'list', query] as const,
  featured: ['nfts', 'featured'] as const,
  nft: (id: string) => ['nfts', 'detail', id] as const,
  related: (id: string) => ['nfts', 'related', id] as const,

  cart: (scope: string) => ['cart', scope] as const,
  quote: (scope: string, cartVersion: number, network: NetworkId) => ['quote', scope, cartVersion, network] as const,

  me: (userId: string) => ['me', userId] as const,
  favorites: (userId: string) => ['me', userId, 'favorites'] as const,
  profile: (userId: string) => ['me', userId, 'profile'] as const,
  wallets: (userId: string) => ['me', userId, 'wallets'] as const,
  orders: (userId: string) => ['me', userId, 'orders'] as const,
  order: (userId: string, orderId: string) => ['me', userId, 'orders', orderId] as const,
}

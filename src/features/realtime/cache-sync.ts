import type { QueryClient } from '@tanstack/react-query'
import type { Cart, NftDetail, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { queryKeys } from '@/api/query-keys'
import { compareEth, formatEth } from '@/lib/money'

/**
 * Aplica eventos de tempo real ao cache do TanStack Query.
 * Cada patch só é aplicado se a versão do evento for MAIOR que a versão em
 * cache — assim um evento atrasado nunca regride um dado mais novo vindo do REST.
 */

function patchSummary(item: NftSummary, event: NftUpdatedEvent): NftSummary {
  if (item.id !== event.data.nftId || item.version >= event.version) return item
  return {
    ...item,
    price: event.data.price,
    compareAtPrice: event.data.compareAtPrice,
    soldOut: event.data.soldOut,
    version: event.version,
  }
}

function patchContainer(data: unknown, event: NftUpdatedEvent): unknown {
  if (!data || typeof data !== 'object') return data
  const record = data as Record<string, unknown>
  if ('editions' in record) return data // detalhe: tratado separadamente
  let changed = false
  const next: Record<string, unknown> = { ...record }
  if (Array.isArray(record.items)) {
    next.items = (record.items as NftSummary[]).map((i) => {
      const patched = patchSummary(i, event)
      if (patched !== i) changed = true
      return patched
    })
  }
  if (Array.isArray(record.hero)) {
    next.hero = (record.hero as NftSummary[]).map((i) => {
      const patched = patchSummary(i, event)
      if (patched !== i) changed = true
      return patched
    })
  }
  if (record.spotlight && typeof record.spotlight === 'object') {
    const patched = patchSummary(record.spotlight as NftSummary, event)
    if (patched !== record.spotlight) {
      next.spotlight = patched
      changed = true
    }
  }
  return changed ? next : data
}

export interface NftChangeNotice {
  nftId: string
  name: string
  message: string
}

export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent): NftChangeNotice[] {
  const { nftId } = event.data

  queryClient.setQueryData<NftDetail>(queryKeys.nft(nftId), (old) => {
    if (!old || old.version >= event.version) return old
    return {
      ...old,
      price: event.data.price,
      compareAtPrice: event.data.compareAtPrice,
      soldOut: event.data.soldOut,
      version: event.version,
      editions: old.editions.map((edition) => {
        const update = event.data.editions.find((e) => e.id === edition.id)
        return update ? { ...edition, price: update.price, available: update.available } : edition
      }),
    }
  })

  queryClient.setQueriesData({ queryKey: queryKeys.nfts }, (data: unknown) => patchContainer(data, event))
  queryClient.setQueriesData({ predicate: (q) => q.queryKey[0] === 'me' && q.queryKey[2] === 'favorites' }, (data: unknown) =>
    patchContainer(data, event),
  )

  // Carrinho e cotação são recalculados no servidor: compara para avisar o usuário e refaz a consulta.
  const notices: NftChangeNotice[] = []
  let inCart = false
  for (const [, cart] of queryClient.getQueriesData<Cart>({ queryKey: ['cart'] })) {
    for (const item of cart?.items ?? []) {
      if (item.nftId !== nftId || item.nftVersion >= event.version) continue
      inCart = true
      const update = event.data.editions.find((e) => e.id === item.editionId)
      if (!update) continue
      if (compareEth(update.price, item.unitPrice) !== 0) {
        notices.push({
          nftId,
          name: item.name,
          message: `O preço de ${item.name} (${item.editionLabel}) mudou de ${formatEth(item.unitPrice)} para ${formatEth(update.price)}.`,
        })
      }
      if (update.available === 0) {
        notices.push({ nftId, name: item.name, message: `A edição ${item.editionLabel} de ${item.name} esgotou.` })
      } else if (update.available < item.quantity) {
        notices.push({
          nftId,
          name: item.name,
          message: `Restam apenas ${update.available} unidade(s) de ${item.name} (${item.editionLabel}).`,
        })
      }
    }
  }
  if (inCart) {
    void queryClient.invalidateQueries({ queryKey: ['cart'] })
    void queryClient.invalidateQueries({ queryKey: ['quote'] })
  }
  return notices
}

export function applyOrderUpdated(queryClient: QueryClient, userId: string, event: OrderUpdatedEvent) {
  const key = queryKeys.order(userId, event.data.orderId)
  queryClient.setQueryData<Order>(key, (old) => {
    if (!old || old.version >= event.version) return old
    return {
      ...old,
      status: event.data.status,
      transaction: event.data.transaction,
      failureReason: event.data.failureReason,
      version: event.version,
    }
  })
  void queryClient.invalidateQueries({ queryKey: key })
  void queryClient.invalidateQueries({ queryKey: queryKeys.orders(userId), exact: true })
  if (event.data.status === 'confirmed') {
    void queryClient.invalidateQueries({ queryKey: ['cart'] })
    void queryClient.invalidateQueries({ queryKey: ['quote'] })
  }
}

/** Reconciliação após reconectar: refaz as consultas ativas afetadas por eventos. */
export function reconcileAfterReconnect(queryClient: QueryClient, userId: string | null) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.nfts })
  void queryClient.invalidateQueries({ queryKey: ['cart'] })
  void queryClient.invalidateQueries({ queryKey: ['quote'] })
  if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.orders(userId) })
}

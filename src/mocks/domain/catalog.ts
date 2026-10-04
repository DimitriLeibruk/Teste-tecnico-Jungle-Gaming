import Big from 'big.js'
import {
  CATEGORIES,
  NETWORKS,
  type CatalogResponse,
  type CategoryId,
  type EditionId,
  type NetworkId,
  type NftDetail,
  type NftSummary,
  catalogQuerySchema,
} from '@/api/contracts'
import { compareEth, normalizeEth } from '@/lib/money'
import { db, persist } from '../db/database'
import { publishNftUpdated } from './events'

type ParsedQuery = ReturnType<typeof catalogQuerySchema.parse>

export function toSummary(nft: NftDetail): NftSummary {
  return {
    id: nft.id,
    name: nft.name,
    tokenId: nft.tokenId,
    image: nft.image,
    thumb: nft.thumb,
    alt: nft.alt,
    category: nft.category,
    network: nft.network,
    price: nft.price,
    compareAtPrice: nft.compareAtPrice,
    rarity: nft.rarity,
    soldOut: nft.soldOut,
    listedAt: nft.listedAt,
    version: nft.version,
  }
}

export function allNfts(): NftDetail[] {
  const state = db()
  return state.nftOrder.map((id) => state.nfts[id]!).filter(Boolean)
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function popularity(nft: NftDetail) {
  return nft.reviewCount * nft.rating
}

function newestThreshold(nfts: NftDetail[]) {
  const newest = Math.max(...nfts.map((n) => Date.parse(n.listedAt)))
  return newest - 21 * 86_400_000
}

function matches(nft: NftDetail, q: ParsedQuery, ignore?: 'categories' | 'networks', threshold?: number) {
  if (q.q) {
    const haystack = normalize([nft.name, nft.tokenId, nft.collection.name, ...nft.attributes, CATEGORIES[nft.category]].join(' '))
    if (!normalize(q.q).split(/\s+/).every((term) => haystack.includes(term))) return false
  }
  if (ignore !== 'categories' && q.categories?.length && !q.categories.includes(nft.category)) return false
  if (ignore !== 'networks' && q.networks?.length && !q.networks.includes(nft.network)) return false
  if (q.minPrice && compareEth(nft.price, q.minPrice) < 0) return false
  if (q.maxPrice && compareEth(nft.price, q.maxPrice) > 0) return false
  if (q.tab === 'new' && threshold !== undefined && Date.parse(nft.listedAt) < threshold) return false
  if (q.tab === 'trending' && nft.reviewCount < 15) return false
  return true
}

const sorters: Record<ParsedQuery['sort'], (a: NftDetail, b: NftDetail) => number> = {
  recent: (a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt),
  'price-asc': (a, b) => compareEth(a.price, b.price) || a.name.localeCompare(b.name),
  'price-desc': (a, b) => compareEth(b.price, a.price) || a.name.localeCompare(b.name),
  popular: (a, b) => popularity(b) - popularity(a) || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
}

export function listCatalog(q: ParsedQuery, { empty = false } = {}): CatalogResponse {
  const nfts = empty ? [] : allNfts()
  const threshold = nfts.length ? newestThreshold(nfts) : undefined
  const filtered = nfts.filter((n) => matches(n, q, undefined, threshold)).sort(sorters[q.sort])
  const total = filtered.length
  const totalPages = Math.ceil(total / q.pageSize)
  const start = (q.page - 1) * q.pageSize

  const categoryCounts = new Map<CategoryId, number>()
  for (const n of nfts.filter((n) => matches(n, q, 'categories', threshold))) {
    categoryCounts.set(n.category, (categoryCounts.get(n.category) ?? 0) + 1)
  }
  const networkCounts = new Map<NetworkId, number>()
  for (const n of nfts.filter((n) => matches(n, q, 'networks', threshold))) {
    networkCounts.set(n.network, (networkCounts.get(n.network) ?? 0) + 1)
  }
  const prices = allNfts().map((n) => new Big(n.price))
  const min = prices.reduce((a, b) => (b.lt(a) ? b : a), prices[0] ?? new Big(0))
  const max = prices.reduce((a, b) => (b.gt(a) ? b : a), prices[0] ?? new Big(0))

  return {
    items: filtered.slice(start, start + q.pageSize).map(toSummary),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages,
    facets: {
      categories: (Object.keys(CATEGORIES) as CategoryId[]).map((id) => ({ id, label: CATEGORIES[id], count: categoryCounts.get(id) ?? 0 })),
      networks: (Object.keys(NETWORKS) as NetworkId[]).map((id) => ({ id, label: NETWORKS[id].label, count: networkCounts.get(id) ?? 0 })),
      price: { min: normalizeEth(min), max: normalizeEth(max) },
    },
  }
}

export function getNft(id: string): NftDetail | undefined {
  return db().nfts[id]
}

export function getEdition(nft: NftDetail, editionId: EditionId) {
  return nft.editions.find((e) => e.id === editionId)
}

/** Recalcula campos derivados, incrementa a versão, persiste e emite nft.updated. */
export function touchNft(nft: NftDetail) {
  const defaultEdition = getEdition(nft, nft.defaultEditionId)
  if (defaultEdition) nft.price = defaultEdition.price
  nft.soldOut = nft.editions.every((e) => e.available === 0)
  nft.version += 1
  persist()
  return publishNftUpdated(nft)
}

/** Altera preço e/ou disponibilidade de uma edição (usado por cenários e pelo Mock Lab). */
export function updateEdition(nftId: string, editionId: EditionId | undefined, patch: { price?: string; available?: number }) {
  const nft = getNft(nftId)
  if (!nft) throw new Error(`NFT ${nftId} não encontrado`)
  const edition = getEdition(nft, editionId ?? nft.defaultEditionId)
  if (!edition) throw new Error(`Edição ${editionId} não encontrada`)
  if (patch.price !== undefined) edition.price = normalizeEth(patch.price)
  if (patch.available !== undefined) edition.available = Math.max(0, Math.floor(patch.available))
  return touchNft(nft)
}

import { z } from 'zod'
import { ethAmountSchema, isoDateSchema, networkIdSchema, paginatedSchema } from './common'

export const CATEGORIES = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
} as const

export const categoryIdSchema = z.enum(Object.keys(CATEGORIES) as [keyof typeof CATEGORIES, ...(keyof typeof CATEGORIES)[]])
export type CategoryId = z.infer<typeof categoryIdSchema>

export const editionIdSchema = z.enum(['1-1', '1-10', '1-50', 'aberta'])
export type EditionId = z.infer<typeof editionIdSchema>

export const raritySchema = z.enum(['comum', 'raro', 'lendario'])

export const editionSchema = z.object({
  id: editionIdSchema,
  label: z.string(),
  price: ethAmountSchema,
  /** Unidades ainda disponíveis para compra. 0 = esgotada. */
  available: z.number().int().min(0),
  /** Tiragem total (null em edição aberta). */
  supply: z.number().int().min(1).nullable(),
  /** Limite por pedido. */
  maxPerOrder: z.number().int().min(1),
})
export type Edition = z.infer<typeof editionSchema>

export const nftSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  thumb: z.string(),
  alt: z.string(),
  category: categoryIdSchema,
  network: networkIdSchema,
  /** Preço da edição padrão, exibido nos cards. */
  price: ethAmountSchema,
  /** Preço anterior (riscado) quando há promoção. */
  compareAtPrice: ethAmountSchema.nullable(),
  rarity: raritySchema,
  soldOut: z.boolean(),
  listedAt: isoDateSchema,
  /** Versão monotônica do recurso — usada para ordenar REST x eventos. */
  version: z.number().int().min(1),
})
export type NftSummary = z.infer<typeof nftSummarySchema>

export const reviewSchema = z.object({
  id: z.string(),
  author: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string(),
  createdAt: isoDateSchema,
})

export const nftDetailSchema = nftSummarySchema.extend({
  description: z.string(),
  story: z.array(z.string()),
  collection: z.object({ id: z.string(), name: z.string() }),
  attributes: z.array(z.string()),
  editions: z.array(editionSchema).min(1),
  defaultEditionId: editionIdSchema,
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0),
  reviews: z.array(reviewSchema),
  creator: z.object({ name: z.string(), royaltyPercent: z.number() }),
  contract: z.object({ address: z.string(), standard: z.string() }),
  gallery: z.array(z.object({ src: z.string(), alt: z.string() })).min(1),
})
export type NftDetail = z.infer<typeof nftDetailSchema>

export const catalogSortSchema = z.enum(['recent', 'price-asc', 'price-desc', 'popular', 'name'])
export type CatalogSort = z.infer<typeof catalogSortSchema>

export const CATALOG_SORT_LABELS: Record<CatalogSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  popular: 'Mais populares',
  name: 'Nome (A–Z)',
}

export const catalogTabSchema = z.enum(['all', 'new', 'trending'])
export type CatalogTab = z.infer<typeof catalogTabSchema>

export const CATALOG_TAB_LABELS: Record<CatalogTab, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

export const CATALOG_PAGE_SIZE = 9

/** Parâmetros aceitos por GET /api/nfts (todos opcionais na URL). */
export const catalogQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  categories: z.array(categoryIdSchema).optional(),
  networks: z.array(networkIdSchema).optional(),
  minPrice: ethAmountSchema.optional(),
  maxPrice: ethAmountSchema.optional(),
  sort: catalogSortSchema.default('recent'),
  tab: catalogTabSchema.default('all'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(48).default(CATALOG_PAGE_SIZE),
})
export type CatalogQuery = z.input<typeof catalogQuerySchema>

const facetSchema = z.object({ id: z.string(), label: z.string(), count: z.number().int().min(0) })

export const catalogResponseSchema = paginatedSchema(nftSummarySchema).extend({
  facets: z.object({
    categories: z.array(facetSchema.extend({ id: categoryIdSchema })),
    networks: z.array(facetSchema.extend({ id: networkIdSchema })),
    price: z.object({ min: ethAmountSchema, max: ethAmountSchema }),
  }),
})
export type CatalogResponse = z.infer<typeof catalogResponseSchema>

export const featuredResponseSchema = z.object({
  hero: z.array(nftSummarySchema).min(1),
  spotlight: nftSummarySchema,
})
export type FeaturedResponse = z.infer<typeof featuredResponseSchema>

export const relatedResponseSchema = z.object({ items: z.array(nftSummarySchema) })

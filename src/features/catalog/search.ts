import { z } from 'zod'
import {
  CATALOG_PAGE_SIZE,
  catalogSortSchema,
  catalogTabSchema,
  categoryIdSchema,
  networkIdSchema,
  type CatalogQuery,
  type CategoryId,
  type NetworkId,
} from '@/api/contracts'

/**
 * Estado do catálogo na URL. Listas são strings separadas por vírgula para
 * URLs legíveis (?categories=musica,arte-3d). Valores inválidos são descartados
 * (`.catch`), então links adulterados nunca quebram a página.
 */
const csv = z
  .string()
  .regex(/^[a-z0-9-]+(,[a-z0-9-]+)*$/)
  .optional()
  .catch(undefined)

const ethParam = z
  .string()
  .regex(/^\d+(\.\d{1,18})?$/)
  .optional()
  .catch(undefined)

export const catalogSearchSchema = z.object({
  q: z.string().trim().max(60).optional().catch(undefined),
  categories: csv,
  networks: csv,
  minPrice: ethParam,
  maxPrice: ethParam,
  sort: catalogSortSchema.optional().catch(undefined),
  tab: catalogTabSchema.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(999).optional().catch(undefined),
})

export type CatalogSearch = z.infer<typeof catalogSearchSchema>

function parseList<T extends string>(value: string | undefined, schema: z.ZodType<T>): T[] {
  if (!value) return []
  return value.split(',').flatMap((v) => {
    const parsed = schema.safeParse(v)
    return parsed.success ? [parsed.data] : []
  })
}

export function searchCategories(search: CatalogSearch): CategoryId[] {
  return parseList(search.categories, categoryIdSchema)
}

export function searchNetworks(search: CatalogSearch): NetworkId[] {
  return parseList(search.networks, networkIdSchema)
}

/** Converte o estado da URL na consulta enviada à API (fonte única dos parâmetros). */
export function toCatalogQuery(search: CatalogSearch): CatalogQuery {
  const categories = searchCategories(search)
  const networks = searchNetworks(search)
  return {
    q: search.q || undefined,
    categories: categories.length ? [...categories].sort() : undefined,
    networks: networks.length ? [...networks].sort() : undefined,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    sort: search.sort ?? 'recent',
    tab: search.tab ?? 'all',
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

export function toggleInList(list: string[], value: string) {
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  return next.length ? next.join(',') : undefined
}

export function hasActiveFilters(search: CatalogSearch) {
  return Boolean(search.q || search.categories || search.networks || search.minPrice || search.maxPrice || (search.tab && search.tab !== 'all'))
}

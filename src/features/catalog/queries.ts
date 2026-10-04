import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { CatalogQuery } from '@/api/contracts'
import { nftApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'

/**
 * Cada combinação de parâmetros tem sua própria chave: uma resposta antiga
 * nunca sobrescreve a consulta atual. O `signal` cancela requisições obsoletas.
 */
export const catalogQueryOptions = (query: CatalogQuery) =>
  queryOptions({
    queryKey: queryKeys.catalog(query),
    queryFn: ({ signal }) => nftApi.list(query, { signal }),
  })

export function useCatalog(query: CatalogQuery) {
  return useQuery({ ...catalogQueryOptions(query), placeholderData: keepPreviousData })
}

export const featuredQueryOptions = queryOptions({
  queryKey: queryKeys.featured,
  queryFn: ({ signal }) => nftApi.featured({ signal }),
  staleTime: 60_000,
})

export function useFeatured() {
  return useQuery(featuredQueryOptions)
}

export const nftQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.nft(id),
    queryFn: ({ signal }) => nftApi.detail(id, { signal }),
  })

export function useNft(id: string) {
  return useQuery(nftQueryOptions(id))
}

export function useRelated(id: string) {
  return useQuery({
    queryKey: queryKeys.related(id),
    queryFn: ({ signal }) => nftApi.related(id, { signal }),
    staleTime: 60_000,
  })
}

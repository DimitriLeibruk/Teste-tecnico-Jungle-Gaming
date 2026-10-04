import { http, HttpResponse } from 'msw'
import { catalogQuerySchema, type FeaturedResponse } from '@/api/contracts'
import { allNfts, getNft, listCatalog, toSummary } from '../domain/catalog'
import { apiError, zodFieldErrors } from '../http'
import { getScenarioConfig } from '../scenarios'

const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : undefined)

export const catalogHandlers = [
  http.get('/api/nfts', ({ request }) => {
    const params = new URL(request.url).searchParams
    const parsed = catalogQuerySchema.safeParse({
      q: params.get('q') ?? undefined,
      categories: list(params.get('categories')),
      networks: list(params.get('networks')),
      minPrice: params.get('minPrice') ?? undefined,
      maxPrice: params.get('maxPrice') ?? undefined,
      sort: params.get('sort') ?? undefined,
      tab: params.get('tab') ?? undefined,
      page: params.has('page') ? Number(params.get('page')) : undefined,
      pageSize: params.has('pageSize') ? Number(params.get('pageSize')) : undefined,
    })
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Parâmetros de busca inválidos', { fieldErrors: zodFieldErrors(parsed.error) })
    }
    return HttpResponse.json(listCatalog(parsed.data, { empty: getScenarioConfig().catalogEmpty }))
  }),

  http.get('/api/nfts/featured', () => {
    const byId = (id: string) => getNft(id)
    const hero = ['emerald-ape-042', 'neon-vessel-552', 'golden-beat-207'].map(byId).filter((n) => !!n).map(toSummary)
    const spotlight = byId('cosmic-bloom-118') ?? allNfts()[0]!
    const body: FeaturedResponse = { hero, spotlight: toSummary(spotlight) }
    return HttpResponse.json(body)
  }),

  http.get('/api/nfts/:id', ({ params }) => {
    const nft = getNft(String(params.id))
    if (!nft) return apiError(404, 'NOT_FOUND', 'Este NFT não existe ou foi removido do catálogo.')
    return HttpResponse.json(nft)
  }),

  http.get('/api/nfts/:id/related', ({ params }) => {
    const nft = getNft(String(params.id))
    if (!nft) return apiError(404, 'NOT_FOUND', 'Este NFT não existe ou foi removido do catálogo.')
    const items = allNfts()
      .filter((n) => n.id !== nft.id && n.collection.id === nft.collection.id && !n.soldOut)
      .sort((a, b) => b.reviewCount * b.rating - a.reviewCount * a.rating)
      .slice(0, 10)
      .map(toSummary)
    return HttpResponse.json({ items })
  }),
]

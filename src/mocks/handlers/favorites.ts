import { http, HttpResponse } from 'msw'
import { db, persist } from '../db/database'
import { getNft, toSummary } from '../domain/catalog'
import { apiError, requireAuth } from '../http'

function favoritesBody(userId: string) {
  const ids = db().favorites[userId] ?? []
  return {
    ids,
    items: ids.map((id) => getNft(id)).filter((n) => !!n).map(toSummary),
  }
}

export const favoritesHandlers = [
  http.get('/api/me/favorites', ({ request }) => {
    const { user } = requireAuth(request)
    return HttpResponse.json(favoritesBody(user.id))
  }),

  http.put('/api/me/favorites/:nftId', ({ request, params }) => {
    const { user } = requireAuth(request)
    const nftId = String(params.nftId)
    if (!getNft(nftId)) return apiError(404, 'NOT_FOUND', 'NFT não encontrado')
    const list = (db().favorites[user.id] ??= [])
    if (!list.includes(nftId)) list.unshift(nftId)
    persist()
    return HttpResponse.json(favoritesBody(user.id))
  }),

  http.delete('/api/me/favorites/:nftId', ({ request, params }) => {
    const { user } = requireAuth(request)
    const nftId = String(params.nftId)
    db().favorites[user.id] = (db().favorites[user.id] ?? []).filter((id) => id !== nftId)
    persist()
    return HttpResponse.json(favoritesBody(user.id))
  }),
]

import { delay, http, HttpResponse } from 'msw'
import { createOrderInputSchema, IDEMPOTENCY_HEADER } from '@/api/contracts'
import { db } from '../db/database'
import { createOrder } from '../domain/orders'
import { apiError, readBody, requireAuth } from '../http'

export const ordersHandlers = [
  http.post('/api/orders', async ({ request }) => {
    const { user } = requireAuth(request)
    const key = request.headers.get(IDEMPOTENCY_HEADER)
    if (!key || key.length < 16 || key.length > 128) {
      return apiError(422, 'VALIDATION_ERROR', `Header ${IDEMPOTENCY_HEADER} obrigatório (16 a 128 caracteres).`)
    }
    const input = await readBody(request, createOrderInputSchema)
    const result = createOrder(user, input, key)
    if (result.dropResponse) {
      // Cenário order-timeout: o pedido foi persistido, mas a resposta nunca chega.
      await delay('infinite')
    }
    return HttpResponse.json(result.order, {
      status: result.replayed ? 200 : 201,
      headers: result.replayed ? { 'Idempotent-Replayed': 'true' } : {},
    })
  }),

  http.get('/api/orders', ({ request }) => {
    const { user } = requireAuth(request)
    const items = Object.values(db().orders)
      .map((r) => r.order)
      .filter((o) => o.userId === user.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    return HttpResponse.json({ items })
  }),

  http.get('/api/orders/:id', ({ request, params }) => {
    const { user } = requireAuth(request)
    const record = db().orders[String(params.id)]
    if (!record) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado.')
    if (record.order.userId !== user.id) return apiError(403, 'FORBIDDEN', 'Você não tem permissão para ver este pedido.')
    return HttpResponse.json(record.order)
  }),
]

import { setupWorker } from 'msw/browser'
import { networkHandler } from './network'
import { authHandlers } from './handlers/auth'
import { catalogHandlers } from './handlers/catalog'
import { favoritesHandlers } from './handlers/favorites'
import { cartHandlers } from './handlers/cart'
import { ordersHandlers } from './handlers/orders'
import { accountHandlers } from './handlers/account'
import { realtimeHandler } from './realtime'
import { initDb } from './db/database'
import { resumePendingOrders, settleDueOrders } from './domain/orders'
import { applyScenarioFromUrl } from './scenarios'
import { mockControl } from './control'

/** Ordem importa: o middleware de rede (latência/falhas) vem primeiro. */
export const handlers = [
  networkHandler,
  ...authHandlers,
  ...catalogHandlers,
  ...favoritesHandlers,
  ...cartHandlers,
  ...ordersHandlers,
  ...accountHandlers,
  realtimeHandler,
]

export async function startMockServer() {
  applyScenarioFromUrl()
  await initDb()
  settleDueOrders()
  resumePendingOrders()

  const worker = setupWorker(...handlers)
  await worker.start({
    quiet: true,
    // Assets estáticos e fontes passam direto; qualquer outra chamada sem handler gera aviso.
    onUnhandledRequest(request, print) {
      const url = new URL(request.url)
      if (url.origin === location.origin && !url.pathname.startsWith('/api/')) return
      print.warning()
    },
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  window.__KURIO_MOCK__ = mockControl
  return worker
}

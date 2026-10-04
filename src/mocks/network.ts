import { delay, http, HttpResponse } from 'msw'
import { apiError } from './http'
import { getScenarioConfig, hitCount, registerHit, type LatencyProfile } from './scenarios'
import { settleDueOrders } from './domain/orders'

/**
 * Handler "middleware" registrado antes de todas as rotas /api/*.
 * Aplica latência e falhas do cenário ativo; quando não há falha, não retorna
 * nada e o MSW segue para o handler da rota (fallthrough).
 */

let requestSeq = 0

function seeded(n: number) {
  // Sequência pseudoaleatória determinística (mesma ordem a cada carregamento).
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function latencyFor(profile: LatencyProfile, method: string, path: string, seq: number): number {
  switch (profile) {
    case 'none':
      return 0
    case 'slow':
      return 2500
    case 'variable':
      return 200 + Math.round(seeded(seq) * 2200)
    case 'out-of-order':
      if (method === 'GET' && path === '/api/nfts') return seq % 2 === 1 ? 1200 : 150
      return 120
    default:
      return 120 + Math.round(seeded(seq) * 300)
  }
}

export const networkHandler = http.all('/api/*', async ({ request }) => {
  const config = getScenarioConfig()
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method
  requestSeq += 1

  // Liquida pagamentos cujo prazo passou (sustenta refresh e relógio controlado).
  settleDueOrders()

  const ms = latencyFor(config.latency, method, path, requestSeq)
  if (ms > 0) await delay(ms)

  if (config.offline) return HttpResponse.error()

  for (const rule of config.faults) {
    if (rule.method && rule.method !== method) continue
    if (!new RegExp(rule.path).test(path)) continue
    const key = `fault:${rule.id}`
    if (rule.times !== undefined && hitCount(key) >= rule.times) continue
    registerHit(key)
    if (rule.fault.type === 'network') return HttpResponse.error()
    if (rule.fault.type === 'timeout') {
      await delay('infinite')
      return
    }
    return apiError(rule.fault.status, rule.fault.code, rule.fault.message)
  }
  return undefined
})

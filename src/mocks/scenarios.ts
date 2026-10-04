/**
 * Cenários de rede e de negócio do backend simulado.
 *
 * - Seleção: `?scenario=slow` (ou `?scenario=slow,favorites-fail`) em qualquer URL,
 *   pelo painel "Mock Lab" ou por `window.__KURIO_MOCK__.setScenario([...])`.
 * - A seleção persiste em localStorage; o reset volta ao cenário `default`.
 * - Regras "once" contam disparos em localStorage, então o comportamento é
 *   reproduzível inclusive após refresh.
 */

import type { ApiErrorCode } from '@/api/contracts'

export type LatencyProfile = 'none' | 'default' | 'slow' | 'variable' | 'out-of-order'

export type Fault =
  | { type: 'network' }
  | { type: 'timeout' }
  | { type: 'http'; status: number; code: ApiErrorCode; message: string }

export interface FaultRule {
  id: string
  method?: string
  /** Regex aplicada ao pathname. */
  path: string
  /** Quantas vezes dispara (omitido = sempre). */
  times?: number
  fault: Fault
}

export interface ScenarioConfig {
  latency: LatencyProfile
  faults: FaultRule[]
  payment: 'confirmed' | 'declined'
  /** Tempo até a "rede" liquidar o pagamento. */
  settleDelayMs: number
  catalogEmpty: boolean
  offline: boolean
  orderTimeoutOnce: boolean
  priceChangeOnOrderOnce: boolean
  soldOutOnOrderOnce: boolean
  walletRejectOnce: boolean
  sessionExpireOnce: boolean
  realtimeChaos: boolean
}

export const BASE_CONFIG: ScenarioConfig = {
  latency: 'default',
  faults: [],
  payment: 'confirmed',
  settleDelayMs: 2500,
  catalogEmpty: false,
  offline: false,
  orderTimeoutOnce: false,
  priceChangeOnOrderOnce: false,
  soldOutOnOrderOnce: false,
  walletRejectOnce: false,
  sessionExpireOnce: false,
  realtimeChaos: false,
}

export const SCENARIOS = {
  default: {
    label: 'Padrão',
    description: 'Tudo funciona, com latência variável curta (120–420 ms).',
    config: {},
  },
  instant: {
    label: 'Sem latência',
    description: 'Respostas imediatas (usado nos testes E2E e no Lighthouse).',
    config: { latency: 'none', settleDelayMs: 1500 },
  },
  slow: {
    label: 'Rede lenta',
    description: 'Todas as respostas demoram ~2,5 s (skeletons visíveis).',
    config: { latency: 'slow' },
  },
  variable: {
    label: 'Latência variável',
    description: 'Latência entre 200 ms e 2,4 s, sequência determinística.',
    config: { latency: 'variable' },
  },
  'out-of-order': {
    label: 'Respostas fora de ordem',
    description: 'Buscas do catálogo alternam 1,2 s / 150 ms: respostas antigas chegam depois das novas.',
    config: { latency: 'out-of-order' },
  },
  empty: {
    label: 'Catálogo vazio',
    description: 'A listagem de NFTs retorna zero resultados.',
    config: { catalogEmpty: true },
  },
  'catalog-error': {
    label: 'Falha transitória no catálogo',
    description: 'As 3 primeiras chamadas da listagem retornam 503; a seguinte funciona.',
    config: {
      faults: [
        {
          id: 'catalog-503',
          method: 'GET',
          path: '^/api/nfts$',
          times: 3,
          fault: { type: 'http', status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Catálogo temporariamente indisponível' },
        },
      ],
    },
  },
  'server-error': {
    label: 'Erro 500 em toda a API',
    description: 'Todas as rotas REST respondem 500.',
    config: {
      faults: [{ id: 'all-500', path: '^/api/', fault: { type: 'http', status: 500, code: 'INTERNAL_ERROR', message: 'Erro interno no servidor simulado' } }],
    },
  },
  offline: {
    label: 'Sem conexão',
    description: 'Falha de rede em todas as chamadas e o socket recusa conexões.',
    config: { offline: true },
  },
  'favorites-fail': {
    label: 'Falha ao favoritar',
    description: 'Incluir/remover favoritos responde 500 (testa rollback otimista).',
    config: {
      faults: [
        {
          id: 'favorites-500',
          path: '^/api/me/favorites/',
          fault: { type: 'http', status: 500, code: 'INTERNAL_ERROR', message: 'Não foi possível atualizar seus favoritos' },
        },
      ],
    },
  },
  'session-expired': {
    label: 'Sessão expira',
    description: 'A próxima chamada autenticada expira a sessão (401 SESSION_EXPIRED).',
    config: { sessionExpireOnce: true },
  },
  'payment-declined': {
    label: 'Pagamento recusado',
    description: 'Pedidos são recusados pela rede após ficarem pendentes.',
    config: { payment: 'declined' },
  },
  'order-timeout': {
    label: 'Timeout no pedido',
    description: 'O primeiro POST /api/orders cria o pedido mas a resposta não chega (timeout). A nova tentativa recupera o mesmo pedido.',
    config: { orderTimeoutOnce: true },
  },
  'price-change': {
    label: 'Preço muda na compra',
    description: 'No primeiro envio do pedido, o preço de um item sobe e o servidor exige nova confirmação.',
    config: { priceChangeOnOrderOnce: true },
  },
  'sold-out': {
    label: 'Edição esgota na compra',
    description: 'No primeiro envio do pedido, a edição de um item esgota.',
    config: { soldOutOnOrderOnce: true },
  },
  'wallet-rejected': {
    label: 'Carteira recusa conexão',
    description: 'A primeira tentativa de conectar a carteira é recusada pelo usuário.',
    config: { walletRejectOnce: true },
  },
  'realtime-chaos': {
    label: 'Eventos duplicados/antigos',
    description: 'Cada evento nft.updated é reenviado duplicado e seguido de uma versão antiga.',
    config: { realtimeChaos: true },
  },
} satisfies Record<string, { label: string; description: string; config: Partial<ScenarioConfig> }>

export type ScenarioId = keyof typeof SCENARIOS

const SCENARIO_KEY = 'kurio.mock.scenario'
const HITS_KEY = 'kurio.mock.hits'

export function isScenarioId(value: string): value is ScenarioId {
  return Object.hasOwn(SCENARIOS, value)
}

export function getActiveScenarioIds(): ScenarioId[] {
  try {
    const raw = localStorage.getItem(SCENARIO_KEY)
    const ids = raw ? (JSON.parse(raw) as string[]) : ['default']
    const valid = ids.filter(isScenarioId)
    return valid.length ? valid : ['default']
  } catch {
    return ['default']
  }
}

export function setActiveScenarioIds(ids: string[]) {
  const valid = ids.filter(isScenarioId)
  localStorage.setItem(SCENARIO_KEY, JSON.stringify(valid.length ? valid : ['default']))
  localStorage.removeItem(HITS_KEY)
}

/** Combina os presets ativos em uma configuração final. */
export function getScenarioConfig(): ScenarioConfig {
  return getActiveScenarioIds().reduce<ScenarioConfig>((acc, id) => {
    const preset = SCENARIOS[id].config as Partial<ScenarioConfig>
    return { ...acc, ...preset, faults: [...acc.faults, ...(preset.faults ?? [])] }
  }, { ...BASE_CONFIG, faults: [] })
}

function readHits(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(HITS_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function hitCount(key: string) {
  return readHits()[key] ?? 0
}

export function registerHit(key: string) {
  const hits = readHits()
  hits[key] = (hits[key] ?? 0) + 1
  localStorage.setItem(HITS_KEY, JSON.stringify(hits))
  return hits[key]
}

/** Consome uma regra "once": true apenas no primeiro disparo. */
export function takeOnce(key: string) {
  if (hitCount(key) > 0) return false
  registerHit(key)
  return true
}

export function resetHits() {
  localStorage.removeItem(HITS_KEY)
}

/** Lê `?scenario=` da URL inicial, aplica e limpa o parâmetro. */
export function applyScenarioFromUrl() {
  const url = new URL(window.location.href)
  const param = url.searchParams.get('scenario')
  if (param === null) return
  setActiveScenarioIds(param.split(',').map((s) => s.trim()))
  url.searchParams.delete('scenario')
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
}

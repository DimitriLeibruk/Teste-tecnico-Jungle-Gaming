import type { EditionId } from '@/api/contracts'
import { db, persist, resetDb } from './db/database'
import { getEdition, getNft, updateEdition } from './domain/catalog'
import { clearSettlementTimers, settleOrder } from './domain/orders'
import { connectedPeers, dropConnections, dropUserConnections, emitStaleNftEvent, replayLastEvent, resetRealtime } from './realtime'
import { getActiveScenarioIds, getScenarioConfig, resetHits, SCENARIOS, setActiveScenarioIds, type ScenarioId } from './scenarios'

/**
 * Painel de controle do backend simulado, exposto em `window.__KURIO_MOCK__`.
 *
 * Usado pelos testes Playwright (via page.evaluate) e pelo painel "Mock Lab".
 * Todas as ações alteram o estado do SERVIDOR simulado; a interface só recebe
 * as mudanças pelos mesmos caminhos de produção (REST + eventos Socket.IO).
 */
export const mockControl = {
  scenarios: SCENARIOS,
  getScenario: (): ScenarioId[] => getActiveScenarioIds(),
  getConfig: () => getScenarioConfig(),

  /** Define os cenários ativos (combináveis). Recarregue a página para limpar estado de UI. */
  setScenario(ids: ScenarioId[] | ScenarioId) {
    setActiveScenarioIds(Array.isArray(ids) ? ids : [ids])
    return getActiveScenarioIds()
  },

  /** Restaura integralmente o cenário conhecido (dados + cenário + contadores). */
  async reset(scenario: ScenarioId[] = ['default']) {
    clearSettlementTimers()
    resetRealtime()
    await resetDb()
    setActiveScenarioIds(scenario)
    resetHits()
    // Limpa também o estado do cliente (sessão, carrinho de visitante, rascunhos).
    for (const key of Object.keys(localStorage)) if (key.startsWith('kurio.') && !key.startsWith('kurio.mock')) localStorage.removeItem(key)
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('kurio.')) sessionStorage.removeItem(key)
  },

  /** Altera preço e/ou disponibilidade e emite `nft.updated` pelo Socket.IO. */
  updateNft(nftId: string, patch: { price?: string; available?: number; editionId?: EditionId }) {
    const { editionId, ...rest } = patch
    return updateEdition(nftId, editionId, rest)
  },

  getNft(nftId: string) {
    const nft = getNft(nftId)
    return nft ? { ...nft, edition: (id: EditionId) => getEdition(nft, id) } : null
  },

  /** Força a liquidação de um pedido pendente. */
  settleOrder(orderId: string, outcome?: 'confirmed' | 'declined') {
    return settleOrder(orderId, outcome)
  },

  pendingOrders() {
    return Object.values(db().orders)
      .filter((r) => r.order.status === 'pending')
      .map((r) => r.order)
  },

  orders() {
    return Object.values(db().orders).map((r) => r.order)
  },

  /** Expira as sessões ativas (todas ou de um usuário). */
  expireSessions(userId?: string) {
    for (const session of Object.values(db().sessions)) {
      if (!userId || session.userId === userId) session.revoked = true
    }
    persist()
    if (userId) dropUserConnections(userId)
  },

  /** Simula queda do servidor de tempo real; reconexões recusadas por `blockMs`. */
  disconnectSockets(blockMs = 0) {
    dropConnections(blockMs)
  },

  replayLastEvent,
  emitStaleNftEvent,
  connectedPeers,
}

export type MockControl = typeof mockControl

declare global {
  interface Window {
    __KURIO_MOCK__?: MockControl
  }
}

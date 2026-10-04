import type { RealtimeEvent } from '@/api/contracts'

/**
 * Registro de eventos já aplicados.
 * - Duplicatas (mesmo eventId) são descartadas.
 * - Eventos com versão <= à maior versão conhecida do recurso são descartados.
 * A comparação final com o cache (versão vinda do REST) acontece no patch.
 */
export class EventLedger {
  private seen = new Set<string>()
  private order: string[] = []
  private versions = new Map<string, number>()

  constructor(private readonly capacity = 500) {}

  private key(event: RealtimeEvent) {
    return `${event.resource.type}:${event.resource.id}`
  }

  /** Retorna o motivo do descarte, ou null quando o evento deve ser aplicado. */
  check(event: RealtimeEvent): 'duplicate' | 'stale' | null {
    if (this.seen.has(event.eventId)) return 'duplicate'
    const known = this.versions.get(this.key(event)) ?? 0
    if (event.version <= known) return 'stale'
    return null
  }

  record(event: RealtimeEvent) {
    this.seen.add(event.eventId)
    this.order.push(event.eventId)
    if (this.order.length > this.capacity) this.seen.delete(this.order.shift()!)
    const key = this.key(event)
    this.versions.set(key, Math.max(event.version, this.versions.get(key) ?? 0))
  }

  /** Alinha com versões observadas via REST (ex.: após reconciliação). */
  observe(resourceType: string, id: string, version: number) {
    const key = `${resourceType}:${id}`
    this.versions.set(key, Math.max(version, this.versions.get(key) ?? 0))
  }

  clear() {
    this.seen.clear()
    this.order = []
    this.versions.clear()
  }
}

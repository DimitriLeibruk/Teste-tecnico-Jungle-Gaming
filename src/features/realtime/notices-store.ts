import { useSyncExternalStore } from 'react'
import type { NftChangeNotice } from './cache-sync'

/** Avisos de alterações recebidas em tempo real (exibidos no carrinho/checkout). */
interface Notice extends NftChangeNotice {
  id: string
  at: number
}

let notices: Notice[] = []
const listeners = new Set<() => void>()
let seq = 0

function emit() {
  listeners.forEach((l) => l())
}

export const realtimeNotices = {
  push(items: NftChangeNotice[]) {
    if (!items.length) return
    notices = [...items.map((n) => ({ ...n, id: `n${++seq}`, at: Date.now() })), ...notices].slice(0, 6)
    emit()
  },
  dismiss(id: string) {
    notices = notices.filter((n) => n.id !== id)
    emit()
  },
  clear() {
    notices = []
    emit()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get: () => notices,
}

export function useRealtimeNotices() {
  return useSyncExternalStore(realtimeNotices.subscribe, realtimeNotices.get, realtimeNotices.get)
}

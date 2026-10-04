import { uuid } from '@/lib/id'
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/lib/storage'

/**
 * Identificador do carrinho do visitante (persistido em localStorage).
 * Enviado em todas as chamadas no header X-Cart-Id; no login, o carrinho é
 * mesclado ao do usuário e um novo id é gerado.
 */
let cached: string | null = null

export function getGuestCartId(): string {
  if (cached) return cached
  const stored = readJson<string>(STORAGE_KEYS.guestCart)
  cached = stored ?? uuid()
  if (!stored) writeJson(STORAGE_KEYS.guestCart, cached)
  return cached
}

export function rotateGuestCartId() {
  cached = null
  removeKey(STORAGE_KEYS.guestCart)
  return getGuestCartId()
}

/**
 * Acesso seguro ao Web Storage: modo privado, cotas e bloqueios
 * não podem derrubar a aplicação.
 */
type Area = 'local' | 'session'

function area(kind: Area): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readJson<T>(key: string, kind: Area = 'local'): T | null {
  try {
    const raw = area(kind)?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown, kind: Area = 'local') {
  try {
    area(kind)?.setItem(key, JSON.stringify(value))
  } catch {
    /* cota excedida ou storage bloqueado — segue em memória */
  }
}

export function removeKey(key: string, kind: Area = 'local') {
  try {
    area(kind)?.removeItem(key)
  } catch {
    /* noop */
  }
}

export const STORAGE_KEYS = {
  session: 'kurio.session',
  guestCart: 'kurio.guest-cart',
  checkoutDraft: 'kurio.checkout.draft',
  checkoutAttempt: 'kurio.checkout.attempt',
} as const

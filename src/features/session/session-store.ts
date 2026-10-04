import { useSyncExternalStore } from 'react'
import type { AuthResponse, User } from '@/api/contracts'
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/lib/storage'

/**
 * Estado da sessão (fonte única de verdade no cliente).
 * Persistimos apenas token, expiração e um snapshot público do usuário —
 * nunca senhas. `epoch` muda a cada login/logout/expiração e invalida
 * assinaturas e eventos da sessão anterior.
 */
export type SessionStatus = 'restoring' | 'authenticated' | 'anonymous'

export interface SessionState {
  status: SessionStatus
  user: User | null
  token: string | null
  expiresAt: string | null
  epoch: number
  /** Motivo do último encerramento involuntário (exibido no login). */
  endedReason: 'expired' | null
}

interface Persisted {
  token: string
  expiresAt: string
  user: User
}

const initialPersisted = readJson<Persisted>(STORAGE_KEYS.session)

let state: SessionState = {
  status: initialPersisted ? 'restoring' : 'anonymous',
  user: initialPersisted?.user ?? null,
  token: initialPersisted?.token ?? null,
  expiresAt: initialPersisted?.expiresAt ?? null,
  epoch: 0,
  endedReason: null,
}

const listeners = new Set<() => void>()
let expiryTimer: ReturnType<typeof setTimeout> | undefined

function set(next: Partial<SessionState>) {
  state = { ...state, ...next }
  if (state.token && state.user && state.expiresAt) {
    writeJson(STORAGE_KEYS.session, { token: state.token, expiresAt: state.expiresAt, user: state.user } satisfies Persisted)
  } else {
    removeKey(STORAGE_KEYS.session)
  }
  scheduleExpiry()
  listeners.forEach((l) => l())
}

function scheduleExpiry() {
  clearTimeout(expiryTimer)
  if (state.status !== 'authenticated' || !state.expiresAt) return
  const ms = Date.parse(state.expiresAt) - Date.now()
  // setTimeout aceita no máximo ~24,8 dias
  if (ms < 2 ** 31 - 1) expiryTimer = setTimeout(() => sessionStore.expire(), Math.max(0, ms))
}

export const sessionStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  authenticate(auth: AuthResponse) {
    set({
      status: 'authenticated',
      user: auth.user,
      token: auth.session.token,
      expiresAt: auth.session.expiresAt,
      epoch: state.epoch + 1,
      endedReason: null,
    })
  },
  confirm(user: User, expiresAt: string) {
    set({ status: 'authenticated', user, expiresAt })
  },
  updateUser(user: User) {
    if (state.user?.id === user.id) set({ user })
  },
  clear() {
    set({ status: 'anonymous', user: null, token: null, expiresAt: null, epoch: state.epoch + 1, endedReason: null })
  },
  expire() {
    if (state.status !== 'authenticated' && state.status !== 'restoring') return
    set({ status: 'anonymous', user: null, token: null, expiresAt: null, epoch: state.epoch + 1, endedReason: 'expired' })
  },
  dismissEndedReason() {
    if (state.endedReason) set({ endedReason: null })
  },
}

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

export function cartScope(session: Pick<SessionState, 'status' | 'user'>, guestCartId: string) {
  return session.status === 'authenticated' && session.user ? `user:${session.user.id}` : `guest:${guestCartId}`
}

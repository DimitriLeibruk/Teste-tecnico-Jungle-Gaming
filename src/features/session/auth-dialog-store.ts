import { useSyncExternalStore } from 'react'

/** Controle global do modal "Entrar | Criar conta" (desktop). */
export type AuthDialogMode = 'login' | 'register'

interface State {
  mode: AuthDialogMode | null
  reason: string | null
}

let state: State = { mode: null, reason: null }
const listeners = new Set<() => void>()

function set(next: State) {
  state = next
  listeners.forEach((l) => l())
}

export const authDialog = {
  open(mode: AuthDialogMode = 'login', reason: string | null = null) {
    set({ mode, reason })
  },
  switch(mode: AuthDialogMode) {
    set({ ...state, mode })
  },
  close() {
    set({ mode: null, reason: null })
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get: () => state,
}

export function useAuthDialog() {
  return useSyncExternalStore(authDialog.subscribe, authDialog.get, authDialog.get)
}

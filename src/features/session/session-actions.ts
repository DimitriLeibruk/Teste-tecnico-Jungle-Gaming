import type { QueryClient } from '@tanstack/react-query'
import type { AuthResponse } from '@/api/contracts'
import { authApi, cartApi } from '@/api/endpoints'
import { configureHttp } from '@/api/http'
import { toApiError, type ApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { removeKey, STORAGE_KEYS } from '@/lib/storage'
import { getGuestCartId, rotateGuestCartId } from '@/features/cart/guest-cart'
import { sessionStore } from './session-store'

/**
 * Orquestra os efeitos colaterais de sessão: limpeza de cache privado,
 * mescla do carrinho do visitante e reação a sessão expirada.
 */
let queryClient: QueryClient | null = null

export function bindSession(client: QueryClient) {
  queryClient = client
  configureHttp({
    getToken: () => sessionStore.get().token,
    getGuestCartId,
    onAuthError: handleAuthError,
  })
}

/** Remove do cache tudo que pertence ao usuário anterior. */
export function clearPrivateData() {
  if (!queryClient) return
  for (const key of [['me'], ['cart'], ['quote']]) {
    void queryClient.cancelQueries({ queryKey: key })
    queryClient.removeQueries({ queryKey: key })
  }
}

function clearCheckoutStorage() {
  removeKey(STORAGE_KEYS.checkoutDraft, 'session')
  removeKey(STORAGE_KEYS.checkoutAttempt, 'session')
}

export async function restoreSession() {
  const current = sessionStore.get()
  if (current.status !== 'restoring') return
  try {
    const res = await authApi.session()
    sessionStore.confirm(res.user, res.expiresAt)
  } catch (error) {
    const apiError = toApiError(error)
    if (apiError.isAuthError) {
      clearPrivateData()
      sessionStore.expire()
    } else if (current.user && current.expiresAt) {
      // Falha de rede no boot: mantém a sessão local; o servidor revalida na próxima chamada.
      sessionStore.confirm(current.user, current.expiresAt)
    } else {
      sessionStore.clear()
    }
  }
}

export async function completeLogin(auth: AuthResponse) {
  const previous = sessionStore.get().user
  if (previous && previous.id !== auth.user.id) clearCheckoutStorage()
  clearPrivateData()

  // Preserva os itens do visitante: mescla ANTES de trocar o estado da sessão.
  // Se a sessão virasse "autenticada" primeiro, um GET /cart do usuário poderia
  // responder depois da mescla com o carrinho antigo e sobrescrever o cache.
  const guestCartId = getGuestCartId()
  try {
    const cart = await cartApi.merge(guestCartId, auth.session.token)
    queryClient?.setQueryData(queryKeys.cart(`user:${auth.user.id}`), cart)
  } catch {
    /* sem mescla: o carrinho do usuário será buscado normalmente */
  }
  queryClient?.removeQueries({ queryKey: queryKeys.cart(`guest:${guestCartId}`) })
  rotateGuestCartId()
  sessionStore.authenticate(auth)
}

export async function logout() {
  try {
    await authApi.logout()
  } catch {
    /* logout local acontece mesmo sem resposta do servidor */
  }
  clearCheckoutStorage()
  clearPrivateData()
  sessionStore.clear()
}

function handleAuthError(_error: ApiError, sentToken: string | null) {
  // Ignora respostas de requisições feitas por uma sessão anterior.
  if (!sentToken || sentToken !== sessionStore.get().token) return
  clearPrivateData()
  sessionStore.expire()
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateOrderInput, Order, WalletConnectionInput } from '@/api/contracts'
import { ordersApi, walletsApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { stableHash, stableStringify } from '@/lib/hash'
import { uuid } from '@/lib/id'
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/lib/storage'
import { useSession } from '@/features/session/session-store'

/**
 * Tentativa de checkout persistida em sessionStorage: guarda a chave de
 * idempotência e o payload enquanto a resposta do servidor não chega.
 * Se a página recarregar no meio do envio, a mesma chave recupera o mesmo pedido.
 */
export interface CheckoutAttempt {
  key: string
  requestHash: string
  userId: string
  input: CreateOrderInput
  startedAt: string
}

export function readPendingAttempt(userId: string | undefined): CheckoutAttempt | null {
  const attempt = readJson<CheckoutAttempt>(STORAGE_KEYS.checkoutAttempt, 'session')
  return attempt && attempt.userId === userId ? attempt : null
}

export function clearPendingAttempt() {
  removeKey(STORAGE_KEYS.checkoutAttempt, 'session')
}

const MAX_ATTEMPTS = 3
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Criação idempotente de pedido com recuperação automática:
 * timeout/falha de rede/5xx → reenvia com a MESMA chave (até 3 tentativas).
 * Cliques repetidos são bloqueados pelo estado da mutation e pela mesma chave.
 */
export function useCreateOrder({ onAttempt }: { onAttempt?: (attempt: number) => void } = {}) {
  const queryClient = useQueryClient()
  const { user } = useSession()

  return useMutation({
    mutationKey: ['orders', 'create'],
    mutationFn: async (input: CreateOrderInput): Promise<Order> => {
      if (!user) throw new Error('Sessão necessária')
      const requestHash = stableHash(stableStringify(input))
      let attempt = readPendingAttempt(user.id)
      if (!attempt || attempt.requestHash !== requestHash) {
        attempt = { key: uuid(), requestHash, userId: user.id, input, startedAt: new Date().toISOString() }
        writeJson(STORAGE_KEYS.checkoutAttempt, attempt, 'session')
      }
      for (let i = 1; ; i++) {
        onAttempt?.(i)
        try {
          const order = await ordersApi.create(input, attempt.key)
          clearPendingAttempt()
          return order
        } catch (error) {
          const apiError = toApiError(error)
          if (apiError.isTransient && i < MAX_ATTEMPTS) {
            await sleep(600 * i)
            continue
          }
          // Erros definitivos (409/422) encerram a tentativa; transitórios mantêm a chave para retomada.
          if (!apiError.isTransient) clearPendingAttempt()
          throw apiError
        }
      }
    },
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(order.userId, order.id), order)
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders(order.userId), exact: true })
    },
  })
}

export function useConnectWallet() {
  return useMutation({ mutationFn: (input: WalletConnectionInput) => walletsApi.connect(input) })
}

export function useDisconnectWallet() {
  return useMutation({ mutationFn: (connectionId: string) => walletsApi.disconnect(connectionId) })
}

import { QueryClient } from '@tanstack/react-query'
import { ApiError, toApiError } from '@/api/errors'

/**
 * Política de cache, retries e sincronização (documentada em ARCHITECTURE.md):
 * - Queries: até 2 novas tentativas, só em falhas transitórias (rede, timeout, 5xx, 429),
 *   com backoff exponencial (0,5 s → 1 s → máx. 4 s). Erros 4xx não são repetidos.
 * - Mutations: sem retry automático (operações não idempotentes). O pedido tem
 *   recuperação própria via chave de idempotência.
 * - staleTime padrão de 30 s; dados afetados por tempo real (carrinho/cotação/pedidos)
 *   são sincronizados por eventos Socket.IO e por invalidação após mutations.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          const apiError = toApiError(error)
          return apiError.isTransient && failureCount < 2
        },
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function isNotFound(error: unknown) {
  return error instanceof ApiError && error.code === 'NOT_FOUND'
}

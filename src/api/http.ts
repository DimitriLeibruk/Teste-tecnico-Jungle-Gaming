import axios, { type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { env } from '@/lib/env'
import { whenNetworkReady } from '@/lib/network-gate'
import { ApiError, toApiError } from './errors'

/**
 * Cliente HTTP único da aplicação. Todas as chamadas REST passam por aqui.
 * Sessão e carrinho de visitante são injetados via `configureHttp` para evitar
 * dependência circular com o estado da aplicação.
 */
export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  headers: { Accept: 'application/json' },
})

interface HttpBindings {
  getToken: () => string | null
  getGuestCartId: () => string
  onAuthError: (error: ApiError, sentToken: string | null) => void
}

let bindings: HttpBindings | null = null

export function configureHttp(next: HttpBindings) {
  bindings = next
}

// Nenhuma chamada sai antes de a camada de mocks estar ativa (ver network-gate).
http.interceptors.request.use(async (config) => {
  await whenNetworkReady()
  const token = bindings?.getToken()
  if (token && !config.headers.has('Authorization')) config.headers.set('Authorization', `Bearer ${token}`)
  if (bindings) config.headers.set('X-Cart-Id', bindings.getGuestCartId())
  return config
})

http.interceptors.response.use(undefined, (error: unknown) => {
  const apiError = toApiError(error)
  if (apiError.isAuthError && bindings && axios.isAxiosError(error)) {
    const header = error.config?.headers?.Authorization
    const sentToken = typeof header === 'string' ? header.replace(/^Bearer /, '') : null
    // Só reage se a requisição foi feita com a sessão ainda vigente.
    if (sentToken) bindings.onAuthError(apiError, sentToken)
  }
  return Promise.reject(apiError)
})

/** Valida a resposta contra o contrato; divergências viram INVALID_RESPONSE. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    if (import.meta.env.DEV) console.error('[contrato] resposta inválida', result.error.issues, data)
    throw new ApiError({ status: 200, code: 'INVALID_RESPONSE', message: 'Resposta inesperada do servidor.' })
  }
  return result.data
}

export async function request<T extends z.ZodType>(schema: T, config: AxiosRequestConfig): Promise<z.infer<T>> {
  const response = await http.request(config)
  return parse(schema, response.data)
}

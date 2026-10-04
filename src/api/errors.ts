import { isAxiosError, isCancel } from 'axios'
import { apiErrorBodySchema, type ApiErrorCode } from './contracts'

export type ClientErrorCode = ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'CANCELED' | 'UNKNOWN'

/** Erro normalizado de todas as chamadas — a UI só conhece este tipo. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ClientErrorCode
  readonly fieldErrors: Record<string, string>
  readonly details: unknown

  constructor(params: { status: number; code: ClientErrorCode; message: string; fieldErrors?: Record<string, string>; details?: unknown }) {
    super(params.message)
    this.name = 'ApiError'
    this.status = params.status
    this.code = params.code
    this.fieldErrors = params.fieldErrors ?? {}
    this.details = params.details
  }

  /** Falhas transitórias: podem ser repetidas com segurança. */
  get isTransient() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT' || this.status >= 500 || this.status === 429
  }

  get isAuthError() {
    return this.code === 'SESSION_EXPIRED' || this.code === 'UNAUTHENTICATED'
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isCancel(error)) return new ApiError({ status: 0, code: 'CANCELED', message: 'Requisição cancelada' })
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ status: 0, code: 'TIMEOUT', message: 'O servidor demorou para responder. Tente novamente.' })
    }
    if (!error.response) {
      return new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.' })
    }
    const parsed = apiErrorBodySchema.safeParse(error.response.data)
    if (parsed.success) {
      const { code, message, fieldErrors, details } = parsed.data.error
      return new ApiError({ status: error.response.status, code, message, fieldErrors, details })
    }
    return new ApiError({
      status: error.response.status,
      code: error.response.status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN',
      message: 'Algo deu errado. Tente novamente em instantes.',
    })
  }
  return new ApiError({ status: 0, code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Erro inesperado' })
}

/** Mensagem amigável para exibir em toasts e alertas. */
export function errorMessage(error: unknown) {
  return toApiError(error).message
}

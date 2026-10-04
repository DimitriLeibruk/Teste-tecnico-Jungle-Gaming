import { z } from 'zod'

/**
 * Valores em ETH trafegam SEMPRE como strings decimais (nunca number),
 * para não perder precisão. Cálculos usam big.js (ver src/lib/money.ts).
 */
export const ethAmountSchema = z.string().regex(/^\d+(\.\d{1,18})?$/, 'Valor em ETH inválido')
export type EthAmount = z.infer<typeof ethAmountSchema>

export const isoDateSchema = z.string().datetime({ offset: true })

export const networkIdSchema = z.enum(['ethereum', 'polygon', 'solana'])
export type NetworkId = z.infer<typeof networkIdSchema>

export const NETWORKS: Record<NetworkId, { label: string; explorerName: string; explorerTx: string }> = {
  ethereum: { label: 'Ethereum', explorerName: 'Etherscan', explorerTx: 'https://sepolia.etherscan.io/tx/' },
  polygon: { label: 'Polygon', explorerName: 'Polygonscan', explorerTx: 'https://amoy.polygonscan.com/tx/' },
  solana: { label: 'Solana', explorerName: 'Solscan', explorerTx: 'https://solscan.io/tx/' },
}

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'ADDRESS_IN_USE',
  'AVAILABILITY_CONFLICT',
  'QUOTE_OUTDATED',
  'QUOTE_EXPIRED',
  'IDEMPOTENCY_CONFLICT',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'WALLET_REJECTED',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

/** Formato único de erro de todas as rotas REST. */
export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    /** Erros por campo (validação 422 e conflitos 409 de cadastro). */
    fieldErrors: z.record(z.string(), z.string()).optional(),
    /** Dados adicionais do erro (ex.: nova cotação em QUOTE_OUTDATED). */
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>

export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
}

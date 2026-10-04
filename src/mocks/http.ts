import { HttpResponse } from 'msw'
import type { z } from 'zod'
import type { ApiErrorBody, ApiErrorCode, User } from '@/api/contracts'
import { db, persist, type SessionRecord, type UserRecord } from './db/database'
import { getScenarioConfig, takeOnce } from './scenarios'
import { uuid } from '@/lib/id'

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string>; details?: unknown } = {},
) {
  const body: ApiErrorBody = { error: { code, message, ...extra } }
  return HttpResponse.json(body, { status })
}

/** Converte issues do Zod em `fieldErrors` (primeira mensagem por campo). */
export function zodFieldErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    fieldErrors[key] ??= issue.message
  }
  return fieldErrors
}

/** Lê e valida o corpo JSON; lança 422 com erros por campo. */
export async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw apiError(422, 'VALIDATION_ERROR', 'Corpo da requisição inválido')
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados', { fieldErrors: zodFieldErrors(parsed.error) })
  }
  return parsed.data
}

export function toUserDto(user: UserRecord): User {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    ensName: user.ensName,
    ensSuffix: user.ensSuffix,
    walletNickname: user.walletNickname,
    createdAt: user.createdAt,
  }
}

function bearer(request: Request) {
  const header = request.headers.get('Authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

/**
 * Resolve a sessão do request.
 * - sem token → null
 * - token desconhecido → 401 UNAUTHENTICATED
 * - expirado/revogado → 401 SESSION_EXPIRED
 */
export function resolveAuth(request: Request): { user: UserRecord; session: SessionRecord } | null {
  const token = bearer(request)
  if (!token) return null
  const session = db().sessions[token]
  if (!session) throw apiError(401, 'UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
  // Cenário session-expired: expira na primeira chamada de navegação/checkout autenticada
  // (perfil, carteiras, favoritos, pedidos, cotação) — não no login/merge do carrinho.
  const path = new URL(request.url).pathname
  const navigationCall = /^\/api\/(me|orders|quotes|wallet-connections)/.test(path)
  if (!session.revoked && navigationCall && getScenarioConfig().sessionExpireOnce && takeOnce('session-expire')) {
    session.revoked = true
    persist()
  }
  if (session.revoked || Date.parse(session.expiresAt) <= Date.now()) {
    throw apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  const user = db().users[session.userId]
  if (!user) throw apiError(401, 'UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
  return { user, session }
}

export function requireAuth(request: Request) {
  const auth = resolveAuth(request)
  if (!auth) throw apiError(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.')
  return auth
}

export const SESSION_TTL_MS = 60 * 60 * 1000

export function createSession(userId: string): SessionRecord {
  const token = `tok_${uuid().replace(/-/g, '')}`
  const now = Date.now()
  const session: SessionRecord = {
    token,
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    revoked: false,
  }
  db().sessions[token] = session
  return session
}

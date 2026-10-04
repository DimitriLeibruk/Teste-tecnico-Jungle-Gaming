import { http, HttpResponse } from 'msw'
import { loginInputSchema, registerInputSchema, type AuthResponse, type SessionResponse } from '@/api/contracts'
import { createUserRecord, db, persist } from '../db/database'
import { verifyPassword } from '../db/crypto'
import { apiError, createSession, readBody, requireAuth, resolveAuth, toUserDto } from '../http'

const RESERVED_USERNAMES = ['admin', 'kurio', 'suporte', 'root']

export const authHandlers = [
  http.post('/api/auth/register', async ({ request }) => {
    const input = await readBody(request, registerInputSchema)
    const users = Object.values(db().users)
    const fieldErrors: Record<string, string> = {}
    if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) fieldErrors.email = 'Este e-mail já está cadastrado'
    if (users.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) fieldErrors.username = 'Este nome de usuário já está em uso'
    if (fieldErrors.email || fieldErrors.username) {
      return apiError(409, fieldErrors.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', 'Já existe uma conta com esses dados.', { fieldErrors })
    }
    if (RESERVED_USERNAMES.includes(input.username.toLowerCase())) {
      return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados', { fieldErrors: { username: 'Este nome de usuário é reservado' } })
    }
    const user = await createUserRecord(input)
    const session = createSession(user.id)
    persist()
    const body: AuthResponse = { user: toUserDto(user), session: { token: session.token, expiresAt: session.expiresAt } }
    return HttpResponse.json(body, { status: 201 })
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const input = await readBody(request, loginInputSchema)
    const user = Object.values(db().users).find((u) => u.email.toLowerCase() === input.email.toLowerCase())
    if (!user || !(await verifyPassword(input.password, user.passwordSalt, user.passwordHash))) {
      return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    }
    const session = createSession(user.id)
    persist()
    const body: AuthResponse = { user: toUserDto(user), session: { token: session.token, expiresAt: session.expiresAt } }
    return HttpResponse.json(body)
  }),

  http.get('/api/auth/session', ({ request }) => {
    const { user, session } = requireAuth(request)
    const body: SessionResponse = { user: toUserDto(user), expiresAt: session.expiresAt }
    return HttpResponse.json(body)
  }),

  http.post('/api/auth/logout', ({ request }) => {
    try {
      const auth = resolveAuth(request)
      if (auth) {
        auth.session.revoked = true
        persist()
      }
    } catch {
      /* logout é idempotente: sessão já inválida também resulta em 204 */
    }
    return new HttpResponse(null, { status: 204 })
  }),
]

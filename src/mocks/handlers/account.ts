import { http, HttpResponse } from 'msw'
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  passwordChangeInputSchema,
  profileUpdateInputSchema,
  walletConnectionInputSchema,
  walletInputSchema,
  walletSlotSchema,
  type Wallet,
  type WalletConnection,
} from '@/api/contracts'
import { db, nextId, persist } from '../db/database'
import { hashPassword, randomHex, verifyPassword } from '../db/crypto'
import { apiError, readBody, requireAuth, toUserDto } from '../http'
import { getScenarioConfig, takeOnce } from '../scenarios'

async function fileToDataUrl(file: File) {
  const buffer = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000))
  return `data:${file.type};base64,${btoa(binary)}`
}

export const accountHandlers = [
  // ------------------------------------------------------------------ Perfil
  http.get('/api/me/profile', ({ request }) => {
    const { user } = requireAuth(request)
    return HttpResponse.json(toUserDto(user))
  }),

  http.patch('/api/me/profile', async ({ request }) => {
    const { user } = requireAuth(request)
    const input = await readBody(request, profileUpdateInputSchema)
    const others = Object.values(db().users).filter((u) => u.id !== user.id)
    const fieldErrors: Record<string, string> = {}
    if (others.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) fieldErrors.email = 'Este e-mail já está em uso por outra conta'
    if (others.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) fieldErrors.username = 'Este nome de usuário já está em uso'
    if (fieldErrors.email || fieldErrors.username) {
      return apiError(409, fieldErrors.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', 'Não foi possível salvar: dados já em uso.', { fieldErrors })
    }
    Object.assign(user, {
      displayName: input.displayName,
      username: input.username,
      email: input.email.toLowerCase(),
      ensName: input.ensName,
      ensSuffix: input.ensSuffix,
      walletNickname: input.walletNickname,
    })
    persist()
    return HttpResponse.json(toUserDto(user))
  }),

  http.put('/api/me/avatar', async ({ request }) => {
    const { user } = requireAuth(request)
    let file: FormDataEntryValue | null = null
    try {
      file = (await request.formData()).get('avatar')
    } catch {
      /* corpo inválido */
    }
    if (!(file instanceof File)) {
      return apiError(422, 'VALIDATION_ERROR', 'Envie uma imagem', { fieldErrors: { avatar: 'Selecione uma imagem' } })
    }
    if (!AVATAR_TYPES.includes(file.type as (typeof AVATAR_TYPES)[number])) {
      return apiError(422, 'VALIDATION_ERROR', 'Formato não suportado', { fieldErrors: { avatar: 'Use PNG, JPG ou WebP' } })
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return apiError(422, 'VALIDATION_ERROR', 'Arquivo muito grande', { fieldErrors: { avatar: 'A imagem deve ter até 2 MB' } })
    }
    user.avatarUrl = await fileToDataUrl(file)
    persist()
    return HttpResponse.json(toUserDto(user))
  }),

  http.delete('/api/me/avatar', ({ request }) => {
    const { user } = requireAuth(request)
    user.avatarUrl = null
    persist()
    return HttpResponse.json(toUserDto(user))
  }),

  http.put('/api/me/password', async ({ request }) => {
    const { user, session } = requireAuth(request)
    const input = await readBody(request, passwordChangeInputSchema)
    if (!(await verifyPassword(input.currentPassword, user.passwordSalt, user.passwordHash))) {
      return apiError(422, 'VALIDATION_ERROR', 'Senha atual incorreta', { fieldErrors: { currentPassword: 'Senha atual incorreta' } })
    }
    user.passwordSalt = randomHex(16)
    user.passwordHash = await hashPassword(input.newPassword, user.passwordSalt)
    // Revoga as demais sessões do usuário, mantendo a atual.
    for (const s of Object.values(db().sessions)) {
      if (s.userId === user.id && s.token !== session.token) s.revoked = true
    }
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------------------------------------------------------------- Carteiras
  http.get('/api/me/wallets', ({ request }) => {
    const { user } = requireAuth(request)
    return HttpResponse.json(db().wallets[user.id] ?? { primary: null, secondary: null })
  }),

  http.put('/api/me/wallets/:slot', async ({ request, params }) => {
    const { user } = requireAuth(request)
    const slot = walletSlotSchema.safeParse(params.slot)
    if (!slot.success) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada')
    const input = await readBody(request, walletInputSchema)
    const entry = (db().wallets[user.id] ??= { primary: null, secondary: null })
    if (slot.data === 'secondary' && !entry.primary) {
      return apiError(422, 'VALIDATION_ERROR', 'Cadastre a carteira principal primeiro.')
    }
    // Endereço vinculado a outra conta → conflito.
    const inUse = Object.entries(db().wallets).some(
      ([ownerId, w]) => ownerId !== user.id && [w.primary, w.secondary].some((x) => x?.address.toLowerCase() === input.address.toLowerCase()),
    )
    if (inUse) {
      return apiError(409, 'ADDRESS_IN_USE', 'Endereço já vinculado a outra conta', {
        fieldErrors: { address: 'Este endereço já está vinculado a outra conta Kurio' },
      })
    }
    const wallet: Wallet = {
      id: entry[slot.data]?.id ?? nextId('wal'),
      slot: slot.data,
      ...input,
      referralCode: input.referralCode,
      secondaryAddress: input.secondaryAddress ? input.secondaryAddress : null,
      email: input.email.toLowerCase(),
      updatedAt: new Date().toISOString(),
    }
    entry[slot.data] = wallet
    persist()
    return HttpResponse.json(entry)
  }),

  // ------------------------------------------- Conexão simulada de carteira
  http.post('/api/wallet-connections', async ({ request }) => {
    const { user } = requireAuth(request)
    const input = await readBody(request, walletConnectionInputSchema)
    const entry = db().wallets[user.id]
    const wallet = [entry?.primary, entry?.secondary].find((w) => w?.id === input.walletId)
    if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada')
    if (getScenarioConfig().walletRejectOnce && takeOnce('wallet-reject')) {
      return apiError(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira. Tente novamente e aprove a solicitação.')
    }
    const connection: WalletConnection & { userId: string } = {
      id: nextId('conn'),
      userId: user.id,
      walletId: wallet.id,
      provider: input.provider,
      network: input.network,
      address: wallet.address,
      connectedAt: new Date().toISOString(),
    }
    db().connections[connection.id] = connection
    persist()
    const { userId: _userId, ...body } = connection
    return HttpResponse.json(body, { status: 201 })
  }),

  http.delete('/api/wallet-connections/:id', ({ request, params }) => {
    const { user } = requireAuth(request)
    const connection = db().connections[String(params.id)]
    if (connection && connection.userId !== user.id) return apiError(403, 'FORBIDDEN', 'Conexão pertence a outro usuário')
    delete db().connections[String(params.id)]
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]

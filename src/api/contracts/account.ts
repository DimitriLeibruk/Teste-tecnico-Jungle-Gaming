import { z } from 'zod'
import { isoDateSchema, networkIdSchema } from './common'

// ---------------------------------------------------------------------------
// Regras de campo compartilhadas entre formulários (cliente) e handlers (mock)
// ---------------------------------------------------------------------------

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Use pelo menos 3 caracteres')
  .max(20, 'Use no máximo 20 caracteres')
  .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, ponto ou sublinhado')

export const emailSchema = z.string().trim().min(1, 'Informe o e-mail').email('Informe um e-mail válido')

export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa de pelo menos 8 caracteres')
  .max(64, 'Use no máximo 64 caracteres')
  .regex(/[a-z]/i, 'Inclua pelo menos uma letra')
  .regex(/\d/, 'Inclua pelo menos um número')

export const displayNameSchema = z.string().trim().min(2, 'Informe ao menos 2 caracteres').max(40, 'Use no máximo 40 caracteres')

export const ENS_SUFFIXES = ['.eth', '.kurio.eth'] as const
export const ensSuffixSchema = z.enum(ENS_SUFFIXES)
export type EnsSuffix = z.infer<typeof ensSuffixSchema>
export const ensLabelSchema = z
  .string()
  .trim()
  .min(3, 'O nome ENS precisa de pelo menos 3 caracteres')
  .max(32, 'Use no máximo 32 caracteres')
  .regex(/^[a-z0-9-]+$/, 'Use letras minúsculas, números ou hífen')

export const walletNicknameSchema = z.string().trim().min(2, 'Informe o apelido da carteira').max(30, 'Use no máximo 30 caracteres')

// ---------------------------------------------------------------------------
// Usuário e sessão
// ---------------------------------------------------------------------------

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  ensName: z.string().nullable(),
  ensSuffix: ensSuffixSchema,
  walletNickname: z.string().nullable(),
  createdAt: isoDateSchema,
})
export type User = z.infer<typeof userSchema>

export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: isoDateSchema,
})
export type Session = z.infer<typeof sessionSchema>

export const authResponseSchema = z.object({ user: userSchema, session: sessionSchema })
export type AuthResponse = z.infer<typeof authResponseSchema>

export const sessionResponseSchema = z.object({ user: userSchema, expiresAt: isoDateSchema })
export type SessionResponse = z.infer<typeof sessionResponseSchema>

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginInput = z.infer<typeof loginInputSchema>

/** Payload enviado à API (a confirmação de senha é validada só no cliente). */
export const registerInputSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
})
export type RegisterInput = z.infer<typeof registerInputSchema>

export const registerFormSchema = registerInputSchema
  .extend({ confirmPassword: z.string().min(1, 'Confirme a senha') })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
export type RegisterForm = z.infer<typeof registerFormSchema>

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export const profileUpdateInputSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  email: emailSchema,
  ensName: ensLabelSchema,
  ensSuffix: ensSuffixSchema,
  walletNickname: walletNicknameSchema,
})
export type ProfileUpdateInput = z.infer<typeof profileUpdateInputSchema>

export const passwordChangeInputSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: passwordSchema,
})
export type PasswordChangeInput = z.infer<typeof passwordChangeInputSchema>

export const passwordChangeFormSchema = passwordChangeInputSchema
  .extend({ confirmPassword: z.string().min(1, 'Confirme a nova senha') })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })
export type PasswordChangeForm = z.infer<typeof passwordChangeFormSchema>

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

// ---------------------------------------------------------------------------
// Carteiras
// ---------------------------------------------------------------------------

export const walletProviderSchema = z.enum(['metamask', 'walletconnect', 'coinbase'])
export type WalletProvider = z.infer<typeof walletProviderSchema>

export const WALLET_PROVIDERS: Record<WalletProvider, { label: string; initial: string }> = {
  walletconnect: { label: 'WalletConnect', initial: 'W' },
  metamask: { label: 'MetaMask', initial: 'M' },
  coinbase: { label: 'Coinbase Wallet', initial: 'C' },
}

export const walletSlotSchema = z.enum(['primary', 'secondary'])
export type WalletSlot = z.infer<typeof walletSlotSchema>

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function isValidAddress(address: string, network: z.infer<typeof networkIdSchema>) {
  return network === 'solana' ? SOLANA_ADDRESS.test(address) : EVM_ADDRESS.test(address)
}

export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,12}$/, 'O código tem de 6 a 12 letras ou números')

/** Campos da carteira (layout de Carteiras e Pagamento). */
export const walletFieldsSchema = z.object({
  displayName: displayNameSchema,
  nickname: walletNicknameSchema,
  network: networkIdSchema,
  profileName: z.string().trim().min(2, 'Informe o nome do perfil').max(40, 'Use no máximo 40 caracteres'),
  address: z.string().trim().min(1, 'Informe o endereço da carteira'),
  secondaryAddress: z.string().trim().max(64, 'Use no máximo 64 caracteres').optional().or(z.literal('')),
  provider: walletProviderSchema,
  referralCode: referralCodeSchema,
  email: emailSchema,
  ensName: ensLabelSchema,
  ensSuffix: ensSuffixSchema,
})

/** Valida o formato do endereço conforme a rede escolhida. */
export function refineWalletAddress(v: { address: string; network: z.infer<typeof networkIdSchema> }, ctx: z.RefinementCtx) {
  if (v.address && !isValidAddress(v.address, v.network)) {
    ctx.addIssue({
      code: 'custom',
      path: ['address'],
      message:
        v.network === 'solana'
          ? 'Endereço Solana inválido (base58, 32 a 44 caracteres)'
          : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais',
    })
  }
}

export const walletInputSchema = walletFieldsSchema.superRefine(refineWalletAddress)
export type WalletInput = z.infer<typeof walletInputSchema>

export const walletSchema = z.object({
  id: z.string(),
  slot: walletSlotSchema,
  displayName: z.string(),
  nickname: z.string(),
  network: networkIdSchema,
  profileName: z.string(),
  address: z.string(),
  secondaryAddress: z.string().nullable(),
  provider: walletProviderSchema,
  referralCode: z.string(),
  email: z.string(),
  ensName: z.string(),
  ensSuffix: ensSuffixSchema,
  updatedAt: isoDateSchema,
})
export type Wallet = z.infer<typeof walletSchema>

export const walletsResponseSchema = z.object({
  primary: walletSchema.nullable(),
  secondary: walletSchema.nullable(),
})
export type WalletsResponse = z.infer<typeof walletsResponseSchema>

/** Simulação de conexão de carteira (extensão) no checkout. */
export const walletConnectionInputSchema = z.object({
  walletId: z.string(),
  provider: walletProviderSchema,
  network: networkIdSchema,
})
export type WalletConnectionInput = z.infer<typeof walletConnectionInputSchema>

export const walletConnectionSchema = z.object({
  id: z.string(),
  walletId: z.string(),
  provider: walletProviderSchema,
  network: networkIdSchema,
  address: z.string(),
  connectedAt: isoDateSchema,
})
export type WalletConnection = z.infer<typeof walletConnectionSchema>

import { z } from 'zod'
import { refineWalletAddress, usernameSchema, walletFieldsSchema, type User, type Wallet } from '@/api/contracts'
import { readJson, STORAGE_KEYS, writeJson } from '@/lib/storage'

/** Campos do layout "Pagamento" (Perfil do colecionador). */
export const checkoutFormSchema = walletFieldsSchema
  .omit({ nickname: true })
  .extend({
    username: usernameSchema,
    useSecondary: z.boolean(),
    note: z.string().trim().max(280, 'Use no máximo 280 caracteres').optional().or(z.literal('')),
  })
  .superRefine(refineWalletAddress)

export type CheckoutForm = z.infer<typeof checkoutFormSchema>

export function formFromWallet(wallet: Wallet | null, user: User | null, base?: Partial<CheckoutForm>): CheckoutForm {
  return {
    displayName: base?.displayName || wallet?.displayName || user?.displayName || '',
    username: base?.username || user?.username || '',
    network: wallet?.network ?? 'ethereum',
    profileName: wallet?.profileName ?? '',
    address: wallet?.address ?? '',
    secondaryAddress: wallet?.secondaryAddress ?? '',
    provider: wallet?.provider ?? 'metamask',
    referralCode: wallet?.referralCode ?? '',
    email: base?.email || wallet?.email || user?.email || '',
    ensName: wallet?.ensName ?? user?.ensName ?? '',
    ensSuffix: wallet?.ensSuffix ?? user?.ensSuffix ?? '.eth',
    useSecondary: base?.useSecondary ?? false,
    note: base?.note ?? '',
  }
}

/** Rascunho do checkout (sessionStorage) para retomar após expiração de sessão. */
interface Draft {
  userId: string
  values: CheckoutForm
}

export function readDraft(userId: string): CheckoutForm | null {
  const draft = readJson<Draft>(STORAGE_KEYS.checkoutDraft, 'session')
  if (!draft || draft.userId !== userId) return null
  const parsed = checkoutFormSchema.safeParse(draft.values)
  // Rascunho incompleto também é útil: devolve os valores mesmo sem validar.
  return parsed.success ? parsed.data : draft.values
}

export function writeDraft(userId: string, values: CheckoutForm) {
  writeJson(STORAGE_KEYS.checkoutDraft, { userId, values } satisfies Draft, 'session')
}

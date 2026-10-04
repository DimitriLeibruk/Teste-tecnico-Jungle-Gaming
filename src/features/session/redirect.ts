import { z } from 'zod'

export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  motivo: z.enum(['expirada']).optional().catch(undefined),
})

/** Aceita apenas destinos internos (evita open redirect). */
export function safeRedirect(target: string | undefined) {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/'
  if (target.startsWith('/entrar') || target.startsWith('/cadastro')) return '/'
  return target
}

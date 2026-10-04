import { stableHash } from '@/lib/hash'

export { stableHash, stableStringify } from '@/lib/hash'

/** Senhas nunca são armazenadas em claro: SHA-256(salt:senha). */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(digest))
}

export async function verifyPassword(password: string, salt: string, hash: string) {
  return (await hashPassword(password, salt)) === hash
}

export function randomHex(bytes: number) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)))
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Hash de transação simulado (64 hex) derivado do id do pedido. */
export function fakeTxHash(seed: string) {
  let out = ''
  let i = 0
  while (out.length < 64) out += stableHash(`${seed}:${i++}`)
  return `0x${out.slice(0, 64)}`
}

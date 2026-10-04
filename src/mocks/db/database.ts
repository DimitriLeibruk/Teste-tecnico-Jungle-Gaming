import type {
  EditionId,
  EnsSuffix,
  NftDetail,
  Order,
  Quote,
  Wallet,
  WalletConnection,
} from '@/api/contracts'
import { buildNfts, SEED_NOW, SEED_PASSWORD, SEED_USERS } from './seed'
import { hashPassword, randomHex } from './crypto'

/**
 * "Banco" do backend simulado. Vive em memória no thread principal (onde o MSW
 * executa os handlers) e é persistido em localStorage para sustentar refresh.
 * O reset recria integralmente o cenário conhecido a partir das fixtures.
 */

export const DB_STORAGE_KEY = 'kurio.mock.db'
const SCHEMA = 3

export interface UserRecord {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl: string | null
  ensName: string | null
  ensSuffix: EnsSuffix
  walletNickname: string | null
  createdAt: string
  passwordHash: string
  passwordSalt: string
}

export interface SessionRecord {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
  revoked: boolean
}

export interface CartLine {
  id: string
  nftId: string
  editionId: EditionId
  quantity: number
  addedUnitPrice: string
  addedAt: string
}

export interface CartRecord {
  id: string
  userId: string | null
  lines: CartLine[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export interface QuoteRecord {
  quote: Quote
  cartId: string
  userId: string | null
}

export interface OrderRecord {
  order: Order
  idempotencyKey: string
  requestHash: string
  cartId: string
  /** Momento (epoch ms) em que a simulação liquida o pagamento. */
  settleAt: number
  outcome: 'confirmed' | 'declined'
  reservations: Array<{ nftId: string; editionId: EditionId; quantity: number }>
}

export interface DbState {
  schema: number
  idSeq: number
  eventSeq: number
  nfts: Record<string, NftDetail>
  nftOrder: string[]
  users: Record<string, UserRecord>
  sessions: Record<string, SessionRecord>
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  userCarts: Record<string, string>
  quotes: Record<string, QuoteRecord>
  orders: Record<string, OrderRecord>
  /** userId:idempotencyKey → orderId */
  idempotency: Record<string, string>
  wallets: Record<string, { primary: Wallet | null; secondary: Wallet | null }>
  connections: Record<string, WalletConnection & { userId: string }>
}

let state: DbState | null = null
const listeners = new Set<() => void>()

async function seed(): Promise<DbState> {
  const nfts = buildNfts()
  const users: DbState['users'] = {}
  const favorites: DbState['favorites'] = {}
  const wallets: DbState['wallets'] = {}

  for (const seedUser of SEED_USERS) {
    const salt = randomHex(16)
    users[seedUser.id] = {
      id: seedUser.id,
      username: seedUser.username,
      email: seedUser.email,
      displayName: seedUser.displayName,
      avatarUrl: null,
      ensName: seedUser.ensName,
      ensSuffix: '.eth',
      walletNickname: seedUser.walletNickname,
      createdAt: SEED_NOW,
      passwordSalt: salt,
      passwordHash: await hashPassword(SEED_PASSWORD, salt),
    }
    favorites[seedUser.id] = [...seedUser.favorites]
    const entry: { primary: Wallet | null; secondary: Wallet | null } = { primary: null, secondary: null }
    for (const w of seedUser.wallets) {
      entry[w.slot] = {
        id: `wal_${seedUser.id}_${w.slot}`,
        slot: w.slot,
        displayName: seedUser.displayName,
        nickname: w.nickname,
        network: w.network,
        profileName: w.profileName,
        address: w.address,
        secondaryAddress: w.secondaryAddress,
        provider: w.provider,
        referralCode: w.referralCode,
        email: seedUser.email,
        ensName: w.ensName,
        ensSuffix: w.ensSuffix,
        updatedAt: SEED_NOW,
      }
    }
    wallets[seedUser.id] = entry
  }

  return {
    schema: SCHEMA,
    idSeq: 0,
    eventSeq: 0,
    nfts: Object.fromEntries(nfts.map((n) => [n.id, n])),
    nftOrder: nfts.map((n) => n.id),
    users,
    sessions: {},
    favorites,
    carts: {},
    userCarts: {},
    quotes: {},
    orders: {},
    idempotency: {},
    wallets,
    connections: {},
  }
}

function load(): DbState | null {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DbState
    return parsed.schema === SCHEMA ? parsed : null
  } catch {
    return null
  }
}

export function persist() {
  if (!state) return
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* cota excedida: mantém em memória */
  }
}

export async function initDb() {
  state = load() ?? (await seed())
  persist()
  // Outra aba alterou o banco: recarrega para manter os dados consistentes.
  window.addEventListener('storage', (event) => {
    if (event.key !== DB_STORAGE_KEY || !event.newValue) return
    try {
      const next = JSON.parse(event.newValue) as DbState
      if (next.schema === SCHEMA) state = next
    } catch {
      /* ignora */
    }
  })
}

export async function resetDb() {
  state = await seed()
  persist()
  listeners.forEach((l) => l())
}

export function onDbReset(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function db(): DbState {
  if (!state) throw new Error('Mock DB não inicializado')
  return state
}

export function nextId(prefix: string) {
  const s = db()
  s.idSeq += 1
  return `${prefix}_${s.idSeq.toString().padStart(6, '0')}`
}

export function nextEventId() {
  const s = db()
  s.eventSeq += 1
  return `evt_${s.eventSeq.toString().padStart(8, '0')}`
}

export async function createUserRecord(input: { username: string; email: string; password: string }): Promise<UserRecord> {
  const salt = randomHex(16)
  const user: UserRecord = {
    id: nextId('usr'),
    username: input.username,
    email: input.email.toLowerCase(),
    displayName: input.username,
    avatarUrl: null,
    ensName: null,
    ensSuffix: '.eth',
    walletNickname: null,
    createdAt: new Date().toISOString(),
    passwordSalt: salt,
    passwordHash: await hashPassword(input.password, salt),
  }
  db().users[user.id] = user
  db().favorites[user.id] = []
  db().wallets[user.id] = { primary: null, secondary: null }
  return user
}

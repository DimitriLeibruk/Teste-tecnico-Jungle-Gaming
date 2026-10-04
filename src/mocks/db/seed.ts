import type { CategoryId, Edition, EditionId, NetworkId, NftDetail, WalletProvider } from '@/api/contracts'
import { CATEGORIES } from '@/api/contracts'
import { mulEth, normalizeEth, roundEth } from '@/lib/money'

/**
 * Fixtures determinísticas do cenário padrão.
 * Tudo deriva de uma semente fixa: o mesmo seed gera sempre os mesmos dados,
 * o que mantém baselines visuais e testes E2E estáveis.
 */

export const SEED_NOW = '2026-09-30T12:00:00.000Z'

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Art = 'emerald' | 'sage' | 'ivory' | 'golden'

const ART_ALT: Record<Art, string> = {
  emerald: 'Macaco de pelo castanho com óculos redondos verdes e jaqueta college verde com colar de esmeralda',
  sage: 'Gorila grisalho de chapéu bucket verde-sálvia e moletom lilás',
  ivory: 'Gorila de pelo escuro com gola alta verde e blazer marfim',
  golden: 'Macaco de pelo dourado com fones de ouvido verdes e jaqueta creme',
}

const ART_ATTRIBUTES: Record<Art, string[]> = {
  emerald: ['Óculos', 'Esmeralda', 'Jaqueta college'],
  sage: ['Chapéu bucket', 'Moletom', 'Pelo grisalho'],
  ivory: ['Blazer', 'Gola alta', 'Brinco'],
  golden: ['Fones de ouvido', 'Pelo dourado', 'Jaqueta creme'],
}

/** NFTs que aparecem no Figma, com nomes, artes e preços do layout. */
const FIGMA_ITEMS: Array<{ name: string; art: Art; price: string; compareAt?: string; category: CategoryId; network: NetworkId; rarity?: 'raro' | 'lendario' }> = [
  { name: 'Emerald Ape #042', art: 'emerald', price: '1.19', category: 'arte-digital', network: 'ethereum', rarity: 'raro' },
  { name: 'Sage Nomad #009', art: 'sage', price: '1.69', category: 'arte-digital', network: 'ethereum' },
  { name: 'Neon Vessel #552', art: 'ivory', price: '1.99', compareAt: '2.29', category: 'colecionaveis', network: 'ethereum', rarity: 'raro' },
  { name: 'Cosmic Bloom #118', art: 'sage', price: '1.29', category: 'generativa', network: 'polygon' },
  { name: 'Violet Nomad #314', art: 'sage', price: '1.39', category: 'arte-digital', network: 'ethereum' },
  { name: 'Ivory Baron #088', art: 'ivory', price: '1.79', category: 'colecionaveis', network: 'ethereum' },
  { name: 'Golden Beat #207', art: 'golden', price: '0.99', category: 'musica', network: 'polygon' },
  { name: 'Golden Frequency #071', art: 'golden', price: '0.59', category: 'musica', network: 'solana' },
  { name: 'Golden Signal #160', art: 'golden', price: '0.39', category: 'musica', network: 'ethereum' },
]

const NAME_PARTS: Record<Art, { first: string[]; second: string[] }> = {
  emerald: { first: ['Jade', 'Verdant', 'Malachite', 'Forest', 'Clover', 'Moss', 'Velvet'], second: ['Ape', 'Prince', 'Shades', 'Varsity'] },
  sage: { first: ['Dusty', 'Lilac', 'Misty', 'Quiet', 'Lavender', 'Ash', 'Willow'], second: ['Nomad', 'Bloom', 'Drifter', 'Hiker'] },
  ivory: { first: ['Onyx', 'Marble', 'Midnight', 'Pearl', 'Obsidian', 'Silent', 'Noble'], second: ['Baron', 'Vessel', 'Count', 'Curator'] },
  golden: { first: ['Amber', 'Honey', 'Solar', 'Copper', 'Saffron', 'Brass', 'Sunny'], second: ['Beat', 'Signal', 'Frequency', 'Echo'] },
}

const ARTS: Art[] = ['emerald', 'sage', 'ivory', 'golden']
const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[]
const NETWORK_CYCLE: NetworkId[] = ['ethereum', 'ethereum', 'polygon', 'solana', 'ethereum', 'polygon']

export const TOTAL_NFTS = 36

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildEditions(base: string, rand: () => number, opts: { soldOutEdition?: EditionId; allSoldOut?: boolean }): Edition[] {
  const pick = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
  const editions: Edition[] = [
    { id: '1-1', label: '1/1', price: roundEth(mulEth(base, 3), 2), supply: 1, available: rand() > 0.3 ? 1 : 0, maxPerOrder: 1 },
    { id: '1-10', label: '1/10', price: roundEth(mulEth(base, '1.5'), 2), supply: 10, available: pick(1, 6), maxPerOrder: 5 },
    { id: '1-50', label: '1/50', price: base, supply: 50, available: pick(12, 30), maxPerOrder: 10 },
    { id: 'aberta', label: 'Aberta', price: roundEth(mulEth(base, '0.6'), 2), supply: null, available: 500, maxPerOrder: 20 },
  ]
  for (const edition of editions) {
    if (opts.allSoldOut || edition.id === opts.soldOutEdition) edition.available = 0
  }
  return editions
}

function isoDaysBefore(days: number, hours = 0) {
  return new Date(Date.parse(SEED_NOW) - days * 86_400_000 - hours * 3_600_000).toISOString()
}

export function buildNfts(): NftDetail[] {
  const rand = mulberry32(20260930)
  const nfts: NftDetail[] = []
  const usedNames = new Set<string>()

  for (let i = 0; i < TOTAL_NFTS; i++) {
    const figma = FIGMA_ITEMS[i]
    const art: Art = figma?.art ?? ARTS[i % ARTS.length]!
    let name = figma?.name
    if (!name) {
      do {
        const parts = NAME_PARTS[art]
        const first = parts.first[Math.floor(rand() * parts.first.length)]!
        const second = parts.second[Math.floor(rand() * parts.second.length)]!
        name = `${first} ${second} #${String(100 + Math.floor(rand() * 899)).padStart(3, '0')}`
      } while (usedNames.has(name))
    }
    usedNames.add(name)

    const price = figma?.price ?? normalizeEth((0.05 + Math.round(rand() * 1220) / 100).toFixed(2))
    const category = figma?.category ?? CATEGORY_IDS[i % CATEGORY_IDS.length]!
    const network = figma?.network ?? NETWORK_CYCLE[i % NETWORK_CYCLE.length]!
    const rarity = figma?.rarity ?? (i % 13 === 0 ? 'lendario' : i % 5 === 0 ? 'raro' : 'comum')
    const tokenNumber = name.split('#')[1] ?? String(i)
    const id = slugify(name)

    // Casos de borda determinísticos:
    // - Ivory Baron #088: edição 1/10 esgotada (edição indisponível no detalhe)
    // - 12º item em diante, a cada 11: NFT totalmente esgotado
    const allSoldOut = i >= 12 && i % 11 === 1
    const soldOutEdition: EditionId | undefined = i === 5 ? '1-10' : undefined
    const editions = buildEditions(price, rand, { allSoldOut, soldOutEdition })
    const attributes = [...ART_ATTRIBUTES[art].slice(0, 2), rarity === 'comum' ? 'Comum' : rarity === 'raro' ? 'Raro' : 'Lendário']
    const reviewCount = 4 + Math.floor(rand() * 30)
    const rating = Math.round((3.8 + rand() * 1.2) * 10) / 10
    const cleanName = name.split(' #')[0]!

    nfts.push({
      id,
      name,
      tokenId: `#${tokenNumber.padStart(4, '0')}`,
      image: `/nfts/${art}.webp`,
      thumb: `/nfts/${art}-thumb.webp`,
      alt: `${name}: ${ART_ALT[art]}`,
      category,
      network,
      price,
      compareAtPrice: figma?.compareAt ?? (i > 9 && i % 7 === 0 ? roundEth(mulEth(price, '1.15'), 2) : null),
      rarity,
      soldOut: allSoldOut,
      listedAt: isoDaysBefore(i * 2 + (i % 3), i),
      version: 1,
      description: `Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na ${network === 'ethereum' ? 'Ethereum' : network === 'polygon' ? 'Polygon' : 'Solana'}, com arte desbloqueável e acesso para colecionadores.`,
      story: [
        `${name} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na rede. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
        `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. ${cleanName} recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
      ],
      collection: { id: 'kurio-apes', name: 'Kurio Apes' },
      attributes,
      editions,
      defaultEditionId: '1-50',
      rating,
      reviewCount,
      reviews: Array.from({ length: Math.min(3, reviewCount) }, (_, r) => ({
        id: `${id}-review-${r}`,
        author: ['ana.souza', 'bruno.lima', 'colecionador.br', 'mint.lover'][(i + r) % 4]!,
        rating: Math.max(3, Math.round(rating - r * 0.4)),
        comment: [
          'Arte impecável e procedência clara. A edição chegou na carteira em minutos.',
          'Ótimo acabamento, os atributos combinam muito com a coleção.',
          'Comprei a edição 1/50 e o suporte do criador é excelente.',
        ][r]!,
        createdAt: isoDaysBefore(r * 5 + 3),
      })),
      creator: { name: 'Nova Sato', royaltyPercent: 5 },
      contract: { address: '0x7A42c3b1E9f05D2a8B6e4F1c9D3a7E5b2C819E8', standard: 'ERC-721' },
      gallery: [
        { src: `/nfts/${art}.webp`, alt: `${name}: vista frontal` },
        { src: `/nfts/${art}.webp`, alt: `${name}: detalhe dos atributos` },
        { src: `/nfts/${art}.webp`, alt: `${name}: versão para exibição` },
        { src: `/nfts/${art}.webp`, alt: `${name}: certificado de procedência` },
      ],
    })
  }
  return nfts
}

// ---------------------------------------------------------------------------
// Usuários (credenciais fictícias — documentadas no README)
// ---------------------------------------------------------------------------

export const SEED_PASSWORD = 'Kurio@2026'

export interface SeedUser {
  id: string
  username: string
  email: string
  displayName: string
  ensName: string
  walletNickname: string
  favorites: string[]
  wallets: Array<{
    slot: 'primary' | 'secondary'
    nickname: string
    network: NetworkId
    profileName: string
    address: string
    secondaryAddress: string | null
    provider: WalletProvider
    referralCode: string
    ensName: string
    ensSuffix: '.eth' | '.kurio.eth'
  }>
}

export const SEED_USERS: SeedUser[] = [
  {
    id: 'usr_ana',
    username: 'ana.souza',
    email: 'ana@kurio.dev',
    displayName: 'Ana Souza',
    ensName: 'ana',
    walletNickname: 'Principal',
    favorites: ['emerald-ape-042', 'golden-beat-207'],
    wallets: [
      {
        slot: 'primary',
        nickname: 'Principal',
        network: 'ethereum',
        profileName: 'Ana Colecionadora',
        address: '0xA91F3c2B7d4E8a1F6b0C9e2D5a7B3c8E1f4AE82C',
        secondaryAddress: null,
        provider: 'metamask',
        referralCode: 'KURIOANA',
        ensName: 'ana',
        ensSuffix: '.eth',
      },
      {
        slot: 'secondary',
        nickname: 'Reserva',
        network: 'polygon',
        profileName: 'Ana Reserva',
        address: '0x5B21a9C4e7D3f8B0c6E1a2D9f4B7c3E8a0D61F9A',
        secondaryAddress: 'nova.kurio.eth',
        provider: 'coinbase',
        referralCode: 'KURIOANA',
        ensName: 'nova',
        ensSuffix: '.kurio.eth',
      },
    ],
  },
  {
    id: 'usr_bruno',
    username: 'bruno.lima',
    email: 'bruno@kurio.dev',
    displayName: 'Bruno Lima',
    ensName: 'brunolima',
    walletNickname: 'Cofre',
    favorites: ['ivory-baron-088'],
    wallets: [
      {
        slot: 'primary',
        nickname: 'Cofre',
        network: 'ethereum',
        profileName: 'Bruno Lima',
        address: '0x3C9e1B7a5D2f8E4c0A6b9D1e7F3a5C8b2E4D7A10',
        secondaryAddress: null,
        provider: 'walletconnect',
        referralCode: 'BRUNO2026',
        ensName: 'brunolima',
        ensSuffix: '.eth',
      },
    ],
  },
  {
    id: 'usr_carla',
    username: 'carla.dev',
    email: 'carla@kurio.dev',
    displayName: 'Carla Mendes',
    ensName: 'carla',
    walletNickname: 'Nova',
    favorites: [],
    wallets: [],
  },
]

// ---------------------------------------------------------------------------
// Cupons
// ---------------------------------------------------------------------------

export const SEED_COUPONS: Array<{ code: string; label: string; percent: number; expiresAt: string }> = [
  { code: 'KURIO10', label: 'Desconto do lançamento (10%)', percent: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'GENESIS5', label: 'Gênesis (5%)', percent: 5, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'VERAO2025', label: 'Verão 2025 (15%)', percent: 15, expiresAt: '2025-03-20T23:59:59.000Z' },
]

/** Taxa de rede estimada por pedido. */
export const NETWORK_FEES: Record<NetworkId, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

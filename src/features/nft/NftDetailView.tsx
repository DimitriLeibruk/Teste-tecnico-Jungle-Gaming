import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Heart, Mail, Search, ShoppingCart, Star } from 'lucide-react'
import { NETWORKS, type EditionId, type NftDetail } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QuantityStepper } from '@/components/quantity-stepper'
import { announce } from '@/components/live-announcer'
import { useAddToCart, useCart } from '@/features/cart/hooks'
import { useIsFavorite, useToggleFavorite } from '@/features/favorites/hooks'
import { formatEth } from '@/lib/money'
import { cn, formatDate, shortAddress } from '@/lib/utils'

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-primary" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('size-3.5', i < Math.round(rating) ? 'fill-primary' : 'fill-transparent')} />
      ))}
    </span>
  )
}

/** Seleção de edição como radiogroup; edições esgotadas ficam desabilitadas. */
function EditionPicker({ nft, value, onChange }: { nft: NftDetail; value: EditionId; onChange: (id: EditionId) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[15px] font-semibold">Edição:</legend>
      <div role="radiogroup" aria-label="Edição" className="flex flex-wrap gap-2">
        {nft.editions.map((e) => {
          const soldOut = e.available === 0
          const selected = e.id === value
          return (
            <button
              key={e.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={soldOut}
              onClick={() => onChange(e.id)}
              onKeyDown={(ev) => {
                const enabled = nft.editions.filter((x) => x.available > 0)
                const idx = enabled.findIndex((x) => x.id === value)
                if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
                  ev.preventDefault()
                  onChange(enabled[(idx + 1) % enabled.length]!.id)
                } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
                  ev.preventDefault()
                  onChange(enabled[(idx - 1 + enabled.length) % enabled.length]!.id)
                }
              }}
              tabIndex={selected ? 0 : -1}
              data-edition={e.id}
              className={cn(
                'cursor-pointer rounded-full border px-2.5 py-1 text-xs uppercase transition-colors',
                selected ? 'border-primary bg-accent font-semibold text-primary' : 'border-border text-foreground hover:border-primary',
                soldOut && 'cursor-not-allowed text-subtle line-through opacity-60 hover:border-border',
              )}
            >
              {e.label}
              {soldOut && <span className="sr-only"> (esgotada)</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function ShareLinks({ nft }: { nft: NftDetail }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/nft/${nft.id}` : ''
  const text = encodeURIComponent(`${nft.name} na Kurio`)
  return (
    <div className="flex items-center gap-3 text-[15px] font-semibold">
      Compartilhar este NFT:
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (nova aba)" className="hover:text-primary">
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
          <path d="M5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.2 9h3.6v11.5H3.2V9Zm6 0h3.4v1.6c.5-.9 1.7-1.9 3.6-1.9 3.8 0 4.5 2.5 4.5 5.7v6.1h-3.6v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.5H9.2V9Z" />
        </svg>
      </a>
      <a href={`mailto:?subject=${text}&body=${encodeURIComponent(url)}`} aria-label="Compartilhar por e-mail" className="hover:text-primary">
        <Mail className="size-4" aria-hidden />
      </a>
      <a href={`https://x.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no X (nova aba)" className="hover:text-primary">
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
          <path d="M22 5.9c-.7.3-1.5.6-2.4.7.9-.5 1.5-1.3 1.8-2.3-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.7A11.6 11.6 0 0 1 3.4 4.8a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5 0 2 1.4 3.7 3.3 4.1-.6.2-1.2.2-1.9.1.5 1.6 2 2.8 3.8 2.9A8.2 8.2 0 0 1 2 18.6 11.6 11.6 0 0 0 8.3 20.4c7.5 0 11.7-6.2 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.3Z" />
        </svg>
      </a>
    </div>
  )
}

export function NftDetailView({ nft }: { nft: NftDetail }) {
  const router = useRouter()
  const navigate = useNavigate()
  const firstAvailable = nft.editions.find((e) => e.id === nft.defaultEditionId && e.available > 0) ?? nft.editions.find((e) => e.available > 0)
  const [selectedEditionId, setEditionId] = useState<EditionId>(firstAvailable?.id ?? nft.defaultEditionId)
  const [rawQuantity, setQuantity] = useState(1)
  // Se a edição escolhida esgotar (evento em tempo real), usa outra disponível.
  const selected = nft.editions.find((e) => e.id === selectedEditionId)
  const editionId: EditionId = selected && selected.available > 0 ? selected.id : (nft.editions.find((e) => e.available > 0)?.id ?? selectedEditionId)
  const [activeImage, setActiveImage] = useState(0)
  const [zoom, setZoom] = useState(false)
  const edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0]!
  const { data: cart } = useCart()
  const inCart = cart?.items.find((i) => i.nftId === nft.id && i.editionId === editionId)?.quantity ?? 0
  const maxForEdition = Math.min(edition.available, edition.maxPerOrder)
  const maxQty = Math.max(0, maxForEdition - inCart)
  const unavailable = edition.available === 0 || maxQty === 0
  // Quantidade sempre dentro do limite atual (a disponibilidade pode mudar em tempo real).
  const quantity = Math.min(rawQuantity, Math.max(1, maxQty))
  const addToCart = useAddToCart()
  const isFavorite = useIsFavorite(nft.id)
  const { toggle, isPending: favPending } = useToggleFavorite()

  // Avisa alterações de preço recebidas em tempo real.
  const lastPrice = useRef(edition.price)
  const lastEdition = useRef(editionId)
  const [priceFlash, setPriceFlash] = useState(false)
  useEffect(() => {
    if (lastEdition.current === editionId && lastPrice.current !== edition.price) {
      announce(`O preço de ${nft.name} (${edition.label}) foi atualizado para ${formatEth(edition.price)}`, 'assertive')
      setPriceFlash(true)
      const t = setTimeout(() => setPriceFlash(false), 6000)
      lastPrice.current = edition.price
      return () => clearTimeout(t)
    }
    lastPrice.current = edition.price
    lastEdition.current = editionId
  }, [edition.price, edition.label, editionId, nft.name])

  const add = (thenGoToCart: boolean) =>
    addToCart.mutate(
      { nftId: nft.id, editionId, quantity, name: nft.name },
      { onSuccess: () => (thenGoToCart ? void navigate({ to: '/carrinho' }) : setQuantity(1)) },
    )

  const availabilityText =
    edition.available === 0
      ? 'Edição esgotada'
      : inCart > 0 && maxQty === 0
        ? `Você já tem o limite de ${maxForEdition} no carrinho`
        : `${edition.available} disponíveis · máx. ${edition.maxPerOrder} por pedido${inCart ? ` · ${inCart} no carrinho` : ''}`

  const image = nft.gallery[activeImage] ?? nft.gallery[0]!

  return (
    <article aria-labelledby="nft-title" className="pb-40 md:pb-0">
      {/* Topo mobile */}
      <div className="container-page relative md:hidden">
        <div className="absolute inset-x-4 top-5 z-10 flex justify-between sm:inset-x-6">
          <button type="button" onClick={() => (window.history.length > 1 ? router.history.back() : void navigate({ to: '/' }))} aria-label="Voltar" className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-accent/90 text-primary">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => toggle(nft.id, nft.name, isFavorite)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
            className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-accent/90 text-primary"
          >
            <Heart className={cn('size-5', isFavorite && 'fill-primary')} aria-hidden />
          </button>
        </div>
        <img src={image.src} alt={image.alt} width={360} height={360} fetchPriority="high" className="mx-auto mt-16 aspect-square w-full max-w-[360px] rounded-t-3xl object-cover" />
      </div>

      <div className="container-page">
        <nav aria-label="Trilha" className="mt-7 hidden text-[15px] font-semibold md:block">
          <ol className="flex gap-2">
            <li>
              <Link to="/" className="hover:text-primary">
                Início
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link to="/mercado" className="hover:text-primary">
                Mercado
              </Link>
            </li>
            <li aria-current="page" className="sr-only">
              {nft.name}
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:mt-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[100px_445px_minmax(0,1fr)] lg:gap-[26px]">
          {/* Galeria (desktop) */}
          <ul className="hidden flex-col gap-4 lg:flex" aria-label="Galeria">
            {nft.gallery.map((g, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`Ver imagem ${i + 1}: ${g.alt}`}
                  aria-current={i === activeImage}
                  className={cn('block cursor-pointer overflow-hidden rounded-sm ring-offset-2 ring-offset-background', i === activeImage && 'ring-2 ring-primary')}
                >
                  <img src={nft.thumb} alt="" width={100} height={100} className="size-[100px] object-cover" />
                </button>
              </li>
            ))}
          </ul>
          <div className="relative hidden bg-card p-5 md:block">
            <img src={image.src} alt={image.alt} width={405} height={405} fetchPriority="high" className="aspect-square w-full rounded-2xl object-cover" />
            <button type="button" onClick={() => setZoom(true)} aria-label="Ampliar imagem" className="absolute top-2 right-2 flex size-9 cursor-pointer items-center justify-center rounded-full bg-card text-foreground hover:text-primary">
              <Search className="size-5" aria-hidden />
            </button>
          </div>

          {/* Informações */}
          <div className="-mt-6 flex flex-col gap-4 rounded-t-3xl bg-card px-5 pt-8 md:mt-0 md:rounded-none md:bg-transparent md:p-0">
            <div className="flex items-start justify-between gap-3">
              <h1 id="nft-title" className="text-xl font-bold md:text-[26px]">
                {nft.name}
              </h1>
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-primary px-2 py-0.5 text-sm md:hidden">
                <Star className="size-3.5 fill-primary text-primary" aria-hidden />
                <span className="font-semibold">{nft.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">({nft.reviewCount})</span>
                <span className="sr-only">avaliações</span>
              </span>
            </div>
            <div className="hidden items-center justify-between gap-4 border-b border-border pb-2 md:flex">
              <p className={cn('text-xl font-bold text-primary transition-colors', priceFlash && 'rounded-sm bg-accent px-1')} data-testid="detail-price">
                {formatEth(edition.price)}
              </p>
              <p className="flex items-center gap-2 text-sm">
                <Stars rating={nft.rating} />
                <span>
                  {nft.reviewCount} avaliações de colecionadores <span className="sr-only">(nota {nft.rating.toFixed(1)} de 5)</span>
                </span>
              </p>
            </div>
            {priceFlash && (
              <Badge variant="outline" className="w-fit" role="status">
                Preço atualizado agora
              </Badge>
            )}
            <div>
              <h2 className="mb-2 hidden text-[15px] font-semibold md:block">Sobre este NFT:</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{nft.description}</p>
            </div>

            <EditionPicker nft={nft} value={editionId} onChange={(id) => (setEditionId(id), setQuantity(1))} />

            <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
              <QuantityStepper value={quantity} max={Math.max(1, maxQty)} onChange={setQuantity} label={nft.name} disabled={unavailable} />
              <div className="flex gap-2">
                <Button className="h-[38px] w-[118px] rounded-sm text-sm font-semibold uppercase" onClick={() => add(true)} loading={addToCart.isPending} disabled={unavailable}>
                  Comprar
                </Button>
                <Button
                  variant="outline"
                  className="h-[38px] rounded-sm text-sm"
                  onClick={() => toggle(nft.id, nft.name, isFavorite)}
                  aria-pressed={isFavorite}
                  disabled={favPending}
                >
                  <Heart className={cn('size-5', isFavorite && 'fill-primary')} aria-hidden />
                  {isFavorite ? 'Favoritado' : 'Favoritar'}
                </Button>
              </div>
            </div>
            <p className={cn('text-xs', unavailable ? 'text-destructive' : 'text-subtle')} aria-live="polite">
              {availabilityText}
            </p>

            <dl className="flex flex-col gap-3 text-sm text-muted-foreground">
              <div className="flex gap-1">
                <dt>ID do token:</dt>
                <dd>{nft.tokenId}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Coleção:</dt>
                <dd>{nft.collection.name}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Atributos:</dt>
                <dd>{nft.attributes.join(', ')}</dd>
              </div>
            </dl>
            <div className="hidden md:block">
              <ShareLinks nft={nft} />
            </div>
          </div>
        </div>

        <Tabs defaultValue="detalhes" className="mt-12 md:mt-20">
          <TabsList aria-label="Informações do NFT">
            <TabsTrigger value="detalhes">Detalhes do NFT</TabsTrigger>
            <TabsTrigger value="avaliacoes">Avaliações de colecionadores ({nft.reviewCount})</TabsTrigger>
          </TabsList>
          <TabsContent value="detalhes" className="flex flex-col gap-4 text-[13px] leading-relaxed text-muted-foreground">
            {nft.story.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <div>
              <h3 className="font-semibold text-foreground">Rede:</h3>
              <p>Cunhado na {NETWORKS[nft.network].label} com procedência imutável e metadados armazenados no IPFS.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Contrato:</h3>
              <p>
                {shortAddress(nft.contract.address)} • Contrato inteligente {nft.contract.standard} verificado.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Direitos autorais:</h3>
              <p>
                Direitos autorais do criador ({nft.creator.name}): {nft.creator.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="avaliacoes">
            <ul className="flex flex-col gap-4">
              {nft.reviews.map((r) => (
                <li key={r.id} className="rounded-md bg-card p-4">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">@{r.author}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Stars rating={r.rating} />
                      <span className="sr-only">{r.rating} de 5 estrelas</span>
                      {formatDate(r.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-subtle">Exibindo as avaliações mais recentes de {nft.reviewCount}.</p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Barra de compra fixa (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-[32px] bg-card px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.4)] md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <span aria-hidden>Qtd.</span>
            <QuantityStepper value={quantity} max={Math.max(1, maxQty)} onChange={setQuantity} label={nft.name} disabled={unavailable} size="sm" />
          </div>
          <p className="text-xl font-bold text-primary">{formatEth(edition.price)}</p>
        </div>
        <div className="mt-4 flex gap-3">
          <Button
            size="lg"
            className="h-[60px] flex-1 rounded-2xl bg-gradient-to-r from-[#e0a06a] to-primary text-base font-semibold"
            onClick={() => add(true)}
            loading={addToCart.isPending}
            disabled={unavailable}
          >
            Comprar NFT
          </Button>
          <Button variant="secondary" className="size-[60px] rounded-full border-0 bg-accent" onClick={() => add(false)} disabled={unavailable || addToCart.isPending} aria-label="Adicionar ao carrinho">
            <ShoppingCart className="size-5 text-primary" aria-hidden />
          </Button>
        </div>
      </div>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[720px] p-4" accent={false}>
          <DialogTitle className="mb-3 pr-8">{nft.name}</DialogTitle>
          <img src={image.src} alt={image.alt} className="w-full rounded-xl object-contain" />
        </DialogContent>
      </Dialog>
    </article>
  )
}

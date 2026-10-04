import { Link } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { Skeleton } from '@/components/ui/misc'
import { useAddToCart } from '@/features/cart/hooks'
import { useIsFavorite, useToggleFavorite } from '@/features/favorites/hooks'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

export function Price({ price, compareAt, className }: { price: string; compareAt?: string | null; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 text-base font-bold text-primary', className)}>
      <span>{formatEth(price)}</span>
      {compareAt && (
        <span className="font-normal text-muted-foreground line-through">
          <span className="sr-only">de </span>
          {formatEth(compareAt)}
        </span>
      )}
    </p>
  )
}

function FavoriteButton({ nft, className }: { nft: NftSummary; className?: string }) {
  const isFavorite = useIsFavorite(nft.id)
  const { toggle } = useToggleFavorite()
  return (
    <button
      type="button"
      onClick={() => toggle(nft.id, nft.name, isFavorite)}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
      className={cn('flex cursor-pointer items-center justify-center rounded-md bg-card text-foreground transition-colors hover:text-primary', className)}
    >
      <Heart className={cn('size-5', isFavorite && 'fill-primary text-primary')} aria-hidden />
    </button>
  )
}

/** Card do catálogo (frames Início desktop/mobile). Ações rápidas aparecem no hover/foco. */
export function NftCard({ nft, priority = false, variant = 'grid' }: { nft: NftSummary; priority?: boolean; variant?: 'grid' | 'mobile' | 'carousel' }) {
  const addToCart = useAddToCart()
  const isMobile = variant === 'mobile'

  return (
    <article className="group relative flex flex-col" aria-label={nft.name} data-testid="nft-card">
      <div className={cn('relative overflow-hidden bg-card', isMobile ? 'rounded-3xl p-1.5' : 'p-3 md:p-4')}>
        <img
          src={nft.image}
          alt=""
          width={250}
          height={250}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={cn('aspect-square w-full rounded-2xl object-cover transition-transform duration-300 group-hover:scale-[1.02]', isMobile && 'aspect-[4/5]', nft.soldOut && 'opacity-60 grayscale-[40%]')}
        />
        {nft.rarity !== 'comum' && (
          <span className={cn('absolute top-4 left-0 bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground uppercase', isMobile && 'top-3 left-1.5 rounded-tl-2xl py-2')}>
            {nft.rarity === 'raro' ? 'Raro' : 'Lendário'}
          </span>
        )}
        {nft.soldOut && (
          <span className="absolute top-4 right-4 rounded-sm border border-destructive bg-background/90 px-2 py-1 text-xs font-semibold text-destructive">Esgotado</span>
        )}

        {isMobile ? (
          <FavoriteButton nft={nft} className="absolute top-3 right-3 z-10 size-8 rounded-full bg-background/80" />
        ) : (
          <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center gap-3 pb-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100 md:pb-0">
            <button
              type="button"
              disabled={nft.soldOut || addToCart.isPending}
              onClick={() => addToCart.mutate({ nftId: nft.id, editionId: '1-50', quantity: 1, name: nft.name })}
              aria-label={`Adicionar ${nft.name} (edição 1/50) ao carrinho`}
              className="flex size-[35px] cursor-pointer items-center justify-center rounded-md bg-card hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart className="size-5" aria-hidden />
            </button>
            <FavoriteButton nft={nft} className="size-[35px]" />
            <Link
              to="/nft/$nftId"
              params={{ nftId: nft.id }}
              aria-label={`Ver detalhes de ${nft.name}`}
              className="flex size-[35px] items-center justify-center rounded-md bg-card hover:text-primary"
            >
              <Search className="size-5" aria-hidden />
            </Link>
          </div>
        )}
      </div>
      <div className={cn('mt-5 flex flex-col gap-1', isMobile && 'mt-3 px-1')}>
        <h3 className={cn('text-[15px] leading-tight font-normal', isMobile && 'text-base')}>
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none group-has-[:focus-visible]:underline">
            {nft.name}
          </Link>
        </h3>
        <Price price={nft.price} compareAt={nft.compareAtPrice} className={isMobile ? 'text-lg' : undefined} />
      </div>
    </article>
  )
}

export function NftCardSkeleton({ variant = 'grid' }: { variant?: 'grid' | 'mobile' }) {
  const isMobile = variant === 'mobile'
  return (
    <div aria-hidden className="flex flex-col">
      <div className={cn('bg-card', isMobile ? 'rounded-3xl p-1.5' : 'p-3 md:p-4')}>
        <Skeleton className={cn('aspect-square w-full rounded-2xl', isMobile && 'aspect-[4/5]')} />
      </div>
      <div className={cn('mt-5 flex flex-col gap-2', isMobile && 'mt-3 px-1')}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}

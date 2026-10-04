import { createFileRoute, Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/states'
import { NftCard, NftCardSkeleton } from '@/features/catalog/NftCard'
import { useFavorites } from '@/features/favorites/hooks'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/_auth/conta/favoritos')({
  component: FavoritesPage,
})

function FavoritesPage() {
  usePageTitle('Lista de interesse')
  const { data, isPending, error, refetch, isRefetching } = useFavorites()
  const items = data?.items.filter((i) => data.ids.includes(i.id)) ?? []

  return (
    <section aria-labelledby="fav-title" className="pb-8">
      <h1 id="fav-title" className="mb-6 text-[15px] font-semibold">
        Lista de interesse
      </h1>
      {isPending ? (
        <ul className="grid grid-cols-2 gap-6 lg:grid-cols-3" aria-busy="true" aria-label="Carregando favoritos">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-8 text-primary" aria-hidden />}
          title="Nenhum favorito ainda"
          description="Toque no coração de um NFT para salvá-lo aqui."
          action={
            <Button asChild>
              <Link to="/mercado">Explorar o mercado</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3" data-testid="favorites-grid">
          {items.map((nft) => (
            <li key={nft.id}>
              <NftCard nft={nft} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

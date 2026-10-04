import { createFileRoute } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/misc'
import { ErrorState } from '@/components/states'
import { NotFound } from '@/components/NotFound'
import { isNotFound } from '@/app/query-client'
import { nftQueryOptions, useNft, useRelated } from '@/features/catalog/queries'
import { CardRail } from '@/features/catalog/CardRail'
import { NftDetailView } from '@/features/nft/NftDetailView'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/nft/$nftId')({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftQueryOptions(params.nftId))
  },
  staticData: { mobileNav: false },
  component: NftPage,
})

function DetailSkeleton() {
  return (
    <div className="container-page" aria-busy="true" aria-label="Carregando NFT">
      <Skeleton className="mt-7 hidden h-5 w-40 md:block" />
      <div className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-8 md:mt-4 md:grid-cols-2 lg:grid-cols-[100px_445px_minmax(0,1fr)] lg:gap-[26px]">
        <div className="hidden flex-col gap-4 lg:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-[100px] rounded-sm" />
          ))}
        </div>
        <div className="bg-card p-5">
          <Skeleton className="aspect-square w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-2/3" />
        </div>
      </div>
      {/* Reserva a área das abas para não deslocar o rodapé ao carregar. */}
      <div className="mt-12 flex flex-col gap-4 md:mt-20">
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  )
}

function NftPage() {
  const { nftId } = Route.useParams()
  const { data, error, isPending, refetch, isRefetching } = useNft(nftId)
  const related = useRelated(nftId)
  usePageTitle(data?.name ?? (isNotFound(error) ? 'NFT não encontrado' : 'Detalhes do NFT'))

  const rail = <CardRail title="Mais desta coleção" items={related.data?.items} loading={related.isPending} />
  if (isPending) {
    return (
      <>
        <DetailSkeleton />
        {rail}
      </>
    )
  }
  if (isNotFound(error)) {
    return <NotFound title="NFT não encontrado" description="Este NFT não existe ou foi removido do catálogo. Confira outros itens no mercado." />
  }
  if (error && !data) {
    return (
      <div className="container-page py-16">
        <ErrorState error={error} title="Não foi possível carregar este NFT" onRetry={() => void refetch()} retrying={isRefetching} />
      </div>
    )
  }
  return (
    <>
      <NftDetailView key={data.id} nft={data} />
      {rail}
    </>
  )
}

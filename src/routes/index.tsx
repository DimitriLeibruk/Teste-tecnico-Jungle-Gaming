import { createFileRoute } from '@tanstack/react-router'
import { Catalog } from '@/features/catalog/Catalog'
import { MobileSearchBar } from '@/features/catalog/MobileSearchBar'
import { catalogQueryOptions, featuredQueryOptions } from '@/features/catalog/queries'
import { catalogSearchSchema, toCatalogQuery } from '@/features/catalog/search'
import { useCatalogSearch } from '@/features/catalog/useCatalogSearch'
import { Hero, Spotlight } from '@/features/home/Hero'
import { MintJournal, PromoBanners } from '@/features/home/Editorial'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => ({ query: toCatalogQuery(search) }),
  // Pré-carrega sem bloquear a navegação (os skeletons cobrem o carregamento).
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(featuredQueryOptions)
    void context.queryClient.prefetchQuery(catalogQueryOptions(deps.query))
  },
  component: HomePage,
})

function HomePage() {
  usePageTitle('Marketplace de NFTs')
  const search = Route.useSearch()
  const { onChange, mobileFiltersOpen, setMobileFiltersOpen } = useCatalogSearch('/')

  return (
    <>
      <MobileSearchBar key={search.q ?? ''} q={search.q} onChange={onChange} onOpenFilters={() => setMobileFiltersOpen(true)} />
      <Hero />
      <div className="container-page mt-8 md:mt-14">
        <Catalog
          search={search}
          onChange={onChange}
          aside={<Spotlight />}
          mobileFiltersOpen={mobileFiltersOpen}
          onMobileFiltersOpenChange={setMobileFiltersOpen}
        />
      </div>
      <PromoBanners />
      <MintJournal />
    </>
  )
}

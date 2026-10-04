import { useState, type FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Catalog } from '@/features/catalog/Catalog'
import { MobileSearchBar } from '@/features/catalog/MobileSearchBar'
import { catalogQueryOptions } from '@/features/catalog/queries'
import { catalogSearchSchema, toCatalogQuery } from '@/features/catalog/search'
import { useCatalogSearch } from '@/features/catalog/useCatalogSearch'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/mercado')({
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => ({ query: toCatalogQuery(search) }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(catalogQueryOptions(deps.query))
  },
  component: MarketPage,
})

function MarketPage() {
  usePageTitle('Mercado')
  const search = Route.useSearch()
  const { onChange, mobileFiltersOpen, setMobileFiltersOpen } = useCatalogSearch('/mercado')
  return (
    <>
      <MobileSearchBar key={search.q ?? ''} q={search.q} onChange={onChange} onOpenFilters={() => setMobileFiltersOpen(true)} />
      <div className="container-page">
        <nav aria-label="Trilha" className="mt-7 hidden text-[15px] font-semibold md:block">
          <ol className="flex gap-2">
            <li>
              <Link to="/" className="hover:text-primary">
                Início
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page">Mercado</li>
          </ol>
        </nav>
        <div className="mt-6 mb-8 hidden items-end justify-between gap-6 md:flex">
          <h1 className="text-2xl font-bold">Mercado</h1>
          <MarketSearch key={search.q ?? ''} q={search.q} onSubmit={(q) => onChange({ q })} />
        </div>
        <h1 className="sr-only md:hidden">Mercado</h1>
        <div className="mt-6 md:mt-0">
          <Catalog search={search} onChange={onChange} mobileFiltersOpen={mobileFiltersOpen} onMobileFiltersOpenChange={setMobileFiltersOpen} title="Resultados do mercado" />
        </div>
      </div>
    </>
  )
}

function MarketSearch({ q, onSubmit }: { q: string | undefined; onSubmit: (q: string | undefined) => void }) {
  const [term, setTerm] = useState(q ?? '')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(term.trim() || undefined)
  }
  return (
    <form role="search" onSubmit={submit} className="flex w-full max-w-md gap-2">
      <label htmlFor="market-search" className="sr-only">
        Buscar NFTs
      </label>
      <Input id="market-search" type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar por nome, token ou atributo" maxLength={60} />
      <Button type="submit" aria-label="Buscar">
        <Search aria-hidden />
      </Button>
    </form>
  )
}

import { useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { CATALOG_SORT_LABELS, CATALOG_TAB_LABELS, type CatalogResponse, type CatalogSort, type CatalogTab, type NftSummary } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/misc'
import { EmptyState, ErrorState } from '@/components/states'
import { cn } from '@/lib/utils'
import { NftCard, NftCardSkeleton } from './NftCard'
import { useCatalog } from './queries'
import { hasActiveFilters, searchCategories, searchNetworks, toCatalogQuery, toggleInList, type CatalogSearch } from './search'

export type SearchPatch = Partial<CatalogSearch>
export type UpdateSearch = (patch: SearchPatch, options?: { resetPage?: boolean }) => void

// ---------------------------------------------------------------- Filtros

function FacetList({
  title,
  facets,
  selected,
  onToggle,
  accent,
}: {
  title: string
  facets: Array<{ id: string; label: string; count: number }> | undefined
  selected: string[]
  onToggle: (id: string) => void
  accent?: boolean
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-[15px] font-semibold">
        {title}
      </h3>
      <ul className="flex flex-col gap-1">
        {facets
          ? facets.map((facet) => {
              const active = selected.includes(facet.id)
              return (
                <li key={facet.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(facet.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-secondary',
                      accent ? 'text-primary' : 'text-muted-foreground',
                      active && 'bg-accent font-semibold text-primary ring-1 ring-primary/60',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {active && <span aria-hidden className="size-1.5 rounded-full bg-primary" />}
                      {facet.label}
                    </span>
                    <span className="tabular-nums" aria-label={`${facet.count} itens`}>
                      ({facet.count})
                    </span>
                  </button>
                </li>
              )
            })
          : Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <Skeleton className="my-1 h-7 w-full" />
              </li>
            ))}
      </ul>
    </section>
  )
}

function PriceFilter(props: { bounds: { min: string; max: string } | undefined; search: CatalogSearch; onApply: UpdateSearch }) {
  // Remonta quando a URL ou os limites mudam (o estado local é só o rascunho do slider).
  const key = `${props.search.minPrice}-${props.search.maxPrice}-${props.bounds?.min}-${props.bounds?.max}`
  return <PriceFilterInner key={key} {...props} />
}

function PriceFilterInner({ bounds, search, onApply }: { bounds: { min: string; max: string } | undefined; search: CatalogSearch; onApply: UpdateSearch }) {
  const min = bounds ? Math.floor(Number(bounds.min) * 100) / 100 : 0
  const max = bounds ? Math.ceil(Number(bounds.max) * 100) / 100 : 0
  const [value, setValue] = useState<[number, number]>([search.minPrice ? Number(search.minPrice) : min, search.maxPrice ? Number(search.maxPrice) : max])

  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-[15px] font-semibold">
        Faixa de preço
      </h3>
      {bounds ? (
        <>
          <Slider
            min={min}
            max={max}
            step={0.01}
            minStepsBetweenThumbs={1}
            value={value}
            onValueChange={(v) => setValue([v[0] ?? min, v[1] ?? max])}
            thumbLabels={['Preço mínimo em ETH', 'Preço máximo em ETH']}
            className="px-2"
          />
          <p className="px-3 text-sm" aria-live="polite">
            Preço: {value[0].toFixed(2)} – {value[1].toFixed(2)} ETH
          </p>
          <div className="flex gap-2 px-3">
            <Button
              size="sm"
              className="rounded-sm text-sm"
              onClick={() =>
                onApply({
                  minPrice: value[0] > min ? value[0].toFixed(2) : undefined,
                  maxPrice: value[1] < max ? value[1].toFixed(2) : undefined,
                })
              }
            >
              Aplicar
            </Button>
            {(search.minPrice || search.maxPrice) && (
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => onApply({ minPrice: undefined, maxPrice: undefined })}>
                Limpar
              </Button>
            )}
          </div>
        </>
      ) : (
        <Skeleton className="h-16 w-full" />
      )}
    </section>
  )
}

export function CatalogFilters({ data, search, onChange }: { data: CatalogResponse | undefined; search: CatalogSearch; onChange: UpdateSearch }) {
  const categories = searchCategories(search)
  const networks = searchNetworks(search)
  return (
    <div className="flex flex-col gap-7">
      <FacetList
        title="Coleções"
        facets={data?.facets.categories}
        selected={categories}
        accent
        onToggle={(id) => onChange({ categories: toggleInList(categories, id) })}
      />
      <PriceFilter bounds={data?.facets.price} search={search} onApply={onChange} />
      <FacetList title="Rede" facets={data?.facets.networks} selected={networks} onToggle={(id) => onChange({ networks: toggleInList(networks, id) })} />
    </div>
  )
}

// ------------------------------------------------------------- Toolbar

function Tabs({ tab, onChange }: { tab: CatalogTab; onChange: UpdateSearch }) {
  return (
    <div role="group" aria-label="Destaques do catálogo" className="flex items-center gap-4 overflow-x-auto md:gap-5">
      {(Object.keys(CATALOG_TAB_LABELS) as CatalogTab[]).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={tab === t}
          onClick={() => onChange({ tab: t === 'all' ? undefined : t })}
          className={cn(
            'relative shrink-0 cursor-pointer pb-1 text-base whitespace-nowrap transition-colors hover:text-primary md:text-[13px]',
            tab === t ? 'font-semibold text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary' : 'text-foreground',
          )}
        >
          {CATALOG_TAB_LABELS[t]}
        </button>
      ))}
    </div>
  )
}

function SortSelect({ sort, onChange, id }: { sort: CatalogSort; onChange: UpdateSearch; id: string }) {
  return (
    <div className="flex items-center gap-1 text-[13px]">
      <label htmlFor={id} className="whitespace-nowrap">
        Ordenar por:
      </label>
      <Select value={sort} onValueChange={(v) => onChange({ sort: v === 'recent' ? undefined : (v as CatalogSort) })}>
        <SelectTrigger id={id} className="h-8 w-auto gap-1 border-0 bg-transparent px-1 text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {(Object.keys(CATALOG_SORT_LABELS) as CatalogSort[]).map((s) => (
            <SelectItem key={s} value={s}>
              {CATALOG_SORT_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ----------------------------------------------------------- Paginação

function Pagination({ page, totalPages, linkFor }: { page: number; totalPages: number; linkFor: (page: number) => SearchPatch }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => totalPages <= 7 || p === 1 || p === totalPages || Math.abs(p - page) <= 1)
  const cell = 'flex size-[30px] items-center justify-center rounded-sm border border-border text-sm transition-colors hover:border-primary hover:text-primary'
  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-end">
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <Link to="." search={(prev: CatalogSearch) => ({ ...prev, ...linkFor(page - 1) })} className={cell} aria-label="Página anterior">
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          </li>
        )}
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            {i > 0 && p - pages[i - 1]! > 1 && <span aria-hidden>…</span>}
            <Link
              to="."
              search={(prev: CatalogSearch) => ({ ...prev, ...linkFor(p) })}
              aria-label={`Página ${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={cn(cell, p === page && 'border-primary bg-primary font-semibold text-primary-foreground hover:text-primary-foreground')}
            >
              {p}
            </Link>
          </li>
        ))}
        {page < totalPages && (
          <li>
            <Link to="." search={(prev: CatalogSearch) => ({ ...prev, ...linkFor(page + 1) })} className={cell} aria-label="Próxima página">
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}

// -------------------------------------------------------------- Catálogo

export function Catalog({
  search,
  onChange,
  aside,
  mobileFiltersOpen,
  onMobileFiltersOpenChange,
  headingLevel = 'h2',
  title = 'Catálogo de NFTs',
}: {
  search: CatalogSearch
  onChange: UpdateSearch
  aside?: React.ReactNode
  mobileFiltersOpen: boolean
  onMobileFiltersOpenChange: (open: boolean) => void
  headingLevel?: 'h1' | 'h2'
  title?: string
}) {
  const query = toCatalogQuery(search)
  const { data, error, isPending, isFetching, isPlaceholderData, refetch, isRefetching } = useCatalog(query)
  const sortId = useId()
  const Heading = headingLevel

  const showSkeleton = isPending
  const outOfRange = data && data.total > 0 && data.items.length === 0

  return (
    <section id="catalogo" aria-labelledby="catalogo-titulo" className="scroll-mt-4">
      <Heading id="catalogo-titulo" className="sr-only">
        {title}
      </Heading>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,230px)_minmax(0,1fr)] lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-[50px]">
        <aside className="hidden flex-col gap-6 md:flex" aria-label="Filtros">
          <div className="bg-card px-3 py-6 lg:px-5">
            <CatalogFilters data={data} search={search} onChange={onChange} />
          </div>
          {aside}
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Tabs tab={query.tab ?? 'all'} onChange={onChange} />
            <div className="hidden md:block">
              <SortSelect sort={query.sort ?? 'recent'} onChange={onChange} id={sortId} />
            </div>
          </div>

          {hasActiveFilters(search) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {search.q && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1">
                  Busca: “{search.q}”
                  <button type="button" className="cursor-pointer text-primary" onClick={() => onChange({ q: undefined })} aria-label="Remover busca">
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              )}
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs"
                onClick={() => onChange({ q: undefined, categories: undefined, networks: undefined, minPrice: undefined, maxPrice: undefined, tab: undefined })}
              >
                Limpar filtros
              </Button>
            </div>
          )}

          <p role="status" className="sr-only">
            {isPending ? 'Carregando NFTs…' : data ? `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}. Página ${data.page} de ${Math.max(1, data.totalPages)}.` : ''}
          </p>

          {error && !data ? (
            <ErrorState error={error} title="Não foi possível carregar o catálogo" onRetry={() => void refetch()} retrying={isRefetching} />
          ) : showSkeleton ? (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-2 md:gap-x-6 lg:grid-cols-3 lg:gap-x-[34px] lg:gap-y-[66px]" aria-busy="true" aria-label="Carregando NFTs">
              {Array.from({ length: 9 }, (_, i) => (
                <li key={i} className={cn(i % 2 === 1 && 'max-md:mt-8')}>
                  <div className="md:hidden">
                    <NftCardSkeleton variant="mobile" />
                  </div>
                  <div className="max-md:hidden">
                    <NftCardSkeleton />
                  </div>
                </li>
              ))}
            </ul>
          ) : data && data.items.length > 0 ? (
            <>
              {error && <ErrorState error={error} title="Falha ao atualizar o catálogo" onRetry={() => void refetch()} retrying={isRefetching} className="py-4" />}
              <ul
                className={cn(
                  'grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity md:grid-cols-2 md:gap-x-6 lg:grid-cols-3 lg:gap-x-[34px] lg:gap-y-[66px]',
                  isPlaceholderData && isFetching && 'opacity-60',
                )}
                aria-busy={isFetching}
                data-testid="catalog-grid"
              >
                {data.items.map((nft: NftSummary, i) => (
                  <li key={nft.id} className={cn(i % 2 === 1 && 'max-md:mt-8')}>
                    <div className="md:hidden">
                      <NftCard nft={nft} variant="mobile" priority={i < 2} />
                    </div>
                    <div className="max-md:hidden">
                      <NftCard nft={nft} priority={i < 3} />
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={data.page} totalPages={data.totalPages} linkFor={(p) => ({ page: p === 1 ? undefined : p })} />
            </>
          ) : outOfRange ? (
            <EmptyState
              title="Página fora do intervalo"
              description={`Esta busca tem ${data.totalPages} ${data.totalPages === 1 ? 'página' : 'páginas'}.`}
              action={<Button onClick={() => onChange({ page: undefined }, { resetPage: false })}>Ir para a primeira página</Button>}
            />
          ) : (
            <EmptyState
              title="Nenhum NFT encontrado"
              description={hasActiveFilters(search) ? 'Tente remover alguns filtros ou buscar por outro termo.' : 'Ainda não há NFTs listados no mercado.'}
              action={
                hasActiveFilters(search) ? (
                  <Button variant="outline" onClick={() => onChange({ q: undefined, categories: undefined, networks: undefined, minPrice: undefined, maxPrice: undefined, tab: undefined })}>
                    Limpar filtros
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      </div>

      <Sheet open={mobileFiltersOpen} onOpenChange={onMobileFiltersOpenChange}>
        <SheetContent side="bottom" className="pb-10">
          <SheetTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" aria-hidden /> Filtros e ordenação
          </SheetTitle>
          <SheetDescription>Os filtros são aplicados imediatamente e ficam salvos no endereço da página.</SheetDescription>
          <SortSelect sort={query.sort ?? 'recent'} onChange={onChange} id={`${sortId}-mobile`} />
          <CatalogFilters data={data} search={search} onChange={onChange} />
          <Button onClick={() => onMobileFiltersOpenChange(false)}>Ver {data ? `${data.total} resultados` : 'resultados'}</Button>
        </SheetContent>
      </Sheet>
    </section>
  )
}

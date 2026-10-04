import { useState, type FormEvent } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import type { UpdateSearch } from './Catalog'

/** Barra de busca + botão de filtros do topo mobile (frame Início mobile). */
export function MobileSearchBar({ q, onChange, onOpenFilters }: { q: string | undefined; onChange: UpdateSearch; onOpenFilters: () => void }) {
  const [value, setValue] = useState(q ?? '')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onChange({ q: value.trim() || undefined })
    document.getElementById('catalogo')?.scrollIntoView({ block: 'start' })
  }
  return (
    <div className="container-page flex gap-2 pt-10 md:hidden">
      <form role="search" onSubmit={submit} className="flex h-[46px] flex-1 items-center gap-3 rounded-xl bg-card px-3">
        <Search className="size-5 shrink-0 text-subtle" aria-hidden />
        <label htmlFor="mobile-search" className="sr-only">
          Explorar coleções
        </label>
        <input
          id="mobile-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Explorar coleções"
          maxLength={60}
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent text-base placeholder:text-subtle focus-visible:outline-none"
        />
      </form>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label="Abrir filtros e ordenação"
        className="flex size-[46px] cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-[#e0a06a] to-primary text-primary-foreground"
      >
        <SlidersHorizontal className="size-5" aria-hidden />
      </button>
    </div>
  )
}

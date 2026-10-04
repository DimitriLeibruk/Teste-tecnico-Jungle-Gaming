import { useEffect, useRef, useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { cn } from '@/lib/utils'
import { NftCard, NftCardSkeleton } from './NftCard'

/** Carrossel horizontal com scroll-snap e indicadores (frames Detalhe/Carrinho). */
export function CardRail({ title, items, loading }: { title: string; items: NftSummary[] | undefined; loading?: boolean }) {
  const ref = useRef<HTMLUListElement>(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const total = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.05))
      setPages(total)
      setPage(Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [items])

  if (!loading && items && items.length === 0) return null
  const headingId = `rail-${title.replace(/\W+/g, '-').toLowerCase()}`

  return (
    <section aria-labelledby={headingId} className="container-page mt-16 md:mt-24">
      <h2 id={headingId} className="border-b border-border pb-3 text-base font-semibold text-primary">
        {title}
      </h2>
      <ul ref={ref} className="mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" tabIndex={0} aria-label={`${title} — role para ver mais`}>
        {(items ?? Array.from({ length: 5 }, () => null)).map((nft, i) => (
          <li key={nft?.id ?? i} className="w-[calc(50%-12px)] shrink-0 snap-start sm:w-[calc(33.333%-16px)] lg:w-[calc(20%-19.2px)]">
            {nft ? <NftCard nft={nft} variant="carousel" /> : <NftCardSkeleton />}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2" role="group" aria-label={`Páginas de ${title}`}>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Página ${i + 1} de ${pages}`}
              aria-current={i === page}
              onClick={() => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' })}
              className={cn('size-3 cursor-pointer rounded-full border border-primary', i === page && 'bg-primary')}
            />
          ))}
        </div>
      )}
    </section>
  )
}

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useFeatured } from '@/features/catalog/queries'
import { cn } from '@/lib/utils'

const SLIDES = [
  {
    image: '/nfts/emerald.webp',
    alt: 'Macaco de pelo castanho com óculos redondos e jaqueta college verde',
    eyebrow: 'Bem-vindo à Kurio',
    title: ['SEJA DONO DO FUTURO', 'DA ARTE DIGITAL'],
    mobileTitle: ['SEJA DONO DA', 'CULTURA DIGITAL'],
    text: 'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
    mobileText: 'Descubra NFTs selecionados de criadores do mundo todo.',
  },
  {
    image: '/nfts/ivory.webp',
    alt: 'Gorila de pelo escuro com gola alta verde e blazer marfim',
    eyebrow: 'Edições limitadas',
    title: ['COLECIONE OBRAS', 'COM PROCEDÊNCIA'],
    mobileTitle: ['COLECIONE COM', 'PROCEDÊNCIA'],
    text: 'Cada obra tem atributos verificados na rede, histórico permanente e direitos autorais que apoiam os criadores em cada revenda.',
    mobileText: 'Atributos verificados e histórico permanente na rede.',
  },
  {
    image: '/nfts/golden.webp',
    alt: 'Macaco de pelo dourado com fones de ouvido verdes',
    eyebrow: 'Novos lançamentos',
    title: ['MÚSICA, ARTE 3D', 'E MUITO MAIS'],
    mobileTitle: ['MÚSICA, 3D', 'E MUITO MAIS'],
    text: 'Explore categorias, compare edições e encontre peças únicas para a sua coleção em Ethereum, Polygon e Solana.',
    mobileText: 'Explore categorias em Ethereum, Polygon e Solana.',
  },
]

function Dots({ count, active, onSelect, className }: { count: number; active: number; onSelect: (i: number) => void; className?: string }) {
  return (
    <div className={cn('flex gap-2', className)} role="group" aria-label="Destaques">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Mostrar destaque ${i + 1} de ${count}`}
          aria-current={i === active}
          className={cn('size-2 cursor-pointer rounded-full transition-colors', i === active ? 'bg-primary' : 'bg-primary/50 hover:bg-primary/80')}
        />
      ))}
    </div>
  )
}

/** Hero com carrossel manual (sem autoplay — WCAG 2.2.2). */
export function Hero() {
  const { data } = useFeatured()
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]!
  // Os slides seguem a ordem dos destaques da API (Emerald, Neon Vessel, Golden Beat).
  const nft: NftSummary | undefined = data?.hero[index % (data?.hero.length || 1)]
  const secondary: NftSummary | undefined = data ? data.spotlight : undefined

  return (
    <section aria-roledescription="carrossel" aria-label="Destaques da Kurio" className="container-page">
      {/* Desktop */}
      <div className="hidden min-h-[480px] grid-cols-[1fr_450px] items-center gap-10 py-3 md:grid lg:pl-12">
        <div className="flex flex-col gap-5" aria-live="polite">
          <p className="text-[13px] tracking-wide">{slide.eyebrow}</p>
          <h1 className="text-[34px] leading-[1.6] font-bold tracking-[0.06em] lg:text-[40px]">
            {slide.title[0]}
            <br />
            {slide.title[1]}
          </h1>
          <p className="max-w-[540px] text-[13px] leading-relaxed text-muted-foreground">{slide.text}</p>
          <div className="mt-6 flex items-center justify-between pr-10">
            <Button asChild className="h-10 rounded-sm px-7 text-sm font-semibold uppercase">
              <Link to="/mercado">Explorar</Link>
            </Button>
            <Dots count={SLIDES.length} active={index} onSelect={setIndex} className="mt-6" />
          </div>
        </div>
        <div className="aspect-square w-[450px] overflow-hidden rounded-[20px]">
          {/* Arte editorial do destaque (estática): pinta sem esperar a API; o link vem dos dados. */}
          {nft ? (
            <Link to="/nft/$nftId" params={{ nftId: nft.id }} aria-label={`Ver ${nft.name}`}>
              <img src={slide.image} alt={slide.alt} width={450} height={450} fetchPriority="high" loading="eager" className="size-full object-cover" />
            </Link>
          ) : (
            <img src={slide.image} alt={slide.alt} width={450} height={450} fetchPriority="high" loading="eager" className="size-full object-cover" />
          )}
        </div>
      </div>

      {/* Mobile */}
      <div className="relative mt-4 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#3d2516] via-[#2c1a12] to-[#22150f] p-4 md:hidden">
        <span aria-hidden className="absolute -top-10 left-1/3 size-56 rounded-full bg-[#4a2c1a]/50" />
        <div className="relative grid grid-cols-[1fr_auto] gap-2" aria-live="polite">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{slide.eyebrow}</p>
            <p className="text-lg leading-snug font-bold tracking-wide" role="heading" aria-level={1}>
              {slide.mobileTitle[0]}
              <br />
              {slide.mobileTitle[1]}
            </p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{slide.mobileText}</p>
            <Link to="/mercado" className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-primary uppercase">
              Explorar <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="relative h-[140px] w-[138px]">
            <img src={slide.image} alt={slide.alt} width={138} height={138} fetchPriority="high" className="size-[138px] rounded-2xl object-cover" />
            {secondary && (
              <img src={secondary.thumb} alt="" width={56} height={56} className="absolute -bottom-2 left-0 size-14 rounded-xl border-2 border-[#2c1a12] object-cover" />
            )}
          </div>
        </div>
        <Dots count={SLIDES.length} active={index} onSelect={setIndex} className="relative mt-3 justify-center" />
      </div>
    </section>
  )
}

/** Card "NFT EM DESTAQUE — OFERTA LIMITADA" abaixo dos filtros. */
export function Spotlight() {
  const { data } = useFeatured()
  const nft = data?.spotlight
  return (
    <section aria-labelledby="spotlight-title" className="flex flex-col">
      <div className="bg-card px-3 pt-4 pb-2 lg:px-3">
        <h2 id="spotlight-title" className="text-lg font-bold tracking-wide text-primary">
          NFT EM DESTAQUE
        </h2>
        <p className="text-center text-base font-bold tracking-wide">OFERTA LIMITADA</p>
      </div>
      {nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block" aria-label={`Ver ${nft.name}, oferta limitada`}>
          <img src={nft.image} alt={nft.alt} width={310} height={365} loading="lazy" className="aspect-[310/365] w-full rounded-2xl object-cover" />
        </Link>
      ) : (
        <Skeleton className="aspect-[310/365] w-full rounded-2xl" />
      )}
    </section>
  )
}

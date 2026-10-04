import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const BANNERS = [
  {
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/nfts/emerald.webp',
    alt: 'Macaco de óculos redondos e jaqueta college verde',
    search: { tab: 'new' as const },
  },
  {
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/nfts/ivory.webp',
    alt: 'Gorila de gola alta verde e blazer marfim',
    search: { categories: 'arte-digital' },
  },
]

export function PromoBanners() {
  return (
    <section aria-label="Coleções em destaque" className="container-page mt-20 grid gap-6 md:mt-24 lg:grid-cols-2 lg:gap-[66px]">
      {BANNERS.map((b) => (
        <article key={b.title} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center bg-card">
          <img src={b.image} alt={b.alt} width={285} height={250} loading="lazy" className="h-full max-h-[250px] w-full object-cover" />
          <div className="flex flex-col items-end gap-3 p-4 text-right">
            <h2 className="text-sm font-semibold sm:text-base">{b.title}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{b.text}</p>
            <Button asChild size="sm" className="rounded-sm px-5">
              <Link to="/mercado" search={b.search}>
                Explorar <ArrowRight aria-hidden />
                <span className="sr-only">{b.title}</span>
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { image: '/nfts/ivory.webp', date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar seus ativos digitais.' },
  { image: '/nfts/emerald.webp', date: '13 de setembro', read: '2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.' },
  { image: '/nfts/sage.webp', date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.' },
  { image: '/nfts/golden.webp', date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.' },
]

/** "Diário da Cunhagem": conteúdo editorial fora do escopo — links levam a "Em breve". */
export function MintJournal() {
  return (
    <section aria-labelledby="diario-titulo" className="container-page mt-20 md:mt-28">
      <h2 id="diario-titulo" className="text-center text-2xl font-bold">
        Diário da Cunhagem
      </h2>
      <p className="mt-3 text-center text-[13px] text-muted-foreground">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
        {POSTS.map((p) => (
          <li key={p.title} className="group relative flex flex-col bg-card">
            <img src={p.image} alt="" width={268} height={195} loading="lazy" className="h-[195px] w-full object-cover" />
            <div className="flex flex-col gap-2 p-4">
              <p className="text-[11px] text-muted-foreground">
                {p.date} <span aria-hidden>|</span> Leitura de {p.read}
              </p>
              <h3 className="text-sm leading-snug font-semibold">
                <Link to="/em-breve" search={{ secao: 'diario' }} className="after:absolute after:inset-0 hover:text-primary">
                  {p.title}
                </Link>
              </h3>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{p.text}</p>
              <span aria-hidden className="text-[11px] font-semibold text-primary">
                Ler mais →
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { emailSchema } from '@/api/contracts'
import { Logo } from './Header'
import { cn } from '@/lib/utils'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

type FooterLink = { label: string; to: string; search?: Record<string, string> }

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Meu perfil',
    links: [
      { label: 'Meu perfil', to: '/conta/perfil' },
      { label: 'Minha coleção', to: '/em-breve', search: { secao: 'colecao' } },
      { label: 'Atividade', to: '/conta/atividade' },
      { label: 'Estúdio do criador', to: '/em-breve', search: { secao: 'estudio' } },
      { label: 'Lista de interesse', to: '/conta/favoritos' },
    ],
  },
  {
    title: 'Central de ajuda',
    links: [
      { label: 'Central de ajuda', to: '/em-breve', search: { secao: 'ajuda' } },
      { label: 'Como comprar NFTs', to: '/em-breve', search: { secao: 'como-comprar' } },
      { label: 'Carteira e segurança', to: '/em-breve', search: { secao: 'seguranca' } },
      { label: 'Política do mercado', to: '/em-breve', search: { secao: 'politica' } },
      { label: 'Denunciar item', to: '/em-breve', search: { secao: 'denuncia' } },
    ],
  },
  {
    title: 'Coleções',
    links: [
      { label: 'Arte digital', to: '/mercado', search: { categories: 'arte-digital' } },
      { label: 'Fotografia', to: '/mercado', search: { categories: 'fotografia' } },
      { label: 'Música', to: '/mercado', search: { categories: 'musica' } },
      { label: 'Arte 3D', to: '/mercado', search: { categories: 'arte-3d' } },
      { label: 'Utilidade', to: '/mercado', search: { categories: 'utilidade' } },
    ],
  },
]

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com/', path: 'M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6Z' },
  { label: 'Instagram', href: 'https://www.instagram.com/', path: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm5.5-1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z' },
  { label: 'X (Twitter)', href: 'https://x.com/', path: 'M22 5.9c-.7.3-1.5.6-2.4.7.9-.5 1.5-1.3 1.8-2.3-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.7A11.6 11.6 0 0 1 3.4 4.8a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5 0 2 1.4 3.7 3.3 4.1-.6.2-1.2.2-1.9.1.5 1.6 2 2.8 3.8 2.9A8.2 8.2 0 0 1 2 18.6 11.6 11.6 0 0 0 8.3 20.4c7.5 0 11.7-6.2 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.3Z' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', path: 'M5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.2 9h3.6v11.5H3.2V9Zm6 0h3.4v1.6c.5-.9 1.7-1.9 3.6-1.9 3.8 0 4.5 2.5 4.5 5.7v6.1h-3.6v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.5H9.2V9Z' },
  { label: 'YouTube', href: 'https://www.youtube.com/', path: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z' },
]

export function WalletBadges({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-sm border border-primary/60 bg-band px-2.5 py-1 text-[8px] font-bold tracking-wider text-primary', className)}>
      METAMASK <span aria-hidden>•</span> WALLETCONNECT <span aria-hidden>•</span> COINBASE
    </span>
  )
}

/**
 * Newsletter: fora do escopo. Valida o e-mail e informa claramente que a
 * inscrição não está disponível na demonstração (não simula sucesso).
 */
function Newsletter() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const result = emailSchema.safeParse(email)
    if (!result.success) {
      setMessage({ tone: 'error', text: result.error.issues[0]?.message ?? 'E-mail inválido' })
      return
    }
    setMessage({ tone: 'info', text: 'A newsletter ainda não está disponível nesta demonstração. Nenhum dado foi enviado.' })
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <h2 className="text-[15px] leading-tight font-semibold">Antecipe-se ao próximo lançamento</h2>
      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">
          E-mail para a newsletter
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          aria-invalid={message?.tone === 'error' || undefined}
          aria-describedby={message ? 'newsletter-msg' : undefined}
          className="h-10 min-w-0 flex-1 rounded-l-sm bg-accent px-3 text-sm placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-ring"
        />
        <button type="submit" className="h-10 cursor-pointer rounded-r-sm bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary-hover">
          Enviar
        </button>
      </div>
      <p id="newsletter-msg" role="status" className={cn('text-xs leading-relaxed', message?.tone === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
        {message?.text ?? 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
      </p>
    </form>
  )
}

export function Footer() {
  return (
    <footer className="container-page mt-16 pb-28 md:mt-24 md:pb-6">
      <div className="bg-card">
        <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 md:px-12 lg:grid-cols-4 lg:gap-0">
          {FEATURES.map((f, i) => (
            <div key={f.letter} className={cn('flex flex-col gap-3 lg:px-8', i > 0 && 'lg:border-l lg:border-primary/70', i === 0 && 'lg:pl-0')}>
              <span aria-hidden className="flex size-[74px] items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                {f.letter}
              </span>
              <h2 className="text-base font-semibold">{f.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
          <div className="lg:border-l lg:border-primary/70 lg:pl-4">
            <Newsletter />
          </div>
        </div>

        <div className="grid gap-3 bg-band px-6 py-6 text-sm sm:grid-cols-2 md:px-8 lg:grid-cols-4 lg:items-center">
          <Logo />
          <p className="text-foreground">Feito para colecionadores, criadores e cultura</p>
          <a href="mailto:contato@email.com" className="hover:text-primary">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="hover:text-primary">
            +55 11 4002 8922
          </a>
        </div>

        <div className="grid grid-cols-2 gap-8 px-6 py-8 md:px-8 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-3 text-base font-semibold">{col.title}</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} search={link.search} className="hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="col-span-2 flex flex-col gap-4 lg:col-span-1">
            <div>
              <h2 className="mb-3 text-base font-semibold">Redes sociais</h2>
              <ul className="flex gap-2">
                {SOCIAL.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-8 items-center justify-center rounded-sm border border-primary text-primary hover:bg-primary/10"
                      aria-label={`${s.label} (abre em nova aba)`}
                    >
                      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
                        <path d={s.path} />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-2 text-base font-semibold">Carteiras compatíveis</h2>
              <WalletBadges />
            </div>
          </div>
        </div>
      </div>
      <p className="py-5 text-center text-xs">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}

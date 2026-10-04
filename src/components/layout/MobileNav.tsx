import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, Heart, Home, ScanLine, ShoppingCart, User } from 'lucide-react'
import { useCart } from '@/features/cart/hooks'
import { cn } from '@/lib/utils'
import { useRouter } from '@tanstack/react-router'

/** Barra de navegação inferior (mobile), conforme o frame "Início" mobile. */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  const item = (active: boolean) =>
    cn('flex size-12 items-center justify-center rounded-full transition-colors', active ? 'text-primary' : 'text-muted-foreground hover:text-foreground')

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto flex h-[84px] max-w-[480px] items-center justify-between rounded-t-[32px] bg-card px-6 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(0_0_0/0.35)]">
        <Link to="/" className={item(pathname === '/')} aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined}>
          <Home className="size-6" aria-hidden />
        </Link>
        <Link to="/conta/favoritos" className={item(pathname === '/conta/favoritos')} aria-label="Favoritos">
          <Heart className="size-6" aria-hidden />
        </Link>
        <span className="w-16" aria-hidden />
        <Link
          to="/mercado"
          aria-label="Explorar o mercado"
          className="absolute -top-7 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full border-[6px] border-background bg-gradient-to-br from-[#e0a06a] to-primary text-primary-foreground shadow-lg"
        >
          <ScanLine className="size-6" aria-hidden />
        </Link>
        <Link to="/carrinho" className={cn(item(pathname === '/carrinho'), 'relative')} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
          <ShoppingCart className="size-6" aria-hidden />
          {count > 0 && (
            <span className="absolute top-1.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {count}
            </span>
          )}
        </Link>
        <Link to="/conta/perfil" className={item(pathname.startsWith('/conta/perfil') || pathname.startsWith('/conta/carteiras'))} aria-label="Minha conta">
          <User className="size-6" aria-hidden />
        </Link>
      </div>
    </nav>
  )
}

/** Cabeçalho mobile das páginas internas: voltar + título (frames Carrinho/Pagamento). */
export function MobilePageHeader({ title, action, className }: { title: string; action?: React.ReactNode; className?: string }) {
  const router = useRouter()
  return (
    <div className={cn('flex items-center gap-4 pt-5 pb-4 md:hidden', className)}>
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: '/' }))}
        className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-primary"
        aria-label="Voltar"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <h1 className="flex-1 text-center text-xl font-bold">{title}</h1>
      <div className="flex size-9 shrink-0 items-center justify-center">{action}</div>
    </div>
  )
}

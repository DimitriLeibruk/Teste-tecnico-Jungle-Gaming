import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCart } from '@/features/cart/hooks'
import { authDialog } from '@/features/session/auth-dialog-store'
import { useSession } from '@/features/session/session-store'
import { cn } from '@/lib/utils'

const AccountMenu = lazy(() => import('./AccountMenu'))

const NAV = [
  { to: '/', label: 'Início', match: (p: string) => p === '/' },
  { to: '/mercado', label: 'Mercado', match: (p: string) => /^\/(mercado|nft|carrinho|pagamento)/.test(p) },
  { to: '/em-breve', label: 'Criadores', search: { secao: 'criadores' }, match: (p: string, s: string) => p === '/em-breve' && s.includes('criadores') },
  { to: '/em-breve', label: 'Aprenda', search: { secao: 'aprenda' }, match: (p: string, s: string) => p === '/em-breve' && s.includes('aprenda') },
] as const

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-[13px] font-bold tracking-[0.12em] text-foreground', className)} aria-label="Kurio — página inicial">
      KURIO
    </Link>
  )
}

export function CartLink({ className }: { className?: string }) {
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  return (
    <Link to="/carrinho" className={cn('relative inline-flex size-10 items-center justify-center rounded-full hover:bg-secondary', className)} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
      <ShoppingCart className="size-6" aria-hidden />
      {count > 0 && (
        <span
          data-testid="cart-count"
          className="absolute top-0.5 right-0 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-secondary" aria-label="Buscar NFTs">
        <Search className="size-6" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 translate-y-0 p-6" accent={false}>
          <DialogTitle>Buscar no mercado</DialogTitle>
          <DialogDescription className="mb-4">Busque por nome, token, coleção ou atributo.</DialogDescription>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              setOpen(false)
              void navigate({ to: '/mercado', search: (prev) => ({ ...prev, q: value.trim() || undefined, page: undefined }) })
            }}
            className="flex gap-2"
          >
            <label htmlFor="header-search" className="sr-only">
              Termo de busca
            </label>
            <Input id="header-search" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: Emerald, #0042, Música" maxLength={60} />
            <Button type="submit">Buscar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Header desktop/tablet (no mobile a navegação é a barra inferior). */
export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const searchStr = useRouterState({ select: (s) => s.location.searchStr })
  const { status } = useSession()

  return (
    <header className="hidden md:block">
      <div className="container-page">
        <div className="flex h-[68px] items-center justify-between border-b border-border">
          <Logo className="w-28" />
          <nav aria-label="Principal" className="h-full">
            <ul className="flex h-full items-stretch gap-6 lg:gap-9">
              {NAV.map((item) => {
                const active = item.match(pathname, searchStr)
                return (
                  <li key={item.label} className="flex">
                    <Link
                      to={item.to}
                      search={'search' in item ? item.search : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex items-start pt-5 text-[15px] transition-colors hover:text-primary',
                        active ? 'font-semibold text-primary after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[3px] after:bg-primary' : 'text-foreground',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="flex w-28 items-center justify-end gap-3 lg:w-auto">
            <SearchDialog />
            <CartLink />
            {status === 'authenticated' ? (
              <Suspense fallback={<span className="skeleton h-[34px] w-[100px]" aria-hidden />}>
                <AccountMenu />
              </Suspense>
            ) : status === 'restoring' ? (
              <span className="skeleton h-[34px] w-[100px]" aria-hidden />
            ) : (
              <Button size="sm" className="h-[34px] rounded-sm px-2.5 text-[15px] font-medium" onClick={() => authDialog.open('login')}>
                <LogIn className="size-5" aria-hidden />
                Entrar
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

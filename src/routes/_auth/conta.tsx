import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Download, Heart, LifeBuoy, LogOut, MapPin, ShoppingCart, Tag, User } from 'lucide-react'
import { logout } from '@/features/session/session-actions'
import { MobilePageHeader } from '@/components/layout/MobileNav'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_auth/conta')({
  component: AccountLayout,
})

const ITEMS = [
  { to: '/conta/perfil', label: 'Dados do perfil', icon: User },
  { to: '/conta/carteiras', label: 'Carteiras', icon: MapPin },
  { to: '/conta/atividade', label: 'Atividade', icon: ShoppingCart },
  { to: '/conta/favoritos', label: 'Lista de interesse', icon: Heart },
  { to: '/em-breve', search: { secao: 'ofertas' }, label: 'Ofertas', icon: Tag, soon: true },
  { to: '/em-breve', search: { secao: 'downloads' }, label: 'Arquivos baixados', icon: Download, soon: true },
  { to: '/em-breve', search: { secao: 'suporte' }, label: 'Suporte', icon: LifeBuoy, soon: true },
] as const

const TITLES: Record<string, string> = {
  '/conta/perfil': 'Meu perfil',
  '/conta/carteiras': 'Carteiras',
  '/conta/atividade': 'Atividade',
  '/conta/favoritos': 'Lista de interesse',
}

function AccountLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const signOut = async () => {
    await logout()
    void navigate({ to: '/' })
  }

  return (
    <div className="container-page">
      <MobilePageHeader title={TITLES[pathname] ?? 'Minha conta'} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-7 md:mt-8 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[310px_minmax(0,1fr)]">
        <nav aria-label="Minha conta" className="h-fit min-w-0 md:bg-card">
          <h2 className="hidden px-2.5 pt-5 pb-1 text-lg font-semibold md:block">Meu perfil</h2>
          <ul className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:gap-0 md:pb-0">
            {ITEMS.map((item) => {
              const active = pathname === item.to
              const Icon = item.icon
              return (
                <li key={item.label} className="relative shrink-0">
                  <Link
                    to={item.to}
                    search={'search' in item ? item.search : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-full border border-border px-3 py-2 text-sm whitespace-nowrap text-primary transition-colors hover:bg-secondary md:rounded-none md:border-0 md:border-l-[6px] md:border-transparent md:px-4 md:py-3 md:text-[15px]',
                      active && 'border-primary bg-accent md:border-l-primary md:bg-transparent',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {item.label}
                    {'soon' in item && <span className="sr-only">(em breve)</span>}
                  </Link>
                </li>
              )
            })}
            <li className="relative shrink-0 md:border-t md:border-border">
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full cursor-pointer items-center gap-3 rounded-full border border-border px-3 py-2 text-sm font-semibold whitespace-nowrap text-primary hover:bg-secondary md:rounded-none md:border-0 md:px-4 md:py-3 md:text-[15px]"
              >
                <LogOut className="size-5" aria-hidden />
                Sair
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

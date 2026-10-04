import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createRootRouteWithContext, Outlet, useMatches, useRouter, useRouterState } from '@tanstack/react-router'
import { WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import type { RouterContext } from '@/app/router'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileNav } from '@/components/layout/MobileNav'
import { LiveAnnouncer, announce } from '@/components/live-announcer'
import { Toaster } from '@/components/ui/sonner'
import { authDialog, useAuthDialog } from '@/features/session/auth-dialog-store'
import { useSession } from '@/features/session/session-store'
import { useRealtime } from '@/features/realtime/RealtimeProvider'
import { env } from '@/lib/env'

// Modal de login: baixado sob demanda na primeira abertura (formulários fora do bundle inicial).
const AuthDialog = lazy(() => import('@/features/session/AuthDialog').then((m) => ({ default: m.AuthDialog })))

function AuthDialogHost() {
  const { mode } = useAuthDialog()
  const [mounted, setMounted] = useState(false)
  if (mode && !mounted) setMounted(true)
  if (!mounted) return null
  return (
    <Suspense fallback={null}>
      <AuthDialog />
    </Suspense>
  )
}

const MockLab = env.apiMocking ? lazy(() => import('@/mocks/panel/MockLab')) : () => null

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

/** Reage à expiração de sessão preservando o contexto para retomada. */
function SessionWatcher() {
  const { endedReason, epoch } = useSession()
  const router = useRouter()
  useEffect(() => {
    if (endedReason !== 'expired') return
    const { location, matches } = router.state
    const isPrivate = matches.some((m) => m.routeId.startsWith('/_auth'))
    announce('Sua sessão expirou. Entre novamente para continuar.', 'assertive')
    if (isPrivate) {
      void router.navigate({ to: '/entrar', search: { redirect: location.href, motivo: 'expirada' }, replace: true })
    } else {
      toast.warning('Sua sessão expirou.', {
        id: 'session-expired',
        action: { label: 'Entrar', onClick: () => authDialog.open('login', 'Sua sessão expirou. Entre novamente para continuar.') },
      })
    }
  }, [endedReason, epoch, router])
  return null
}

/** Move o foco para o conteúdo principal a cada navegação (leitores de tela e teclado). */
function FocusOnNavigate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    document.getElementById('conteudo')?.focus({ preventScroll: true })
  }, [pathname])
  return null
}

function ConnectionBanner() {
  const { status } = useRealtime()
  if (status !== 'reconnecting') return null
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-accent px-4 py-2 text-xs text-foreground">
      <WifiOff className="size-4 text-primary" aria-hidden />
      Conexão em tempo real perdida. Reconectando… Os dados serão sincronizados ao reconectar.
    </div>
  )
}

function RootLayout() {
  const matches = useMatches()
  const showMobileNav = matches.every((m) => m.staticData?.mobileNav !== false)
  const showFooter = matches.every((m) => m.staticData?.footer !== false)

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a href="#conteudo" className="sr-only-focusable fixed top-2 left-2 z-[60] rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground">
        Pular para o conteúdo
      </a>
      <Header />
      <ConnectionBanner />
      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      {/* Os frames mobile de detalhe/carrinho/pagamento não têm rodapé (barras de ação fixas). */}
      {showFooter && (
        <div className={showMobileNav ? undefined : 'max-md:hidden'}>
          <Footer />
        </div>
      )}
      {showMobileNav ? !showFooter && <div className="h-28 md:hidden" aria-hidden /> : <div className="h-48 md:hidden" aria-hidden />}
      {showMobileNav && <MobileNav />}
      <AuthDialogHost />
      <Toaster />
      <LiveAnnouncer />
      <SessionWatcher />
      <FocusOnNavigate />
      <Suspense fallback={null}>
        <MockLab />
      </Suspense>
    </div>
  )
}

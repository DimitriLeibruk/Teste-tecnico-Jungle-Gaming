import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { sessionStore, useSession } from './session-store'
import { LoginForm, RegisterForm } from './AuthForms'
import { AuthTabs } from './AuthDialog'
import { safeRedirect } from './redirect'
import { usePageTitle } from '@/hooks/use-page-title'

/**
 * Páginas /entrar e /cadastro: layout dos frames mobile; no desktop o mesmo
 * cartão do modal, centralizado. Após autenticar, volta ao fluxo anterior.
 */
export function AuthPage({ mode, redirectTo, expired }: { mode: 'login' | 'register'; redirectTo?: string; expired?: boolean }) {
  usePageTitle(mode === 'login' ? 'Entrar' : 'Criar conta')
  const router = useRouter()
  const navigate = useNavigate()
  const { status } = useSession()
  const target = safeRedirect(redirectTo)

  // Já autenticado (ex.: voltou pelo histórico): segue para o destino.
  useEffect(() => {
    if (status === 'authenticated') void router.navigate({ to: target, replace: true })
  }, [status, target, router])

  const done = () => {
    sessionStore.dismissEndedReason()
    void router.navigate({ to: target, replace: true })
  }
  const notice = expired ? 'Sua sessão expirou. Entre novamente para continuar de onde parou.' : null
  const other = mode === 'login' ? '/cadastro' : '/entrar'

  return (
    <div className="container-page flex justify-center py-6 md:py-16">
      <div className="w-full max-w-[500px] md:border-b-[10px] md:border-b-primary md:bg-card md:px-20 md:py-12">
        <p className="mt-16 mb-14 text-center text-3xl font-bold tracking-[0.12em] md:hidden" aria-hidden>
          KURIO
        </p>
        <div className="hidden md:block">
          <AuthTabs mode={mode} onChange={(m) => void navigate({ to: m === 'login' ? '/entrar' : '/cadastro', search: { redirect: redirectTo }, replace: true })} />
        </div>
        <h1 className="mb-6 text-center text-xl font-bold md:mt-6 md:text-xs md:font-normal">
          <span className="md:hidden">{mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}</span>
          <span className="hidden md:inline">
            {mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
          </span>
        </h1>
        {mode === 'login' ? <LoginForm onSuccess={done} notice={notice} /> : <RegisterForm onSuccess={done} />}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {mode === 'login' ? 'Novo na Kurio? ' : 'Já tem uma conta? '}
          <Link to={other} search={{ redirect: redirectTo }} className="text-primary hover:underline">
            {mode === 'login' ? 'Crie uma conta' : 'Entre'}
          </Link>
        </p>
      </div>
    </div>
  )
}

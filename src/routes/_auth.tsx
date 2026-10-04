import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { sessionStore } from '@/features/session/session-store'

/**
 * Layout das rotas privadas (checkout, pedidos, perfil, carteiras, favoritos).
 * Aguarda a validação da sessão persistida e redireciona para /entrar
 * preservando o destino em `redirect`.
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, location }) => {
    await context.sessionReady
    if (sessionStore.get().status !== 'authenticated') {
      throw redirect({ to: '/entrar', search: { redirect: location.href } })
    }
  },
  component: () => <Outlet />,
})

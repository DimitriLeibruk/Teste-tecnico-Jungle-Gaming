import { createFileRoute } from '@tanstack/react-router'
import { AuthPage } from '@/features/session/AuthPage'
import { authSearchSchema } from '@/features/session/redirect'

export const Route = createFileRoute('/entrar')({
  validateSearch: authSearchSchema,
  staticData: { mobileNav: false, footer: false },
  component: function LoginRoute() {
    const { redirect, motivo } = Route.useSearch()
    return <AuthPage mode="login" redirectTo={redirect} expired={motivo === 'expirada'} />
  },
})

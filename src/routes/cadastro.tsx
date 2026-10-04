import { createFileRoute } from '@tanstack/react-router'
import { AuthPage } from '@/features/session/AuthPage'
import { authSearchSchema } from '@/features/session/redirect'

export const Route = createFileRoute('/cadastro')({
  validateSearch: authSearchSchema,
  staticData: { mobileNav: false, footer: false },
  component: function RegisterRoute() {
    const { redirect } = Route.useSearch()
    return <AuthPage mode="register" redirectTo={redirect} />
  },
})

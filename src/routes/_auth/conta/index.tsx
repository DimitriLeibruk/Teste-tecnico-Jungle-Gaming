import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/conta/')({
  beforeLoad: () => {
    throw redirect({ to: '/conta/perfil', replace: true })
  },
})

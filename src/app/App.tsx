import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { createQueryClient } from './query-client'
import { createAppRouter } from './router'
import { bindSession, restoreSession } from '@/features/session/session-actions'
import { RealtimeProvider } from '@/features/realtime/RealtimeProvider'

/**
 * Cria cliente de dados, sessão e router. Chamado só depois que a camada de
 * mocks está ativa (a restauração de sessão já faz uma chamada à API).
 */
export function createApp() {
  const queryClient = createQueryClient()
  bindSession(queryClient)
  // Restaura a sessão em paralelo ao primeiro render; rotas privadas aguardam.
  const sessionReady = restoreSession()
  const router = createAppRouter(queryClient, sessionReady)

  return function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          <RouterProvider router={router} />
        </RealtimeProvider>
      </QueryClientProvider>
    )
  }
}

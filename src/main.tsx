import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { env } from '@/lib/env'
import { setNetworkReady } from '@/lib/network-gate'
import { createApp } from '@/app/App'

async function enableMocking() {
  if (!env.apiMocking) return
  const { startMockServer } = await import('./mocks/browser')
  await startMockServer()
}

// A UI renderiza já; as chamadas de rede aguardam a camada de mocks ficar ativa
// (ver src/lib/network-gate.ts). Assim o MSW sai do caminho crítico de renderização.
setNetworkReady(
  enableMocking().catch((error: unknown) => {
    console.error('[mocks] falha ao iniciar a camada de mocks', error)
  }),
)

const App = createApp()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

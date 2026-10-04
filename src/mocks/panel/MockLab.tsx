import { useEffect, useState } from 'react'
import { whenNetworkReady } from '@/lib/network-gate'
import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import type { Cart } from '@/api/contracts'
import { addEth } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/controls'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { SCENARIOS, type ScenarioId } from '../scenarios'
import { SEED_PASSWORD, SEED_USERS } from '../db/seed'

/**
 * Painel de demonstração da camada de mocks ("Mock Lab").
 * Todas as ações chamam o servidor simulado (window.__KURIO_MOCK__); a UI da
 * loja recebe as mudanças apenas por REST e Socket.IO, como em produção.
 * Oculto quando localStorage["kurio.mock.panel"] = "hidden" (testes visuais).
 */
export default function MockLab() {
  // O painel aparece quando o servidor simulado termina de iniciar.
  const [started, setStarted] = useState(() => !!window.__KURIO_MOCK__)
  useEffect(() => {
    if (!started) void whenNetworkReady().then(() => setStarted(true))
  }, [started])
  const control = started ? window.__KURIO_MOCK__ : undefined
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ScenarioId[]>(() => control?.getScenario() ?? ['default'])
  const [log, setLog] = useState<string[]>([])
  const hidden = (() => {
    try {
      return localStorage.getItem('kurio.mock.panel') === 'hidden'
    } catch {
      return false
    }
  })()
  if (!control || hidden) return null

  const write = (message: string) => setLog((l) => [`${new Date().toLocaleTimeString('pt-BR')} — ${message}`, ...l].slice(0, 8))

  const cartNft = () => {
    const carts = queryClient.getQueriesData<Cart>({ queryKey: ['cart'] })
    return carts.flatMap(([, c]) => c?.items ?? [])[0]
  }

  const changePrice = () => {
    const item = cartNft()
    const nftId = item?.nftId ?? 'emerald-ape-042'
    const editionId = item?.editionId ?? '1-50'
    const current = control.getNft(nftId)?.edition(editionId)?.price ?? '1'
    const event = control.updateNft(nftId, { editionId, price: addEth(current, '0.1') })
    write(`nft.updated v${event.version}: ${nftId} ${editionId} → ${event.data.editions.find((e) => e.id === editionId)?.price} ETH`)
  }

  const soldOut = () => {
    const item = cartNft()
    const nftId = item?.nftId ?? 'emerald-ape-042'
    const event = control.updateNft(nftId, { editionId: item?.editionId ?? '1-50', available: 0 })
    write(`nft.updated v${event.version}: ${nftId} esgotado`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-3 z-40 flex cursor-pointer items-center gap-2 rounded-full border border-primary/60 bg-card/95 px-3 py-2 text-xs font-semibold text-primary shadow-lg md:bottom-4"
        aria-label="Abrir Mock Lab (cenários de simulação)"
        data-testid="mock-lab-toggle"
      >
        <FlaskConical className="size-4" aria-hidden /> Mock Lab
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[92%] max-w-md gap-5 text-sm">
          <SheetTitle className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" aria-hidden /> Mock Lab
          </SheetTitle>
          <SheetDescription>
            Controla o backend simulado (MSW + Socket.IO). As mudanças chegam à loja pelos mesmos caminhos de produção.
          </SheetDescription>

          <section aria-labelledby="ml-scenarios" className="flex flex-col gap-2">
            <h3 id="ml-scenarios" className="font-semibold">
              Cenários (combináveis)
            </h3>
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
                <li key={id} className="flex gap-2">
                  <Checkbox
                    id={`ml-${id}`}
                    checked={selected.includes(id)}
                    onCheckedChange={(checked) => setSelected((s) => (checked ? [...s.filter((x) => x !== 'default'), id] : s.filter((x) => x !== id)))}
                    className="mt-0.5"
                  />
                  <label htmlFor={`ml-${id}`} className="cursor-pointer">
                    <span className="font-medium">{SCENARIOS[id].label}</span>
                    <span className="block text-xs text-muted-foreground">{SCENARIOS[id].description}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  control.setScenario(selected.length ? selected : ['default'])
                  window.location.reload()
                }}
              >
                Aplicar e recarregar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await control.reset()
                  window.location.assign('/')
                }}
              >
                Resetar tudo
              </Button>
            </div>
          </section>

          <section aria-labelledby="ml-events" className="flex flex-col gap-2">
            <h3 id="ml-events" className="font-semibold">
              Eventos em tempo real
            </h3>
            <p className="text-xs text-muted-foreground">Afeta o primeiro item do carrinho (ou Emerald Ape #042).</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={changePrice}>
                Subir preço +0.1
              </Button>
              <Button size="sm" variant="secondary" onClick={soldOut}>
                Esgotar edição
              </Button>
              <Button size="sm" variant="secondary" onClick={() => write(control.replayLastEvent() ? 'Último evento reenviado (duplicata)' : 'Nenhum evento ainda')}>
                Duplicar evento
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => write(control.emitStaleNftEvent(cartNft()?.nftId ?? 'emerald-ape-042') ? 'Evento antigo enviado' : 'Nenhum evento anterior deste NFT')}
              >
                Evento antigo
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  control.disconnectSockets(5000)
                  write('Socket derrubado; reconexões recusadas por 5 s')
                }}
              >
                Queda de 5 s
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  control.expireSessions()
                  write('Sessões expiradas no servidor')
                }}
              >
                Expirar sessão
              </Button>
            </div>
            {control.pendingOrders().map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 rounded-sm border border-border p-2 text-xs">
                <span>Pedido {o.number} pendente</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => control.settleOrder(o.id, 'confirmed')}>
                    Confirmar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => control.settleOrder(o.id, 'declined')}>
                    Recusar
                  </Button>
                </span>
              </div>
            ))}
            {log.length > 0 && (
              <ol className="flex flex-col gap-1 rounded-sm bg-background p-2 font-mono text-[11px] text-muted-foreground" aria-label="Log de ações">
                {log.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="ml-users" className="flex flex-col gap-1">
            <h3 id="ml-users" className="font-semibold">
              Credenciais fictícias
            </h3>
            {SEED_USERS.map((u) => (
              <p key={u.id} className="text-xs">
                {u.email} · <span className="text-muted-foreground">{SEED_PASSWORD}</span>
              </p>
            ))}
          </section>
        </SheetContent>
      </Sheet>
    </>
  )
}

import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react'
import { NETWORKS, WALLET_PROVIDERS, type Quote, type WalletConnection } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Alert } from '@/components/ui/misc'
import { QuoteTotals } from '@/features/cart/CartSummary'
import { formatEth } from '@/lib/money'
import { shortAddress } from '@/lib/utils'
import { OrderLines } from './OrderLines'
import type { CheckoutForm } from './schema'

export type ReviewStage = 'review' | 'revalidating' | 'changed' | 'submitting' | 'blocked'

/**
 * Revisão antes do envio. A cotação exibida é um SNAPSHOT: se a cotação atual
 * divergir (evento em tempo real ou revalidação), o usuário precisa confirmar de novo.
 */
export function ReviewDialog({
  open,
  onOpenChange,
  quote,
  previousTotal,
  stage,
  values,
  connection,
  attempt,
  error,
  onConfirm,
  liveQuoteChanged,
  onRefreshReview,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quote: Quote | null
  previousTotal: string | null
  stage: ReviewStage
  values: CheckoutForm
  connection: WalletConnection | null
  attempt: number
  error: string | null
  onConfirm: () => void
  liveQuoteChanged: boolean
  onRefreshReview: () => void
}) {
  const busy = stage === 'revalidating' || stage === 'submitting'
  const blockingIssues = quote?.issues.filter((i) => i.type === 'SOLD_OUT' || i.type === 'INSUFFICIENT_AVAILABILITY') ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        className="max-w-[560px] gap-4 px-6 pt-8 pb-8"
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
        showClose={!busy}
      >
        <DialogTitle className="text-center text-lg">Revise seu pedido</DialogTitle>
        <DialogDescription className="text-center text-xs">Confira os valores. A cotação do servidor é a referência para o pagamento.</DialogDescription>

        {stage === 'changed' && previousTotal && quote && (
          <Alert variant="warning">
            <AlertTriangle aria-hidden />
            <div>
              <p className="font-semibold">Os valores do pedido mudaram</p>
              <p className="text-muted-foreground">
                Total anterior: {formatEth(previousTotal)} → novo total: <strong className="text-primary">{formatEth(quote.total)}</strong>. Revise e confirme novamente.
              </p>
              {quote.issues
                .filter((i) => i.type === 'PRICE_CHANGED' || i.type === 'COUPON_EXPIRED')
                .map((i, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground">
                    {i.message}
                  </p>
                ))}
            </div>
          </Alert>
        )}
        {liveQuoteChanged && stage === 'review' && (
          <Alert variant="warning">
            <RefreshCw aria-hidden />
            <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
              <p>Recebemos uma atualização de preço ou disponibilidade.</p>
              <Button size="sm" variant="outline" onClick={onRefreshReview}>
                Atualizar revisão
              </Button>
            </div>
          </Alert>
        )}
        {blockingIssues.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <ul>
              {blockingIssues.map((i, idx) => (
                <li key={idx}>{i.message}</li>
              ))}
            </ul>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <p>{error}</p>
          </Alert>
        )}

        <OrderLines lines={quote?.items} loading={!quote} dense caption="Itens do pedido" />
        <QuoteTotals quote={quote ?? undefined} compact />

        <dl className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 text-xs">
          <div>
            <dt className="text-subtle">Carteira</dt>
            <dd>{WALLET_PROVIDERS[values.provider].label}</dd>
          </div>
          <div>
            <dt className="text-subtle">Rede</dt>
            <dd>{NETWORKS[values.network].label}</dd>
          </div>
          <div>
            <dt className="text-subtle">Endereço</dt>
            <dd className="font-mono">{shortAddress(connection?.address ?? values.address)}</dd>
          </div>
          <div>
            <dt className="text-subtle">Colecionador</dt>
            <dd className="truncate">
              {values.displayName} (@{values.username})
            </dd>
          </div>
        </dl>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
          Envio protegido contra duplicidade: cliques repetidos ou novas tentativas recuperam o mesmo pedido.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Voltar
          </Button>
          <Button onClick={onConfirm} loading={busy} disabled={busy || !quote?.valid || liveQuoteChanged} data-testid="confirm-order">
            {stage === 'revalidating'
              ? 'Validando valores…'
              : stage === 'submitting'
                ? attempt > 1
                  ? `Reenviando (tentativa ${attempt})…`
                  : 'Enviando pedido…'
                : stage === 'changed'
                  ? 'Confirmar novos valores'
                  : 'Confirmar e pagar'}
          </Button>
        </div>
        <p className="sr-only" aria-live="assertive">
          {stage === 'changed' ? 'Os valores do pedido mudaram. Revise e confirme novamente.' : ''}
        </p>
      </DialogContent>
    </Dialog>
  )
}

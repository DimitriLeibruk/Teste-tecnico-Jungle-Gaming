import { ExternalLink } from 'lucide-react'
import { NETWORKS, type Order } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { formatEth, isZeroEth } from '@/lib/money'
import { formatShortDate, shortAddress } from '@/lib/utils'

/**
 * Recibo (frame "Confirmação de Pedido"). Renderiza exclusivamente o snapshot
 * do pedido: mudanças posteriores no catálogo não alteram os valores.
 */
export function Receipt({ order, onClose }: { order: Order; onClose: () => void }) {
  const tx = order.transaction!
  const network = NETWORKS[order.network]
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[578px] gap-0 p-0" aria-describedby="receipt-desc" data-testid="receipt">
        <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-5">
          <img src="/thank-you.png" alt="" width={76} height={88} />
          <DialogTitle className="text-center text-[15px] font-semibold text-muted-foreground">Seus NFTs agora estão na sua carteira</DialogTitle>
        </div>

        <dl className="grid grid-cols-2 gap-y-3 border-y border-primary px-6 py-3 text-xs sm:grid-cols-4 sm:px-9">
          <div className="sm:border-r sm:border-primary sm:pr-3">
            <dt className="font-semibold text-muted-foreground">ID da transação</dt>
            <dd className="font-mono text-muted-foreground" title={tx.hash} data-testid="tx-id">
              {shortAddress(tx.hash, 6, 4).toUpperCase().replace('0X', '0x')}
            </dd>
          </div>
          <div className="sm:border-r sm:border-primary sm:px-3">
            <dt className="text-muted-foreground">Data</dt>
            <dd className="text-muted-foreground">{formatShortDate(order.settledAt ?? order.createdAt)}</dd>
          </div>
          <div className="sm:border-r sm:border-primary sm:px-3">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="text-muted-foreground">{formatEth(order.total)}</dd>
          </div>
          <div className="sm:pl-3">
            <dt className="font-semibold text-muted-foreground">Carteira</dt>
            <dd className="text-muted-foreground">{order.wallet.label}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 px-6 py-6 sm:px-11">
          <h2 className="text-[15px] font-semibold">Detalhes da transação</h2>
          <table className="w-full text-sm">
            <caption className="sr-only">Itens comprados no pedido {order.number}</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="pb-2 font-semibold">
                  NFTs
                </th>
                <th scope="col" className="pb-2 text-center font-semibold">
                  Edições
                </th>
                <th scope="col" className="pb-2 text-right font-semibold">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.itemId}>
                  <td className="pt-3">
                    <div className="flex items-center gap-3">
                      <img src={item.image} alt={item.alt} width={66} height={66} className="size-[66px] shrink-0 rounded-sm object-cover" />
                      <div className="min-w-0">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-subtle">
                          ID do token: {item.tokenId} · {item.editionLabel}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="pt-3 text-center text-xs text-muted-foreground">(x {item.quantity})</td>
                  <td className="pt-3 text-right text-base font-bold whitespace-nowrap text-primary">{formatEth(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-2 ml-auto flex w-full max-w-[320px] flex-col gap-2 text-[15px]" data-testid="receipt-totals">
            {!isZeroEth(order.discount) && (
              <div className="flex justify-between">
                <dt>Desconto</dt>
                <dd>(-) {formatEth(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Taxa de rede</dt>
              <dd>{formatEth(order.networkFee)}</dd>
            </div>
            <div className="flex justify-between font-bold">
              <dt>Total</dt>
              <dd className="text-primary" data-testid="receipt-total">
                {formatEth(order.total)}
              </dd>
            </div>
          </dl>
          <p id="receipt-desc" className="border-t border-border pt-3 text-center text-[13px] leading-relaxed text-muted-foreground">
            Transação confirmada na {network.label}. A propriedade foi transferida para sua carteira conectada ({shortAddress(order.wallet.address)}) e registrada na rede.
          </p>
          <DialogDescription className="sr-only">Pedido {order.number} confirmado.</DialogDescription>
          <Button asChild className="mx-auto h-12 rounded-sm px-4 text-base font-semibold">
            <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer">
              Ver no {network.explorerName}
              <ExternalLink className="size-4" aria-hidden />
              <span className="sr-only">(abre em nova aba; transação simulada)</span>
            </a>
          </Button>
          <p className="text-center text-[11px] text-subtle">Referência de transação simulada para demonstração.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

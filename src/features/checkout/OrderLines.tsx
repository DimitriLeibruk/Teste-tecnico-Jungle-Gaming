import type { QuoteLine } from '@/api/contracts'
import { Skeleton } from '@/components/ui/misc'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

/** Linhas "Seus NFTs" (Pagamento) e "Detalhes da transação" (Recibo). */
export function OrderLines({ lines, loading, dense, caption }: { lines: QuoteLine[] | undefined; loading?: boolean; dense?: boolean; caption: string }) {
  if (loading || !lines) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando itens">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[70px] w-full" />
        ))}
      </div>
    )
  }
  return (
    <table className="w-full border-separate border-spacing-y-2 text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">NFT</th>
          <th scope="col">Quantidade</th>
          <th scope="col">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.itemId} className={cn(!dense && 'bg-card')}>
            <td className="py-0">
              <div className="flex items-center gap-3">
                <img src={l.image} alt={l.alt} width={66} height={66} className={cn('shrink-0 object-cover', dense ? 'size-[66px] rounded-sm' : 'size-[70px]')} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{l.name}</p>
                  <p className="text-xs text-subtle">
                    ID do token: {l.tokenId} · {l.editionLabel}
                  </p>
                </div>
              </div>
            </td>
            <td className="px-2 text-center text-xs whitespace-nowrap text-muted-foreground">
              <span aria-hidden>(x {l.quantity})</span>
              <span className="sr-only">{l.quantity} unidades</span>
            </td>
            <td className="pr-3 text-right text-base font-bold whitespace-nowrap text-primary tabular-nums">{formatEth(l.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Trash2 } from 'lucide-react'
import type { Cart, CartItem } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Alert, Skeleton } from '@/components/ui/misc'
import { EmptyState, ErrorState } from '@/components/states'
import { QuantityStepper } from '@/components/quantity-stepper'
import { MobilePageHeader } from '@/components/layout/MobileNav'
import { CardRail } from '@/features/catalog/CardRail'
import { useRelated } from '@/features/catalog/queries'
import { CouponForm, QuoteTotals } from '@/features/cart/CartSummary'
import { RealtimeNotices } from '@/features/cart/RealtimeNotices'
import { useAcknowledgePrices, useCart, useQuote, useRemoveCartItem, useUpdateCartItem } from '@/features/cart/hooks'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/carrinho')({
  staticData: { mobileNav: false },
  component: CartPage,
})

function ItemStatus({ item }: { item: CartItem }) {
  if (item.status === 'ok') return null
  const text =
    item.status === 'sold-out'
      ? 'Esgotado — remova o item para continuar'
      : item.status === 'insufficient'
        ? `Restam ${item.maxQuantity} — reduza a quantidade`
        : `Preço alterado (era ${formatEth(item.addedUnitPrice)})`
  return (
    <p className={cn('mt-1 flex items-center gap-1 text-xs', item.status === 'price-changed' ? 'text-primary' : 'text-destructive')}>
      <AlertTriangle className="size-3.5" aria-hidden />
      {text}
    </p>
  )
}

function useItemActions() {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const busyId = (update.isPending && update.variables?.itemId) || (remove.isPending && remove.variables?.itemId) || null
  return { update, remove, busyId }
}

function CartRows({ cart }: { cart: Cart }) {
  const { update, remove, busyId } = useItemActions()
  return (
    <table className="hidden w-full border-separate border-spacing-y-3 md:table">
      <caption className="sr-only">Itens no carrinho</caption>
      <thead>
        <tr className="text-left text-[15px]">
          <th scope="col" className="border-b border-border pb-3 font-semibold">
            NFTs
          </th>
          <th scope="col" className="border-b border-border pb-3 font-semibold">
            Preço
          </th>
          <th scope="col" className="border-b border-border pb-3 font-semibold">
            Edições
          </th>
          <th scope="col" className="border-b border-border pb-3 font-semibold">
            Total
          </th>
          <th scope="col" className="border-b border-border pb-3">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {cart.items.map((item) => (
          <tr key={item.id} className={cn('bg-card', busyId === item.id && 'opacity-70')} data-testid="cart-row" aria-busy={busyId === item.id}>
            <td className="py-0 pr-4">
              <div className="flex items-center gap-4">
                <img src={item.image} alt={item.alt} width={70} height={70} className="size-[70px] object-cover" />
                <div>
                  <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="text-[15px] font-semibold hover:text-primary">
                    {item.name}
                  </Link>
                  <p className="text-[13px] text-subtle">
                    ID do token: {item.tokenId} · Edição {item.editionLabel}
                  </p>
                  <ItemStatus item={item} />
                </div>
              </div>
            </td>
            <td className="pr-4 text-[15px] font-semibold text-primary tabular-nums">
              {item.status === 'price-changed' && (
                <span className="mr-2 text-xs font-normal text-muted-foreground line-through">
                  <span className="sr-only">antes </span>
                  {formatEth(item.addedUnitPrice, { suffix: false })}
                </span>
              )}
              {formatEth(item.unitPrice)}
            </td>
            <td className="pr-4">
              <QuantityStepper
                size="sm"
                value={item.quantity}
                max={Math.max(item.quantity > item.maxQuantity ? item.quantity : item.maxQuantity, 1)}
                onChange={(q) => update.mutate({ itemId: item.id, quantity: q, name: item.name })}
                label={`${item.name} (${item.editionLabel})`}
                disabled={busyId === item.id || item.status === 'sold-out'}
              />
            </td>
            <td className="pr-4 text-[15px] font-semibold text-primary tabular-nums" data-testid="line-total">
              {formatEth(item.lineTotal)}
            </td>
            <td className="pr-6 text-right">
              <button
                type="button"
                onClick={() => remove.mutate({ itemId: item.id, name: item.name })}
                disabled={busyId === item.id}
                aria-label={`Remover ${item.name} (${item.editionLabel}) do carrinho`}
                className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CartCardsMobile({ cart }: { cart: Cart }) {
  const { update, remove, busyId } = useItemActions()
  return (
    <ul className="flex flex-col gap-5 md:hidden" aria-label="Itens no carrinho">
      {cart.items.map((item) => (
        <li key={item.id} className={cn('flex overflow-hidden rounded-2xl bg-card', busyId === item.id && 'opacity-70')} data-testid="cart-row-mobile">
          <img src={item.image} alt={item.alt} width={100} height={100} className="size-[100px] shrink-0 object-cover" />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <p className="text-sm text-subtle">Edição: {item.editionLabel}</p>
              <p className="mt-1 text-lg font-bold text-primary">{formatEth(item.lineTotal)}</p>
              <ItemStatus item={item} />
            </div>
            <div className="flex flex-col items-end gap-2">
              <QuantityStepper
                size="sm"
                value={item.quantity}
                max={Math.max(item.quantity > item.maxQuantity ? item.quantity : item.maxQuantity, 1)}
                onChange={(q) => update.mutate({ itemId: item.id, quantity: q, name: item.name })}
                label={`${item.name} (${item.editionLabel})`}
                disabled={busyId === item.id || item.status === 'sold-out'}
              />
              <button type="button" onClick={() => remove.mutate({ itemId: item.id, name: item.name })} aria-label={`Remover ${item.name} do carrinho`} className="cursor-pointer p-1 text-primary">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function CartSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando carrinho">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 bg-card p-0 max-md:rounded-2xl">
          <Skeleton className="size-[70px] rounded-none max-md:size-[100px]" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}

function CartPage() {
  usePageTitle('Carrinho de NFTs')
  const navigate = useNavigate()
  const { data: cart, error, isPending, refetch, isRefetching } = useCart()
  const quote = useQuote('ethereum')
  const acknowledge = useAcknowledgePrices()
  const related = useRelated(cart?.items[0]?.nftId ?? 'emerald-ape-042')
  const hasItems = !!cart && cart.items.length > 0
  const priceChanged = cart?.items.some((i) => i.status === 'price-changed')
  const blocking = quote.data?.issues.filter((i) => i.type !== 'PRICE_CHANGED' && i.type !== 'COUPON_EXPIRED') ?? []
  const canCheckout = hasItems && !!quote.data?.valid && !quote.isFetching

  return (
    <>
      <div className="container-page">
        <MobilePageHeader title="Carrinho de NFTs" />
        <nav aria-label="Trilha" className="mt-7 hidden text-[15px] font-semibold md:block">
          <ol className="flex gap-2">
            <li>
              <Link to="/" className="hover:text-primary">
                Início
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link to="/mercado" className="hover:text-primary">
                Mercado
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page">Carrinho</li>
          </ol>
        </nav>
        <h1 className="sr-only">Carrinho de NFTs</h1>

        <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-8 pb-[360px] md:grid-cols-[minmax(0,1fr)_300px] md:pb-0 lg:grid-cols-[minmax(0,782px)_332px] lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4">
            <RealtimeNotices />
            {priceChanged && (
              <Alert variant="warning" role="status">
                <AlertTriangle aria-hidden />
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                  <p>Alguns preços mudaram desde que você adicionou os itens. O resumo já mostra os valores atuais.</p>
                  <Button size="sm" variant="outline" onClick={() => acknowledge.mutate()} loading={acknowledge.isPending}>
                    Entendi
                  </Button>
                </div>
              </Alert>
            )}
            {isPending ? (
              <CartSkeleton />
            ) : error && !cart ? (
              <ErrorState error={error} title="Não foi possível carregar o carrinho" onRetry={() => void refetch()} retrying={isRefetching} />
            ) : !hasItems ? (
              <EmptyState
                title="Seu carrinho está vazio"
                description="Explore o mercado e adicione NFTs para começar sua coleção."
                action={
                  <Button asChild>
                    <Link to="/mercado">Explorar o mercado</Link>
                  </Button>
                }
              />
            ) : (
              <>
                <CartRows cart={cart} />
                <CartCardsMobile cart={cart} />
              </>
            )}
          </div>

          {hasItems && (
            <aside
              aria-labelledby="summary-title"
              className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-4 rounded-t-[32px] bg-card px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.4)] md:static md:rounded-none md:bg-transparent md:p-0 md:shadow-none"
            >
              <h2 id="summary-title" className="hidden border-b border-border pb-3 text-lg font-semibold md:block">
                Resumo da carteira
              </h2>
              <div className="hidden md:block">
                <CouponForm cart={cart} />
              </div>
              <div className="md:hidden">
                <CouponForm cart={cart} variant="mobile" />
              </div>
              {quote.error ? (
                <ErrorState error={quote.error} title="Não foi possível calcular os valores" onRetry={() => void quote.refetch()} retrying={quote.isRefetching} className="py-4" />
              ) : (
                <QuoteTotals quote={quote.data} loading={quote.isPending} compact />
              )}
              {blocking.length > 0 && (
                <ul className="flex flex-col gap-1 text-xs text-destructive" role="alert">
                  {blocking.map((i, idx) => (
                    <li key={idx}>{i.message}</li>
                  ))}
                </ul>
              )}
              <Button
                size="lg"
                className="h-[60px] rounded-2xl bg-gradient-to-r from-[#e0a06a] to-primary text-base font-semibold md:h-10 md:rounded-sm md:bg-none md:bg-primary md:text-[15px]"
                disabled={!canCheckout}
                onClick={() => void navigate({ to: '/pagamento' })}
              >
                Conectar e finalizar
              </Button>
              <Link to="/mercado" className="hidden text-center text-[15px] text-primary hover:underline md:block">
                Continuar explorando
              </Link>
            </aside>
          )}
        </div>
      </div>
      <div className="hidden md:block">
        <CardRail title="Colecionadores também viram" items={related.data?.items} loading={related.isPending} />
      </div>
    </>
  )
}

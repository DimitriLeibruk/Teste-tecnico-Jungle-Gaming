import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, Clock, Link2, Link2Off, Wallet as WalletIcon } from 'lucide-react'
import { NETWORKS, quoteSchema, WALLET_PROVIDERS, type Quote, type Wallet, type WalletConnection, type WalletProvider } from '@/api/contracts'
import { quoteApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/misc'
import { EmptyState, ErrorState } from '@/components/states'
import { announce } from '@/components/live-announcer'
import { MobilePageHeader } from '@/components/layout/MobileNav'
import { useWallets } from '@/features/account/hooks'
import { CouponForm, QuoteTotals } from '@/features/cart/CartSummary'
import { RealtimeNotices } from '@/features/cart/RealtimeNotices'
import { useCart, useCartScope, useQuote } from '@/features/cart/hooks'
import { CheckoutFields } from '@/features/checkout/CheckoutFields'
import { clearPendingAttempt, readPendingAttempt, useConnectWallet, useCreateOrder, useDisconnectWallet, type CheckoutAttempt } from '@/features/checkout/hooks'
import { OrderLines } from '@/features/checkout/OrderLines'
import { ReviewDialog, type ReviewStage } from '@/features/checkout/ReviewDialog'
import { checkoutFormSchema, formFromWallet, readDraft, writeDraft, type CheckoutForm } from '@/features/checkout/schema'
import { useOrders } from '@/features/orders/hooks'
import { useSession } from '@/features/session/session-store'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatEth } from '@/lib/money'
import { removeKey, STORAGE_KEYS } from '@/lib/storage'
import { cn, shortAddress } from '@/lib/utils'

export const Route = createFileRoute('/_auth/pagamento')({
  staticData: { mobileNav: false },
  component: CheckoutPage,
})

interface ReviewState {
  open: boolean
  quote: Quote | null
  previousTotal: string | null
  stage: ReviewStage
  error: string | null
}

const CLOSED: ReviewState = { open: false, quote: null, previousTotal: null, stage: 'review', error: null }

function ProviderOptions({ value, onChange }: { value: WalletProvider; onChange: (p: WalletProvider) => void }) {
  return (
    <div role="radiogroup" aria-label="Carteira para pagamento" className="flex flex-col gap-3">
      {(Object.keys(WALLET_PROVIDERS) as WalletProvider[]).map((p) => {
        const checked = value === p
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(p)}
            className={cn(
              'flex h-[60px] cursor-pointer items-center gap-4 rounded-2xl border bg-card px-4 text-left text-sm transition-colors md:h-[46px] md:rounded-none md:bg-transparent',
              checked ? 'border-primary md:border-foreground' : 'border-transparent md:border-border',
            )}
          >
            <span className={cn('flex size-4 items-center justify-center rounded-full border border-primary')} aria-hidden>
              {checked && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary md:hidden" aria-hidden>
              {WALLET_PROVIDERS[p].initial}
            </span>
            {WALLET_PROVIDERS[p].label}
          </button>
        )
      })}
    </div>
  )
}

function WalletCards({ primary, secondary, useSecondary, onChange }: { primary: Wallet | null; secondary: Wallet | null; useSecondary: boolean; onChange: (v: boolean) => void }) {
  const wallets = [primary, secondary].filter((w): w is Wallet => !!w)
  return (
    <div role="radiogroup" aria-label="Carteira cadastrada" className="flex flex-col gap-4">
      {wallets.map((w) => {
        const checked = (w.slot === 'secondary') === useSecondary
        return (
          <button
            key={w.id}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(w.slot === 'secondary')}
            className={cn('flex cursor-pointer items-start gap-4 rounded-2xl border bg-card p-4 text-left', checked ? 'border-primary' : 'border-transparent')}
          >
            <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-primary" aria-hidden>
              {checked && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">{w.nickname}</span>
              <span className="font-mono text-xs text-muted-foreground">{w.secondaryAddress || shortAddress(w.address)}</span>
              <span className="text-xs text-muted-foreground">Rede {NETWORKS[w.network].label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CheckoutPage() {
  usePageTitle('Pagamento')
  const { user } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const scope = useCartScope()
  const cart = useCart()
  const wallets = useWallets()
  const orders = useOrders()
  const userId = user!.id

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: readDraft(userId) ?? formFromWallet(null, user),
  })
  const values = form.watch()
  const quote = useQuote(values.network)
  const selectedWallet = (values.useSecondary ? wallets.data?.secondary : wallets.data?.primary) ?? null

  const [formOpenMobile, setFormOpenMobile] = useState(false)
  const [showCoupon, setShowCoupon] = useState(false)
  const [connection, setConnection] = useState<WalletConnection | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [review, setReview] = useState<ReviewState>(CLOSED)
  const reviewRef = useRef(review)
  reviewRef.current = review
  const [attemptNo, setAttemptNo] = useState(1)
  const [pendingAttempt, setPendingAttempt] = useState<CheckoutAttempt | null>(() => readPendingAttempt(userId))

  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const createOrder = useCreateOrder({ onAttempt: setAttemptNo })

  // Preenche com a carteira principal quando não há rascunho salvo.
  const initialized = useRef(!!readDraft(userId))
  useEffect(() => {
    if (initialized.current || !wallets.data) return
    initialized.current = true
    form.reset(formFromWallet(wallets.data.primary, user))
  }, [wallets.data, form, user])

  // Rascunho persistido (retomada após expiração de sessão/refresh).
  useEffect(() => {
    const sub = form.watch((v) => writeDraft(userId, v as CheckoutForm))
    return () => sub.unsubscribe()
  }, [form, userId])

  // Mudou carteira, rede ou provedor: a conexão anterior deixa de valer.
  useEffect(() => {
    if (connection && (connection.network !== values.network || connection.provider !== values.provider || connection.walletId !== selectedWallet?.id)) {
      setConnection(null)
      announce('Carteira desconectada: a rede ou a carteira selecionada mudou.')
    }
  }, [connection, values.network, values.provider, selectedWallet?.id])

  const toggleSecondary = (useSecondary: boolean) => {
    const wallet = (useSecondary ? wallets.data?.secondary : wallets.data?.primary) ?? null
    const current = form.getValues()
    form.reset(formFromWallet(wallet, user, { ...current, useSecondary }), { keepDirty: false })
  }

  const doDisconnect = () => {
    if (!connection) return
    disconnect.mutate(connection.id)
    setConnection(null)
    announce('Carteira desconectada')
  }

  const buyerFrom = (v: CheckoutForm) => ({
    displayName: v.displayName,
    username: v.username,
    profileName: v.profileName,
    email: v.email,
    ensName: v.ensName,
    ensSuffix: v.ensSuffix,
    referralCode: v.referralCode,
    secondaryAddress: v.secondaryAddress || undefined,
    note: v.note || undefined,
  })

  const openReview = form.handleSubmit(
    async (v) => {
      if (!selectedWallet || !quote.data) return
      if (!quote.data.valid) {
        announce('Revise os itens do carrinho antes de continuar.', 'assertive')
        return
      }
      setConnectError(null)
      let conn = connection
      if (!conn) {
        try {
          conn = await connect.mutateAsync({ walletId: selectedWallet.id, provider: v.provider, network: v.network })
          setConnection(conn)
          announce(`Carteira ${WALLET_PROVIDERS[v.provider].label} conectada`)
        } catch (error) {
          const message = toApiError(error).message
          setConnectError(message)
          announce(message, 'assertive')
          return
        }
      }
      setReview({ open: true, quote: quote.data, previousTotal: null, stage: 'review', error: null })
    },
    () => {
      setFormOpenMobile(true)
      announce('Corrija os campos destacados no formulário.', 'assertive')
    },
  )

  // Trava síncrona contra cliques repetidos (o estado do React só atualiza no próximo render).
  const inFlight = useRef(false)
  const confirm = async () => {
    const current = reviewRef.current
    if (inFlight.current || !current.quote || !connection || !selectedWallet || createOrder.isPending) return
    inFlight.current = true
    try {
      await runConfirm(current)
    } finally {
      inFlight.current = false
    }
  }

  const runConfirm = async (current: ReviewState) => {
    if (!current.quote || !connection || !selectedWallet) return
    const v = form.getValues()
    setReview((r) => ({ ...r, stage: 'revalidating', error: null }))

    // 1) Revalida preço, disponibilidade, cupom e taxas com o servidor.
    let fresh: Quote
    try {
      fresh = await quoteApi.create(v.network)
      queryClient.setQueryData(queryKeys.quote(scope, cart.data?.version ?? -1, v.network), fresh)
    } catch (error) {
      setReview((r) => ({ ...r, stage: 'review', error: toApiError(error).message }))
      return
    }
    if (fresh.fingerprint !== current.quote.fingerprint || !fresh.valid) {
      setReview((r) => ({ ...r, quote: fresh, previousTotal: current.quote!.total, stage: fresh.valid ? 'changed' : 'blocked' }))
      return
    }

    // 2) Envia com chave de idempotência (recupera o mesmo pedido em novas tentativas).
    setAttemptNo(1)
    setReview((r) => ({ ...r, quote: fresh, stage: 'submitting' }))
    // Aguarda o fim da mutation para manter a trava ativa durante todo o envio.
    await new Promise<void>((settled) =>
      createOrder.mutate(
      {
        quoteId: fresh.id,
        quoteFingerprint: fresh.fingerprint,
        walletId: selectedWallet.id,
        connectionId: connection.id,
        provider: v.provider,
        network: v.network,
        buyer: buyerFrom(v),
      },
      {
        onSuccess: (order) => {
          removeKey(STORAGE_KEYS.checkoutDraft, 'session')
          setReview(CLOSED)
          void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id }, replace: true })
        },
        onError: (error) => {
          const apiError = toApiError(error)
          const details = quoteSchema.safeParse((apiError.details as { quote?: unknown } | undefined)?.quote)
          if (details.success) {
            void queryClient.invalidateQueries({ queryKey: ['cart'] })
            void queryClient.invalidateQueries({ queryKey: ['quote'] })
            setReview((r) => ({
              ...r,
              quote: details.data,
              previousTotal: fresh.total,
              stage: details.data.valid ? 'changed' : 'blocked',
              error: apiError.message,
            }))
            return
          }
          if (apiError.fieldErrors.connectionId) {
            setConnection(null)
            setReview(CLOSED)
            setConnectError(apiError.message)
            return
          }
          setPendingAttempt(readPendingAttempt(userId))
          setReview((r) => ({
            ...r,
            stage: 'review',
            error: apiError.isTransient ? `${apiError.message} Você pode tentar novamente com segurança: o pedido não será duplicado.` : apiError.message,
          }))
        },
        onSettled: () => settled(),
      },
      ),
    )
  }

  const resumeAttempt = () => {
    if (!pendingAttempt) return
    createOrder.mutate(pendingAttempt.input, {
      onSuccess: (order) => void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id }, replace: true }),
      onError: (error) => {
        announce(toApiError(error).message, 'assertive')
        setPendingAttempt(readPendingAttempt(userId))
      },
    })
  }

  const liveQuoteChanged = review.open && review.stage === 'review' && !!quote.data && !!review.quote && quote.data.fingerprint !== review.quote.fingerprint
  const pendingOrder = orders.data?.items.find((o) => o.status === 'pending')
  const noWallet = wallets.data && !wallets.data.primary
  const cartEmpty = cart.data && cart.data.items.length === 0

  if (cart.error && !cart.data) {
    return (
      <div className="container-page py-16">
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} retrying={cart.isRefetching} />
      </div>
    )
  }

  return (
    <div className="container-page pb-10">
      <MobilePageHeader title="Pagamento com carteira" />
      <nav aria-label="Trilha" className="mt-7 hidden text-[15px] font-semibold md:block">
        <ol className="flex gap-2">
          <li>
            <Link to="/" className="hover:text-primary">
              Início
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/carrinho" className="hover:text-primary">
              Mercado
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">Pagamento</li>
        </ol>
      </nav>
      <h1 className="sr-only">Pagamento</h1>

      <div className="mt-4 flex flex-col gap-3">
        {pendingAttempt && (
          <Alert variant="warning">
            <Clock aria-hidden />
            <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
              <p>Um envio de pedido anterior não foi concluído (conexão interrompida). Retome para recuperar o mesmo pedido, sem cobrança duplicada.</p>
              <span className="flex gap-2">
                <Button size="sm" onClick={resumeAttempt} loading={createOrder.isPending}>
                  Retomar envio
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clearPendingAttempt()
                    setPendingAttempt(null)
                  }}
                >
                  Descartar
                </Button>
              </span>
            </div>
          </Alert>
        )}
        {pendingOrder && (
          <Alert variant="default" role="status">
            <Clock aria-hidden />
            <p className="flex-1">
              O pedido {pendingOrder.number} está aguardando confirmação da rede.{' '}
              <Link to="/pedidos/$orderId" params={{ orderId: pendingOrder.id }} className="text-primary underline">
                Acompanhar pedido
              </Link>
            </p>
          </Alert>
        )}
        <RealtimeNotices />
      </div>

      {cartEmpty ? (
        <EmptyState
          className="mt-6"
          title="Seu carrinho está vazio"
          description="Adicione NFTs ao carrinho para finalizar uma compra."
          action={
            <Button asChild>
              <Link to="/mercado">Explorar o mercado</Link>
            </Button>
          }
        />
      ) : (
        <form onSubmit={openReview} noValidate className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,1fr)_340px] lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between">
          {/* Coluna do formulário */}
          <section aria-labelledby="buyer-title" className="order-2 md:order-1">
            {noWallet ? (
              <Alert variant="warning">
                <WalletIcon aria-hidden />
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                  <p>Cadastre uma carteira para receber seus NFTs e finalizar o pagamento.</p>
                  <Button asChild size="sm">
                    <Link to="/conta/carteiras" search={{ redirect: '/pagamento' }}>
                      Cadastrar carteira
                    </Link>
                  </Button>
                </div>
              </Alert>
            ) : (
              <>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between rounded-2xl bg-card px-4 py-3 text-left md:hidden"
                  aria-expanded={formOpenMobile}
                  aria-controls="buyer-fields"
                  onClick={() => setFormOpenMobile((o) => !o)}
                >
                  <span>
                    <span id="buyer-title-mobile" className="block font-semibold">
                      Perfil do colecionador
                    </span>
                    <span className="text-xs text-muted-foreground">Preenchido a partir da carteira selecionada</span>
                  </span>
                  <ChevronDown className={cn('size-5 text-primary transition-transform', formOpenMobile && 'rotate-180')} aria-hidden />
                </button>
                <h2 id="buyer-title" className="mb-4 hidden text-lg font-semibold md:block">
                  Perfil do colecionador
                </h2>
                <div id="buyer-fields" className={cn('mt-4 md:mt-0 md:block', !formOpenMobile && 'hidden')}>
                  <CheckoutFields form={form} hasSecondary={!!wallets.data?.secondary} onToggleSecondary={toggleSecondary} />
                </div>
              </>
            )}
          </section>

          {/* Coluna de resumo */}
          <aside aria-label="Resumo do pedido" className="order-1 flex flex-col gap-4 md:order-2">
            {wallets.data && (wallets.data.primary || wallets.data.secondary) && (
              <section aria-labelledby="connected-title" className="flex flex-col gap-3 md:hidden">
                <div className="flex items-center justify-between">
                  <h2 id="connected-title" className="font-bold">
                    Carteira conectada
                  </h2>
                  <Link to="/conta/carteiras" className="text-sm font-semibold text-primary">
                    Trocar carteira
                  </Link>
                </div>
                <WalletCards primary={wallets.data.primary} secondary={wallets.data.secondary} useSecondary={values.useSecondary} onChange={toggleSecondary} />
              </section>
            )}

            <section aria-labelledby="nfts-title" className="hidden md:block">
              <h2 id="nfts-title" className="text-lg font-semibold">
                Seus NFTs
              </h2>
              <div className="mt-2 flex justify-between border-b border-border pb-1 text-[15px] font-semibold" aria-hidden>
                <span>NFTs</span>
                <span>Subtotal</span>
              </div>
              <OrderLines lines={quote.data?.items} loading={quote.isPending} caption="Itens do pedido" />
            </section>

            {cart.data && (
              <div className="hidden md:block">
                {showCoupon || cart.data.coupon ? (
                  <CouponForm cart={cart.data} />
                ) : (
                  <button type="button" onClick={() => setShowCoupon(true)} className="w-full cursor-pointer text-center text-[15px] hover:text-primary">
                    Tem um código promocional? <span className="text-primary">Aplique aqui</span>
                  </button>
                )}
              </div>
            )}

            {quote.error ? (
              <ErrorState error={quote.error} title="Não foi possível calcular os valores" onRetry={() => void quote.refetch()} retrying={quote.isRefetching} className="py-4" />
            ) : (
              <div className="hidden md:block">
                <QuoteTotals quote={quote.data} loading={quote.isPending} />
              </div>
            )}

            <section aria-labelledby="provider-title" className="flex flex-col gap-3">
              <h2 id="provider-title" className="font-bold md:text-center md:text-lg">
                Carteira e rede
              </h2>
              <ProviderOptions value={values.provider} onChange={(p) => form.setValue('provider', p, { shouldDirty: true })} />
              <p className="text-xs text-muted-foreground">
                Rede selecionada: <strong className="text-foreground">{NETWORKS[values.network].label}</strong> (altere em “Rede”)
              </p>
              {connection ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-success/60 bg-success/10 px-3 py-2 text-xs" role="status">
                  <span className="flex items-center gap-2">
                    <Link2 className="size-4 text-success" aria-hidden />
                    Conectado: {WALLET_PROVIDERS[connection.provider].label} · {shortAddress(connection.address)}
                  </span>
                  <Button type="button" size="sm" variant="ghost" onClick={doDisconnect}>
                    <Link2Off aria-hidden /> Desconectar
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-subtle">A carteira será conectada (simulação) ao confirmar a compra.</p>
              )}
              {connectError && (
                <Alert variant="destructive">
                  <AlertTriangle aria-hidden />
                  <p>{connectError}</p>
                </Alert>
              )}
            </section>

            {quote.data && !quote.data.valid && (
              <ul role="alert" className="flex flex-col gap-1 text-xs text-destructive">
                {quote.data.issues
                  .filter((i) => i.type !== 'PRICE_CHANGED' && i.type !== 'COUPON_EXPIRED')
                  .map((i, idx) => (
                    <li key={idx}>{i.message}</li>
                  ))}
                <li>
                  <Link to="/carrinho" className="underline">
                    Ajustar no carrinho
                  </Link>
                </li>
              </ul>
            )}

            <div className="flex items-center justify-between text-lg font-bold md:hidden">
              <span>Total:</span>
              <span className="text-primary">{quote.data ? formatEth(quote.data.total) : '—'}</span>
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-[60px] rounded-2xl bg-gradient-to-r from-[#e0a06a] to-primary text-base font-semibold md:h-[45px] md:rounded-md md:bg-none md:bg-primary"
              loading={connect.isPending}
              disabled={!quote.data?.valid || !!noWallet || !selectedWallet || quote.isFetching}
              data-testid="checkout-submit"
            >
              {connect.isPending ? `Conectando à ${WALLET_PROVIDERS[values.provider].label}…` : 'Confirmar compra'}
            </Button>
          </aside>
        </form>
      )}

      <ReviewDialog
        open={review.open}
        onOpenChange={(open) => setReview((r) => (open ? r : CLOSED))}
        quote={review.quote}
        previousTotal={review.previousTotal}
        stage={review.stage}
        values={values}
        connection={connection}
        attempt={attemptNo}
        error={review.error}
        onConfirm={() => void confirm()}
        liveQuoteChanged={liveQuoteChanged}
        onRefreshReview={() => setReview((r) => ({ ...r, quote: quote.data ?? r.quote, previousTotal: r.quote?.total ?? null, stage: 'changed' }))}
      />
    </div>
  )
}

import { useId, useState, type FormEvent } from 'react'
import { Tag, X } from 'lucide-react'
import type { Cart, Quote } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { formatEth, isZeroEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useCoupon } from './hooks'

/** Campo de cupom (aplicar/remover) com erros de validação associados ao input. */
export function CouponForm({ cart, variant = 'desktop' }: { cart: Cart; variant?: 'desktop' | 'mobile' | 'inline' }) {
  const [code, setCode] = useState('')
  const { apply, remove } = useCoupon()
  const id = useId()
  const error = apply.error ? (toApiError(apply.error).fieldErrors.code ?? toApiError(apply.error).message) : null

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-sm border border-primary/60 bg-accent px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          <Tag className="size-4 text-primary" aria-hidden />
          <span>
            Cupom <strong className="text-primary">{cart.coupon.code}</strong> aplicado
            <span className="block text-xs text-muted-foreground">{cart.coupon.label}</span>
          </span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => remove.mutate()} loading={remove.isPending} aria-label={`Remover cupom ${cart.coupon.code}`}>
          <X aria-hidden /> Remover
        </Button>
      </div>
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    apply.mutate(code.trim(), { onSuccess: () => setCode('') })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={id} className={cn('text-[13px] font-semibold', variant === 'mobile' && 'sr-only')}>
        Código promocional
      </label>
      <div className={cn('flex', variant === 'mobile' && 'rounded-full border border-border bg-background p-1')}>
        <input
          id={id}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            if (apply.isError) apply.reset()
          }}
          placeholder="Digite o código promocional..."
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          maxLength={20}
          autoComplete="off"
          className={cn(
            'h-10 min-w-0 flex-1 bg-background px-2 text-xs placeholder:text-subtle focus-visible:outline-none',
            variant === 'mobile' ? 'rounded-full px-4 text-sm' : 'rounded-l-sm border border-primary focus-visible:ring-1 focus-visible:ring-primary',
            error && 'border-destructive',
          )}
        />
        <Button
          type="submit"
          loading={apply.isPending}
          className={cn('h-10 font-semibold', variant === 'mobile' ? 'h-12 rounded-full bg-gradient-to-r from-[#e0a06a] to-primary px-5 text-base' : 'w-[102px] rounded-l-none rounded-r-sm text-base')}
        >
          Aplicar
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="sr-only">
          Cupons de teste: KURIO10 e GENESIS5.
        </p>
      )}
    </form>
  )
}

/** Resumo com os valores da COTAÇÃO do servidor (fonte de verdade dos totais). */
export function QuoteTotals({ quote, loading, className, compact }: { quote: Quote | undefined; loading?: boolean; className?: string; compact?: boolean }) {
  if (!quote || loading) {
    return (
      <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-label="Calculando valores">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <dl className={cn('flex flex-col gap-3 text-[15px]', compact && 'gap-2 text-sm', className)} data-testid="quote-totals">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="text-lg tabular-nums" data-testid="quote-subtotal">
          {formatEth(quote.subtotal)}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt>{quote.coupon ? quote.coupon.label : 'Desconto do lançamento'}</dt>
        <dd className="tabular-nums" data-testid="quote-discount">
          (-) {isZeroEth(quote.discount) ? '0.00' : formatEth(quote.discount, { suffix: false })}
        </dd>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-between">
          <dt>Taxa de rede</dt>
          <dd className="text-lg tabular-nums" data-testid="quote-fee">
            {formatEth(quote.networkFee)}
          </dd>
        </div>
        <p className="text-right text-xs text-primary">Taxa estimada</p>
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-4 font-bold">
        <dt>Total</dt>
        <dd className="text-lg text-primary tabular-nums" data-testid="quote-total">
          {formatEth(quote.total)}
        </dd>
      </div>
    </dl>
  )
}

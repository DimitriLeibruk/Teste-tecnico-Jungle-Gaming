import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Seletor de quantidade inteira com limites e rótulos acessíveis. */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  size = 'md',
  className,
}: {
  value: number
  min?: number
  max: number
  onChange: (next: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const btn = cn(
    'inline-flex cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted disabled:text-subtle',
    size === 'md' ? 'h-10 w-[30px] rounded-[15px]' : 'h-6 w-[18px] rounded-[9px]',
  )
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center', size === 'md' ? 'gap-4' : 'gap-3', className)}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label={`Diminuir quantidade de ${label}`}>
        <Minus className={size === 'md' ? 'size-5' : 'size-3'} strokeWidth={2.5} aria-hidden />
      </button>
      <output aria-live="polite" aria-label={`Quantidade: ${value}`} className={cn('min-w-4 text-center tabular-nums', size === 'md' ? 'text-base' : 'text-sm')}>
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label={`Aumentar quantidade de ${label}`}>
        <Plus className={size === 'md' ? 'size-5' : 'size-3'} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  )
}

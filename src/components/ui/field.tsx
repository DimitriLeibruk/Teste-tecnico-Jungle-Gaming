import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FieldContextValue {
  id: string
  errorId: string
  hintId: string
  invalid: boolean
  hasHint: boolean
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

/**
 * Campo de formulário acessível: liga label, dica e mensagem de erro ao
 * controle via id/aria-describedby/aria-invalid.
 */
export function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
  labelClassName,
  hideLabel,
}: {
  label: React.ReactNode
  required?: boolean
  error?: string
  hint?: React.ReactNode
  className?: string
  labelClassName?: string
  hideLabel?: boolean
  children: React.ReactNode
}) {
  const id = React.useId()
  const ctx: FieldContextValue = { id, errorId: `${id}-error`, hintId: `${id}-hint`, invalid: !!error, hasHint: !!hint }
  return (
    <FieldContext value={ctx}>
      <div className={cn('flex flex-col gap-2', className)}>
        <Label htmlFor={id} className={cn(hideLabel && 'sr-only', labelClassName)}>
          {label}
          {required && (
            <>
              <span aria-hidden className="text-lg leading-none text-destructive">
                *
              </span>
              <span className="sr-only">(obrigatório)</span>
            </>
          )}
        </Label>
        {children}
        {hint && !error && (
          <p id={ctx.hintId} className="text-xs text-subtle">
            {hint}
          </p>
        )}
        {error && (
          <p id={ctx.errorId} className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </FieldContext>
  )
}

/** Props de acessibilidade para o controle dentro de <Field>. */
export function useFieldControl() {
  const ctx = React.useContext(FieldContext)
  if (!ctx) return {}
  const describedBy = [ctx.invalid ? ctx.errorId : null, ctx.hasHint && !ctx.invalid ? ctx.hintId : null].filter(Boolean).join(' ')
  return {
    id: ctx.id,
    'aria-invalid': ctx.invalid || undefined,
    'aria-describedby': describedBy || undefined,
  }
}

/** Wrapper que injeta as props de acessibilidade no filho. */
export function FieldControl({ children }: { children: React.ReactElement<Record<string, unknown>> }) {
  const props = useFieldControl()
  return React.cloneElement(children, { ...props, ...children.props, id: props.id })
}

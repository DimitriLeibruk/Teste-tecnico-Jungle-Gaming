import * as React from 'react'
import { Separator as SeparatorPrimitive } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** Skeleton com shimmer (classe .skeleton em index.css). Oculto de leitores de tela. */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden className={cn('skeleton', className)} {...props} />
}

export function Separator({ className, orientation = 'horizontal', decorative = true, ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  )
}

const badgeVariants = cva('inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      outline: 'border border-primary text-primary',
      muted: 'bg-muted text-muted-foreground',
      danger: 'border border-destructive text-destructive',
      success: 'border border-success text-success',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

const alertVariants = cva('relative flex w-full gap-3 rounded-md border px-4 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0', {
  variants: {
    variant: {
      default: 'border-border bg-card text-foreground',
      warning: 'border-primary/60 bg-accent text-foreground [&>svg]:text-primary',
      destructive: 'border-destructive/70 bg-destructive/10 text-foreground [&>svg]:text-destructive',
      success: 'border-success/60 bg-success/10 text-foreground [&>svg]:text-success',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Alert({ className, variant, role = 'alert', ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role={role} className={cn(alertVariants({ variant }), className)} {...props} />
}

export function AlertTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('font-semibold', className)} {...props} />
}

export function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('text-muted-foreground [&_p]:leading-relaxed', className)} {...props} />
}

import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-36 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm placeholder:text-subtle',
        'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }

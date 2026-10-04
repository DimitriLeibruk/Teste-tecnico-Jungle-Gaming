import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** Toasts (sonner) com a identidade Kurio; anunciados por leitores de tela. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      closeButton
      duration={5000}
      containerAriaLabel="Notificações"
      toastOptions={{
        classNames: {
          toast: '!bg-card !text-foreground !border !border-border !font-sans !rounded-md',
          description: '!text-muted-foreground',
          success: '!border-success/60',
          error: '!border-destructive/70',
          warning: '!border-primary/70',
          closeButton: '!bg-card !border-border !text-foreground',
        },
      }}
      {...props}
    />
  )
}

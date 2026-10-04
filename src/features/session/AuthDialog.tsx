import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { authDialog, useAuthDialog, type AuthDialogMode } from './auth-dialog-store'
import { LoginForm, RegisterForm } from './AuthForms'

/** Modal "Entrar | Criar conta" (frames Login/Cadastro desktop). Mantém o usuário na página atual. */
export function AuthDialog() {
  const { mode, reason } = useAuthDialog()
  const close = () => authDialog.close()

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-[500px] px-6 pt-12 pb-12 sm:px-20" aria-describedby="auth-dialog-desc">
        <AuthTabs mode={mode ?? 'login'} onChange={(m) => authDialog.switch(m)} />
        <DialogTitle className="sr-only">{mode === 'register' ? 'Criar conta' : 'Entrar'}</DialogTitle>
        <DialogDescription id="auth-dialog-desc" className="mt-6 mb-6 text-center text-xs text-foreground">
          {mode === 'register'
            ? 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'
            : 'Entre para gerenciar sua carteira, coleção e perfil de criador.'}
        </DialogDescription>
        {mode === 'register' ? <RegisterForm onSuccess={close} /> : <LoginForm onSuccess={close} notice={reason} />}
      </DialogContent>
    </Dialog>
  )
}

export function AuthTabs({ mode, onChange }: { mode: AuthDialogMode; onChange: (mode: AuthDialogMode) => void }) {
  const tab = (value: AuthDialogMode, label: string) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={mode === value}
      className={cn('cursor-pointer text-xl tracking-wide transition-colors', mode === value ? 'text-primary' : 'text-foreground hover:text-primary')}
    >
      {label}
    </button>
  )
  return (
    <div className="flex items-center justify-center gap-2" role="group" aria-label="Escolha entre entrar ou criar conta">
      {tab('login', 'Entrar')}
      <span aria-hidden className="h-6 w-px bg-primary" />
      {tab('register', 'Criar conta')}
    </div>
  )
}

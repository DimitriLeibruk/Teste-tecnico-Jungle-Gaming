import { useState } from 'react'
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { loginInputSchema, registerFormSchema, type LoginInput, type RegisterForm } from '@/api/contracts'
import { authApi } from '@/api/endpoints'
import { toApiError, type ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Field, FieldControl } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'
import { PasswordInput } from '@/components/password-input'
import { announce } from '@/components/live-announcer'
import { completeLogin } from './session-actions'

/** Aplica erros por campo vindos da API (422/409) no formulário. */
export function applyServerErrors<T extends FieldValues>(error: ApiError, setError: UseFormSetError<T>, fields: readonly string[]) {
  let applied = false
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if (fields.includes(field)) {
      setError(field as Path<T>, { type: 'server', message }, { shouldFocus: !applied })
      applied = true
    }
  }
  return applied
}

function SocialButtons() {
  return (
    <div className="flex flex-col gap-3">
      <div className="my-1 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span className="text-xs text-foreground">Ou continue com</span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
      {[
        {
          label: 'Continuar com Google',
          icon: (
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z" />
            </svg>
          ),
        },
        {
          label: 'Continuar com Facebook',
          icon: (
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path fill="#3b5999" d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6Z" />
            </svg>
          ),
        },
      ].map((b) => (
        <button
          key={b.label}
          type="button"
          aria-disabled="true"
          aria-describedby="social-unavailable"
          className="flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-sm border border-input text-xs text-muted-foreground opacity-80"
        >
          {b.icon}
          {b.label}
        </button>
      ))}
      <p id="social-unavailable" className="text-center text-[11px] text-subtle">
        Login social indisponível nesta demonstração.
      </p>
    </div>
  )
}

export function LoginForm({ onSuccess, notice }: { onSuccess: () => void; notice?: string | null }) {
  const [formError, setFormError] = useState<string | null>(null)
  const [forgotInfo, setForgotInfo] = useState(false)
  const form = useForm<LoginInput>({ resolver: zodResolver(loginInputSchema), defaultValues: { email: '', password: '' } })
  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (res) => {
      await completeLogin(res)
      announce(`Bem-vindo de volta, ${res.user.displayName}`)
      onSuccess()
    },
    onError: (error) => {
      const apiError = toApiError(error)
      if (!applyServerErrors(apiError, form.setError, ['email', 'password'])) setFormError(apiError.message)
      form.setFocus('email')
    },
  })
  const { errors } = form.formState

  return (
    <form
      noValidate
      aria-label="Entrar"
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
      className="flex flex-col gap-3"
    >
      {notice && (
        <Alert variant="warning" role="status">
          <AlertCircle aria-hidden />
          <p>{notice}</p>
        </Alert>
      )}
      {formError && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <p>{formError}</p>
        </Alert>
      )}
      <Field label="E-mail" hideLabel error={errors.email?.message}>
        <FieldControl>
          <Input type="email" autoComplete="email" placeholder="contato@email.com" {...form.register('email')} />
        </FieldControl>
      </Field>
      <Field label="Senha" hideLabel error={errors.password?.message}>
        <FieldControl>
          <PasswordInput autoComplete="current-password" placeholder="Senha" {...form.register('password')} />
        </FieldControl>
      </Field>
      <div className="flex flex-col items-end gap-1">
        <button type="button" onClick={() => setForgotInfo(true)} className="cursor-pointer text-xs text-primary hover:underline">
          Esqueceu a senha?
        </button>
        {forgotInfo && (
          <p role="status" className="text-right text-xs text-muted-foreground">
            A recuperação de senha não faz parte desta demonstração. Use as credenciais do README.
          </p>
        )}
      </div>
      <Button type="submit" size="lg" className="mt-3 h-11 rounded-md text-sm font-semibold" loading={mutation.isPending}>
        Entrar
      </Button>
      <SocialButtons />
    </form>
  )
}

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const mutation = useMutation({
    mutationFn: (values: RegisterForm) => authApi.register({ username: values.username, email: values.email, password: values.password }),
    onSuccess: async (res) => {
      await completeLogin(res)
      announce(`Conta criada. Bem-vindo, ${res.user.username}`)
      onSuccess()
    },
    onError: (error) => {
      const apiError = toApiError(error)
      if (!applyServerErrors(apiError, form.setError, ['username', 'email', 'password'])) setFormError(apiError.message)
    },
  })
  const { errors } = form.formState

  return (
    <form
      noValidate
      aria-label="Criar conta"
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
      className="flex flex-col gap-3"
    >
      {formError && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <p>{formError}</p>
        </Alert>
      )}
      <Field label="Nome de usuário" hideLabel error={errors.username?.message}>
        <FieldControl>
          <Input autoComplete="username" placeholder="Nome de usuário" {...form.register('username')} />
        </FieldControl>
      </Field>
      <Field label="E-mail" hideLabel error={errors.email?.message}>
        <FieldControl>
          <Input type="email" autoComplete="email" placeholder="Digite seu e-mail" {...form.register('email')} />
        </FieldControl>
      </Field>
      <Field label="Senha" hideLabel error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números.">
        <FieldControl>
          <PasswordInput autoComplete="new-password" placeholder="Senha" {...form.register('password')} />
        </FieldControl>
      </Field>
      <Field label="Confirmar senha" hideLabel error={errors.confirmPassword?.message}>
        <FieldControl>
          <PasswordInput autoComplete="new-password" placeholder="Confirmar senha" {...form.register('confirmPassword')} />
        </FieldControl>
      </Field>
      <Button type="submit" size="lg" className="mt-4 h-11 rounded-md text-sm font-semibold" loading={mutation.isPending}>
        Criar conta
      </Button>
      <SocialButtons />
    </form>
  )
}

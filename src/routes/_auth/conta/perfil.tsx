import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AlertCircle, ImageIcon } from 'lucide-react'
import { ENS_SUFFIXES, passwordChangeFormSchema, profileUpdateInputSchema, type PasswordChangeForm, type ProfileUpdateInput } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Field, FieldControl } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, Skeleton } from '@/components/ui/misc'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PasswordInput } from '@/components/password-input'
import { ErrorState } from '@/components/states'
import { announce } from '@/components/live-announcer'
import { useChangePassword, useProfile, useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/features/account/hooks'
import { resizeAvatar, validateAvatar } from '@/features/account/avatar'
import { applyServerErrors } from '@/features/session/AuthForms'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/_auth/conta/perfil')({
  component: ProfilePage,
})

function AvatarField() {
  const { data: user } = useProfile()
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const problem = validateAvatar(file)
    if (problem) {
      setError(problem)
      announce(problem, 'assertive')
      return
    }
    setError(null)
    const blob = await resizeAvatar(file)
    upload.mutate(
      { file: blob, name: file.name.replace(/\.\w+$/, '.webp') },
      {
        onSuccess: () => {
          toast.success('Avatar atualizado')
          announce('Avatar atualizado')
        },
        onError: (e) => setError(toApiError(e).fieldErrors.avatar ?? toApiError(e).message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span id="avatar-label" className="text-sm">
        Avatar
      </span>
      <div className="flex items-center gap-6">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="Seu avatar atual" width={50} height={50} className="size-[50px] rounded-full border border-border object-cover" />
        ) : (
          <span className="flex size-[50px] items-center justify-center rounded-full border border-border bg-accent text-primary" aria-label="Sem avatar">
            <ImageIcon className="size-6" aria-hidden />
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          id="avatar-input"
          aria-labelledby="avatar-label"
          aria-describedby={error ? 'avatar-error' : 'avatar-hint'}
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <Button type="button" className="h-10 w-[98px] rounded-sm font-semibold" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
          Alterar
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!user?.avatarUrl}
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(undefined, {
              onSuccess: () => {
                toast.success('Avatar removido')
                announce('Avatar removido')
              },
              onError: (e) => setError(toApiError(e).message),
            })
          }
        >
          Remover
        </Button>
      </div>
      {error ? (
        <p id="avatar-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p id="avatar-hint" className="text-xs text-subtle">
          PNG, JPG ou WebP até 2 MB.
        </p>
      )}
    </div>
  )
}

function ProfilePage() {
  usePageTitle('Meu perfil')
  const { data: user, isPending, error, refetch, isRefetching } = useProfile()
  const update = useUpdateProfile()
  const changePassword = useChangePassword()
  const [formError, setFormError] = useState<string | null>(null)

  const profileForm = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateInputSchema),
    defaultValues: { displayName: '', username: '', email: '', ensName: '', ensSuffix: '.eth', walletNickname: '' },
  })
  const passwordForm = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  useEffect(() => {
    if (!user) return
    profileForm.reset({
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      ensName: user.ensName ?? '',
      ensSuffix: user.ensSuffix,
      walletNickname: user.walletNickname ?? '',
    })
  }, [user, profileForm])

  const saving = update.isPending || changePassword.isPending

  /** Um único "Salvar" (como no layout): salva o perfil e, se preenchida, a nova senha. */
  const onSave = async () => {
    setFormError(null)
    const wantsPassword = Object.values(passwordForm.getValues()).some(Boolean)
    const profileOk = await profileForm.trigger()
    const passwordOk = wantsPassword ? await passwordForm.trigger() : true
    if (!profileOk || !passwordOk) {
      announce('Corrija os campos destacados.', 'assertive')
      const firstError = Object.keys(profileForm.formState.errors)[0] as keyof ProfileUpdateInput | undefined
      if (firstError) profileForm.setFocus(firstError)
      else if (wantsPassword) passwordForm.setFocus(Object.keys(passwordForm.formState.errors)[0] as keyof PasswordChangeForm)
      return
    }
    const messages: string[] = []
    // Compara com os dados atuais (formState.isDirty lido fora do render pode estar desatualizado).
    const values = profileForm.getValues()
    const changed =
      !!user &&
      (values.displayName !== user.displayName ||
        values.username !== user.username ||
        values.email !== user.email ||
        values.ensName !== (user.ensName ?? '') ||
        values.ensSuffix !== user.ensSuffix ||
        values.walletNickname !== (user.walletNickname ?? ''))
    if (changed) {
      try {
        const saved = await update.mutateAsync(profileForm.getValues())
        profileForm.reset({ ...profileForm.getValues(), ensName: saved.ensName ?? '', walletNickname: saved.walletNickname ?? '' })
        messages.push('Perfil atualizado')
      } catch (e) {
        const apiError = toApiError(e)
        if (!applyServerErrors(apiError, profileForm.setError, Object.keys(profileUpdateInputSchema.shape))) setFormError(apiError.message)
        announce(apiError.message, 'assertive')
        return
      }
    }
    if (wantsPassword) {
      try {
        const { currentPassword, newPassword } = passwordForm.getValues()
        await changePassword.mutateAsync({ currentPassword, newPassword })
        passwordForm.reset()
        messages.push('Senha alterada')
      } catch (e) {
        const apiError = toApiError(e)
        if (!applyServerErrors(apiError, passwordForm.setError, ['currentPassword', 'newPassword'])) setFormError(apiError.message)
        announce(apiError.message, 'assertive')
        return
      }
    }
    const message = messages.length ? `${messages.join(' e ')} com sucesso.` : 'Nenhuma alteração para salvar.'
    toast.success(message)
    announce(message)
  }

  if (error && !user) return <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />

  const pe = profileForm.formState.errors
  const we = passwordForm.formState.errors

  return (
    <section aria-labelledby="profile-title" className="pb-8">
      <h1 id="profile-title" className="mb-6 text-[15px] font-semibold">
        Perfil do colecionador
      </h1>
      {formError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle aria-hidden />
          <p>{formError}</p>
        </Alert>
      )}
      {isPending ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2" aria-busy="true" aria-label="Carregando perfil">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void onSave()
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-7 gap-y-6 md:grid-cols-2">
            <Field label="Nome de exibição" required error={pe.displayName?.message}>
              <FieldControl>
                <Input autoComplete="name" {...profileForm.register('displayName')} />
              </FieldControl>
            </Field>
            <Field label="Nome de usuário" required error={pe.username?.message}>
              <FieldControl>
                <Input autoComplete="username" {...profileForm.register('username')} />
              </FieldControl>
            </Field>
            <Field label="E-mail" required error={pe.email?.message}>
              <FieldControl>
                <Input type="email" autoComplete="email" {...profileForm.register('email')} />
              </FieldControl>
            </Field>
            <Field label="Nome ENS" required error={pe.ensName?.message}>
              <div className="flex gap-2.5">
                <Controller
                  control={profileForm.control}
                  name="ensSuffix"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-[110px] shrink-0" aria-label="Sufixo ENS">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ENS_SUFFIXES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldControl>
                  <Input placeholder="nome" {...profileForm.register('ensName')} />
                </FieldControl>
              </div>
            </Field>
            <Field label="Apelido da carteira" required error={pe.walletNickname?.message}>
              <FieldControl>
                <Input {...profileForm.register('walletNickname')} />
              </FieldControl>
            </Field>
            <AvatarField />
          </div>

          <fieldset className="mt-10 grid max-w-[417px] gap-5">
            <legend className="mb-5 text-[15px] font-semibold">Alterar senha</legend>
            <Field label="Senha atual" error={we.currentPassword?.message}>
              <FieldControl>
                <PasswordInput autoComplete="current-password" {...passwordForm.register('currentPassword')} />
              </FieldControl>
            </Field>
            <Field label="Nova senha" error={we.newPassword?.message} hint="Mínimo de 8 caracteres, com letras e números.">
              <FieldControl>
                <PasswordInput autoComplete="new-password" {...passwordForm.register('newPassword')} />
              </FieldControl>
            </Field>
            <Field label="Confirmar nova senha" error={we.confirmPassword?.message}>
              <FieldControl>
                <PasswordInput autoComplete="new-password" {...passwordForm.register('confirmPassword')} />
              </FieldControl>
            </Field>
          </fieldset>

          <Button type="submit" className="mt-8 h-10 w-[131px] rounded-sm font-semibold" loading={saving}>
            Salvar
          </Button>
        </form>
      )}
    </section>
  )
}

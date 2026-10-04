import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import {
  ENS_SUFFIXES,
  NETWORKS,
  WALLET_PROVIDERS,
  walletFieldsSchema,
  walletInputSchema,
  type NetworkId,
  type User,
  type Wallet,
  type WalletInput,
  type WalletProvider,
  type WalletSlot,
} from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Field, FieldControl, useFieldControl } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { announce } from '@/components/live-announcer'
import { applyServerErrors } from '@/features/session/AuthForms'
import { useSaveWallet } from './hooks'

function SelectControl({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode }) {
  const a11y = useFieldControl()
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger {...a11y}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}

export function emptyWallet(user: User | null): WalletInput {
  return {
    displayName: user?.displayName ?? '',
    nickname: '',
    network: 'ethereum',
    profileName: '',
    address: '',
    secondaryAddress: '',
    provider: 'metamask',
    referralCode: '',
    email: user?.email ?? '',
    ensName: user?.ensName ?? '',
    ensSuffix: user?.ensSuffix ?? '.eth',
  }
}

export function walletToInput(wallet: Wallet): WalletInput {
  return {
    displayName: wallet.displayName,
    nickname: wallet.nickname,
    network: wallet.network,
    profileName: wallet.profileName,
    address: wallet.address,
    secondaryAddress: wallet.secondaryAddress ?? '',
    provider: wallet.provider,
    referralCode: wallet.referralCode,
    email: wallet.email,
    ensName: wallet.ensName,
    ensSuffix: wallet.ensSuffix,
  }
}

/** Formulário de carteira (frame "Carteiras"): validação local + erros da API por campo. */
export function WalletForm({ slot, initial, onSaved, submitLabel }: { slot: WalletSlot; initial: WalletInput; onSaved?: () => void; submitLabel: string }) {
  const save = useSaveWallet()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<WalletInput>({ resolver: zodResolver(walletInputSchema), defaultValues: initial })
  const e = form.formState.errors

  useEffect(() => {
    form.reset(initial)
  }, [initial, form])

  const onSubmit = form.handleSubmit(
    (values) => {
      setFormError(null)
      save.mutate(
        { slot, input: values },
        {
          onSuccess: () => {
            const message = slot === 'primary' ? 'Carteira principal salva' : 'Carteira secundária salva'
            toast.success(message)
            announce(message)
            onSaved?.()
          },
          onError: (error) => {
            const apiError = toApiError(error)
            if (!applyServerErrors(apiError, form.setError, Object.keys(walletFieldsSchema.shape))) setFormError(apiError.message)
            announce(apiError.message, 'assertive')
          },
        },
      )
    },
    () => announce('Corrija os campos destacados.', 'assertive'),
  )

  return (
    <form noValidate onSubmit={onSubmit} aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'}>
      {formError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle aria-hidden />
          <p>{formError}</p>
        </Alert>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-7 gap-y-6 md:grid-cols-2">
        <Field label="Nome de exibição" required error={e.displayName?.message}>
          <FieldControl>
            <Input {...form.register('displayName')} />
          </FieldControl>
        </Field>
        <Field label="Apelido da carteira" required error={e.nickname?.message}>
          <FieldControl>
            <Input {...form.register('nickname')} />
          </FieldControl>
        </Field>
        <Field label="Rede" required error={e.network?.message}>
          <Controller
            control={form.control}
            name="network"
            render={({ field }) => (
              <SelectControl value={field.value} onChange={(v) => field.onChange(v as NetworkId)} placeholder="Selecione uma rede">
                {(Object.keys(NETWORKS) as NetworkId[]).map((n) => (
                  <SelectItem key={n} value={n}>
                    {NETWORKS[n].label}
                  </SelectItem>
                ))}
              </SelectControl>
            )}
          />
        </Field>
        <Field label="Nome do perfil" required error={e.profileName?.message}>
          <FieldControl>
            <Input {...form.register('profileName')} />
          </FieldControl>
        </Field>
        <Field label="Endereço da carteira" required error={e.address?.message}>
          <FieldControl>
            <Input placeholder="Endereço 0x da carteira" className="font-mono text-xs" spellCheck={false} autoComplete="off" {...form.register('address')} />
          </FieldControl>
        </Field>
        <Field label="ENS ou carteira secundária (opcional)" error={e.secondaryAddress?.message} labelClassName="md:invisible">
          <FieldControl>
            <Input placeholder="ENS ou carteira secundária (opcional)" {...form.register('secondaryAddress')} />
          </FieldControl>
        </Field>
        <Field label="Tipo de carteira" required error={e.provider?.message}>
          <Controller
            control={form.control}
            name="provider"
            render={({ field }) => (
              <SelectControl value={field.value} onChange={(v) => field.onChange(v as WalletProvider)} placeholder="Selecione uma carteira">
                {(Object.keys(WALLET_PROVIDERS) as WalletProvider[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {WALLET_PROVIDERS[p].label}
                  </SelectItem>
                ))}
              </SelectControl>
            )}
          />
        </Field>
        <Field label="Código de indicação" required error={e.referralCode?.message}>
          <FieldControl>
            <Input autoCapitalize="characters" {...form.register('referralCode')} />
          </FieldControl>
        </Field>
        <Field label="E-mail" required error={e.email?.message}>
          <FieldControl>
            <Input type="email" autoComplete="email" {...form.register('email')} />
          </FieldControl>
        </Field>
        <Field label="Nome ENS" required error={e.ensName?.message}>
          <div className="flex gap-2.5">
            <Controller
              control={form.control}
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
              <Input placeholder="nome" {...form.register('ensName')} />
            </FieldControl>
          </div>
        </Field>
      </div>
      <Button type="submit" className="mt-8 h-10 rounded-sm px-4 font-semibold" loading={save.isPending}>
        {submitLabel}
      </Button>
    </form>
  )
}

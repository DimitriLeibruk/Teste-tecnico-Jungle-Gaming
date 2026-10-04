import { Controller, type UseFormReturn } from 'react-hook-form'
import { ENS_SUFFIXES, NETWORKS, WALLET_PROVIDERS, type NetworkId, type WalletProvider } from '@/api/contracts'
import { Field, FieldControl } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFieldControl } from '@/components/ui/field'
import type { CheckoutForm } from './schema'

function SelectControl({ value, onChange, placeholder, children, onBlur }: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode; onBlur?: () => void }) {
  const a11y = useFieldControl()
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger {...a11y} onBlur={onBlur}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}

/** Campos do "Perfil do colecionador" (frame Pagamento), em grade de duas colunas. */
export function CheckoutFields({ form, hasSecondary, onToggleSecondary }: { form: UseFormReturn<CheckoutForm>; hasSecondary: boolean; onToggleSecondary: (value: boolean) => void }) {
  const { register, control, formState } = form
  const e = formState.errors
  const useSecondary = form.watch('useSecondary')

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-5 md:grid-cols-2">
      <Field label="Nome de exibição" required error={e.displayName?.message}>
        <FieldControl>
          <Input autoComplete="name" {...register('displayName')} />
        </FieldControl>
      </Field>
      <Field label="Nome de usuário" required error={e.username?.message}>
        <FieldControl>
          <Input autoComplete="username" {...register('username')} />
        </FieldControl>
      </Field>

      <Field label="Rede" required error={e.network?.message}>
        <Controller
          control={control}
          name="network"
          render={({ field }) => (
            <SelectControl value={field.value} onChange={(v) => field.onChange(v as NetworkId)} placeholder="Selecione uma rede" onBlur={field.onBlur}>
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
          <Input {...register('profileName')} />
        </FieldControl>
      </Field>

      <Field label="Endereço da carteira" required error={e.address?.message} hint="Endereço da carteira cadastrada selecionada.">
        <FieldControl>
          <Input readOnly aria-readonly placeholder="Endereço 0x da carteira" className="font-mono text-xs text-muted-foreground" {...register('address')} />
        </FieldControl>
      </Field>
      <Field label="ENS ou carteira secundária (opcional)" error={e.secondaryAddress?.message} labelClassName="md:invisible">
        <FieldControl>
          <Input placeholder="ENS ou carteira secundária (opcional)" {...register('secondaryAddress')} />
        </FieldControl>
      </Field>

      <Field label="Tipo de carteira" required error={e.provider?.message}>
        <Controller
          control={control}
          name="provider"
          render={({ field }) => (
            <SelectControl value={field.value} onChange={(v) => field.onChange(v as WalletProvider)} placeholder="Selecione uma carteira" onBlur={field.onBlur}>
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
          <Input autoCapitalize="characters" {...register('referralCode')} />
        </FieldControl>
      </Field>

      <Field label="E-mail" required error={e.email?.message}>
        <FieldControl>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FieldControl>
      </Field>
      <Field label="Nome ENS" required error={e.ensName?.message}>
        <div className="flex gap-2">
          <Controller
            control={control}
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
            <Input placeholder="nome" {...register('ensName')} />
          </FieldControl>
        </div>
      </Field>

      <div className="flex flex-col gap-2 md:col-span-2">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
          <input
            type="checkbox"
            checked={useSecondary}
            disabled={!hasSecondary}
            onChange={(ev) => onToggleSecondary(ev.target.checked)}
            className="size-4 cursor-pointer appearance-none rounded-full border border-primary checked:border-4 checked:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          Usar outra carteira?
        </label>
        {!hasSecondary && <p className="text-xs text-subtle">Cadastre uma carteira secundária em Carteiras para usá-la aqui.</p>}
      </div>

      <Field label="Observação do colecionador (opcional)" error={e.note?.message} className="md:col-span-1">
        <FieldControl>
          <Textarea rows={6} maxLength={280} {...register('note')} />
        </FieldControl>
      </Field>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { Checkbox } from '@/components/ui/controls'
import { Skeleton } from '@/components/ui/misc'
import { ErrorState } from '@/components/states'
import { emptyWallet, WalletForm, walletToInput } from '@/features/account/WalletForm'
import { useWallets } from '@/features/account/hooks'
import { safeRedirect } from '@/features/session/redirect'
import { useSession } from '@/features/session/session-store'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/_auth/conta/carteiras')({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  component: WalletsPage,
})

function WalletsPage() {
  usePageTitle('Carteiras')
  const { user } = useSession()
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  const { data, isPending, error, refetch, isRefetching } = useWallets()
  const [addingPrimary, setAddingPrimary] = useState(false)
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  const primary = data?.primary ?? null
  const secondary = data?.secondary ?? null
  const primaryInitial = useMemo(() => (primary ? walletToInput(primary) : emptyWallet(user)), [primary, user])
  const secondaryInitial = useMemo(() => {
    if (sameAsPrimary && primary) return { ...walletToInput(primary), nickname: `${primary.nickname} (cópia)` }
    return secondary ? walletToInput(secondary) : emptyWallet(user)
  }, [sameAsPrimary, primary, secondary, user])

  const afterPrimarySave = () => {
    setAddingPrimary(false)
    if (redirect) void navigate({ to: safeRedirect(redirect) })
  }

  if (error && !data) return <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />

  const showPrimaryForm = !!data?.primary || addingPrimary
  const showSecondaryForm = !!data?.secondary || addingSecondary

  return (
    <div className="flex flex-col gap-10 pb-8">
      <section aria-labelledby="primary-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 id="primary-title" className="text-[15px] font-semibold">
              Carteira principal
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!showPrimaryForm && (
            <button type="button" onClick={() => setAddingPrimary(true)} className="cursor-pointer text-base font-semibold text-primary hover:underline">
              Adicionar
            </button>
          )}
        </div>
        <div className="mt-6">
          {isPending ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2" aria-busy="true" aria-label="Carregando carteiras">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : showPrimaryForm ? (
            <WalletForm slot="primary" initial={primaryInitial} onSaved={afterPrimarySave} submitLabel="Salvar carteira" />
          ) : (
            <p className="text-xs text-muted-foreground">Você ainda não adicionou uma carteira principal.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="secondary-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="secondary-title" className="text-[15px] font-semibold">
              Carteira secundária
            </h2>
            {!showSecondaryForm && <p className="mt-1 text-xs text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={sameAsPrimary}
                onCheckedChange={(v) => {
                  setSameAsPrimary(v === true)
                  if (v === true) setAddingSecondary(true)
                }}
                disabled={!data?.primary}
                className="rounded-full"
              />
              Igual à carteira principal
            </label>
            {!showSecondaryForm && (
              <button
                type="button"
                onClick={() => setAddingSecondary(true)}
                disabled={!data?.primary}
                className="cursor-pointer text-base font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Adicionar
              </button>
            )}
          </div>
        </div>
        {!data?.primary && !isPending && <p className="mt-2 text-xs text-subtle">Cadastre a carteira principal antes da secundária.</p>}
        {showSecondaryForm && data?.primary && (
          <div className="mt-6">
            <WalletForm slot="secondary" initial={secondaryInitial} onSaved={() => setAddingSecondary(false)} submitLabel="Salvar carteira secundária" />
          </div>
        )}
      </section>
    </div>
  )
}

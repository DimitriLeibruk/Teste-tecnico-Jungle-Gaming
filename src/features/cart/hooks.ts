import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AddCartItemInput, Cart, NetworkId } from '@/api/contracts'
import { cartApi, quoteApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { announce } from '@/components/live-announcer'
import { cartScope, useSession } from '@/features/session/session-store'
import { getGuestCartId } from './guest-cart'

export function useCartScope() {
  const session = useSession()
  return cartScope(session, getGuestCartId())
}

/** Carrinho do visitante ou do usuário (escopo isolado por chave). */
export function useCart() {
  const scope = useCartScope()
  const { status } = useSession()
  return useQuery({
    queryKey: queryKeys.cart(scope),
    queryFn: ({ signal }) => cartApi.get({ signal }),
    enabled: status !== 'restoring',
    staleTime: 10_000,
  })
}

function useCartMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<Cart>,
  messages: { success?: (vars: TVars, cart: Cart) => string; errorPrefix: string },
) {
  const queryClient = useQueryClient()
  const scope = useCartScope()
  return useMutation({
    mutationFn,
    onSuccess: (cart, vars) => {
      queryClient.setQueryData(queryKeys.cart(scope), cart)
      void queryClient.invalidateQueries({ queryKey: ['quote', scope] })
      const message = messages.success?.(vars, cart)
      if (message) announce(message)
    },
    onError: (error) => {
      const apiError = toApiError(error)
      toast.error(`${messages.errorPrefix}: ${apiError.message}`)
      announce(`${messages.errorPrefix}: ${apiError.message}`, 'assertive')
      // Conflito de disponibilidade: atualiza carrinho e catálogo com o estado real.
      if (apiError.code === 'AVAILABILITY_CONFLICT' || apiError.code === 'NOT_FOUND') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cart(scope) })
        void queryClient.invalidateQueries({ queryKey: ['nfts'] })
      }
    },
  })
}

export function useAddToCart() {
  return useCartMutation((input: AddCartItemInput & { name: string }) => cartApi.addItem({ nftId: input.nftId, editionId: input.editionId, quantity: input.quantity }), {
    success: (vars) => `${vars.name} adicionado ao carrinho`,
    errorPrefix: 'Não foi possível adicionar ao carrinho',
  })
}

export function useUpdateCartItem() {
  return useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number; name: string }) => cartApi.updateItem(itemId, quantity), {
    success: (vars) => `Quantidade de ${vars.name} atualizada para ${vars.quantity}`,
    errorPrefix: 'Não foi possível alterar a quantidade',
  })
}

export function useRemoveCartItem() {
  return useCartMutation(({ itemId }: { itemId: string; name: string }) => cartApi.removeItem(itemId), {
    success: (vars) => `${vars.name} removido do carrinho`,
    errorPrefix: 'Não foi possível remover o item',
  })
}

export function useAcknowledgePrices() {
  return useCartMutation(() => cartApi.acknowledgePrices(), {
    success: () => 'Novos preços aceitos',
    errorPrefix: 'Não foi possível atualizar os preços',
  })
}

/** Cupom: erros de validação (inválido/expirado) são exibidos no campo, não em toast. */
export function useCoupon() {
  const queryClient = useQueryClient()
  const scope = useCartScope()
  const onSuccess = (cart: Cart) => {
    queryClient.setQueryData(queryKeys.cart(scope), cart)
    void queryClient.invalidateQueries({ queryKey: ['quote', scope] })
  }
  const apply = useMutation({
    mutationFn: (code: string) => cartApi.applyCoupon(code),
    onSuccess: (cart) => {
      onSuccess(cart)
      announce(`Cupom ${cart.coupon?.code} aplicado`)
    },
  })
  const remove = useMutation({
    mutationFn: () => cartApi.removeCoupon(),
    onSuccess: (cart) => {
      onSuccess(cart)
      announce('Cupom removido')
    },
    onError: (error) => toast.error(toApiError(error).message),
  })
  return { apply, remove }
}

/**
 * Cotação do servidor para o carrinho atual. A chave inclui a versão do
 * carrinho: qualquer alteração (inclusive vinda de eventos) gera nova cotação.
 */
export function useQuote(network: NetworkId, { enabled = true }: { enabled?: boolean } = {}) {
  const scope = useCartScope()
  const { data: cart } = useCart()
  return useQuery({
    queryKey: queryKeys.quote(scope, cart?.version ?? -1, network),
    queryFn: ({ signal }) => quoteApi.create(network, { signal }),
    enabled: enabled && !!cart && cart.items.length > 0,
    staleTime: 60_000,
    refetchInterval: 4 * 60_000,
  })
}

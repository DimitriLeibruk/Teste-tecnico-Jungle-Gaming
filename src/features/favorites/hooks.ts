import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { favoritesApi, type FavoritesResponse } from '@/api/endpoints'
import { errorMessage } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { announce } from '@/components/live-announcer'
import { useSession } from '@/features/session/session-store'
import { authDialog } from '@/features/session/auth-dialog-store'

export function useFavorites() {
  const { status, user } = useSession()
  return useQuery({
    queryKey: queryKeys.favorites(user?.id ?? 'anonymous'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: status === 'authenticated' && !!user,
    staleTime: 60_000,
  })
}

export function useIsFavorite(nftId: string) {
  const { data } = useFavorites()
  return data?.ids.includes(nftId) ?? false
}

/**
 * Favoritar com ATUALIZAÇÃO OTIMISTA:
 * o coração muda na hora; se a API falhar, o estado anterior é restaurado
 * (rollback) e o usuário é avisado.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const { status, user } = useSession()

  const mutation = useMutation({
    mutationKey: ['favorites', 'toggle'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      const key = queryKeys.favorites(user!.id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      queryClient.setQueryData<FavoritesResponse>(key, (old) => {
        const base = old ?? { ids: [], items: [] }
        return favorite
          ? { ...base, ids: base.ids.includes(nftId) ? base.ids : [nftId, ...base.ids] }
          : { ids: base.ids.filter((id) => id !== nftId), items: base.items.filter((i) => i.id !== nftId) }
      })
      return { previous, key }
    },
    onError: (error, { name, favorite }, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
      const message = `Não foi possível ${favorite ? 'favoritar' : 'remover dos favoritos'} ${name}. ${errorMessage(error)}`
      toast.error(message)
      announce(message, 'assertive')
    },
    onSuccess: (data, { name, favorite }, context) => {
      // Só aplica a resposta se não houver outra alteração de favoritos em andamento.
      if (queryClient.isMutating({ mutationKey: ['favorites', 'toggle'] }) <= 1) queryClient.setQueryData(context.key, data)
      announce(favorite ? `${name} adicionado aos favoritos` : `${name} removido dos favoritos`)
    },
    onSettled: (_data, _error, _vars, context) => {
      if (context && queryClient.isMutating({ mutationKey: ['favorites', 'toggle'] }) <= 1) {
        void queryClient.invalidateQueries({ queryKey: context.key })
      }
    },
  })

  return {
    ...mutation,
    toggle(nftId: string, name: string, currentlyFavorite: boolean) {
      if (status !== 'authenticated' || !user) {
        authDialog.open('login', 'Entre na sua conta para salvar favoritos.')
        return
      }
      mutation.mutate({ nftId, favorite: !currentlyFavorite, name })
    },
  }
}

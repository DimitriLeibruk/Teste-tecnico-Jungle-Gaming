import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PasswordChangeInput, ProfileUpdateInput, User, WalletInput, WalletSlot } from '@/api/contracts'
import { profileApi, walletsApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { sessionStore, useSession } from '@/features/session/session-store'

export function useProfile() {
  const { user } = useSession()
  return useQuery({
    queryKey: queryKeys.profile(user?.id ?? 'anonymous'),
    queryFn: ({ signal }) => profileApi.get({ signal }),
    enabled: !!user,
    staleTime: 60_000,
  })
}

function useProfileMutation<TVars>(mutationFn: (vars: TVars) => Promise<User>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.profile(user.id), user)
      sessionStore.updateUser(user)
    },
  })
}

export function useUpdateProfile() {
  return useProfileMutation((input: ProfileUpdateInput) => profileApi.update(input))
}

export function useUploadAvatar() {
  return useProfileMutation(({ file, name }: { file: Blob; name: string }) => profileApi.uploadAvatar(file, name))
}

export function useRemoveAvatar() {
  return useProfileMutation(() => profileApi.removeAvatar())
}

export function useChangePassword() {
  return useMutation({ mutationFn: (input: PasswordChangeInput) => profileApi.changePassword(input) })
}

export function useWallets() {
  const { user } = useSession()
  return useQuery({
    queryKey: queryKeys.wallets(user?.id ?? 'anonymous'),
    queryFn: ({ signal }) => walletsApi.list({ signal }),
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useSaveWallet() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  return useMutation({
    mutationFn: ({ slot, input }: { slot: WalletSlot; input: WalletInput }) => walletsApi.save(slot, input),
    onSuccess: (wallets) => {
      if (user) queryClient.setQueryData(queryKeys.wallets(user.id), wallets)
    },
  })
}

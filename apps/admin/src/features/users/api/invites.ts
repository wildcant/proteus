import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { acceptInvite, createInvite, deleteInvite, listInvites, resendInvite } from '#/api/generated/invites/invites'
import type {
  AcceptInviteBody,
  AdminAcceptInviteResponse,
  AdminInviteResponse,
  CreateInviteBody,
  DeleteResponse,
  ListInvitesParams,
} from '#/api/generated/model'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const inviteKeys = queryKeysFactory<'invites', ListInvitesParams>('invites')

export const invitesListQueryOptions = (params?: ListInvitesParams) =>
  queryOptions({
    queryKey: inviteKeys.list(params),
    queryFn: () => listInvites(params),
    placeholderData: keepPreviousData,
  })

export const useInvites = (params?: ListInvitesParams) => useQuery(invitesListQueryOptions(params))

export const useCreateInvite = (options?: UseMutationOptions<AdminInviteResponse, Error, CreateInviteBody>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: CreateInviteBody) => createInvite(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: inviteKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to send invite', description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteInvite = (id: string, options?: UseMutationOptions<DeleteResponse, Error, void>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => deleteInvite(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: inviteKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to delete invite', description: error.message })
      onError?.(...args)
    },
  })
}

export const useResendInvite = (id: string, options?: UseMutationOptions<AdminInviteResponse, Error, void>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => resendInvite(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: inviteKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to resend invite', description: error.message })
      onError?.(...args)
    },
  })
}

export const useAcceptInvite = (options?: UseMutationOptions<AdminAcceptInviteResponse, Error, AcceptInviteBody>) => {
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AcceptInviteBody) => acceptInvite(data),
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to accept invite', description: error.message })
      onError?.(...args)
    },
  })
}

import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { queryOptions, useMutation } from '@tanstack/react-query'
import type { AdminUserRolesResponse } from '#/api/generated/model'
import { listRoles } from '#/api/generated/roles/roles'
import { listUserRoles, replaceUserRoles } from '#/api/generated/users/users'
import { userKeys } from '#/features/users/api/users'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const userRoleKeys = queryKeysFactory<'userRoles'>('userRoles')
const roleKeys = queryKeysFactory<'roles'>('roles')

export const userRolesQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: userRoleKeys.detail(userId),
    queryFn: () => listUserRoles(userId),
  })

export const rolesListQueryOptions = () =>
  queryOptions({
    queryKey: roleKeys.list(),
    queryFn: () => listRoles(),
  })

export const useReplaceUserRoles = (
  userId: string,
  options?: UseMutationOptions<AdminUserRolesResponse, Error, string[]>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (roleIds: string[]) => replaceUserRoles(userId, { roleIds }),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: userRoleKeys.detail(userId) })
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update roles', description: error.message })
      onError?.(...args)
    },
  })
}

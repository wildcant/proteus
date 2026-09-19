import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import type {
  AdminCreateRole,
  AdminRoleDetailResponse,
  AdminRoleResponse,
  AdminUpdateRole,
  DeleteResponse,
} from '#/api/generated/model'
import { createRole, deleteRole, getRole, listRoles, updateRole } from '#/api/generated/roles/roles'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const roleKeys = queryKeysFactory<'roles'>('roles')

export const rolesListQueryOptions = () =>
  queryOptions({
    queryKey: roleKeys.list(),
    queryFn: () => listRoles(),
  })

export const roleQueryOptions = (id: string) =>
  queryOptions({
    queryKey: roleKeys.detail(id),
    queryFn: () => getRole(id),
  })

export const useRoles = () => useQuery(rolesListQueryOptions())

export const useCreateRole = (options?: UseMutationOptions<AdminRoleResponse, Error, AdminCreateRole>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateRole) => createRole(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create role', description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateRole = (
  id: string,
  options?: UseMutationOptions<AdminRoleDetailResponse, Error, AdminUpdateRole>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateRole) => updateRole(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() })
      queryClient.invalidateQueries({ queryKey: roleKeys.detail(id) })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update role', description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteRole = (options?: UseMutationOptions<DeleteResponse, Error, string>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to delete role', description: error.message })
      onError?.(...args)
    },
  })
}

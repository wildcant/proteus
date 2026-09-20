import { queryOptions, useQuery } from '@tanstack/react-query'
import { listPermissions } from '#/api/generated/permissions/permissions'
import { queryKeysFactory } from '#/lib/query-key-factory'

const permissionKeys = queryKeysFactory<'permissions'>('permissions')

export const permissionsListQueryOptions = () =>
  queryOptions({
    queryKey: permissionKeys.list(),
    queryFn: () => listPermissions(),
  })

export const usePermissions = () => useQuery(permissionsListQueryOptions())

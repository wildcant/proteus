import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { ListUsersParams } from '#/api/generated/model'
import { listUsers } from '#/api/generated/users/users'
import { queryKeysFactory } from '#/lib/query-key-factory'

const userKeys = queryKeysFactory<'users', ListUsersParams>('users')

const usersListQueryOptions = (params?: ListUsersParams) =>
  queryOptions({
    queryKey: userKeys.list(params),
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  })

export const useUsers = (params?: ListUsersParams) => useQuery(usersListQueryOptions(params))

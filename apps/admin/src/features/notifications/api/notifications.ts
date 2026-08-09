import { keepPreviousData, queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { ListNotificationsParams } from '#/api/generated/model'
import { listNotifications } from '#/api/generated/notifications/notifications'
import { queryKeysFactory } from '#/lib/query-key-factory'

const notificationKeys = queryKeysFactory<'notifications', ListNotificationsParams>('notifications')

export const notificationsListQueryOptions = (params?: ListNotificationsParams) =>
  queryOptions({
    queryKey: notificationKeys.list(params),
    queryFn: () => listNotifications(params),
    placeholderData: keepPreviousData,
  })

export const useNotifications = (params?: ListNotificationsParams) => useQuery(notificationsListQueryOptions(params))

export const useInfiniteNotifications = (
  params: Omit<ListNotificationsParams, 'offset'> | undefined,
  options?: { enabled?: boolean },
) =>
  useInfiniteQuery({
    queryKey: notificationKeys.list(params),
    queryFn: ({ pageParam }) => listNotifications({ ...params, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit
      return nextOffset < lastPage.count ? nextOffset : undefined
    },
    enabled: options?.enabled,
  })

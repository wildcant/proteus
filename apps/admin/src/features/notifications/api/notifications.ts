import { infiniteQueryOptions, keepPreviousData, queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query'
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

type NotificationsInfiniteQueryOptions = { enabled?: boolean }

/**
 * Shared query config for the notification drawer, which pages by offset rather than by page.
 *
 * The key is the same one `notificationsListQueryOptions` uses on purpose: the drawer and the
 * badge count read one cache entry, so opening the drawer cannot show a list the badge disagrees
 * with.
 */
export const notificationsInfiniteQueryOptions = (
  params?: Omit<ListNotificationsParams, 'offset'>,
  options?: NotificationsInfiniteQueryOptions,
) =>
  infiniteQueryOptions({
    queryKey: notificationKeys.list(params),
    queryFn: ({ pageParam }) => listNotifications({ ...params, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit
      return nextOffset < lastPage.count ? nextOffset : undefined
    },
    ...options,
  })

export const useInfiniteNotifications = (
  params?: Omit<ListNotificationsParams, 'offset'>,
  options?: NotificationsInfiniteQueryOptions,
) => useInfiniteQuery(notificationsInfiniteQueryOptions(params, options))

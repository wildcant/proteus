import { Skeleton } from '@proteus/ui'
import { useCallback, useEffect, useRef } from 'react'
import { useInfiniteNotifications } from '#/features/notifications/api/notifications'
import { NotificationItem } from './notification-item'

export function NotificationList({ userId, userEmail }: { userId: string; userEmail: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteNotifications({
    channel: 'feed',
    to: [userId, userEmail],
    limit: 20,
    order: '-createdAt',
  })

  const sentinelRef = useRef<HTMLDivElement>(null)

  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0]
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(observerCallback, { threshold: 0.1 })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [observerCallback])

  const notifications = data?.pages.flatMap((page) => page.notifications) ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 5 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          <Skeleton key={index} className="h-16 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">No notifications yet</div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
      <div ref={sentinelRef} className="h-px" />
      {isFetchingNextPage ? (
        <div className="flex justify-center p-4">
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ) : null}
    </div>
  )
}

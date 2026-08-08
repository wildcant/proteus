import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@proteus/ui'
import { useQueryClient } from '@tanstack/react-query'
import { BellIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMe } from '#/features/auth/api/auth'
import { useInfiniteNotifications } from '#/features/notifications/api/notifications'
import { NotificationList } from './notification-list'

const LAST_READ_KEY = 'notificationsLastReadAt'
const POLL_INTERVAL = 60_000

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { user } = useMe()
  const queryClient = useQueryClient()

  const { data: latestPage } = useInfiniteNotifications(
    user ? { channel: 'feed', to: [user.id, user.email], limit: 1, order: '-createdAt' } : undefined,
    { enabled: !!user },
  )

  const latestNotification = latestPage?.pages[0]?.notifications[0]
  const lastReadAt = localStorage.getItem(LAST_READ_KEY)
  const hasUnread = latestNotification
    ? !lastReadAt || new Date(latestNotification.createdAt) > new Date(lastReadAt)
    : false

  // Poll for new notifications
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [user, queryClient])

  // Keyboard shortcut
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault()
        setOpen((previous) => !previous)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      localStorage.setItem(LAST_READ_KEY, new Date().toISOString())
    }
    setOpen(nextOpen)
  }

  if (!user) return null

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <button
        type="button"
        onClick={() => handleOpen(true)}
        className="relative flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      >
        <BellIcon className="size-4" />
        {hasUnread ? <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-primary" /> : null}
      </button>
      <SheetContent side="right" className="flex flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <NotificationList userId={user.id} userEmail={user.email} />
      </SheetContent>
    </Sheet>
  )
}

import { formatRelativeTime } from '@proteus/utils'
import { DownloadIcon } from 'lucide-react'
import type { AdminNotification } from '#/api/generated/model'

export function NotificationItem({ notification }: { notification: AdminNotification }) {
  const data = notification.data as Record<string, unknown> | null
  const title = (data?.title as string) ?? notification.template ?? 'Notification'
  const description = data?.description as string | undefined
  const file = data?.file as string | undefined

  return (
    <div className="border-b px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(notification.createdAt)}</span>
      </div>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      {file ? (
        <a href={file} download className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <DownloadIcon className="size-3" />
          Download file
        </a>
      ) : null}
    </div>
  )
}

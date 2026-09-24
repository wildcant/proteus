import { Trans, useLingui } from '@lingui/react/macro'
import { formatRelativeTime } from '@proteus/utils'
import { Link } from '@tanstack/react-router'
import { DownloadIcon } from 'lucide-react'
import type { AdminNotification } from '#/api/generated/model'
import { dateLocale } from '#/lib/i18n/locale'

export function NotificationItem({ notification }: { notification: AdminNotification }) {
  const { t } = useLingui()
  const data = notification.data as Record<string, unknown> | null
  const title = (data?.title as string) ?? notification.template ?? t`Notification`
  const description = data?.description as string | undefined
  const file = data?.file as string | undefined
  // The in-app destination the notification is about — the low-stock alert's variant page, so
  // acting on it is one click. Absent on a notification with nothing to open, which is most of them.
  const href = data?.href as string | undefined

  return (
    <div className="border-b px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        {href ? (
          <Link to={href} className="font-medium text-sm hover:underline">
            {title}
          </Link>
        ) : (
          <p className="font-medium text-sm">{title}</p>
        )}
        <span className="shrink-0 text-muted-foreground text-xs">
          {formatRelativeTime(notification.createdAt, dateLocale())}
        </span>
      </div>
      {description ? <p className="mt-0.5 text-muted-foreground text-sm">{description}</p> : null}
      {file ? (
        <a href={file} download className="mt-1 inline-flex items-center gap-1 text-primary text-xs hover:underline">
          <DownloadIcon className="size-3" />
          <Trans>Download file</Trans>
        </a>
      ) : null}
    </div>
  )
}

import type { NotificationChannel } from './common.js'

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export type CreateNotificationDTO = {
  to: string
  channel: NotificationChannel
  from?: string | null
  template?: string | null
  data?: Record<string, unknown> | null
  triggerType?: string | null
  resourceId?: string | null
  resourceType?: string | null
  receiverId?: string | null
  originalNotificationId?: string | null
  idempotencyKey?: string | null
}

// ---------------------------------------------------------------------------
// Provider send input/output
// ---------------------------------------------------------------------------

export type NotificationProviderSendInput = {
  to: string
  channel: NotificationChannel
  from?: string | null
  template?: string | null
  data?: Record<string, unknown> | null
}

export type NotificationProviderSendOutput = {
  externalId?: string
  data?: Record<string, unknown>
}

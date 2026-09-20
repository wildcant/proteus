import type { CreateNotificationDTO } from '@core/types/notification/mutations.js'

/**
 * An operator alert before it knows who it is for: everything a feed row carries except the
 * recipient, plus the key identifying the event that caused it.
 */
export type OperatorAlert = Omit<CreateNotificationDTO, 'to' | 'channel' | 'idempotencyKey'> & {
  idempotencyKey: string
}

/**
 * One alert as a row per operator who should read it.
 *
 * **The recipient belongs in the idempotency key, and that is the whole reason this is a function.**
 * `idx_notification_idempotency_key` is unique, so a fan-out that reuses the event's key writes the
 * first operator's row and silently drops everyone else's as repeats of it. Suffixing per recipient
 * keeps the guarantee the caller wanted — one alert per operator per event, however many times the
 * event is delivered.
 */
export function buildOperatorAlerts(recipients: string[], alert: OperatorAlert): CreateNotificationDTO[] {
  return recipients.map((recipient) => ({
    ...alert,
    to: recipient,
    channel: 'feed',
    idempotencyKey: `${alert.idempotencyKey}:${recipient}`,
  }))
}

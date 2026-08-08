import type { CreateNotificationDTO } from '@core/types/notification/mutations.js'

export function generateCreateNotificationDTO(overrides?: Partial<CreateNotificationDTO>): CreateNotificationDTO {
  return {
    to: 'user@example.com',
    channel: 'feed',
    template: 'order-confirmation',
    data: { orderId: 'order_123' },
    ...overrides,
  }
}

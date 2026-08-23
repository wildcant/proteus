import type { NotificationDTO } from '@core/types/notification/common.js'
import type { CreateNotificationDTO } from '@core/types/notification/mutations.js'
import { faker } from '@faker-js/faker'

export function generateCreateNotificationDTO(overrides?: Partial<CreateNotificationDTO>): CreateNotificationDTO {
  return {
    to: faker.internet.email(),
    channel: 'feed',
    template: 'order-confirmation',
    data: { orderId: 'order_123' },
    ...overrides,
  }
}

export function generateNotificationDTO(overrides?: Partial<NotificationDTO>): NotificationDTO {
  return {
    id: `notif_${faker.string.uuid()}`,
    to: 'user@example.com',
    channel: 'email',
    from: null,
    template: null,
    data: null,
    triggerType: null,
    resourceId: null,
    resourceType: null,
    receiverId: null,
    originalNotificationId: null,
    idempotencyKey: null,
    status: 'success',
    providerId: null,
    providerData: null,
    externalId: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

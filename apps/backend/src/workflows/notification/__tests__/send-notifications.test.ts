import type { CreateNotificationDTO } from '@core/types/notification/mutations.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { test } from '@tests/setup/test-extend.js'
import { sendNotificationsStep } from '../steps/send-notifications.js'

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

test.describe('sendNotificationsStep', () => {
  test('persists the notifications it is given', async ({ dto, service, step, expect }) => {
    const notification = dto.generate.createNotification({ channel: 'feed' })

    const created = await step.run(sendNotificationsStep, { notifications: [notification] })

    expect(created).toHaveLength(1)
    expect(await service.read.notifications(container)).toMatchObject([
      { id: created[0]?.id, to: notification.to, channel: 'feed' },
    ])
  })

  test('has no compensation — rollback leaves the notification sent', async ({ dto, service, step, expect }) => {
    const notification = dto.generate.createNotification({ channel: 'feed' })

    await step.runAndCompensate(sendNotificationsStep, { notifications: [notification] })

    // A sent notification cannot be unsent, so the step registers no compensation.
    expect(await service.read.notifications(container)).toHaveLength(1)
  })

  test('sends every notification in one call', async ({ dto, service, step, expect }) => {
    const notifications: CreateNotificationDTO[] = [
      dto.generate.createNotification({ channel: 'feed' }),
      dto.generate.createNotification({ channel: 'feed' }),
    ]

    await step.run(sendNotificationsStep, { notifications })

    const persisted = await service.read.notifications(container)
    expect(persisted.map((entry) => entry.to).sort()).toEqual(notifications.map((entry) => entry.to).sort())
  })
})

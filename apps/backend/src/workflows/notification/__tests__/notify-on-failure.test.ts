import type { TestContainer } from '@tests/setup/create-container.js'
import { test } from '@tests/setup/test-extend.js'
import { notifyOnFailureStep } from '../steps/notify-on-failure.js'

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

test.describe('notifyOnFailureStep', () => {
  test('sends nothing on the forward path', async ({ dto, service, step, expect }) => {
    await step.run(notifyOnFailureStep, { notifications: [dto.generate.createNotification({ channel: 'feed' })] })

    expect(await service.read.notifications(container)).toEqual([])
  })

  test('sends on rollback', async ({ dto, service, step, expect }) => {
    const notification = dto.generate.createNotification({ channel: 'feed' })

    await step.runAndCompensate(notifyOnFailureStep, { notifications: [notification] })

    expect(await service.read.notifications(container)).toMatchObject([{ to: notification.to }])
  })

  test('rollback preserves the full notification payload', async ({ dto, service, step, expect }) => {
    const notification = dto.generate.createNotification({
      channel: 'feed',
      template: 'workflow-failed',
      data: { workflowName: 'complete-cart', error: 'Payment declined' },
      triggerType: 'workflow-failure',
      resourceId: 'cart_456',
      resourceType: 'cart',
    })

    await step.runAndCompensate(notifyOnFailureStep, { notifications: [notification] })

    expect(await service.read.notifications(container)).toMatchObject([
      {
        to: notification.to,
        template: 'workflow-failed',
        data: { workflowName: 'complete-cart', error: 'Payment declined' },
        triggerType: 'workflow-failure',
        resourceId: 'cart_456',
        resourceType: 'cart',
      },
    ])
  })
})

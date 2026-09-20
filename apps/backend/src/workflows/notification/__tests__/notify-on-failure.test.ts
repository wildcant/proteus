import type { TestContainer } from '@tests/setup/create-container.js'
import { test } from '@tests/setup/test-extend.js'
import { notifyOnFailureStep } from '../steps/notify-on-failure.js'

let container: TestContainer

const alert = {
  template: 'workflow-failed',
  data: { workflowName: 'complete-cart', error: 'Payment declined' },
  triggerType: 'workflow-failure',
  resourceId: 'cart_456',
  resourceType: 'cart',
  idempotencyKey: 'workflow-failed:cart_456',
}

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

test.describe('notifyOnFailureStep', () => {
  test('sends nothing on the forward path', async ({ service, step, expect }) => {
    await service.create.operator(container, ['notification.read', 'order.read'])

    await step.run(notifyOnFailureStep, { features: ['notification.read', 'order.read'], alert })

    expect(await service.read.notifications(container)).toEqual([])
  })

  test('rollback reaches every operator holding the features, with the payload intact', async ({
    service,
    step,
    expect,
  }) => {
    const [first, second] = await Promise.all([
      service.create.operator(container, ['notification.read', 'order.read']),
      // The same audience reached through module wildcards rather than exact keys.
      service.create.operator(container, ['notification.*', 'order.*']),
    ])
    // Holds one half of the pair, so the alert is addressed past them.
    await service.create.operator(container, ['order.read'])

    await step.runAndCompensate(notifyOnFailureStep, { features: ['notification.read', 'order.read'], alert })

    const notifications = await service.read.notifications(container)
    expect(notifications.map((n) => n.to).sort()).toEqual([first.email, second.email].sort())
    expect(notifications[0]).toMatchObject({
      channel: 'feed',
      template: 'workflow-failed',
      data: { workflowName: 'complete-cart', error: 'Payment declined' },
      triggerType: 'workflow-failure',
      resourceId: 'cart_456',
      resourceType: 'cart',
    })
  })
})

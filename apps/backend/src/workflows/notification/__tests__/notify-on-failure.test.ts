import type { CreateNotificationDTO } from '@core/types/notification/mutations.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import { Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { createWorkflow, setWorkflowEngine } from '@core/workflows/types.js'
import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import type { NotifyOnFailureInput } from '../steps/notify-on-failure.js'
import { notifyOnFailureStep } from '../steps/notify-on-failure.js'

function setupWorkflowEngine(notificationService: Partial<INotificationModuleService>) {
  const container = createContainer()
  container.register({ [Modules.NOTIFICATION]: asValue(notificationService) })
  setWorkflowEngine(createSimpleWorkflowEngine(), container)
}

test.describe('notifyOnFailureStep', () => {
  test('main function is a no-op — does not call createNotifications', async ({ expect }) => {
    const createCalls: CreateNotificationDTO[][] = []

    setupWorkflowEngine({
      createNotifications: async (data) => {
        createCalls.push(data)
        return []
      },
    })

    const workflow = createWorkflow<NotifyOnFailureInput, void>('test-no-op', async (ctx, input) => {
      await notifyOnFailureStep(ctx, input)
    })

    await workflow.run({ notifications: [{ to: 'user@example.com', channel: 'email' }] })

    expect(createCalls).toHaveLength(0)
  })

  test('compensation calls createNotifications on workflow rollback', async ({ expect }) => {
    const createCalls: CreateNotificationDTO[][] = []

    setupWorkflowEngine({
      createNotifications: async (data) => {
        createCalls.push(data)
        return []
      },
    })

    const notifications: CreateNotificationDTO[] = [
      { to: 'user@example.com', channel: 'email', template: 'order-failed', data: { orderId: 'ord_123' } },
    ]

    const failingWorkflow = createWorkflow<NotifyOnFailureInput, void>(
      'test-compensation-sends',
      async (ctx, input) => {
        await notifyOnFailureStep(ctx, input)
        await ctx.step('deliberate-failure', async () => {
          throw new Error('deliberate failure')
        })
      },
    )

    await expect(failingWorkflow.run({ notifications })).rejects.toThrow('deliberate failure')

    expect(createCalls).toHaveLength(1)
    expect(createCalls[0]).toEqual(notifications)
  })

  test('compensation preserves full notification payload', async ({ expect }) => {
    const createCalls: CreateNotificationDTO[][] = []

    setupWorkflowEngine({
      createNotifications: async (data) => {
        createCalls.push(data)
        return []
      },
    })

    const notifications: CreateNotificationDTO[] = [
      {
        to: 'admin@example.com',
        channel: 'email',
        template: 'workflow-failed',
        data: { workflowName: 'complete-cart', error: 'Payment declined' },
        triggerType: 'workflow-failure',
        resourceId: 'cart_456',
        resourceType: 'cart',
      },
    ]

    const failingWorkflow = createWorkflow<NotifyOnFailureInput, void>('test-payload-preserved', async (ctx, input) => {
      await notifyOnFailureStep(ctx, input)
      await ctx.step('deliberate-failure', async () => {
        throw new Error('deliberate failure')
      })
    })

    await expect(failingWorkflow.run({ notifications })).rejects.toThrow('deliberate failure')

    expect(createCalls).toHaveLength(1)
    expect(createCalls[0]).toEqual(notifications)
  })
})

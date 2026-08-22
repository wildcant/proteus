import type { NotificationDTO } from '@core/types/notification/common.js'
import type { CreateNotificationDTO } from '@core/types/notification/mutations.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import { Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { createWorkflow, setWorkflowEngine } from '@core/workflows/types.js'
import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import type { SendNotificationsInput } from '../steps/send-notifications.js'
import { sendNotificationsStep } from '../steps/send-notifications.js'

function setupWorkflowEngine(notificationService: Partial<INotificationModuleService>) {
  const container = createContainer()
  container.register({ [Modules.NOTIFICATION]: asValue(notificationService) })
  setWorkflowEngine(createSimpleWorkflowEngine(), container)
}

function makeTestWorkflow(input: SendNotificationsInput) {
  return createWorkflow<SendNotificationsInput, NotificationDTO[]>(
    'test-send-notifications',
    async (ctx, workflowInput) => {
      return sendNotificationsStep(ctx, workflowInput)
    },
  ).run(input)
}

test.describe('sendNotificationsStep', () => {
  test('calls createNotifications with provided data', async ({ dto, expect }) => {
    const expectedNotification = dto.generate.notification()
    const createCalls: CreateNotificationDTO[][] = []

    setupWorkflowEngine({
      createNotifications: async (data) => {
        createCalls.push(data)
        return [expectedNotification]
      },
    })

    const notifications: CreateNotificationDTO[] = [{ to: 'user@example.com', channel: 'email' }]
    const result = await makeTestWorkflow({ notifications })

    expect(createCalls).toHaveLength(1)
    expect(createCalls[0]).toEqual(notifications)
    expect(result).toEqual([expectedNotification])
  })

  test('has no compensation — rollback does not undo notifications', async ({ dto, expect }) => {
    const createCalls: CreateNotificationDTO[][] = []

    setupWorkflowEngine({
      createNotifications: async (data) => {
        createCalls.push(data)
        return [dto.generate.notification()]
      },
    })

    const failingWorkflow = createWorkflow<SendNotificationsInput, void>('test-no-compensation', async (ctx, input) => {
      await sendNotificationsStep(ctx, input)
      await ctx.step('deliberate-failure', async () => {
        throw new Error('deliberate failure')
      })
    })

    await expect(
      failingWorkflow.run({ notifications: [{ to: 'user@example.com', channel: 'email' }] }),
    ).rejects.toThrow('deliberate failure')

    // createNotifications was called once during the step — no compensation call
    expect(createCalls).toHaveLength(1)
  })
})

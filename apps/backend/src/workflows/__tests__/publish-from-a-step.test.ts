import { ErrorTypes } from '@core/errors/app-error.js'
import type { EventBus } from '@core/event-bus/types.js'
import type { Logger } from '@core/types/logger.js'
import { ContainerRegistrationKeys } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { noopLogger } from '../../framework/logger/noop-logger.js'

/**
 * A workflow's final step is where events are published, and the ordering is the whole transactional
 * story: there is no staging store and no `eventGroupId`, because a workflow that fails before its
 * last step simply never runs the emit. This asserts both halves of that — the step publishes, and a
 * workflow that compensates publishes nothing.
 *
 * The workflows here are throwaway, defined in the test the way `tests/setup/run-step.ts` does,
 * because no production workflow publishes yet. It runs under `test:temporal` too, where each step
 * body executes inside an Activity rather than in the caller — so it also says the container a step
 * is handed reaches the bus on both engines.
 */

const logged: string[] = []
const recordingLogger: Logger = {
  ...noopLogger,
  info(message) {
    logged.push(message)
  },
}
const testWithLog = test.extend<Pick<Fixtures, 'logger'>>({
  async logger({ task: _ }, use) {
    await use(recordingLogger)
  },
})

const publishInFinalStep = createWorkflow<{ id: string }, void>('publish-in-final-step', async (ctx, input) => {
  await ctx.step('do-the-work', async () => undefined)
  await ctx.step('publish', async ({ container }) => {
    const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
    await bus.emit('bus.probe', { id: input.id })
  })
})

const failBeforePublishing = createWorkflow<{ id: string }, void>('fail-before-publishing', async (ctx, input) => {
  await ctx.step('do-the-work', async () => {
    throw new WorkflowTerminalError({ type: ErrorTypes.CONFLICT, message: 'the work could not be done' })
  })
  await ctx.step('publish', async ({ container }) => {
    const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
    await bus.emit('bus.probe', { id: input.id })
  })
})

test.describe('publishing from a workflow step', () => {
  testWithLog(
    'reaches the subscriber, through the container the step is handed',
    async ({ createTestContainer, expect }) => {
      logged.length = 0
      await createTestContainer()

      await publishInFinalStep.run({ id: 'ord_step' })

      expect(logged).toContain('[bus-probe] bus.probe:ord_step:bus-probe')
    },
  )

  testWithLog('publishes nothing when an earlier step fails', async ({ createTestContainer, expect }) => {
    logged.length = 0
    await createTestContainer()

    await expect(failBeforePublishing.run({ id: 'ord_rolled_back' })).rejects.toThrow('the work could not be done')

    expect(logged).toEqual([])
  })
})

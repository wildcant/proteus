import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as activities from '../activities.js'
import { TEMPORAL_TASK_QUEUE, WORKFLOWS_PATH } from '../config.js'
import { pingWorkflow } from '../workflows.js'

/**
 * Booting the time-skipping test server downloads its binary on first run and building the
 * workflow bundle is a webpack pass, so the setup budget is minutes, not the default 5 seconds.
 */
const BOOT_TIMEOUT = 180_000

let testEnv: TestWorkflowEnvironment

describe('pingWorkflow', () => {
  beforeAll(async () => {
    // `setup-test-env.ts` turns console.error/warn into thrown errors, and the SDK logs at WARN
    // while the test server starts. Routing its logs to console.info keeps them readable without
    // failing a test for something the SDK considers routine.
    Runtime.install({
      logger: new DefaultLogger('WARN', ({ level, message }) => console.info(`[temporal] ${level} ${message}`)),
    })

    testEnv = await TestWorkflowEnvironment.createTimeSkipping()
  }, BOOT_TIMEOUT)

  afterAll(async () => {
    await testEnv?.teardown()
  })

  it(
    'returns the activity output through a real worker',
    async () => {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: TEMPORAL_TASK_QUEUE,
        workflowsPath: WORKFLOWS_PATH,
        activities,
      })

      const output = await worker.runUntil(
        testEnv.client.workflow.execute(pingWorkflow, {
          taskQueue: TEMPORAL_TASK_QUEUE,
          workflowId: 'ping-test',
          args: ['proteus'],
        }),
      )

      // The activity's own name and attempt number are in the string, so this asserts the value came
      // back from an Activity execution rather than from the workflow calling a local function.
      expect(output).toBe('pong: proteus (activity ping, attempt 1)')
    },
    BOOT_TIMEOUT,
  )
})

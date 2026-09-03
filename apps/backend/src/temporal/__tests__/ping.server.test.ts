import type { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ping } from '../activities.js'
import { PAYLOAD_CONVERTER_PATH, TEMPORAL_TASK_QUEUE, WORKFLOWS_PATH } from '../config.js'
import { pingWorkflow } from '../workflows.js'
import { createTemporalTestEnvironment, TEMPORAL_BOOT_TIMEOUT } from './temporal-test-env.js'

let testEnv: TestWorkflowEnvironment

describe('pingWorkflow', () => {
  beforeAll(async () => {
    testEnv = await createTemporalTestEnvironment()
  }, TEMPORAL_BOOT_TIMEOUT)

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
        dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH },
        activities: { ping },
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
    TEMPORAL_BOOT_TIMEOUT,
  )
})

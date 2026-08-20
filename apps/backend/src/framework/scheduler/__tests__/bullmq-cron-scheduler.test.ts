import type { Logger } from '@core/types/logger.js'
import { createContainer } from 'awilix'
import { createPostgresBackend, type PostgresQueueBackend, Queue, type QueueOptions } from 'bullmq'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { BullMqCronScheduler } from '../bullmq/bullmq-cron-scheduler.js'

const DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/proteus_test'
const QUEUE_NAME = 'proteus-cron-jobs'

function createSpyLogger(): Logger {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    http: vi.fn(),
    debug: vi.fn(),
    setLogLevel: vi.fn(),
    shouldLog: vi.fn(() => false),
  }
}

/**
 * Wait until `predicate` returns true, polling every `intervalMs`.
 * Times out after `timeoutMs` with a clear error.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 10_000, intervalMs = 50): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`)
}

describe('BullMqCronScheduler', () => {
  let scheduler: BullMqCronScheduler
  let logger: Logger
  // Separate queue instance for manually triggering jobs in tests
  let triggerQueue: Queue<unknown, unknown, string, unknown, unknown, string, PostgresQueueBackend>

  beforeEach(async () => {
    logger = createSpyLogger()
    scheduler = new BullMqCronScheduler(logger, createContainer())
    triggerQueue = new Queue(QUEUE_NAME, { connection: DATABASE_URL } as QueueOptions, createPostgresBackend)
    await triggerQueue.obliterate({ force: true })
  })

  afterEach(async () => {
    await scheduler.shutdown()
    await triggerQueue.close()
  })

  test('schedule a job and verify its handler is called', async () => {
    let called = false

    await scheduler.start([
      {
        name: 'test-job',
        schedule: '* * * * *',
        handler: async () => {
          called = true
        },
      },
    ])

    // Simulate a cron tick by adding a job with the same data shape
    await triggerQueue.add('test-job', { jobName: 'test-job' })

    await waitFor(() => called)
    expect(called).toBe(true)
  })

  test('remove a job and verify it no longer fires', async () => {
    let callCount = 0

    await scheduler.start([
      {
        name: 'removable-job',
        schedule: '* * * * *',
        handler: async () => {
          callCount++
        },
      },
    ])

    // Trigger and verify it runs
    await triggerQueue.add('removable-job', { jobName: 'removable-job' })
    await waitFor(() => callCount >= 1)

    // Remove the job — handler should be deregistered
    await scheduler.remove('removable-job')

    // Trigger again — should not run the handler (no handler registered)
    await triggerQueue.add('removable-job', { jobName: 'removable-job' })
    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(callCount).toBe(1)
  })

  test('graceful shutdown completes without error', async () => {
    await scheduler.start([
      {
        name: 'shutdown-job',
        schedule: '* * * * *',
        handler: async () => {
          // noop
        },
      },
    ])

    await expect(scheduler.shutdown()).resolves.toBeUndefined()
  })

  test('handler error is logged and scheduler continues operating', async () => {
    const errorMessage = 'intentional test failure'
    let secondJobCalled = false

    await scheduler.start([
      {
        name: 'failing-job',
        schedule: '* * * * *',
        handler: async () => {
          throw new Error(errorMessage)
        },
      },
      {
        name: 'healthy-job',
        schedule: '* * * * *',
        handler: async () => {
          secondJobCalled = true
        },
      },
    ])

    // Trigger both jobs
    await triggerQueue.add('failing-job', { jobName: 'failing-job' })
    await triggerQueue.add('healthy-job', { jobName: 'healthy-job' })

    await waitFor(() => secondJobCalled)

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Job "failing-job" failed: ${errorMessage}`))
    expect(secondJobCalled).toBe(true)
  })

  test('handler error does not prevent the next tick from firing', async () => {
    let callCount = 0

    await scheduler.start([
      {
        name: 'flaky-job',
        schedule: '* * * * *',
        handler: async () => {
          callCount++
          if (callCount === 1) {
            throw new Error('first tick fails')
          }
        },
      },
    ])

    // First tick — handler throws
    await triggerQueue.add('flaky-job', { jobName: 'flaky-job' })
    await waitFor(() => callCount >= 1)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('first tick fails'))

    // Second tick — handler succeeds
    await triggerQueue.add('flaky-job', { jobName: 'flaky-job' })
    await waitFor(() => callCount >= 2)
    expect(callCount).toBe(2)
  })
})

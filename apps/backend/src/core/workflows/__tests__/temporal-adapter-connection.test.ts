import type { Client } from '@temporalio/client'
import { test } from '@tests/setup/test-extend.js'
import { createContainer } from 'awilix'
import type { TemporalClientHandle } from '../../../temporal/client.js'
import { createTemporalWorkflowEngine } from '../temporal-adapter.js'
import { createWorkflow } from '../types.js'

/**
 * How the adapter's lazy connection behaves when the first attempt fails.
 *
 * The engine caches the connection *promise* so that concurrent first calls share one gRPC
 * connection rather than racing to open several. Caching a rejected one is the failure this file
 * exists to prevent: a Temporal that was unreachable at first use would fail every later `run()`
 * with that same stale error until the process restarted — long after the server came back, and
 * with an error naming a connection nobody is still attempting.
 *
 * No Temporal server here on purpose. `connect` is injectable, the property under test is entirely
 * about what the engine does with the promise it gets back, and a real server can only show the
 * happy half of it.
 */

/** Enough of a `Client` for `run()` — it reaches for `workflow.execute` and nothing else. */
function fakeClient(output: unknown): Client {
  return { workflow: { execute: async () => output } } as unknown as Client
}

function fakeHandle(output: unknown): TemporalClientHandle {
  return { client: fakeClient(output), close: async () => undefined }
}

const probe = createWorkflow<void, string>('connection-probe', (ctx) => ctx.step('noop', async () => 'ran'))

const stepContext = { container: createContainer() }

test.describe('the adapter connection cache', () => {
  test('retries the connection after a failed first attempt instead of replaying its error', async ({ expect }) => {
    let attempts = 0
    const engine = createTemporalWorkflowEngine({
      connect: async () => {
        attempts += 1
        if (attempts === 1) throw new Error('ECONNREFUSED 127.0.0.1:7233')
        return fakeHandle('ran')
      },
    })

    await expect(engine.run(probe, undefined, stepContext)).rejects.toThrow('ECONNREFUSED')

    // The whole point: Temporal came back, so the next caller must get a fresh attempt.
    await expect(engine.run(probe, undefined, stepContext)).resolves.toBe('ran')
    expect(attempts, 'the second run reused the poisoned handle instead of reconnecting').toBe(2)
  })

  test('still opens only one connection for concurrent first calls', async ({ expect }) => {
    let attempts = 0
    const engine = createTemporalWorkflowEngine({
      connect: async () => {
        attempts += 1
        return fakeHandle('ran')
      },
    })

    await Promise.all([
      engine.run(probe, undefined, stepContext),
      engine.run(probe, undefined, stepContext),
      engine.run(probe, undefined, stepContext),
    ])

    // Clearing the handle on rejection must not cost the sharing that caching the promise buys.
    expect(attempts, 'concurrent first calls each opened their own connection').toBe(1)
  })

  test('reuses a connection that succeeded', async ({ expect }) => {
    let attempts = 0
    const engine = createTemporalWorkflowEngine({
      connect: async () => {
        attempts += 1
        return fakeHandle('ran')
      },
    })

    await engine.run(probe, undefined, stepContext)
    await engine.run(probe, undefined, stepContext)

    expect(attempts).toBe(1)
  })
})

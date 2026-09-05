import { describe, expect, test, vi } from 'vitest'
import { noopLogger } from '../../../framework/logger/noop-logger.js'
import type { Database } from '../../../schema.type.js'
import type { DbProvider } from '../../db/ports.js'
import { DeferredTasks, type DeferredTasksConfig } from '../deferred-tasks.js'

/**
 * The webhook API tests reach this class through a route, which is the right place to assert what
 * a webhook does. It is the wrong place to assert what happens when the third task in a chain
 * fails, or whether a task that schedules another is waited for — so those live here.
 */

const NO_DELAY: DeferredTasksConfig = { delayMs: 0, attempts: 3, backoffMs: 0 }

/** Node's provider is a passthrough; this records that every task went through one. */
function fakeDbProvider() {
  const connections: number[] = []
  const provider: DbProvider = {
    getDb: () => ({}) as Database,
    async withConnection(fn) {
      connections.push(connections.length + 1)
      return fn()
    },
    shutdown: async () => undefined,
  }
  return { provider, opened: () => connections.length }
}

function tasks(config: Partial<DeferredTasksConfig> = {}) {
  const { provider, opened } = fakeDbProvider()
  const logged: string[] = []
  const logger = {
    ...noopLogger,
    error(messageOrError: string | Error) {
      logged.push(typeof messageOrError === 'string' ? messageOrError : messageOrError.message)
    },
  }
  return { deferred: new DeferredTasks({ ...NO_DELAY, ...config }, provider, logger), logged, opened }
}

/** Resolves after `ms`, so two tasks can be made to overlap if nothing stops them. Not named
 *  `after`, which Biome reads as a test hook. */
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

describe('DeferredTasks serialization', () => {
  test('runs tasks sharing a name one after another', async () => {
    const { deferred } = tasks()
    const order: string[] = []

    deferred.run('same', async () => {
      order.push('first:start')
      await pause(20)
      order.push('first:end')
    })
    deferred.run('same', async () => {
      order.push('second:start')
    })

    await deferred.drain()

    // Interleaved, this reads first:start, second:start, first:end — which is the shape that let
    // two deliveries of one webhook both pass a read-then-write guard and capture twice.
    expect(order).toEqual(['first:start', 'first:end', 'second:start'])
  })

  test('lets tasks with different names overlap', async () => {
    const { deferred } = tasks()
    const order: string[] = []

    deferred.run('one', async () => {
      order.push('one:start')
      await pause(20)
      order.push('one:end')
    })
    deferred.run('two', async () => {
      order.push('two:start')
    })

    await deferred.drain()

    // Serializing everything would make one slow session block every other shopper's webhook.
    expect(order).toEqual(['one:start', 'two:start', 'one:end'])
  })

  test('keeps the whole chain when three land on one name', async () => {
    const { deferred } = tasks()
    const order: number[] = []

    for (const index of [1, 2, 3]) {
      deferred.run('same', async () => {
        await pause(5)
        order.push(index)
      })
    }

    await deferred.drain()

    expect(order).toEqual([1, 2, 3])
  })

  test('does not let a failing link block its successor', async () => {
    const { deferred, logged } = tasks({ attempts: 1 })
    const order: string[] = []

    deferred.run('same', async () => {
      order.push('failing')
      throw new Error('gateway is down')
    })
    deferred.run('same', async () => {
      order.push('successor')
    })

    await deferred.drain()

    expect(order).toEqual(['failing', 'successor'])
    expect(logged.some((line) => line.includes('giving up'))).toBe(true)
  })
})

describe('DeferredTasks retries', () => {
  test('retries up to the configured number of attempts, then gives up', async () => {
    const { deferred, logged } = tasks({ attempts: 3 })
    const task = vi.fn().mockRejectedValue(new Error('gateway is down'))

    deferred.run('flaky', task)
    await deferred.drain()

    expect(task).toHaveBeenCalledTimes(3)
    expect(logged).toContain('[deferred] "flaky" failed on attempt 3/3, giving up')
  })

  test('stops retrying as soon as an attempt succeeds', async () => {
    const { deferred } = tasks()
    const task = vi.fn().mockRejectedValueOnce(new Error('gateway is down')).mockResolvedValue(undefined)

    deferred.run('flaky', task)
    await deferred.drain()

    expect(task).toHaveBeenCalledTimes(2)
  })

  test('swallows a terminal failure rather than rejecting into nothing', async () => {
    const { deferred } = tasks({ attempts: 1 })

    // The response went out long ago; there is nobody left to hand this to. An unhandled
    // rejection here would take the process down on Node.
    deferred.run('doomed', async () => {
      throw new Error('gateway is down')
    })

    await expect(deferred.drain()).resolves.toBeUndefined()
  })
})

describe('DeferredTasks bookkeeping', () => {
  test('waits for work that a running task schedules in turn', async () => {
    const { deferred } = tasks()
    const order: string[] = []

    deferred.run('outer', async () => {
      order.push('outer')
      deferred.run('inner', async () => {
        await pause(10)
        order.push('inner')
      })
    })

    await deferred.drain()

    // `drain` measuring the set once would miss `inner` entirely, and a test using it would
    // assert against state that had not been written yet.
    expect(order).toEqual(['outer', 'inner'])
  })

  test('drains to empty, so a long-lived process does not accumulate queues', async () => {
    const { deferred } = tasks()

    for (const index of [1, 2, 3]) {
      deferred.run(`name-${index}`, async () => undefined)
    }
    await deferred.drain()

    // A second drain is the observable: anything left behind would still be awaited here, and a
    // queue entry that outlives its task would keep its predecessor's promise alive forever.
    await expect(deferred.drain()).resolves.toBeUndefined()
  })

  test('opens a database connection per attempt, never reusing the request that scheduled it', async () => {
    const { deferred, opened } = tasks({ attempts: 2 })

    deferred.run('needs-db', async () => {
      throw new Error('gateway is down')
    })
    await deferred.drain()

    // On workerd the request's client is closed the instant the response is delivered, so a task
    // that borrowed it would find it shut. Two attempts, two connections.
    expect(opened()).toBe(2)
  })
})

describe('DeferredTasks and the platform', () => {
  test('hands the work to waitUntil when the platform supplies one', async () => {
    const { deferred } = tasks()
    const handed: Promise<unknown>[] = []

    deferred.run(
      'webhook',
      async () => undefined,
      (work) => handed.push(work),
    )
    await deferred.drain()

    // Without this, workerd cancels the task before its first attempt and the route becomes a
    // 200 that does nothing.
    expect(handed).toHaveLength(1)
    await expect(handed[0]).resolves.toBeUndefined()
  })

  test('runs the task anyway when the platform supplies none', async () => {
    const { deferred } = tasks()
    const task = vi.fn().mockResolvedValue(undefined)

    deferred.run('webhook', task)
    await deferred.drain()

    // Node has no execution context and needs none — the process outlives the response.
    expect(task).toHaveBeenCalledOnce()
  })

  test('hands over a promise that only settles once the retries are spent', async () => {
    const { deferred } = tasks({ attempts: 2 })
    let settled = false
    const handed: Promise<unknown>[] = []

    deferred.run(
      'webhook',
      async () => {
        await pause(10)
        throw new Error('gateway is down')
      },
      (work) => handed.push(work),
    )
    const [work] = handed
    if (!work) throw new Error('nothing was handed to waitUntil')
    work.then(() => {
      settled = true
    })

    expect(settled).toBe(false)
    await deferred.drain()
    await Promise.resolve()

    // The platform keeps the isolate alive for exactly as long as this promise is pending, so it
    // has to cover the whole retry ladder rather than just the first attempt.
    expect(settled).toBe(true)
  })
})

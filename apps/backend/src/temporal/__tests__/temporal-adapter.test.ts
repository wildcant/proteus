import { BigNumber } from '@core/db/bignum.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { createTemporalWorkflowEngine, type TemporalWorkflowEngine } from '@core/workflows/temporal-adapter.js'
import { createWorkflow, type WorkflowDefinition, WorkflowTerminalError } from '@core/workflows/types.js'
import type { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { type AwilixContainer, asValue, createContainer } from 'awilix'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createWorkflowActivities } from '../activities.js'
import { PAYLOAD_CONVERTER_PATH, TEMPORAL_TASK_QUEUE, WORKFLOWS_PATH } from '../config.js'
import type { WorkflowRegistry } from '../registry.js'
import { createTemporalTestEnvironment, TEMPORAL_BOOT_TIMEOUT } from './temporal-test-env.js'

/**
 * The adapter end to end: a real Temporal server, a real Worker, a real workflow sandbox, and the
 * real payload converter. Nothing here is a double except the workflows themselves, which are
 * written inline so each test can be about one property of the bridge.
 *
 * The properties under test are the ones a workflow author is entitled to assume are unchanged
 * from the in-process adapter — ordering, compensation, error identity — plus the two that are
 * new: opt-in retry and the shape fingerprint.
 */

const TEST_TIMEOUT = 60_000

let testEnv: TestWorkflowEnvironment
let worker: Worker
let workerRun: Promise<void>
let engine: TemporalWorkflowEngine
let container: AwilixContainer

/**
 * Mutable on purpose. The registry is what the Activity resolves a workflow name through, so
 * swapping an entry mid-execution is how a deploy that changed a workflow is simulated.
 */
const definitions = new Map<string, WorkflowDefinition<unknown, unknown>>()

const registry: WorkflowRegistry = {
  get: (name) => definitions.get(name),
  names: () => [...definitions.keys()],
}

function register<TInput, TOutput>(workflow: WorkflowDefinition<TInput, TOutput>): WorkflowDefinition<TInput, TOutput> {
  definitions.set(workflow.name, workflow as unknown as WorkflowDefinition<unknown, unknown>)
  return workflow
}

/** `engine.run` takes the caller's container; the Worker's is the one steps actually see. */
function run<TInput, TOutput>(workflow: WorkflowDefinition<TInput, TOutput>, input: TInput): Promise<TOutput> {
  return engine.run(workflow, input, { container })
}

describe('temporal workflow engine', () => {
  beforeAll(async () => {
    testEnv = await createTemporalTestEnvironment()

    container = createContainer()
    container.register({ greeting: asValue('hello') })

    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TEMPORAL_TASK_QUEUE,
      workflowsPath: WORKFLOWS_PATH,
      dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH },
      activities: createWorkflowActivities({ container, registry }),
    })
    workerRun = worker.run()
    // Marks it handled, so a shutdown-time rejection cannot surface as an unhandled one.
    void workerRun.catch(() => undefined)

    engine = createTemporalWorkflowEngine({
      // The test server's client, so the tests never reach `env.TEMPORAL_ADDRESS`.
      connect: async () => ({ client: testEnv.client, close: async () => undefined }),
      retry: {
        'retryable-step': { flaky: { maximumAttempts: 3, initialInterval: '1ms' } },
        'retryable-step-terminal': { flaky: { maximumAttempts: 3, initialInterval: '1ms' } },
      },
      idempotentRetry: { maximumAttempts: 2, initialInterval: '1ms' },
      startToCloseTimeout: '30 seconds',
    })
  }, TEMPORAL_BOOT_TIMEOUT)

  afterAll(async () => {
    worker?.shutdown()
    await workerRun?.catch(() => undefined)
    await engine?.close()
    await testEnv?.teardown()
  })

  it(
    'runs every step once and returns the handler value',
    async () => {
      const actions: string[] = []

      const workflow = register(
        createWorkflow<{ start: number }, string>('runs-in-order', async (ctx, input) => {
          const doubled = await ctx.step('double', async () => {
            actions.push('double')
            return input.start * 2
          })
          const greeting = await ctx.step('greet', async ({ container: resolved }) => {
            actions.push('greet')
            return resolved.resolve('greeting') as string
          })
          return `${greeting} ${doubled}`
        }),
      )

      await expect(run(workflow, { start: 21 })).resolves.toBe('hello 42')
      // Once each, across three activity executions — the replays return stored outputs.
      expect(actions).toEqual(['double', 'greet'])
    },
    TEST_TIMEOUT,
  )

  it(
    'carries Date and BigNumber through stored step outputs without degrading them',
    async () => {
      const createdAt = new Date('2024-03-05T09:12:33.456Z')

      const workflow = register(
        createWorkflow<void, { total: BigNumber; at: Date }>('money-path', async (ctx) => {
          const line = await ctx.step('price-line', async () => ({
            unitPrice: new BigNumber('19.99'),
            createdAt,
          }))

          // Reads the *stored* output on the second activity, which is where the default JSON
          // converter would have handed back a string and a `{s,e,c}` object.
          return ctx.step('total-line', async () => ({
            total: line.unitPrice.multipliedBy(3),
            at: line.createdAt,
          }))
        }),
      )

      const result = await run(workflow, undefined)

      expect(BigNumber.isBigNumber(result.total)).toBe(true)
      expect(result.total.toFixed()).toBe('59.97')
      expect(result.at).toBeInstanceOf(Date)
      expect(result.at.getTime()).toBe(createdAt.getTime())
    },
    TEST_TIMEOUT,
  )

  it(
    'carries a step that returns nothing',
    async () => {
      const ran: string[] = []

      const workflow = register(
        createWorkflow<void, string>('void-step', async (ctx) => {
          await ctx.step('validate', async () => {
            ran.push('validate')
          })
          const written = await ctx.step('write', async () => {
            ran.push('write')
            return 'written'
          })
          await ctx.step('notify', async () => {
            ran.push('notify')
          })
          return written
        }),
      )

      // Half of `complete-cart`'s steps return nothing, so this is the common case, not an edge
      // one: `undefined` inside an array is a payload the converter refuses outright — correctly,
      // since JSON would turn it into `null`. Stored outputs are boxed for exactly this reason.
      await expect(run(workflow, undefined)).resolves.toBe('written')
      expect(ran).toEqual(['validate', 'write', 'notify'])
    },
    TEST_TIMEOUT,
  )

  it(
    'unwinds prior compensations in reverse, swallows their errors, and rethrows the original',
    async () => {
      const events: string[] = []

      const workflow = register(
        createWorkflow<void, void>('unwinds', async (ctx) => {
          await ctx.step(
            'first',
            async () => 'a',
            async (output) => {
              events.push(`compensate-first:${output}`)
            },
          )
          await ctx.step(
            'second',
            async () => 'b',
            async () => {
              throw new Error('rollback of second failed')
            },
          )
          await ctx.step(
            'third',
            async () => 'c',
            async (output) => {
              events.push(`compensate-third:${output}`)
            },
          )
          await ctx.step('fails', async () => {
            throw new Error('provider unavailable')
          })
        }),
      )

      await expect(run(workflow, undefined)).rejects.toThrow('provider unavailable')
      expect(events).toEqual(['compensate-third:c', 'compensate-first:a'])
    },
    TEST_TIMEOUT,
  )

  it(
    'surfaces WorkflowTerminalError with its AppError intact, and does not retry it',
    async () => {
      const action = vi.fn(async () => {
        throw new WorkflowTerminalError({
          type: ErrorTypes.CONFLICT,
          message: 'Cart "cart_01" is already being completed',
        })
      })

      const workflow = register(
        createWorkflow<void, void>('terminal', async (ctx) => {
          await ctx.step('check-idempotency', action)
        }),
      )

      const failure = await run(workflow, undefined).catch((error: unknown) => error)

      // The class and the AppError behind it are what `errorHandler` reads to answer 409 rather
      // than 500 — the whole reason the failure is rebuilt on this side of the boundary.
      expect(failure).toBeInstanceOf(WorkflowTerminalError)
      expect(AppError.isError((failure as WorkflowTerminalError).cause)).toBe(true)
      expect((failure as WorkflowTerminalError).cause).toMatchObject({ type: ErrorTypes.CONFLICT })
      expect(failure).toMatchObject({ message: 'Cart "cart_01" is already being completed' })
      expect(action).toHaveBeenCalledTimes(1)
    },
    TEST_TIMEOUT,
  )

  it(
    'does not retry an ordinary failure, because steps are not idempotent by default',
    async () => {
      const action = vi.fn(async () => {
        throw new Error('DB error')
      })

      const workflow = register(
        createWorkflow<void, void>('no-retry-by-default', async (ctx) => {
          await ctx.step('write', action)
        }),
      )

      await expect(run(workflow, undefined)).rejects.toThrow('DB error')
      expect(action).toHaveBeenCalledTimes(1)
    },
    TEST_TIMEOUT,
  )

  it(
    'retries a step that opted in, until it succeeds',
    async () => {
      let attempts = 0

      const workflow = register(
        createWorkflow<void, string>('retryable-step', async (ctx) =>
          ctx.step('flaky', async () => {
            attempts += 1
            if (attempts < 3) throw new Error('connection reset')
            return `ok after ${attempts}`
          }),
        ),
      )

      await expect(run(workflow, undefined)).resolves.toBe('ok after 3')
      expect(attempts).toBe(3)
    },
    TEST_TIMEOUT,
  )

  it(
    'gives every step of an idempotent workflow the default retry policy',
    async () => {
      let attempts = 0

      const workflow = register(
        createWorkflow<void, string>({ name: 'declared-idempotent', idempotent: true }, async (ctx) =>
          ctx.step('any-step', async () => {
            attempts += 1
            if (attempts < 2) throw new Error('transient')
            return 'settled'
          }),
        ),
      )

      await expect(run(workflow, undefined)).resolves.toBe('settled')
      expect(attempts).toBe(2)
    },
    TEST_TIMEOUT,
  )

  it(
    'does not retry a terminal failure even on a step that opted in',
    async () => {
      let attempts = 0

      const workflow = register(
        createWorkflow<void, string>('retryable-step-terminal', async (ctx) =>
          ctx.step('flaky', async () => {
            attempts += 1
            throw new WorkflowTerminalError({ type: ErrorTypes.INVALID_DATA, message: 'Cart has no items' })
          }),
        ),
      )

      await expect(run(workflow, undefined)).rejects.toThrow('Cart has no items')
      expect(attempts).toBe(1)
    },
    TEST_TIMEOUT,
  )

  it(
    'fails loudly, and executes nothing, when the workflow changed shape mid-execution',
    async () => {
      const insertedAction = vi.fn(async () => 'fraud-checked')
      const rewritten = createWorkflow<void, string>('deployed-mid-flight', async (ctx) => {
        const checked = await ctx.step('check-fraud', insertedAction)
        const paid = await ctx.step('authorize-payment', async () => 'paid')
        return `${checked}/${paid}`
      })

      const compensateAuthorize = vi.fn()

      const deployed = register(
        createWorkflow<void, string>('deployed-mid-flight', async (ctx) => {
          const paid = await ctx.step(
            'authorize-payment',
            async () => {
              // Stands in for a deploy landing between two steps of a running execution.
              register(rewritten)
              return 'paid'
            },
            compensateAuthorize,
          )
          const order = await ctx.step('create-order', async () => 'ordered')
          return `${paid}/${order}`
        }),
      )

      const failure = await run(deployed, undefined)
        .then(() => undefined)
        .catch((error: unknown) => error)

      expect(failure).toBeInstanceOf(Error)
      expect(failure).toMatchObject({ message: expect.stringContaining('changed shape while an execution') })
      // The point of the fingerprint: the new step never ran against the old execution's outputs.
      expect(insertedAction).not.toHaveBeenCalled()
      // And the honest cost of a mismatch, worth stating rather than hiding: the unwind can only
      // replay the handler that is deployed *now*, and this one no longer has a compensation at
      // index 0 — so nothing rolls back. A shape change against an in-flight execution is an
      // incident, and Worker Versioning is the real fix (recorded as a follow-up in ILLO-12).
      expect(compensateAuthorize).not.toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )

  it(
    'fails non-retryably when the Worker has no such workflow registered',
    async () => {
      const unregistered = createWorkflow<void, void>('never-registered', async (ctx) => {
        await ctx.step('noop', async () => undefined)
      })

      await expect(run(unregistered, undefined)).rejects.toThrow(/No workflow is registered as "never-registered"/)
    },
    TEST_TIMEOUT,
  )
})

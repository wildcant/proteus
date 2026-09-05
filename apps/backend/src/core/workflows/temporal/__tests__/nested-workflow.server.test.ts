import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { createTemporalWorkflowEngine, type TemporalWorkflowEngine } from '@core/workflows/temporal-adapter.js'
import { createWorkflow, setWorkflowEngine, type WorkflowDefinition } from '@core/workflows/types.js'
import { Context } from '@temporalio/activity'
import type { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { type AwilixContainer, createContainer } from 'awilix'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PAYLOAD_CONVERTER_PATH } from '../../../../temporal/config.js'
import { createWorkflowActivities, withStepActivities } from '../activities.js'
import { TEMPORAL_TASK_QUEUE, WORKFLOWS_PATH } from '../config.js'
import type { WorkflowRegistry } from '../registry.js'
import type { AdvanceWorkflowInput } from '../types.js'
import { createTemporalTestEnvironment, TEMPORAL_BOOT_TIMEOUT } from './temporal-test-env.js'

/**
 * The topology the production Worker actually deploys, which nothing else covers.
 *
 * `src/temporal/container.ts` pins the **simple** engine on the Worker's own container, so the two
 * workflows that call another workflow's `.run()` from inside a step — `create-product` and
 * `complete-customer-auth` — run that nested workflow inline, in the Activity, rather than starting
 * a second Temporal execution. The parity suite cannot show this: `tests/setup/temporal-parity.ts`
 * runs its Activities against the *test* container, which `test:temporal` pins to `temporal`, so
 * there a nested run is its own execution. `POST /admin/products` therefore passes under the parity
 * suite while exercising a shape production does not use.
 *
 * This file is that missing half. It wires the Worker the way `container.ts` does — global engine
 * pinned `simple` — and asserts both what the pin buys and what it costs.
 *
 * What it does **not** cover, and what ADR-0021 records as the residual: a Worker that dies while a
 * nested run is in flight takes the nested workflow's compensation stack with it, because that stack
 * is in-process memory rather than Temporal history. Showing that needs a Worker to be killed
 * mid-step, which is `scripts/temporal/crash-resume.ts`'s territory and a Compose stack away.
 */

const TEST_TIMEOUT = 60_000

let testEnv: TestWorkflowEnvironment
let worker: Worker
let workerRun: Promise<void>
let engine: TemporalWorkflowEngine
let container: AwilixContainer

/** Every `advanceWorkflow` the driver asked for, so the test can see what did and did not reach one. */
const advanced: AdvanceWorkflowInput[] = []

const definitions = new Map<string, WorkflowDefinition<unknown, unknown>>()

const registry: WorkflowRegistry = {
  get: (name) => definitions.get(name),
  names: () => [...definitions.keys()],
}

/** Where a step body ran, read from the Activity context the way `engine-pin.test.ts` does. */
type RanIn = { workflowId: string; activityType: string }

function whereAmI(): RanIn {
  const info = Context.current().info
  return { workflowId: info.workflowExecution?.workflowId ?? '', activityType: info.activityType }
}

describe('nested workflows on a Worker pinned to the simple engine', () => {
  beforeAll(async () => {
    testEnv = await createTemporalTestEnvironment()
    container = createContainer()

    const activities = createWorkflowActivities({ container, registry })

    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TEMPORAL_TASK_QUEUE,
      workflowsPath: WORKFLOWS_PATH,
      dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH },
      // The spy has to be applied *through* `withStepActivities`, not spread over its result: every
      // alias is a reference to the original `advanceWorkflow`, and the driver schedules the alias
      // rather than the base name for every step after the first.
      activities: withStepActivities({
        advanceWorkflow: (input: AdvanceWorkflowInput) => {
          advanced.push(input)
          return activities.advanceWorkflow(input)
        },
        compensateWorkflow: activities.compensateWorkflow,
      }),
    })
    workerRun = worker.run()
    // Marks it handled, so a shutdown-time rejection cannot surface as an unhandled one.
    void workerRun.catch(() => undefined)

    /**
     * The line under test. `createWorkerContainer` does exactly this — the process that runs steps
     * pins `simple` for itself, so a `.run()` reached from inside a step stays in-process instead of
     * starting its own execution from inside an Activity.
     */
    setWorkflowEngine(createSimpleWorkflowEngine(), container)

    engine = createTemporalWorkflowEngine({
      connect: async () => ({ client: testEnv.client, close: async () => undefined }),
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
    'runs a nested .run() inline inside the outer execution’s Activity, and journals none of its steps',
    async () => {
      const innerRanIn: RanIn[] = []

      const inner = createWorkflow<{ sku: string }, string>('nested-inner', async (ctx, input) => {
        await ctx.step('inner-reserve', async () => {
          innerRanIn.push(whereAmI())
          return `reserved ${input.sku}`
        })
        return await ctx.step('inner-price', async () => {
          innerRanIn.push(whereAmI())
          return `priced ${input.sku}`
        })
      })

      const outerRanIn: RanIn[] = []

      // Only the outer is registered: the inner never needs a registry entry precisely because it
      // never travels as a name. That is the pin working.
      const outer = createWorkflow<{ sku: string }, string>('nested-outer', async (ctx, input) => {
        const nested = await ctx.step('outer-create', async () => {
          outerRanIn.push(whereAmI())
          return inner.run(input)
        })
        const finished = await ctx.step('outer-finish', async () => {
          outerRanIn.push(whereAmI())
          return `${nested} / done`
        })
        return finished
      })

      definitions.set('nested-outer', outer as unknown as WorkflowDefinition<unknown, unknown>)

      advanced.length = 0
      await expect(engine.run(outer, { sku: 'SKU-1' }, { container })).resolves.toBe('priced SKU-1 / done')

      // Both of the inner workflow's steps ran inside the *outer* execution's Activity — same
      // workflow id, same `advanceWorkflow` invocation. Under the parity harness's pin these would
      // have been a second execution with an id of its own.
      expect(innerRanIn).toHaveLength(2)
      expect(new Set(innerRanIn.map((ran) => ran.activityType))).toEqual(new Set(['advanceWorkflow']))
      expect(new Set(innerRanIn.map((ran) => ran.workflowId))).toEqual(new Set([outerRanIn[0]?.workflowId]))

      // Nothing but the outer ever reached an Activity, so the inner started no execution of its own.
      expect(new Set(advanced.map((input) => input.name))).toEqual(new Set(['nested-outer']))

      /**
       * The cost of the same pin. One Activity per *outer* step plus the final one that finishes the
       * handler — the inner workflow's two steps add nothing, because nothing about them is written
       * to history. A Worker lost part-way through `outer-create` therefore resumes by re-running
       * the whole nested workflow, and the nested workflow's compensations are gone with the process.
       */
      expect(advanced).toHaveLength(3)
      expect(advanced.map((input) => input.outputs.map((output) => output.value))).toEqual([
        [],
        ['priced SKU-1'],
        ['priced SKU-1', 'priced SKU-1 / done'],
      ])
    },
    TEST_TIMEOUT,
  )
})

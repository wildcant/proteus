import { createTemporalWorkflowEngine } from '@core/workflows/temporal-adapter.js'
import type { StepContext, WorkflowDefinition, WorkflowEngine } from '@core/workflows/types.js'
import { Context } from '@temporalio/activity'
import { Client, Connection } from '@temporalio/client'
import { NativeConnection, Worker } from '@temporalio/worker'
import type { AwilixContainer } from 'awilix'
// The two process-global installers the adapter's own tests already needed: a Temporal Runtime whose
// logger does not go through `console.warn` (which `setup-test-env.ts` turns into a thrown error),
// and a TypeScript-aware `require` hook, because Temporal loads `payloadConverterPath` with
// `require()` and this repo ships `.ts` with no build step.
import {
  installTemporalRuntime,
  installTypeScriptRequireHook,
} from '../../src/core/workflows/temporal/__tests__/temporal-test-env.js'
import {
  createWorkflowActivities,
  type RegisteredWorkflowActivities,
  withStepActivities,
} from '../../src/core/workflows/temporal/activities.js'
import { WORKFLOWS_PATH } from '../../src/core/workflows/temporal/config.js'
import type { WorkflowRegistry } from '../../src/core/workflows/temporal/registry.js'
import { env } from '../../src/env.js'
import { PAYLOAD_CONVERTER_PATH } from '../../src/temporal/config.js'

/**
 * What `npm run --workspace=backend test:temporal` needs that production does not.
 *
 * In production the API process starts an execution and a separate Worker process runs the steps
 * against its own container and database. The parity suite cannot do that: every vitest worker has
 * its own database (`tests/setup/database-url.ts`), so a Worker started elsewhere would run steps
 * against the wrong one. The Worker has to live in the test process, on the test container.
 *
 * So: one Worker per vitest worker process, on a task queue named after the process, and a routing
 * layer in front of the two Activities. A test may hold several containers at once and disposes them
 * per test, so the Activity cannot be bound to one container at Worker-creation time — it resolves
 * the container per call, from a prefix the adapter already puts on every workflow id.
 *
 * Everything else is the real thing: the real driver workflow, the real replay Activities, the real
 * payload converter, a real Temporal server.
 */

/**
 * Per process, so eight vitest workers do not steal each other's tasks. `Worker.create` is what binds
 * a queue, but the name has to exist before that — the adapter needs it synchronously, at the moment
 * a container is built, which may be long before any workflow runs.
 */
const TASK_QUEUE = `proteus-parity-${process.pid}`

/**
 * Generous because a step here can be a nested workflow: `create-product` and
 * `complete-customer-auth` both call another workflow's `.run()` from inside a step, and under this
 * harness that nested run is another Temporal execution rather than an in-process one.
 */
const STEP_TIMEOUT = '120 seconds'

/** A live container, and the Activities built for it. Keyed by the prefix on its workflow ids. */
type Attached = {
  container: AwilixContainer
  /** Names this container has run, so an Activity can find a handler the driver only names. */
  definitions: Map<string, WorkflowDefinition<unknown, unknown>>
  activities: RegisteredWorkflowActivities
}

type Harness = {
  client: Client
  close: () => Promise<void>
}

/**
 * Process-global rather than module-global. Vitest resets the module registry between test files
 * while reusing the process, so a plain module-level map would be rebuilt for every file while the
 * Worker it belongs to would not — the second file's containers would be invisible to the first
 * file's Worker. `globalThis` is what actually matches the Worker's lifetime.
 */
const ATTACHED = Symbol.for('proteus.temporal.parity.attached')
const HARNESS = Symbol.for('proteus.temporal.parity.harness')
const COUNTER = Symbol.for('proteus.temporal.parity.counter')

type Globals = {
  [ATTACHED]?: Map<string, Attached>
  [HARNESS]?: Promise<Harness>
  [COUNTER]?: number
}

const globals = globalThis as unknown as Globals

function attached(): Map<string, Attached> {
  globals[ATTACHED] ??= new Map()
  return globals[ATTACHED]
}

/**
 * Started on the first workflow *run*, not on the first container.
 *
 * Most test files never run a workflow, and building the Worker means bundling the sandboxed driver
 * with webpack and connecting twice — seconds, per process. Paying that only when something is
 * actually going to execute keeps the parity run's cost proportional to the workflows in it.
 */
function harness(): Promise<Harness> {
  globals[HARNESS] ??= start()
  return globals[HARNESS]
}

async function start(): Promise<Harness> {
  installTypeScriptRequireHook()
  installTemporalRuntime()

  const dataConverter = { payloadConverterPath: PAYLOAD_CONVERTER_PATH }
  const namespace = env.TEMPORAL_NAMESPACE

  const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS })
  const nativeConnection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS })

  const worker = await Worker.create({
    connection: nativeConnection,
    namespace,
    taskQueue: TASK_QUEUE,
    workflowsPath: WORKFLOWS_PATH,
    dataConverter,
    activities: routedActivities(),
  })

  const running = worker.run()
  // Marks it handled, so a shutdown-time rejection cannot surface as an unhandled one.
  void running.catch(() => undefined)

  return {
    client: new Client({ connection, namespace, dataConverter }),
    close: async () => {
      worker.shutdown()
      await running.catch(() => undefined)
      await nativeConnection.close()
      await connection.close()
    },
  }
}

/**
 * The two Activities the Worker registers, each resolving its container from the workflow id.
 *
 * `createTemporalWorkflowEngine` already prefixes every workflow id it starts, for exactly this kind
 * of routing — production uses it to let several stacks share a namespace. Here the prefix is the
 * container, so an Activity serving two tests at once still runs each one's steps against the
 * database and the registrations that test set up.
 */
function routedActivities(): RegisteredWorkflowActivities {
  const target = (): Attached => {
    const workflowId = Context.current().info.workflowExecution?.workflowId ?? ''
    const key = workflowId.slice(0, workflowId.indexOf(PREFIX_SEPARATOR))
    const found = attached().get(key)

    if (!found) {
      throw new Error(
        `[parity] no container is attached as "${key}". Its test disposed it while workflow ` +
          `"${workflowId}" was still running — await the run before the test ends.`,
      )
    }

    return found
  }

  // Through `withStepActivities`, like every other Worker: the dispatcher has to answer to the step
  // names too, because that is what the driver schedules. A throwaway workflow registered by a test
  // is not in that set — nothing could have registered its step names before this Worker booted —
  // so its rows fall back to `advanceWorkflow`, which is all parity ever needed.
  return withStepActivities({
    advanceWorkflow: (input) => target().activities.advanceWorkflow(input),
    compensateWorkflow: (input) => target().activities.compensateWorkflow(input),
  })
}

/**
 * Separates the container key from the workflow name in an id. Chosen because nothing generates it:
 * `workflowIdPrefix` is ours, and the rest of the id is `${workflow.name}-${ulid()}`.
 */
const PREFIX_SEPARATOR = '|'

/**
 * A `WorkflowEngine` for one test container, backed by the shared Worker.
 *
 * The wrapper around `run` is what makes the harness work without a registry: the port hands the
 * engine the whole `WorkflowDefinition` and the container the caller wired, so both are recorded
 * here, synchronously, immediately before the execution starts. That matters because the suite runs
 * throwaway workflows — `step.run` wraps a bare step in one — that no static registry could contain.
 */
export function createParityWorkflowEngine(): { engine: WorkflowEngine; close: () => Promise<void> } {
  globals[COUNTER] = (globals[COUNTER] ?? 0) + 1
  const key = `p${globals[COUNTER]}`

  const definitions = new Map<string, WorkflowDefinition<unknown, unknown>>()
  const registry: WorkflowRegistry = {
    get: (name) => definitions.get(name),
    names: () => [...definitions.keys()],
  }

  const engine = createTemporalWorkflowEngine({
    taskQueue: TASK_QUEUE,
    workflowIdPrefix: `${key}${PREFIX_SEPARATOR}`,
    startToCloseTimeout: STEP_TIMEOUT,
    connect: async () => ({
      client: (await harness()).client,
      // The connection is the process's, not this container's — closing it here would take the
      // Worker's client down with the first test that finishes.
      close: async () => undefined,
    }),
  })

  return {
    engine: {
      run<TInput, TOutput>(
        workflow: WorkflowDefinition<TInput, TOutput>,
        input: TInput,
        context: StepContext,
      ): Promise<TOutput> {
        definitions.set(workflow.name, workflow as WorkflowDefinition<unknown, unknown>)

        const existing = attached().get(key)
        if (existing?.container !== context.container) {
          attached().set(key, {
            container: context.container,
            definitions,
            activities: createWorkflowActivities({ container: context.container, registry }),
          })
        }

        return engine.run(workflow, input, context)
      },
    },
    close: async () => {
      attached().delete(key)
      await engine.close()
    },
  }
}

/** Stops the shared Worker. Only the process teardown has any business calling this. */
export async function closeParityHarness(): Promise<void> {
  const started = globals[HARNESS]
  if (!started) return
  globals[HARNESS] = undefined
  await (await started).close()
}

import { NativeConnection, Worker } from '@temporalio/worker'
import { env } from '../env.js'
import { createWorkflowActivities, ping } from './activities.js'
import { PAYLOAD_CONVERTER_PATH, TEMPORAL_TASK_QUEUE, WORKFLOWS_PATH } from './config.js'
import { createWorkerContainer } from './container.js'
import { workflowRegistry } from './registry.js'
import { STEP_ACTIVITY_NAMES } from './step-names.js'

/**
 * Worker entrypoint — `npm run --workspace=backend worker`.
 *
 * This is where Proteus workflows actually execute. The sandboxed driver in `workflows.ts` carries
 * only a name and a list of outputs; the handler behind that name lives here, with the DI
 * container, and is re-entered one step at a time by `advanceWorkflow`.
 *
 * Node only. The Worker needs `@temporalio/core-bridge`, a native addon that workerd cannot load.
 */
const { container, shutdown } = await createWorkerContainer()

const connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS })

/**
 * The step-name aliases are in here too — one Activity type per `ctx.step` name, all of them
 * `advanceWorkflow`. They exist so the Temporal UI can label a timeline row with the step it ran
 * rather than fourteen rows of `advanceWorkflow`; see `step-names.ts`.
 */
const activities = { ping, ...createWorkflowActivities({ container, registry: workflowRegistry }) }

const worker = await Worker.create({
  connection,
  namespace: env.TEMPORAL_NAMESPACE,
  taskQueue: TEMPORAL_TASK_QUEUE,
  workflowsPath: WORKFLOWS_PATH,
  dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH },
  activities,
})

/**
 * `worker.shutdown()` stops polling and drains in-flight tasks, so `worker.run()` resolves on its
 * own once the queue is quiet — which is why the signal handler awaits nothing and the process
 * exits through the bottom of this file rather than through `process.exit`.
 *
 * Guarded on the state, because the SDK installs its own handler for the same signals and
 * deregisters it after the first one: a second Ctrl-C during the drain would reach only this
 * handler, and `shutdown()` throws `IllegalStateError` once the Worker has left `RUNNING`. An
 * uncaught throw there kills the process mid-drain, which is precisely what draining is for.
 */
function handleSignal(signal: string) {
  if (worker.getState() !== 'RUNNING') {
    // Deliberately not escalating to a force-exit. A step is mid-flight and there is no
    // `shutdownForceTime`, because killing it here is the one thing durability cannot recover
    // from: the activity would be lost and, at `maximumAttempts: 1`, never retried. Says so, so an
    // operator watching a slow drain knows it is waiting on a step rather than hung.
    console.info(
      `[temporal-worker] received ${signal}, already draining — waiting for the in-flight step. ` +
        'SIGKILL to stop now, at the cost of that step.',
    )
    return
  }

  console.info(`[temporal-worker] received ${signal}, draining...`)
  worker.shutdown()
}

process.on('SIGTERM', () => handleSignal('SIGTERM'))
process.on('SIGINT', () => handleSignal('SIGINT'))

console.info(
  `[temporal-worker] polling '${TEMPORAL_TASK_QUEUE}' on ${env.TEMPORAL_ADDRESS} (namespace ${env.TEMPORAL_NAMESPACE}) ` +
    `with ${workflowRegistry.names().length} workflows and ${STEP_ACTIVITY_NAMES.size} step activities registered`,
)

await worker.run()
await connection.close()
await shutdown()

console.info('[temporal-worker] stopped')

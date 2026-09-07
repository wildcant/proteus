import { env } from '@env'
import { createWorkerContainer } from '@framework/runtime/container.worker.js'
import { NativeConnection, Worker } from '@temporalio/worker'
import { PAYLOAD_CONVERTER_PATH } from '../../../temporal/config.js'
import { subscriberRegistry } from '../registry.js'
import { createEventActivities } from './activities.js'
import { EVENTS_TASK_QUEUE } from './config.js'

/**
 * Events Worker entrypoint — `npm run --workspace=backend worker:events`.
 *
 * A second Worker process, not a second task queue on the first one. It polls `proteus-events` and
 * runs subscribers; the workflow Worker polls `proteus` and runs checkout steps. Splitting the
 * processes is what makes the queue split mean something — one pool of slots per kind of work, so a
 * burst of event deliveries cannot leave a shopper's `authorize-payment` waiting for a slot.
 *
 * **Both pins are explicit.** `createWorkerContainer` defaults `engine` to `simple` because the
 * workflow Worker wants it — two workflows call another workflow's `.run()` from inside a step and
 * those nested runs are meant to stay in-process. A subscriber calling `.run()` is the opposite
 * case: it is the *entry* to a workflow and should get a durable execution like any other entry
 * point. So this process names both values rather than inheriting either one, and `eventBus` has no
 * default to inherit even if it wanted to.
 *
 * Node only, and activity-only: there is no `workflowsPath` here, because this Worker runs no
 * workflow code. The SDK logs "No workflows registered, not polling for workflow tasks" on boot,
 * which is the correct description of what this process is.
 */
const { container, shutdown } = await createWorkerContainer({ engine: 'temporal', eventBus: 'temporal' })

const connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS })

const worker = await Worker.create({
  connection,
  namespace: env.TEMPORAL_NAMESPACE,
  taskQueue: EVENTS_TASK_QUEUE,
  // The same converter the publisher encodes with, and the same one the workflow Worker uses. Two
  // encodings of `BigNumber` and `Date` would appear as corrupt payload data rather than an error.
  dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH },
  activities: createEventActivities({ container, registry: subscriberRegistry }),
})

/**
 * The workflow Worker's signal handling, for the same reasons — see `core/workflows/temporal/
 * worker.ts`. `worker.shutdown()` stops polling and drains in-flight deliveries, so `worker.run()`
 * resolves on its own and the process exits through the bottom of this file.
 *
 * Guarded on the state because the SDK installs its own handler for the same signals and
 * deregisters it after the first one: a second Ctrl-C during the drain would reach only this
 * handler, and `shutdown()` throws `IllegalStateError` once the Worker has left `RUNNING`.
 */
function handleSignal(signal: string) {
  if (worker.getState() !== 'RUNNING') {
    // A delivery mid-flight is cheaper to lose here than a workflow step is — it has a bounded
    // retry policy and the server will hand it to the next Worker. Still worth saying, so an
    // operator watching a slow drain knows it is waiting on a subscriber rather than hung.
    console.info(
      `[events-worker] received ${signal}, already draining — waiting for the in-flight delivery. ` +
        'SIGKILL to stop now; the activity is retried by the server.',
    )
    return
  }

  console.info(`[events-worker] received ${signal}, draining...`)
  worker.shutdown()
}

process.on('SIGTERM', () => handleSignal('SIGTERM'))
process.on('SIGINT', () => handleSignal('SIGINT'))

console.info(
  `[events-worker] polling '${EVENTS_TASK_QUEUE}' on ${env.TEMPORAL_ADDRESS} ` +
    `(namespace ${env.TEMPORAL_NAMESPACE}) with ${subscriberRegistry.names().length} subscribers registered`,
)

await worker.run()
await connection.close()
await shutdown()

console.info('[events-worker] stopped')

import { NativeConnection, Worker } from '@temporalio/worker'
import { env } from '../env.js'
import * as activities from './activities.js'
import { TEMPORAL_TASK_QUEUE, WORKFLOWS_PATH } from './config.js'

/**
 * Worker entrypoint — `npm run --workspace=backend worker`.
 *
 * This process is infrastructure only. It does not build the DI container and does not run any
 * Proteus workflow: engine selection stays with the simple adapter until the Temporal adapter
 * lands, so nothing here changes how `createWorkflow(...).run()` behaves.
 *
 * Node only. The Worker needs `@temporalio/core-bridge`, a native addon that workerd cannot load.
 */
const connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS })

const worker = await Worker.create({
  connection,
  namespace: env.TEMPORAL_NAMESPACE,
  taskQueue: TEMPORAL_TASK_QUEUE,
  workflowsPath: WORKFLOWS_PATH,
  activities,
})

/**
 * `worker.shutdown()` stops polling and drains in-flight tasks, so `worker.run()` resolves on its
 * own once the queue is quiet — which is why the signal handler awaits nothing and the process
 * exits through the bottom of this file rather than through `process.exit`.
 */
function handleSignal(signal: string) {
  console.info(`[temporal-worker] received ${signal}, draining...`)
  worker.shutdown()
}

process.on('SIGTERM', () => handleSignal('SIGTERM'))
process.on('SIGINT', () => handleSignal('SIGINT'))

console.info(
  `[temporal-worker] polling '${TEMPORAL_TASK_QUEUE}' on ${env.TEMPORAL_ADDRESS} (namespace ${env.TEMPORAL_NAMESPACE})`,
)

await worker.run()
await connection.close()

console.info('[temporal-worker] stopped')

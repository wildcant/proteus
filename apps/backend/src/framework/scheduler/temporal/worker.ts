import type { Logger } from '@core/types/logger.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { env } from '@env'
import { createWorkerContainer } from '@framework/runtime/container.worker.js'
import { NativeConnection, Worker } from '@temporalio/worker'
import { GENERATED_JOBS } from '../../../jobs/registry.gen.js'
import { PAYLOAD_CONVERTER_PATH } from '../../temporal/config.js'
import { createCronScheduler } from '../index.js'
import { createCronActivities } from './activities.js'
import { CRON_HEARTBEAT_TIMEOUT_MS, CRON_TASK_QUEUE, CRON_WORKFLOWS_PATH, cronHeartbeatIntervalMs } from './config.js'

/**
 * Cron Worker entrypoint — `pnpm --filter backend run worker:cron`.
 *
 * The third Worker process. It polls `proteus-cron` and runs scheduled jobs; the events Worker
 * polls `proteus-events` and runs subscribers; the workflow Worker polls `proteus` and runs
 * checkout steps. One pool of slots per kind of work, so a nightly job that takes an hour cannot
 * take a slot from a shopper's `authorize-payment`, and a checkout burst cannot delay a tick.
 *
 * Scheduled work used to run *inside the API process*, on a Worker the API started for itself.
 * That is why the API refused to start its scheduler under `NODE_ENV=test` — two Workers polling
 * one queue on a shared database meant the test suite's jobs vanished into the server's Worker.
 * A process of its own is what makes that guard unnecessary rather than documented.
 *
 * **Both pins are explicit**, for the reason the events Worker names both. `createWorkerContainer`
 * defaults `engine` to `simple` because the workflow Worker wants it; a cron handler calling
 * `.run()` is the opposite case — it is the *entry* to a workflow and should get a durable
 * execution on the workflow queue like any other entry point. That pin is what makes "a nightly
 * cleanup and an admin button share one implementation" true rather than aspirational.
 *
 * **Unlike the events Worker, this one registers a workflow.** A Schedule's action can only start
 * a workflow, never a standalone activity, so the driver in `workflows.ts` has to be bundled here.
 * It is the only workflow this process knows.
 *
 * **And unlike either of them, this one writes server-side state before it polls.** Cron's Schedules
 * are reconciled here, from the same `jobs` import the activity resolves handlers out of — so the
 * deploy that teaches this process to run a job is the deploy that creates its Schedule, and the
 * deploy that removes the job removes it. The API does none of this and no longer resolves a
 * scheduler at all. ADR-0029 records why the owning process is this one.
 */
const { container, shutdown } = await createWorkerContainer({ engine: 'temporal', eventBus: 'temporal' })

const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER)

/**
 * Before the Worker is built, and fatal if it throws: a process that could not write its Schedules
 * has nothing useful to poll for, and booting anyway would leave the previous deploy's job list on
 * the server with no log line tying the two facts together.
 *
 * Its client is closed immediately. Reconciliation happens once, at boot, so holding the connection
 * for the life of the process would be a gRPC channel open for nothing — the Worker's own
 * `NativeConnection` below is a different one, and is what this process actually runs on.
 */
const scheduler = createCronScheduler(logger)
try {
  await scheduler.start(GENERATED_JOBS)
} finally {
  await scheduler.shutdown()
}

const connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS })

const worker = await Worker.create({
  connection,
  namespace: env.TEMPORAL_NAMESPACE,
  taskQueue: CRON_TASK_QUEUE,
  // The one difference from the events Worker's options, and a forced one: see above.
  workflowsPath: CRON_WORKFLOWS_PATH,
  // The same converter the scheduler encodes the action's argument with, and the same one the other
  // two Workers use. Two encodings of `BigNumber` and `Date` would appear as corrupt payload data
  // rather than as an error.
  dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH },
  /**
   * The other half of the heartbeat, and the half that is easy to leave out.
   *
   * Core delivers at most one heartbeat per `min(heartbeatTimeout * 0.8, this)`, and this defaults
   * to 60 seconds — so without the line the activity's beats are coalesced down to one per 24s
   * against a 30s deadline, whatever the wrapper does, and a job that blocks the event loop for
   * seven seconds is declared dead. Setting it to the wrapper's own interval is what makes
   * `HEARTBEATS_PER_TIMEOUT` a statement about the wire rather than about intent.
   */
  maxHeartbeatThrottleInterval: cronHeartbeatIntervalMs(CRON_HEARTBEAT_TIMEOUT_MS),
  activities: createCronActivities({ container, jobs: GENERATED_JOBS }),
})

/**
 * The other two Workers' signal handling, for the same reasons — see `framework/workflows/temporal/
 * worker.ts`. `worker.shutdown()` stops polling and drains the in-flight run, so `worker.run()`
 * resolves on its own and the process exits through the bottom of this file.
 *
 * Guarded on the state because the SDK installs its own handler for the same signals and
 * deregisters it after the first one: a second Ctrl-C during the drain would reach only this
 * handler, and `shutdown()` throws `IllegalStateError` once the Worker has left `RUNNING`.
 */
function handleSignal(signal: string) {
  if (worker.getState() !== 'RUNNING') {
    // Deliberately not escalating to a force-exit. A killed run is failed by its heartbeat timeout
    // rather than retried — `maximumAttempts: 1` — so the cost of SIGKILL here is one skipped tick
    // and one failed run in the schedule's history; nothing pauses over it. Worth saying, so an
    // operator watching a slow drain knows it is waiting on a job rather than hung.
    console.info(
      `[cron-worker] received ${signal}, already draining — waiting for the in-flight job. ` +
        'SIGKILL to stop now; the run then fails on its heartbeat timeout.',
    )
    return
  }

  console.info(`[cron-worker] received ${signal}, draining...`)
  worker.shutdown()
}

process.on('SIGTERM', () => handleSignal('SIGTERM'))
process.on('SIGINT', () => handleSignal('SIGINT'))

console.info(
  `[cron-worker] polling '${CRON_TASK_QUEUE}' on ${env.TEMPORAL_ADDRESS} ` +
    `(namespace ${env.TEMPORAL_NAMESPACE}) with ${GENERATED_JOBS.length} job(s) registered and reconciled`,
)

await worker.run()
await connection.close()
await shutdown()

console.info('[cron-worker] stopped')

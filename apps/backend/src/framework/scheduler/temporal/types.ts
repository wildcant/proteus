import type { Duration } from '@temporalio/common'
import type { SerializedError } from '../../temporal/failure-details.js'

/**
 * The wire contract between the scheduler that creates a Schedule and the cron Worker that answers
 * its action. Types, one failure tag, and nothing that runs.
 *
 * Dependency-free on purpose: `workflows.ts` is bundled into the workflow sandbox, and this is the
 * one module of ours it names. Everything here is either erased at build time or a bare string.
 */

/**
 * What the Schedule's action carries into the driver workflow.
 *
 * A job *name*, never the job: a handler is a closure over the container and cannot cross a wire,
 * so the Worker looks the name up in the job list it was built with. The two timeouts are assembled
 * in Node by the scheduler, where the per-job configuration lives, rather than read from a constant
 * inside the sandbox — the same reason the workflow engine's driver takes its timeout as input.
 */
export type CronJobInput = {
  job: string
  /** How long one run may take. Per job; see `TemporalCronSchedulerOptions.startToCloseTimeout`. */
  startToCloseTimeout: Duration
  /**
   * How long the server waits for a heartbeat before declaring the run dead.
   *
   * The interval the wrapper heartbeats on is derived from this rather than configured next to it —
   * see `activities.ts`. Two numbers that have to stay in a ratio are one number.
   */
  heartbeatTimeout: Duration
}

/** What the driver hands the activity. The timeouts are the driver's business, not the handler's. */
type RunCronJobInput = {
  job: string
}

/**
 * The single Activity the cron Worker registers. Named as a property rather than as a string
 * constant so the driver's `proxyActivities` call and the Worker's registration are checked against
 * one type instead of against each other.
 */
export type CronActivities = {
  runCronJob: (input: RunCronJobInput) => Promise<void>
}

/** `ApplicationFailure.type` for every failure the cron activity raises. */
export const CRON_JOB_FAILURE_TYPE = 'ProteusCronJobFailure'

/**
 * What that failure carries. Nothing reads it back into a JavaScript error — nobody awaits a
 * scheduled run — but it goes through the shared `serializeError` so that an operator reading a
 * failed run in the Temporal UI sees the same `type`/`code` fields a failed workflow step shows.
 */
export type CronJobFailureDetail = {
  job: string
  error: SerializedError
}

import { fileURLToPath } from 'node:url'

/**
 * The queue every scheduled run lands on, and the one the cron Worker polls.
 *
 * A constant rather than an environment variable, for the reason `EVENTS_TASK_QUEUE` is one:
 * `env.TEMPORAL_TASK_QUEUE` is configurable because the workflow queue is what a *deployment*
 * routes on, while this queue only ever has to mean the same thing to the process that reconciles
 * the schedules and the process that polls them. Two constants that agree cost nothing; two
 * environment variables that have drifted are a schedule firing into a queue nobody answers.
 *
 * Separate from `proteus-events` and `proteus` on purpose. Cron is a separate process with a
 * separate lifecycle and a tick that must not be starved — the axis Temporal's own guidance
 * endorses for adding a queue. Urgency *within* a queue is a priority key, not a third queue.
 */
export const CRON_TASK_QUEUE = 'proteus-cron'

/**
 * Absolute path to the driver module the cron Worker registers.
 *
 * A Schedule's action can only start a *workflow*, never a standalone activity — which is the one
 * structural difference between this Worker and the events Worker, and the reason this constant
 * exists at all. The Worker runs workflow code in a v8 isolate it builds itself, so it needs a file
 * on disk rather than an imported binding, and the path points at the `.ts` source because nothing
 * compiles this backend ahead of time.
 *
 * Deliberately in this module rather than beside the driver: `workflows.ts` is bundled into the
 * sandbox, which has no `node:url`, so the file that names its path may not be a file it imports.
 */
export const CRON_WORKFLOWS_PATH = fileURLToPath(new URL('./workflows.ts', import.meta.url))

/**
 * The registered name of the cron driver workflow — the exported function's name in `workflows.ts`.
 *
 * Referenced as a string rather than as the imported function, for the reason
 * `PROTEUS_WORKFLOW_TYPE` is: the process that creates the schedule must never load `workflows.ts`,
 * which pulls in `@temporalio/workflow` and only makes sense inside the sandbox.
 */
export const CRON_JOB_WORKFLOW_TYPE = 'cronJobWorkflow'

/**
 * How many heartbeats are meant to *reach the server* inside one heartbeat timeout.
 *
 * Three, so a single lost or delayed beat is not read as a dead Worker. Private, because the
 * number on its own is not the knob anyone should reach for: beating three times a window in
 * JavaScript is not the same as delivering three, and only a Worker configured with the interval
 * below can close that gap. `cronHeartbeatIntervalMs` is what both sides read.
 */
const HEARTBEATS_PER_TIMEOUT = 3

/**
 * The heartbeat timeout every cron run declares unless the scheduler is constructed with another.
 *
 * Short enough that a dead Worker is noticed in about half a minute, which is the property the
 * whole mechanism exists for. Long enough that an ordinary GC pause or a slow poll is not mistaken
 * for a corpse. Lives here rather than beside the scheduler because the Worker has to derive its
 * throttle from the same number, and two copies that drift silently disarm the heartbeat.
 */
export const CRON_HEARTBEAT_TIMEOUT_MS = 30_000

/** A floor, so a very short timeout in a test cannot turn the interval into a busy loop. */
const MIN_HEARTBEAT_INTERVAL_MS = 50

/**
 * How often a run should beat, and — the part that is easy to miss — how often the Worker must be
 * allowed to *deliver* one.
 *
 * Core throttles heartbeat delivery to `min(heartbeatTimeout * 0.8, maxHeartbeatThrottleInterval)`:
 * it reports the first beat immediately, then sleeps that interval and flushes only the last
 * details recorded in the meantime (`sdk-core/src/worker/activities.rs:588-594` and
 * `activities/activity_heartbeat_manager.rs`). `maxHeartbeatThrottleInterval` defaults to 60
 * seconds, so left alone it never binds and the *delivered* rate is `0.8 * timeout` no matter how
 * often the wrapper calls `heartbeat()` — one beat per window, with 20% of the timeout as the
 * entire margin. A synchronous CPU-bound job or any event-loop stall longer than that margin then
 * times out a perfectly healthy Worker, and with `maximumAttempts: 1`, `pauseOnFailure` and a
 * reconciliation that never unpauses, that transient stall is permanent.
 *
 * So every cron Worker passes this as its `maxHeartbeatThrottleInterval`, and the wrapper uses it
 * as its own interval. One number in both places is what makes `HEARTBEATS_PER_TIMEOUT` describe
 * what actually reaches the server rather than what JavaScript intended.
 */
export function cronHeartbeatIntervalMs(heartbeatTimeoutMs: number): number {
  return Math.max(MIN_HEARTBEAT_INTERVAL_MS, Math.floor(heartbeatTimeoutMs / HEARTBEATS_PER_TIMEOUT))
}

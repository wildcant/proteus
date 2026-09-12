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

import { proxyActivities } from '@temporalio/workflow'
import type { CronActivities, CronJobInput } from './types.js'

/**
 * The cron driver. Every scheduled run is an execution of *this* function.
 *
 * It exists because a Schedule's action can only start a workflow, never a standalone activity —
 * the event bus, which has no such constraint, starts its activity directly and registers no
 * workflow at all. So the whole body is one activity invocation, and the job's handler stays where
 * handlers belong: in the Worker process, with the DI container, outside the sandbox.
 *
 * Sandbox rules apply here and nowhere else in `scheduler/`: no filesystem, no clock, no network,
 * and only `@temporalio/workflow` may be imported for its runtime. The `./types.js` import is
 * type-only and erases at build time.
 *
 * **`maximumAttempts: 1`.** A cron handler is ordinary application code with a database, and
 * nothing makes it idempotent — re-running one that failed halfway is the workflow engine's
 * default stance restated here for the same reason. A failed run is meant to be *visible*, and it
 * is: the run closes as failed, in the Schedule's history, where a silent second attempt would have
 * hidden it. Nothing pauses over it — the next tick fires and fails again until the code is fixed,
 * which is the point. See ADR-0029's amendment.
 */
export async function cronJobWorkflow(input: CronJobInput): Promise<void> {
  const { runCronJob } = proxyActivities<CronActivities>({
    startToCloseTimeout: input.startToCloseTimeout,
    // Without this the server cannot tell a dead Worker from a slow job until `startToCloseTimeout`
    // elapses — and under overlap `SKIP` that one crash suppresses every tick in between while the
    // UI shows a run that looks healthy. See `activities.ts` for the other half.
    heartbeatTimeout: input.heartbeatTimeout,
    retry: { maximumAttempts: 1 },
  })

  await runCronJob({ job: input.job })
}

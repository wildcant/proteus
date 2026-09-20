import { Context } from '@temporalio/activity'
import { ApplicationFailure } from '@temporalio/common'
import type { AwilixContainer } from 'awilix'
import type { JobDefinition } from '../../../core/types/scheduler.js'
import { serializeError } from '../../temporal/failures.js'
import { cronHeartbeatIntervalMs } from './config.js'
import { CRON_JOB_FAILURE_TYPE, type CronActivities, type CronJobFailureDetail } from './types.js'

/**
 * The single Activity the cron Worker registers: look the job up, run its handler with the
 * container, and heartbeat for as long as it takes.
 *
 * A factory rather than a module-level export, for the reason the event bus's dispatch activity is
 * one: the handler needs the DI container, and building it at import time would open a database
 * pool in every process that so much as imports this module.
 *
 * The job list is injected rather than imported. `src/jobs/` is a layer `framework/` may not reach
 * — only a process main may — and keeping the list an argument is also what lets the server test
 * drive this with jobs of its own.
 */
export function createCronActivities(deps: { container: AwilixContainer; jobs: JobDefinition[] }): CronActivities {
  const { container, jobs } = deps

  return {
    runCronJob: async (input) => {
      const job = jobs.find((candidate) => candidate.name === input.job)

      // Non-retryable on purpose, exactly as an unknown subscriber is: a job this Worker does not
      // have is a half-rolled-out deploy or a schedule left behind by a rename, and re-running it
      // produces the same answer until the retry budget is gone. Nobody is awaiting this run, so
      // the honest place for it is a failed execution in the UI naming the job.
      if (!job) {
        throw ApplicationFailure.create({
          type: CRON_JOB_FAILURE_TYPE,
          message: `No job is registered as "${input.job}" on this Worker`,
          nonRetryable: true,
        })
      }

      const stopHeartbeat = startHeartbeat()

      try {
        await job.handler(container)
      } catch (error) {
        throw toCronJobFailure(error, job.name)
      } finally {
        stopHeartbeat()
      }
    },
  }
}

/**
 * Heartbeats until the returned function is called.
 *
 * **This wrapper's job, never the handler's.** `JobDefinition` is the one type both runtimes read,
 * and threading Temporal's activity context into it would put a node-only concern into the shape
 * workerd also runs. A job author writes a function taking the container and gets liveness for
 * free.
 *
 * The interval is derived from the timeout the driver declared rather than configured beside it:
 * two numbers that have to stay in a ratio are one number, and `heartbeatTimeoutMs` is already on
 * the context. When the driver declares no heartbeat timeout there is nothing to prove liveness to,
 * and the SDK is explicit that an activity must *not* heartbeat in that case — hence the early
 * return rather than a default.
 *
 * **Calling `heartbeat()` this often is only half of it.** Core throttles *delivery*, so a Worker
 * that has not had its `maxHeartbeatThrottleInterval` set to the same number drops every beat but
 * the first in each `0.8 * timeout` window — see `cronHeartbeatIntervalMs`, which both sides read.
 * The Worker is where that is configured; this is where it is spent.
 *
 * It deliberately keeps beating through *cancellation*. `shutdownGraceTime` defaults to 0, so an
 * ordinary `worker.shutdown()` cancels every in-flight activity immediately and then waits for the
 * ones that do not confirm it — which every cron handler is, since `JobDefinition` has no
 * cancellation signal in it. Stopping here on cancellation would therefore heartbeat-timeout a job
 * the Worker is still faithfully finishing, on every deploy.
 */
function startHeartbeat(): () => void {
  const context = Context.current()
  const timeout = context.info.heartbeatTimeoutMs
  if (timeout === undefined) return () => undefined

  const timer = setInterval(() => context.heartbeat(), cronHeartbeatIntervalMs(timeout))

  // Nothing about a heartbeat should keep this process alive: on a drained Worker the handler has
  // already returned and cleared it, and after a forced shutdown the run is over whatever this
  // timer thinks — the SDK drops heartbeats from an activity whose stream it has closed.
  timer.unref()

  return () => clearInterval(timer)
}

/**
 * Wraps whatever the handler threw in the one failure shape this boundary uses.
 *
 * Not marked `nonRetryable`, because nothing retries it: the driver schedules this activity with
 * `maximumAttempts: 1`, so the flag would decide nothing. Nothing acts on the failure either — the
 * Schedule has no `pauseOnFailure` — so this shape is the whole of what an operator gets, which is
 * why it carries the job name and the serialized cause rather than a bare message.
 */
function toCronJobFailure(error: unknown, job: string): ApplicationFailure {
  const detail: CronJobFailureDetail = { job, error: serializeError(error) }

  return ApplicationFailure.create({
    type: CRON_JOB_FAILURE_TYPE,
    message: `cron job "${job}" failed: ${detail.error.message}`,
    details: [detail],
  })
}

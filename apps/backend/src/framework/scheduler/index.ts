import type { Logger } from '@core/types/logger.js'
import type { Duration } from '@temporalio/common'
import { TemporalCronScheduler } from './temporal/temporal-cron-scheduler.js'

/**
 * How long one run of a named job may take, for the jobs whose answer is not the five-minute
 * default. Empty for the same reason `container.node.ts`'s `retry` map is: the knob is written down
 * where it is honoured, and nothing has yet earned an entry.
 *
 * Two constraints on anything added here, neither of which fails loudly:
 *
 * - **Nothing below `CRON_HEARTBEAT_TIMEOUT_MS` (30s).** A run whose own timeout fires before the
 *   heartbeat deadline can never be failed *by* a missing heartbeat, so liveness detection for that
 *   job is inert — a dead Worker and a slow one become the same observation.
 * - **Per job, not per tick.** Overlap is `SKIP`, so a job that regularly approaches its timeout is
 *   silently dropping ticks rather than queueing them.
 */
const START_TO_CLOSE_TIMEOUT: Record<string, Duration> = {}

/**
 * The `CronScheduler` the cron Worker reconciles its Schedules through — and the only caller there
 * is. Nothing registers this in a container: the API process does not schedule, does not resolve a
 * scheduler and does not import this file.
 *
 * That is the whole of the change ADR-0029's amendment records. The process that holds the job list
 * is the process that writes the Schedules, so a Schedule the Worker cannot serve is not a
 * deploy-ordering rule to remember but a state that cannot be reached.
 *
 * `heartbeatTimeout` is left at its default on purpose. The cron Worker derives its delivery
 * throttle from `CRON_HEARTBEAT_TIMEOUT_MS` rather than from this instance, so a shorter value
 * here would not shorten the throttle with it — the beats would simply stop arriving in time.
 */
export function createCronScheduler(logger: Logger): TemporalCronScheduler {
  return new TemporalCronScheduler({ logger, startToCloseTimeout: START_TO_CLOSE_TIMEOUT })
}

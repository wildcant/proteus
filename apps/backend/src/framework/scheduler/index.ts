import type { Logger } from '@core/types/logger.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import type { Duration } from '@temporalio/common'
import { type AwilixContainer, asValue } from 'awilix'
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
 * Registers the `CronScheduler` the API process schedules through.
 *
 * It schedules and executes nothing: reconciliation writes Temporal Schedules, and the runs they
 * start are picked up by the cron Worker — `pnpm --filter backend run worker:cron` — which is a
 * separate process with its own slots.
 *
 * `heartbeatTimeout` is left at its default on purpose. The cron Worker derives its delivery
 * throttle from `CRON_HEARTBEAT_TIMEOUT_MS` rather than from this instance, so a shorter value
 * here would not shorten the throttle with it — the beats would simply stop arriving in time.
 */
export function registerScheduler(container: AwilixContainer, logger: Logger): void {
  const scheduler = new TemporalCronScheduler({ logger, startToCloseTimeout: START_TO_CLOSE_TIMEOUT })
  container.register({ [ContainerRegistrationKeys.SCHEDULER]: asValue(scheduler) })
}

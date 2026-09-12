import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { Logger } from '@core/types/logger.js'
import type { CronScheduler, JobDefinition } from '@core/types/scheduler.js'
import {
  type Client,
  ScheduleAlreadyRunning,
  ScheduleNotFoundError,
  type ScheduleOptions,
  ScheduleOverlapPolicy,
} from '@temporalio/client'
import type { Duration } from '@temporalio/common'
import { createTemporalClient, type TemporalClientHandle } from '../../temporal/client.js'
import { CRON_HEARTBEAT_TIMEOUT_MS, CRON_JOB_WORKFLOW_TYPE, CRON_TASK_QUEUE } from './config.js'
import type { CronJobInput } from './types.js'

/**
 * `CronScheduler` backed by **Temporal Schedules** — one Schedule per job, whose action starts the
 * cron driver workflow on the cron task queue.
 *
 * What the server gives us that the queue-backed adapter this replaced had to do without, and that
 * no application code here implements:
 *
 * - **A manual trigger**, so a job can be tested without waiting for its next tick or editing its
 *   cron expression.
 * - **Pause**, so a misbehaving job stops without a deploy — and **pause-on-failure**, so a job
 *   failing every minute stops on its own before it fills the history.
 * - **Backfill** over a missed window, so an outage is replayed deliberately rather than lost.
 * - **A per-run history with the failure inside it**, so diagnosis does not depend on having kept
 *   the process's logs.
 * - **Overlap `SKIP` as a stated policy** rather than as something the library happened to do.
 *
 * ## Reconciliation
 *
 * `start()` is the whole of it: create each job's Schedule, or update it to match if one already
 * exists. It is deliberately *not* a two-way sync — a Schedule whose job has been renamed or
 * deleted stays on the server until someone removes it, and `remove()` is the explicit way to do
 * that. Sweeping orphans needs a rule about what else may own a Schedule in this namespace, and
 * there isn't one yet.
 *
 * A disabled job still gets its Schedule, paused. That is what keeps "turn it back on" a one-line
 * edit rather than a rediscovery that the job ever existed.
 *
 * **The definition is authoritative, including the pause flag.** Every reconcile writes `paused`
 * from `disabled`, so enabling a job unpauses its Schedule exactly as disabling one pauses it, and
 * the source file is the only place the answer to "does this job run" lives. The price is that a
 * pause applied on the server — by `pauseOnFailure`, or by an operator in the UI — survives only
 * until the next boot; unpausing one logs a warning naming what it overruled. ADR-0029 records why
 * this is the trade we take.
 */

export type TemporalCronSchedulerOptions = {
  logger: Logger
  /** The queue the driver workflow is started on. Defaults to the constant the cron Worker polls. */
  taskQueue?: string
  /**
   * How long one run of a named job may take, keyed by job name.
   *
   * Expressed here, at the composition root, rather than on `JobDefinition` — which is the type
   * workerd also reads, and which has no Temporal in it. This is the same place the workflow
   * engine's per-step retry policies are expressed, for the same reason: the knob belongs to the
   * runtime that honours it.
   */
  startToCloseTimeout?: Record<string, Duration>
  /** The timeout for a job with no entry above. */
  defaultStartToCloseTimeout?: Duration
  /**
   * How long the server waits for a heartbeat before declaring a run dead.
   *
   * Short relative to `startToCloseTimeout`, and that gap is the point: without it a Worker that
   * crashes mid-run is not noticed until the *run's* timeout elapses, and under overlap `SKIP`
   * every tick in that window is suppressed while the UI shows a run that looks healthy.
   */
  heartbeatTimeout?: Duration
  /** Supplies the client instead of connecting from `env` — this adapter's own tests use it. */
  connect?: () => Promise<TemporalClientHandle>
}

/** Generous, and the number both previous adapters used. Per job, not per tick. */
const DEFAULT_START_TO_CLOSE_TIMEOUT: Duration = '5 minutes'

/**
 * The same number the cron Worker derives its delivery throttle from, so the two cannot drift — a
 * Worker throttling for a 30-second timeout while a schedule declares five is a heartbeat that
 * disarms itself. See `cronHeartbeatIntervalMs`.
 */
const DEFAULT_HEARTBEAT_TIMEOUT: Duration = CRON_HEARTBEAT_TIMEOUT_MS

/** The Schedule id for a job. `cron_${name}`, which is the key the adapter this replaced used. */
export function cronScheduleId(jobName: string): string {
  return `cron_${jobName}`
}

export class TemporalCronScheduler implements CronScheduler {
  private readonly logger: Logger
  private readonly taskQueue: string
  private readonly timeouts: Record<string, Duration>
  private readonly defaultTimeout: Duration
  private readonly heartbeatTimeout: Duration
  private readonly connect: () => Promise<TemporalClientHandle>

  /**
   * Connected on first use rather than in the constructor, for the reason the event bus's client is:
   * building a container must not require a reachable Temporal server, or every script and test
   * that only touches the database would.
   */
  private handle: Promise<TemporalClientHandle> | undefined

  constructor(options: TemporalCronSchedulerOptions) {
    this.logger = options.logger
    this.taskQueue = options.taskQueue ?? CRON_TASK_QUEUE
    this.timeouts = options.startToCloseTimeout ?? {}
    this.defaultTimeout = options.defaultStartToCloseTimeout ?? DEFAULT_START_TO_CLOSE_TIMEOUT
    this.heartbeatTimeout = options.heartbeatTimeout ?? DEFAULT_HEARTBEAT_TIMEOUT
    this.connect = options.connect ?? createTemporalClient
  }

  queueName(): string {
    return this.taskQueue
  }

  /** Creates the job's Schedule, or updates an existing one to match the definition. */
  async schedule(job: JobDefinition): Promise<void> {
    await this.reconcile(job)
  }

  /**
   * `schedule()`, plus the one fact `start()` needs back from it: whether the job's Schedule is
   * paused now that it has been reconciled — which, since reconciliation is total, is `disabled`
   * read back off the server rather than off the definition.
   */
  private async reconcile(job: JobDefinition): Promise<{ paused: boolean }> {
    const options = this.optionsFor(job)
    const client = await this.client()

    try {
      await client.schedule.create(options)
      return { paused: job.disabled === true }
    } catch (error) {
      // The only expected failure: this job has been scheduled before, by an earlier boot of this
      // process or by another one. Anything else is a real problem and is not swallowed.
      if (!(error instanceof ScheduleAlreadyRunning)) throw error
    }

    /**
     * Read out of the update rather than logged inside it: the SDK reserves the right to call the
     * callback more than once, so anything with an effect belongs after `update()` resolves.
     */
    let wasPaused = false

    await client.schedule.getHandle(options.scheduleId).update((previous) => {
      wasPaused = previous.state.paused

      return {
        spec: options.spec,
        action: options.action,
        policies: options.policies,
        state: {
          ...previous.state,
          /**
           * The definition wins, in both directions: disabling pauses, and enabling unpauses. The
           * `disabled` flag in the source file is the whole answer to "should this job run", so a
           * schedule that disagrees with it is drift to be corrected at boot like the spec and the
           * action are, not a state to be preserved.
           *
           * The cost is stated in ADR-0029 and is not small: `pauseOnFailure` and an operator's
           * own pause write this same flag, and Temporal cannot tell either of them from a
           * deliberate one — so both last only until the next restart. `note` below is what keeps
           * that from being silent, and it is the reason a pause meant to survive belongs in the
           * definition rather than in the UI.
           */
          paused: job.disabled === true,
          /**
           * Overwritten rather than carried through, because `previous.state.note` is the sentence
           * explaining a pause this reconcile may have just cleared — `pauseOnFailure` writes one,
           * and the UI prompts for one. Leaving it in place over a running schedule would leave
           * "paused due to workflow failure" sitting under a job that is firing every minute.
           */
          note: `reconciled from the job definition at ${new Date().toISOString()}`,
        },
        typedSearchAttributes: previous.typedSearchAttributes,
      }
    })

    /**
     * Unpausing is the half of this that undoes someone else's decision, so it is the half that
     * gets said out loud. A schedule does not pause itself for no reason: either an operator did
     * it, or `pauseOnFailure` did, and in both cases the run history holds a "why" that this
     * process has just overruled on the strength of a flag in a source file.
     */
    if (wasPaused && !job.disabled) {
      this.logger.warn(
        `[CronScheduler] "${job.name}" was paused on the server and has been unpaused to match its ` +
          'definition. If it was paused by `pauseOnFailure` or by hand, that pause is now gone — ' +
          `set \`disabled: true\` on the job to stop it across restarts, and check ${cronScheduleId(job.name)}'s ` +
          'run history for what paused it.',
      )
    }

    return { paused: job.disabled === true }
  }

  /** Deletes the job's Schedule. Absent is the desired state, so a missing one is not an error. */
  async remove(jobName: string): Promise<void> {
    const client = await this.client()

    try {
      await client.schedule.getHandle(cronScheduleId(jobName)).delete()
    } catch (error) {
      if (error instanceof ScheduleNotFoundError) return
      throw error
    }
  }

  /**
   * Reconciles the whole job list. Unlike the adapter this replaced it starts no Worker — the cron
   * Worker is its own process, and whether one is polling is deliberately not this method's
   * business: the schedules should exist whether or not a Worker happens to be up.
   *
   * `allSettled` rather than `all`, because from the change that registers this adapter it runs at
   * API boot: one malformed job must not take reconciliation down for every other one, and the
   * summary naming which schedules *did* land is exactly what is worth having when one did not.
   * It still throws — a boot that half-reconciled is not a boot that succeeded — but it throws
   * after every job has had its turn and after each failure has been named.
   */
  async start(jobs: JobDefinition[]): Promise<void> {
    const settled = await Promise.allSettled(jobs.map((job) => this.reconcile(job)))

    const failures: string[] = []
    let paused = 0

    settled.forEach((outcome, index) => {
      // `jobs[index]` is the job this outcome came from; the index is only unprovable to the
      // compiler, which cannot know `allSettled` preserves order.
      const name = jobs[index]?.name ?? `job #${index + 1}`

      if (outcome.status === 'fulfilled') {
        if (outcome.value.paused) paused += 1
        return
      }

      const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
      failures.push(`${name}: ${reason}`)
      this.logger.error(`[CronScheduler] Could not reconcile "${name}": ${reason}`)
    })

    const landed = jobs.length - failures.length
    this.logger.info(
      `[CronScheduler] Reconciled ${landed} of ${jobs.length} schedule(s) against '${this.taskQueue}', ` +
        `${paused} of them paused`,
    )

    if (failures.length > 0) {
      throw new AppError({
        type: ErrorTypes.UNEXPECTED_STATE,
        message:
          `[CronScheduler] ${failures.length} of ${jobs.length} schedule(s) could not be reconciled — ` +
          `${failures.join('; ')}`,
      })
    }
  }

  async shutdown(): Promise<void> {
    const connected = await this.handle?.catch(() => undefined)
    this.handle = undefined
    await connected?.close()
  }

  private async client(): Promise<Client> {
    // Caching the promise is what makes concurrent first calls share one connection instead of
    // racing to open several. Caching a *rejected* one would be a different thing entirely: a
    // Temporal that was unreachable at first use would fail every later call with that same stale
    // error until the process restarted, long after the server came back.
    this.handle ??= this.connect().catch((error: unknown) => {
      this.handle = undefined
      throw error
    })
    return (await this.handle).client
  }

  private optionsFor(job: JobDefinition): ScheduleOptions {
    const input: CronJobInput = {
      job: job.name,
      startToCloseTimeout: this.timeouts[job.name] ?? this.defaultTimeout,
      heartbeatTimeout: this.heartbeatTimeout,
    }

    return {
      scheduleId: cronScheduleId(job.name),
      /**
       * The job's cron string, passed through. Temporal accepts one directly, which is what lets
       * every existing `CronExpression` value carry over unchanged. No `timezone` is set, so the
       * server reads it as UTC — a schedule then means the same thing wherever it runs, which is
       * the only property worth having when the expression is written in a source file.
       */
      spec: { cronExpressions: [job.schedule] },
      action: {
        type: 'startWorkflow',
        workflowType: CRON_JOB_WORKFLOW_TYPE,
        taskQueue: this.taskQueue,
        args: [input],
      },
      policies: {
        // What the previous adapter gave implicitly, stated. A job slower than its interval must not overlap
        // itself; the tick that would have overlapped is dropped rather than queued.
        overlap: ScheduleOverlapPolicy.SKIP,
        // No analogue in the previous adapter. A job failing every minute stops after the first failure instead of
        // filling the history before anyone notices.
        pauseOnFailure: true,
        // `catchupWindow` left at the server default: what to do about ticks missed during an
        // outage is an operator's judgement, and `backfill` is how they express it.
      },
      state: { paused: job.disabled === true },
    }
  }
}

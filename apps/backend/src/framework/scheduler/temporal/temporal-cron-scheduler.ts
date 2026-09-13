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
 * - **Backfill** over a missed window, so an outage is replayed deliberately rather than lost.
 * - **A per-run history with the failure inside it**, so diagnosis does not depend on having kept
 *   the process's logs.
 * - **Overlap `SKIP` as a stated policy** rather than as something the library happened to do.
 *
 * ## Reconciliation
 *
 * `start()` is a **total desired-state sync**: create each job's Schedule or update it to match,
 * then delete every Schedule this code owns that the list does not name. A renamed or deleted job
 * takes its Schedule with it, so the Schedules tab is the source tree rather than the history of
 * every job that ever existed. `remove()` stays as the way to drop one by name.
 *
 * **The sweep is scoped by the `cron_` prefix `cronScheduleId()` stamps**, which is the rule about
 * what else may own a Schedule in this namespace: anything without that prefix is not ours and is
 * never touched.
 *
 * Deleting rather than pausing an orphan, because a paused orphan is indistinguishable in the UI
 * from a deliberately disabled job — and nothing is lost either way. Run history does not live in
 * the Schedule: past runs survive its deletion and stay queryable by the `TemporalScheduledById`
 * search attribute, bounded only by namespace retention.
 *
 * Deletion is safe *here* because the process that sweeps is the process that executes — the cron
 * Worker reconciles from the same import it builds its activity from, so "this Schedule exists" and
 * "this process can run it" are consequences of one thing. See ADR-0029.
 *
 * A disabled job still gets its Schedule, paused. That is what keeps "turn it back on" a one-line
 * edit rather than a rediscovery that the job ever existed.
 *
 * **The definition is authoritative, including the pause flag.** Every reconcile writes `paused`
 * from `disabled`, so enabling a job unpauses its Schedule exactly as disabling one pauses it, and
 * the source file is the only place the answer to "does this job run" lives. A pause applied in the
 * UI therefore survives only until the next boot, and unpausing one logs a warning naming what it
 * overruled — that is not a cost so much as the point: code is the only control plane for cron.
 *
 * `pauseOnFailure` is deliberately **not** set, as the one piece of cron state that could not be
 * expressed in the source tree. A job that fails keeps failing visibly; `disabled: true` is the only
 * thing that stops it.
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

/**
 * What marks a Schedule as this code's, and the whole of the rule the sweep is scoped by.
 *
 * Named rather than inlined so that "ours" reads as a string comparison rather than a heuristic:
 * every Schedule this adapter creates is named by `cronScheduleId()`, so every Schedule carrying
 * this prefix is one the sweep may delete and every Schedule without it belongs to someone else.
 */
const CRON_SCHEDULE_ID_PREFIX = 'cron_'

/** The Schedule id for a job. `cron_${name}`, which is the key the adapter this replaced used. */
export function cronScheduleId(jobName: string): string {
  return `${CRON_SCHEDULE_ID_PREFIX}${jobName}`
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
           * What this overwrites is a pause applied in the UI, which ADR-0029 records as an
           * unsupported operation rather than an accepted cost: code is the only control plane for
           * cron, and a pause meant to outlive a deploy belongs in the definition. `note` below and
           * the warning after this call are what keep the overwrite from being silent.
           */
          paused: job.disabled === true,
          /**
           * Overwritten rather than carried through, because `previous.state.note` is the sentence
           * explaining a pause this reconcile may have just cleared — the UI prompts for one.
           * Leaving it in place over a running schedule would leave "paused by an operator" sitting
           * under a job that is firing every minute.
           */
          note: `reconciled from the job definition at ${new Date().toISOString()}`,
        },
        typedSearchAttributes: previous.typedSearchAttributes,
      }
    })

    /**
     * Unpausing is the half of this that undoes someone else's decision, so it is the half that
     * gets said out loud. Nothing on the server pauses a schedule on its own any more — there is no
     * `pauseOnFailure` — so a pause found here was applied by hand, and the run history holds a
     * "why" that this process has just overruled on the strength of a flag in a source file.
     */
    if (wasPaused && !job.disabled) {
      this.logger.warn(
        `[CronScheduler] "${job.name}" was paused on the server and has been unpaused to match its ` +
          'definition. Pausing from the Temporal UI is not a supported operation — it lasts until ' +
          `the next reconcile — so set \`disabled: true\` on the job to stop it, and check ${cronScheduleId(job.name)}'s ` +
          'run history for what the pause was about.',
      )
    }

    return { paused: job.disabled === true }
  }

  /** Deletes the job's Schedule. Absent is the desired state, so a missing one is not an error. */
  async remove(jobName: string): Promise<void> {
    await this.deleteSchedule(cronScheduleId(jobName))
  }

  /**
   * Reconciles the whole job list, in both directions: every job gets its Schedule, and every
   * Schedule this code owns that no job names is deleted.
   *
   * Unlike the adapter this replaced it starts no Worker. It runs *in* one — the cron Worker calls
   * this at boot, before it begins polling, from the same job list it builds its activity from. That
   * is what makes the sweep safe: the list being swept against is the list that defines what can
   * run, so a Schedule can never outlive the process's ability to serve it.
   *
   * `allSettled` rather than `all`: one malformed job must not take reconciliation down for every
   * other one, and the summary naming which schedules *did* land is exactly what is worth having
   * when one did not. It still throws — a boot that half-reconciled is not a boot that succeeded —
   * but it throws after every job has had its turn and after each failure has been named.
   *
   * The sweep runs even when a reconcile failed, because a failure cannot make it delete something
   * it should not: what survives is decided by the job *list*, not by the outcomes.
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

    const swept = await this.sweep(jobs).catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error)
      failures.push(`sweep: ${reason}`)
      this.logger.error(`[CronScheduler] Could not sweep orphaned schedules: ${reason}`)
      return 0
    })

    const landed = jobs.length - failures.length
    this.logger.info(
      `[CronScheduler] Reconciled ${landed} of ${jobs.length} schedule(s) against '${this.taskQueue}', ` +
        `${paused} of them paused, and removed ${swept} no longer in the job list`,
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

  /**
   * Deletes every Schedule this code owns that the job list does not name, and returns how many.
   *
   * "Owns" is the `cron_` prefix and nothing else — a Schedule created by anything but
   * `cronScheduleId()` is outside the sweep by construction, which is the rule that makes deleting
   * safe in a namespace this process does not have to itself.
   *
   * `list()` reads the visibility store, which the server writes to asynchronously. That lag cannot
   * cost us a live Schedule: a name in `jobs` is kept whether or not the listing mentions it, and
   * one that has just been deleted comes back absent from the delete below rather than as an error.
   */
  private async sweep(jobs: JobDefinition[]): Promise<number> {
    const client = await this.client()
    const wanted = new Set(jobs.map((job) => cronScheduleId(job.name)))
    const orphans: string[] = []

    for await (const summary of client.schedule.list()) {
      if (!summary.scheduleId.startsWith(CRON_SCHEDULE_ID_PREFIX)) continue
      if (wanted.has(summary.scheduleId)) continue
      orphans.push(summary.scheduleId)
    }

    await Promise.all(
      orphans.map(async (scheduleId) => {
        await this.deleteSchedule(scheduleId)
        this.logger.info(
          `[CronScheduler] Removed "${scheduleId}", which no job in the list defines. Its past runs ` +
            'are unaffected and stay queryable by `TemporalScheduledById`.',
        )
      }),
    )

    return orphans.length
  }

  /** Absent is what a delete asks for, so a Schedule that is already gone is not a failure. */
  private async deleteSchedule(scheduleId: string): Promise<void> {
    const client = await this.client()

    try {
      await client.schedule.getHandle(scheduleId).delete()
    } catch (error) {
      if (error instanceof ScheduleNotFoundError) return
      throw error
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
        /**
         * `pauseOnFailure` is deliberately absent, where an earlier version of this adapter set it.
         *
         * It is the one piece of cron state that cannot be expressed in the source tree, and the
         * source tree is the only control plane for cron. It is also a wedge: reconciliation runs
         * once, at Worker boot, so a pause applied after the last Worker of a rollout has started is
         * never undone — a transient mid-rollout failure stops the job indefinitely with no code
         * change that explains it. The behaviour it guarded, a job failing every minute filling up
         * history, is bounded by namespace retention and is better visible than silenced.
         */
        // `catchupWindow` left at the server default: what to do about ticks missed during an
        // outage is an operator's judgement, and `backfill` is how they express it.
      },
      state: { paused: job.disabled === true },
    }
  }
}

import { CronExpression } from '@core/types/cron-expression.js'
import type { JobDefinition } from '@core/types/scheduler.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import {
  type ScheduleExecutionResult,
  type ScheduleHandle,
  ScheduleNotFoundError,
  ScheduleOverlapPolicy,
} from '@temporalio/client'
import { ActivityFailure, ApplicationFailure, RetryState, TimeoutFailure, TimeoutType } from '@temporalio/common'
import type { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { createTemporalDevServerEnvironment, TEMPORAL_BOOT_TIMEOUT } from '@tests/setup/temporal-test-env.js'
import { type AwilixContainer, asValue, createContainer } from 'awilix'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { noopLogger } from '../../../core/logger/noop-logger.js'
import { PAYLOAD_CONVERTER_PATH } from '../../temporal/config.js'
import { createCronActivities } from '../temporal/activities.js'
import { CRON_JOB_WORKFLOW_TYPE, CRON_WORKFLOWS_PATH, cronHeartbeatIntervalMs } from '../temporal/config.js'
import { cronScheduleId, TemporalCronScheduler } from '../temporal/temporal-cron-scheduler.js'
import { CRON_JOB_FAILURE_TYPE } from '../temporal/types.js'

/**
 * The `CronScheduler` port end to end: a real Temporal server, real Schedules, a real Worker
 * polling a real cron queue with the real payload converter, and the real driver workflow and
 * activity behind it. This is the file that replaces `bullmq-cron-scheduler.test.ts` — the same
 * seam, a different implementation behind it.
 *
 * Almost nothing here is *this code's* behaviour, which is why a double would prove nothing. The
 * schedule spec is the server's decoding of a cron string; pause-on-failure and overlap are
 * policies the server enforces; a start-to-close timeout is a clock the server runs; and a dead
 * Worker being noticed at all is the server acting on missing heartbeats. Asserting any of that
 * against a fake is asserting the test's own arithmetic.
 *
 * A full server rather than the time-skipping one the workflow engine's tests boot: Schedules are
 * not part of what that separate Java implementation supports, which is the same reason the event
 * bus's server test needs this one. See `tests/setup/temporal-test-env.ts`.
 *
 * Runs are triggered by hand rather than waited for. The BullMQ test needed a polling loop with a
 * ten-second budget to watch a once-a-minute schedule; a manual trigger is the same observation
 * without the wait, and it is also the operator affordance this migration is partly for.
 */

const TEST_TIMEOUT = 60_000

/** For the one test that boots a Worker of its own after killing another. */
const LONG_TEST_TIMEOUT = 120_000

/** This file's own queue, so nothing else on the server can claim its tasks. */
const TASK_QUEUE = 'proteus-cron-test'

/** A second queue, for the one test that has to kill the Worker polling it. */
const DOOMED_TASK_QUEUE = 'proteus-cron-test-doomed'

/**
 * Short, so "failed on the heartbeat rather than on the run's timeout" is a few seconds of test
 * rather than the half-minute production uses. The contrast is what the assertion reads, not the
 * absolute value: five seconds against the five-minute default start-to-close below.
 */
const HEARTBEAT_TIMEOUT_MS = 5_000
const HEARTBEAT_TIMEOUT = `${HEARTBEAT_TIMEOUT_MS}ms`

/** Deliberately shorter than `HEARTBEAT_TIMEOUT`, so the run's own timeout is what fires first. */
const IMPATIENT_JOB_TIMEOUT = '3 seconds'

let testEnv: TestWorkflowEnvironment
let worker: Worker
let workerRun: Promise<void>
/** Built alongside the one above, because bundling the driver is a hook-time cost, not a test one. */
let doomedWorker: Worker
let scheduler: TemporalCronScheduler
let container: AwilixContainer

/** Every job the Worker actually ran, in order. The whole of what these tests observe. */
const ran: string[] = []

/** What the handler was called with, so "the container-taking function" is checked, not assumed. */
const handlerArgs: AwilixContainer[] = []

/**
 * Lets a blocked handler finish. Held in a mutable module binding read through functions rather
 * than touched directly: the handler that assigns it runs inside the Worker, so narrowing at a call
 * site would be narrowing against an assignment TypeScript cannot see.
 */
let release: (() => void) | undefined

function blockedHandlerReached(): boolean {
  return release !== undefined
}

function releaseBlockedHandler(): void {
  const resolve = release
  release = undefined
  resolve?.()
}

async function block(): Promise<void> {
  await new Promise<void>((resolve) => {
    release = resolve
  })
}

const jobs: JobDefinition[] = [
  {
    name: 'recording-job',
    schedule: CronExpression.EVERY_DAY_AT_MIDNIGHT,
    handler: (resolved) => {
      ran.push('recording-job')
      handlerArgs.push(resolved)
    },
  },
  {
    name: 'disabled-job',
    schedule: CronExpression.EVERY_MINUTE,
    handler: () => {
      ran.push('disabled-job')
    },
    disabled: true,
  },
  {
    name: 'impatient-job',
    schedule: CronExpression.EVERY_HOUR,
    handler: async () => {
      ran.push('impatient-job')
      await block()
    },
  },
  {
    name: 'patient-job',
    schedule: CronExpression.EVERY_HOUR,
    handler: async () => {
      ran.push('patient-job')
      await block()
    },
  },
  {
    name: 'blocking-job',
    schedule: CronExpression.EVERY_HOUR,
    handler: async () => {
      ran.push('blocking-job')
      await block()
    },
  },
]

/**
 * Deliberately absent from `jobs` above, which is what the Worker is built with. A schedule can
 * outlive the job it names — a rename, a half-rolled-out deploy — and this is that schedule.
 */
const ghostJob: JobDefinition = {
  name: 'ghost-job',
  schedule: CronExpression.EVERY_HOUR,
  handler: () => {
    ran.push('ghost-job')
  },
}

/** A scheduler writing into this file's server, pointed at whichever queue the test runs a Worker on. */
function schedulerOn(taskQueue: string): TemporalCronScheduler {
  return new TemporalCronScheduler({
    logger: noopLogger,
    taskQueue,
    heartbeatTimeout: HEARTBEAT_TIMEOUT,
    startToCloseTimeout: { 'impatient-job': IMPATIENT_JOB_TIMEOUT },
    connect: async () => ({ client: testEnv.client, close: async () => undefined }),
  })
}

/** A Worker for this file's jobs, on whichever queue. The cron Worker's options, verbatim. */
async function workerOn(taskQueue: string): Promise<Worker> {
  return Worker.create({
    connection: testEnv.nativeConnection,
    namespace: testEnv.namespace,
    taskQueue,
    // The driver has to be registered: a Schedule's action can only start a workflow.
    workflowsPath: CRON_WORKFLOWS_PATH,
    dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH },
    activities: createCronActivities({ container, jobs }),
    // The production Worker's line, and load-bearing here for the same reason: without it core
    // delivers one beat per `0.8 * timeout` however often the wrapper calls `heartbeat()`, and
    // "survives past its heartbeat timeout" below would be passing on a one-second margin.
    maxHeartbeatThrottleInterval: cronHeartbeatIntervalMs(HEARTBEAT_TIMEOUT_MS),
  })
}

/**
 * The same Worker, but one that can be made to die rather than to drain.
 *
 * `shutdownForceTime` is what makes "killed abruptly" mean something: past it the SDK gives up and
 * leaves the running activity uncleaned, so nothing ever tells the server how that run ended. That
 * is what a crashed process looks like from the server's side, and it is the only thing a heartbeat
 * can distinguish from a slow job.
 */
async function doomedWorkerOn(taskQueue: string): Promise<Worker> {
  return Worker.create({
    connection: testEnv.nativeConnection,
    namespace: testEnv.namespace,
    taskQueue,
    workflowsPath: CRON_WORKFLOWS_PATH,
    dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH },
    activities: createCronActivities({ container, jobs }),
    maxHeartbeatThrottleInterval: cronHeartbeatIntervalMs(HEARTBEAT_TIMEOUT_MS),
    shutdownGraceTime: '1s',
    shutdownForceTime: '2s',
  })
}

/**
 * A scheduler that records what it warned about, so the operational signal the never-unpause
 * decision owes an operator is asserted rather than assumed.
 */
function schedulerCollectingWarnings(warnings: string[]): TemporalCronScheduler {
  return new TemporalCronScheduler({
    logger: {
      ...noopLogger,
      warn(message) {
        warnings.push(message)
      },
    },
    taskQueue: TASK_QUEUE,
    heartbeatTimeout: HEARTBEAT_TIMEOUT,
    connect: async () => ({ client: testEnv.client, close: async () => undefined }),
  })
}

function handleFor(jobName: string): ScheduleHandle {
  return testEnv.client.schedule.getHandle(cronScheduleId(jobName))
}

/**
 * Triggers the schedule and hands back the action the server recorded for it.
 *
 * The poll is not politeness. `trigger()` is a `PatchSchedule` RPC the server applies
 * asynchronously, so a `describe()` issued straight after it can legitimately come back before the
 * action exists — and reading `recentActions.at(-1)` at that moment gets the *previous* run, or
 * nothing at all. Counting from before the trigger is what makes "the run this test started"
 * unambiguous even when the schedule has run before.
 */
async function triggerRun(handle: ScheduleHandle): Promise<ScheduleExecutionResult> {
  const before = (await handle.describe()).info.recentActions.length
  await handle.trigger()

  const deadline = Date.now() + 20_000
  for (;;) {
    const actions = (await handle.describe()).info.recentActions
    const recent = actions.at(-1)
    if (actions.length > before && recent) return recent

    if (Date.now() > deadline) {
      throw new Error(`schedule "${handle.scheduleId}" recorded no action after trigger()`)
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

/** The workflow an action started, waited to whichever terminal state, failure returned not thrown. */
async function outcomeOf(action: ScheduleExecutionResult): Promise<unknown> {
  const { workflowId, firstExecutionRunId } = action.action.workflow
  return await testEnv.client.workflow
    .getHandle(workflowId, firstExecutionRunId)
    .result()
    .then(() => undefined)
    .catch((error: unknown) => error)
}

describe('the temporal cron scheduler', () => {
  beforeAll(async () => {
    testEnv = await createTemporalDevServerEnvironment()

    container = createContainer()
    container.register({ [ContainerRegistrationKeys.LOGGER]: asValue(noopLogger) })

    worker = await workerOn(TASK_QUEUE)
    workerRun = worker.run()
    // Marks it handled, so a shutdown-time rejection cannot surface as an unhandled one.
    void workerRun.catch(() => undefined)

    // Created now, started later: the last test needs a Worker it can kill, and building one costs
    // a webpack pass over the driver that belongs in the hook's budget rather than the test's. Its
    // replacement cannot be built here too — the SDK refuses two Workers on one task queue in one
    // process — so that one is built in the test, once this one is gone.
    doomedWorker = await doomedWorkerOn(DOOMED_TASK_QUEUE)

    scheduler = schedulerOn(TASK_QUEUE)
    await scheduler.start(jobs)
  }, TEMPORAL_BOOT_TIMEOUT)

  afterAll(async () => {
    releaseBlockedHandler()
    worker?.shutdown()
    await workerRun?.catch(() => undefined)
    await scheduler?.shutdown()
    await testEnv?.teardown()
  })

  it(
    'creates a schedule whose spec, overlap policy and pause-on-failure match the job',
    async () => {
      const description = await handleFor('recording-job').describe()

      // Stated policies rather than whatever the library happened to do. `SKIP` is the behaviour
      // the BullMQ adapter documented and got implicitly; `pauseOnFailure` had no analogue at all.
      expect(description.policies).toMatchObject({
        overlap: ScheduleOverlapPolicy.SKIP,
        pauseOnFailure: true,
      })

      // The action is a workflow on the cron queue, because a Schedule cannot start anything else.
      expect(description.action).toMatchObject({
        type: 'startWorkflow',
        workflowType: CRON_JOB_WORKFLOW_TYPE,
        taskQueue: TASK_QUEUE,
      })

      // The server decodes a cron string into a calendar, so `'0 0 * * *'` comes back as midnight
      // rather than as the string it went in as.
      expect(description.spec.calendars?.[0]).toMatchObject({
        hour: [{ start: 0, end: 0, step: 1 }],
        minute: [{ start: 0, end: 0, step: 1 }],
      })

      // No timezone was set, so the server reads the expression as UTC — which is the property
      // that makes a cron string in a source file mean the same thing wherever it is deployed.
      const next = description.info.nextActionTimes[0]
      expect(next?.getUTCHours()).toBe(0)
      expect(next?.getUTCMinutes()).toBe(0)
    },
    TEST_TIMEOUT,
  )

  it(
    'leaves a disabled job paused rather than firing',
    async () => {
      const description = await handleFor('disabled-job').describe()

      // Created, not skipped: turning the job back on should not have to rediscover that it existed.
      expect(description.state.paused).toBe(true)
      // And nothing ran. `nextActionTimes` is deliberately not asserted empty — the server keeps
      // reporting the times a paused schedule *would* fire at, which is what makes unpausing
      // predictable; `paused` is the field that decides whether it does.
      expect(description.info.numActionsTaken).toBe(0)
      expect(description.info.runningActions).toEqual([])
      expect(ran).not.toContain('disabled-job')
    },
    TEST_TIMEOUT,
  )

  it(
    'runs the handler through the driver workflow and the activity when triggered by hand',
    async () => {
      ran.length = 0
      handlerArgs.length = 0

      const action = await triggerRun(handleFor('recording-job'))

      // Nothing here is mocked: schedule action -> driver workflow on the cron queue -> activity ->
      // the container-taking function, on a real Worker.
      await expect(outcomeOf(action)).resolves.toBeUndefined()
      expect(ran).toEqual(['recording-job'])
      // The handler got the container the Worker was built with, which is the whole of what
      // `JobDefinition` promises a job author.
      expect(handlerArgs[0]).toBe(container)
    },
    TEST_TIMEOUT,
  )

  it(
    'fails the run when a handler outruns its start-to-close timeout',
    async () => {
      ran.length = 0
      releaseBlockedHandler()

      try {
        const failure = await outcomeOf(await triggerRun(handleFor('impatient-job')))

        // Failed, not hung — and failed on the *run's* timeout, which is the per-job knob the
        // scheduler was constructed with rather than any default.
        expect(timeoutTypeOf(failure)).toBe(TimeoutType.START_TO_CLOSE)
        expect(ran).toEqual(['impatient-job'])
      } finally {
        releaseBlockedHandler()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'keeps a live run alive past its heartbeat timeout',
    async () => {
      ran.length = 0
      releaseBlockedHandler()

      try {
        const action = await triggerRun(handleFor('patient-job'))
        await waitFor(blockedHandlerReached)

        // Twice the heartbeat timeout, on a Worker that is perfectly healthy. Without the wrapper's
        // heartbeat the server has nothing to distinguish this from the dead Worker in the next
        // test, and fails a run that was going to succeed — which is why this assertion and that
        // one only mean something together.
        //
        // Two whole windows rather than one and a bit, because that is what the delivery throttle
        // now affords: beats land every `HEARTBEAT_TIMEOUT_MS / HEARTBEATS_PER_TIMEOUT`, so the
        // margin is two thirds of the deadline and does not depend on the machine being idle.
        await new Promise((resolve) => setTimeout(resolve, HEARTBEAT_TIMEOUT_MS * 2))
        releaseBlockedHandler()

        await expect(outcomeOf(action)).resolves.toBeUndefined()
        expect(ran).toEqual(['patient-job'])
      } finally {
        releaseBlockedHandler()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'leaves an enabled job paused when its schedule was already paused, and says so',
    async () => {
      const warnings: string[] = []
      const speaking = schedulerCollectingWarnings(warnings)
      const toggled: JobDefinition = {
        name: 'toggled-job',
        schedule: CronExpression.EVERY_DAY_AT_MIDNIGHT,
        handler: () => undefined,
        disabled: true,
      }

      try {
        await speaking.schedule(toggled)
        expect((await handleFor('toggled-job').describe()).state.paused).toBe(true)

        // Enabled now, and with a different cron expression — so that "still paused" cannot be
        // explained by the update having been a no-op. The spec must move; the pause must not.
        await speaking.schedule({ ...toggled, schedule: CronExpression.EVERY_DAY_AT_NOON, disabled: false })

        const description = await handleFor('toggled-job').describe()
        expect(description.spec.calendars?.[0]).toMatchObject({ hour: [{ start: 12, end: 12, step: 1 }] })

        // The deliberate deviation from "reconcile to the declared state", pinned. `pauseOnFailure`
        // and an operator's own pause write this one flag and Temporal cannot tell them apart, so
        // clearing it at boot would undo an incident containment on the next deploy.
        expect(description.state.paused).toBe(true)

        // And it is not silent, which is the whole of what makes the deviation affordable.
        expect(warnings.join('\n')).toContain('"toggled-job" is enabled but its schedule is paused')
      } finally {
        await speaking.remove('toggled-job')
        await speaking.shutdown()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'removes a schedule, and treats an already-absent one as the desired state',
    async () => {
      const removable: JobDefinition = {
        name: 'removable-job',
        schedule: CronExpression.EVERY_HOUR,
        handler: () => undefined,
      }

      await scheduler.schedule(removable)
      expect((await handleFor('removable-job').describe()).scheduleId).toBe(cronScheduleId('removable-job'))

      await scheduler.remove('removable-job')
      await expect(handleFor('removable-job').describe()).rejects.toBeInstanceOf(ScheduleNotFoundError)

      // Absent is what `remove` is asking for, so a schedule that is already gone is not a failure
      // — reconciliation and a re-run of a teardown both call this for names that may never have
      // existed. The bare await is the assertion: it throws on the second path if this regresses.
      await scheduler.remove('never-scheduled-job')
      await expect(handleFor('never-scheduled-job').describe()).rejects.toBeInstanceOf(ScheduleNotFoundError)
    },
    TEST_TIMEOUT,
  )

  it(
    'fails a run without retrying when the Worker has no such job registered',
    async () => {
      ran.length = 0

      try {
        await scheduler.schedule(ghostJob)
        const failure = await outcomeOf(await triggerRun(handleFor('ghost-job')))

        // The job name is in the message because that is the whole of what an operator has to go
        // on: nobody awaited this run and no route handler will report it.
        expect(applicationFailureIn(failure)?.message).toContain('No job is registered as "ghost-job"')
        expect(applicationFailureIn(failure)?.type).toBe(CRON_JOB_FAILURE_TYPE)

        // Non-retryable, and distinguishable from "ran out of attempts": the lookup happens before
        // any handler runs, so repeating it produces the same answer until the budget is gone.
        // `MAXIMUM_ATTEMPTS_REACHED` is what the other failing cases in this file report.
        expect(activityFailureIn(failure)?.retryState).toBe(RetryState.NON_RETRYABLE_FAILURE)
        expect(ran).toEqual([])
      } finally {
        await scheduler.remove('ghost-job')
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'fails the run on the heartbeat timeout when the Worker dies mid-job',
    async () => {
      ran.length = 0
      releaseBlockedHandler()

      const doomedScheduler = schedulerOn(DOOMED_TASK_QUEUE)
      const doomedRun = doomedWorker.run()
      void doomedRun.catch(() => undefined)

      try {
        // `beforeAll` already scheduled this job against the other queue, so this goes down the
        // adapter's *update* path — the half of reconciliation a first boot never exercises — and
        // repoints the action at the Worker this test is about to kill.
        await doomedScheduler.schedule(blockingJob())
        const action = await triggerRun(handleFor('blocking-job'))

        // Wait until the handler is actually inside the Worker, so what follows kills a *running*
        // activity rather than racing the dispatch.
        await waitFor(blockedHandlerReached)

        // A crash, as closely as one process can simulate it: after the force time the SDK gives up
        // on the drain and leaves the activity uncleaned, so no further heartbeat reaches the
        // server. Nothing tells the server this run is over — which is the point.
        const started = Date.now()
        doomedWorker.shutdown()
        await doomedRun.catch(() => undefined)

        // A replacement, because a run is only *declared* failed by a Worker that answers the
        // workflow task the timeout produced — one replica restarting, or another already polling.
        // It is given no activity to run: `maximumAttempts: 1` means the timed-out attempt is the
        // only one, so all this Worker does is close the execution with the failure in it.
        const replacementWorker = await workerOn(DOOMED_TASK_QUEUE)
        const replacementRun = replacementWorker.run()
        void replacementRun.catch(() => undefined)

        const failure = await outcomeOf(action)
        const elapsed = Date.now() - started

        replacementWorker.shutdown()
        await replacementRun.catch(() => undefined)

        // The assertion that makes the heartbeat a tested property rather than a hopeful one:
        // delete the wrapper's heartbeat and this run sits healthy until the five-minute
        // start-to-close elapses, while every other test in this file stays green.
        expect(timeoutTypeOf(failure)).toBe(TimeoutType.HEARTBEAT)
        expect(elapsed).toBeLessThan(60_000)
      } finally {
        releaseBlockedHandler()
        await doomedScheduler.shutdown()
      }
    },
    // Longer than the others: this one builds a Worker of its own partway through, which is a
    // webpack pass over the driver that the hook cannot pay for it.
    LONG_TEST_TIMEOUT,
  )
})

function blockingJob(): JobDefinition {
  const job = jobs.find((candidate) => candidate.name === 'blocking-job')
  if (!job) throw new Error("blocking-job is missing from this file's job list")
  return job
}

/**
 * The `TimeoutType` inside a failed workflow's cause chain, or `undefined` if it did not time out.
 * The classes are the SDK's, so the chain is walked structurally rather than with a cast.
 */
function timeoutTypeOf(error: unknown): TimeoutType | undefined {
  return causeChain(error).find((link) => link instanceof TimeoutFailure)?.timeoutType
}

/** The activity-level failure, which carries the retry verdict the server reached. */
function activityFailureIn(error: unknown): ActivityFailure | undefined {
  return causeChain(error).find((link) => link instanceof ActivityFailure)
}

/** The failure the activity itself raised, with the message and type it chose. */
function applicationFailureIn(error: unknown): ApplicationFailure | undefined {
  return causeChain(error).find((link) => link instanceof ApplicationFailure)
}

/** A failed workflow's causes, outermost first. Bounded, because a cycle here would hang the suite. */
function causeChain(error: unknown): Error[] {
  const chain: Error[] = []
  let current: unknown = error
  while (current instanceof Error && chain.length < 8) {
    chain.push(current)
    current = current.cause
  }
  return chain
}

/** Polls a condition the Worker satisfies from another task. Cheaper than plumbing a signal out. */
async function waitFor(condition: () => boolean, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for the Worker to reach the handler')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

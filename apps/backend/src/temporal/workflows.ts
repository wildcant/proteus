import {
  type ActivityOptions,
  ApplicationFailure,
  proxyActivities,
  type RetryPolicy,
  TemporalFailure,
} from '@temporalio/workflow'
import type { Activities } from './activities.js'
import { readStepFailureDetail, STEP_FAILURE_TYPE } from './failure-details.js'
import type {
  AdvanceWorkflowInput,
  AdvanceWorkflowResult,
  DriverInput,
  StepFailureDetail,
  StepOutput,
} from './types.js'

/**
 * Workflow code is bundled into a deterministic isolate with no filesystem, no network and no
 * clock, so it may only import from `@temporalio/workflow`. The activities import is type-only and
 * erases at build time; the calls below go over the task queue, not through that binding.
 * `failure-details.js` is the one real import, and it is deliberately dependency-free.
 */

const { ping } = proxyActivities<Activities>({ startToCloseTimeout: '10 seconds' })

export async function pingWorkflow(name: string): Promise<string> {
  return await ping(name)
}

/**
 * The generic driver. Every Proteus workflow runs as an execution of *this* function.
 *
 * There is no Proteus code in here on purpose: the handler with its closures stays in the Worker
 * process and is re-entered through `advanceWorkflow`, which returns one step's output at a time.
 * Because nothing application-specific is bundled into the sandbox, the determinism burden that
 * normally governs Temporal workflow code does not apply to the workflows anyone actually writes
 * — it applies to these thirty lines, which do not change.
 *
 * The loop is the whole design: accumulate outputs, hand them back, stop when the handler returns.
 */
export async function proteusWorkflow(driver: DriverInput): Promise<unknown> {
  const outputs: StepOutput[] = []
  let fingerprint: string | null = null
  /**
   * The name of the step the next Activity will run, reported by the previous one's lookahead and
   * spent on that Activity's label. `null` for the first, which is the one Activity nothing can
   * name in advance: no step has run, so no replay has reached a `ctx.step` yet. Naming it would
   * mean running handler glue in the process that starts the execution, which is the one thing this
   * driver exists to avoid.
   */
  let next: string | null = null

  try {
    for (;;) {
      const result = await advance(driver, { name: driver.name, input: driver.input, outputs, fingerprint }, next)
      if (result.done) return result.output

      outputs.push({ value: result.output })
      fingerprint = result.fingerprint
      next = result.next
    }
  } catch (error) {
    await compensate(driver, outputs)
    throw asWorkflowFailure(error)
  }
}

/**
 * Anything that is not already a Temporal failure has to be turned into one before it leaves this
 * function. The TypeScript SDK treats an unrecognised error thrown from workflow code as a *task*
 * failure and retries the task forever, so a bug in here — a payload that will not encode, say —
 * would present as a request that never returns rather than as a failure anyone can see.
 */
function asWorkflowFailure(error: unknown): unknown {
  if (error instanceof TemporalFailure) return error

  const message = error instanceof Error ? error.message : String(error)
  const detail: StepFailureDetail = {
    step: null,
    nonRetryable: true,
    error: { kind: 'plain', name: error instanceof Error ? error.name : 'Error', message },
  }

  return ApplicationFailure.create({ type: STEP_FAILURE_TYPE, message, nonRetryable: true, details: [detail] })
}

/**
 * Runs one step, then decides whether the step it just lost is allowed a second try.
 *
 * The first attempt always runs with `maximumAttempts: 1`, which is what makes this adapter
 * behaviour-identical to the simple one: nothing retries by default, because today's steps are
 * not idempotent — a retried `add-to-cart` creates the line item twice.
 *
 * The retry opt-in is keyed by step *name*, and the driver only learns the name from the failure,
 * so the retry can only be arranged after the first attempt has already failed. Hence two
 * invocations rather than one policy: attempt one, then the remaining attempts under the policy
 * that step opted into. Temporal owns the backoff and the durability of the second invocation,
 * which is the point of doing it this way rather than looping here.
 *
 * `step` is the name the *previous* advance reported, and scheduling under that name is what makes
 * the Temporal UI label the row `authorize-payment` rather than `advanceWorkflow` — the UI takes
 * the label from the Activity type, so nothing short of changing the type moves it. The Worker
 * registers one alias of `advanceWorkflow` per step name and only ever reports a name it
 * registered, so this cannot schedule something nothing will answer.
 */
async function advance(driver: DriverInput, input: AdvanceWorkflowInput, step: string | null) {
  /** 1-based, so the id reads in execution order: `3-authorize-payment`. */
  const position = input.outputs.length + 1
  const type = step ?? ADVANCE_ACTIVITY

  const once = advanceActivity(type, {
    startToCloseTimeout: driver.startToCloseTimeout,
    retry: { maximumAttempts: 1 },
    activityId: `${position}-${type}`,
  })

  try {
    return await once(input)
  } catch (error) {
    const detail = readStepFailureDetail(error)
    if (!detail || detail.nonRetryable || !detail.step) throw error

    const policy = driver.retry[detail.step] ?? driver.defaultRetry
    const remaining = remainingAttempts(policy)
    if (policy === undefined || remaining === undefined) throw error

    const retried = advanceActivity(type, {
      startToCloseTimeout: driver.startToCloseTimeout,
      retry: { ...policy, maximumAttempts: remaining },
      // A distinct id because this is a second Activity, not a second attempt of the first, and
      // Temporal rejects a duplicate. It keeps the first invocation's `type`: the failure names the
      // step, but nothing here can tell whether that name is one the Worker registered, and
      // scheduling an unregistered type would turn a retryable failure into `ActivityNotFound`.
      // `summary` carries the name instead, which is the only label this row can otherwise get.
      activityId: `${position}-${type}-retry`,
      ...(step ? {} : { summary: detail.step }),
    })

    return await retried(input)
  }
}

/** The Activity every alias is an alias of, and the fallback type when no step name is known. */
const ADVANCE_ACTIVITY = 'advanceWorkflow'

type AdvanceActivity = (input: AdvanceWorkflowInput) => Promise<AdvanceWorkflowResult>

/**
 * `proxyActivities` turns a property name into the scheduled Activity type, which is the whole
 * mechanism here — the type has to be a value, not a fixed method name, so the proxy is indexed
 * rather than called through `Activities`.
 */
function advanceActivity(type: string, options: ActivityOptions): AdvanceActivity {
  const activity = proxyActivities<Record<string, AdvanceActivity>>(options)[type]
  if (activity) return activity

  // Unreachable: the proxy answers every property. It is checked because `noUncheckedIndexedAccess`
  // cannot know that, and a non-null assertion is not allowed here.
  throw ApplicationFailure.nonRetryable(`[temporal] could not proxy an Activity named "${type}"`)
}

/**
 * Best effort by design. The compensations themselves already swallow their own errors inside the
 * Activity; if the Activity as a whole cannot run, the caller still has to see the failure that
 * started the rollback rather than one from the rollback.
 */
async function compensate(driver: DriverInput, outputs: StepOutput[]): Promise<void> {
  if (outputs.length === 0) return

  const { compensateWorkflow } = proxyActivities<Activities>({
    startToCloseTimeout: driver.startToCloseTimeout,
    retry: { maximumAttempts: 1 },
  })

  try {
    await compensateWorkflow({ name: driver.name, input: driver.input, outputs })
  } catch {
    // Swallowed — the original failure is what fails this workflow.
  }
}

/**
 * How many attempts are left for the *second* invocation, given one has already been spent.
 * `undefined` means "do not retry", and every path that is not an explicit finite count above one
 * lands there.
 *
 * The unset and zero cases are the ones that matter. Temporal reads `maximumAttempts: 0` — and an
 * absent `maximumAttempts` — as *unlimited*, so passing either through would turn a policy that
 * only meant to tune backoff into infinite retries of a card authorization. Defaulting the other
 * way costs a retry that someone has to ask for again, explicitly; defaulting Temporal's way
 * charges a shopper twice. `createTemporalWorkflowEngine` already rejects such a policy at the
 * composition root, where the mistake is legible; this is the same rule restated where the
 * decision is actually taken, because the driver's input is data and data can arrive from
 * anywhere.
 */
function remainingAttempts(policy: RetryPolicy | undefined): number | undefined {
  const attempts = policy?.maximumAttempts
  if (typeof attempts !== 'number' || !Number.isFinite(attempts) || attempts <= 1) return undefined
  return Math.floor(attempts) - 1
}

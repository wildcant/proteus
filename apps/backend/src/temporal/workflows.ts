import { ApplicationFailure, proxyActivities, type RetryPolicy, TemporalFailure } from '@temporalio/workflow'
import type { Activities } from './activities.js'
import { readStepFailureDetail, STEP_FAILURE_TYPE } from './failure-details.js'
import type { AdvanceWorkflowInput, DriverInput, StepFailureDetail, StepOutput } from './types.js'

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

  try {
    for (;;) {
      const result = await advance(driver, { name: driver.name, input: driver.input, outputs, fingerprint })
      if (result.done) return result.output

      outputs.push({ value: result.output })
      fingerprint = result.fingerprint
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
 */
async function advance(driver: DriverInput, input: AdvanceWorkflowInput) {
  const once = proxyActivities<Activities>({
    startToCloseTimeout: driver.startToCloseTimeout,
    retry: { maximumAttempts: 1 },
  })

  try {
    return await once.advanceWorkflow(input)
  } catch (error) {
    const detail = readStepFailureDetail(error)
    if (!detail || detail.nonRetryable || !detail.step) throw error

    const policy = driver.retry[detail.step] ?? driver.defaultRetry
    const remaining = remainingAttempts(policy)
    if (policy === undefined || remaining === undefined) throw error

    const retried = proxyActivities<Activities>({
      startToCloseTimeout: driver.startToCloseTimeout,
      retry: { ...policy, maximumAttempts: remaining },
    })

    return await retried.advanceWorkflow(input)
  }
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

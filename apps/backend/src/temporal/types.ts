import type { Duration, RetryPolicy } from '@temporalio/common'

/**
 * The wire contract between the generic driver Workflow, the replay Activities and the adapter
 * that starts them. Types only — the driver runs inside Temporal's v8 sandbox, so anything it
 * imports for real is bundled with it, and everything here erases at build time.
 */

/** What `createTemporalWorkflowEngine` hands the driver. One value, so the args list never grows. */
export type DriverInput = {
  /** `WorkflowDefinition.name`, the key the Activity looks the handler up by. */
  name: string
  input: unknown
  /**
   * Per-step retry, keyed by `ctx.step` name. Empty by default: today's steps are not idempotent
   * (`add-to-cart` creates line items, `create-order-fulfillment` moves stock), so a retry
   * double-executes. A step earns an entry here once it is proven safe to run twice.
   */
  retry: Record<string, RetryPolicy>
  /** Applied to every step of a workflow declared `idempotent: true`. */
  defaultRetry?: RetryPolicy
  startToCloseTimeout: Duration
}

/**
 * One completed step's output, boxed.
 *
 * Boxed rather than stored bare because plenty of steps return nothing —
 * `complete-cart`'s `validate-cart-items` and `mark-cart-completed`, `add-to-cart`'s
 * `confirm-inventory` — and the payload converter refuses `undefined` inside an array, correctly:
 * JSON writes it as `null`, which is a value change rather than a failure. As an *object property*
 * `undefined` is dropped and read back as `undefined`, which is exactly the round trip a void step
 * needs, so the box is what makes "this step returned nothing" survive the wire intact.
 */
export type StepOutput = { value: unknown }

export type AdvanceWorkflowInput = {
  name: string
  input: unknown
  /** Outputs of every step completed so far, in call order. Index `i` is the `i`-th `ctx.step`. */
  outputs: StepOutput[]
  /** Fingerprint of the step sequence as of `outputs.length` steps; `null` before the first. */
  fingerprint: string | null
}

export type AdvanceWorkflowResult =
  | { done: true; output: unknown }
  | { done: false; step: string; output: unknown; fingerprint: string }

export type CompensateWorkflowInput = {
  name: string
  input: unknown
  outputs: StepOutput[]
}

/**
 * What the unwind managed to do. Reported so the Worker can log it — a compensation that throws is
 * swallowed so the rest still run, which is the simple adapter's behaviour and must stay, but
 * swallowing it silently means a rollback can fail completely and leave no trace anywhere.
 */
export type CompensateWorkflowResult = {
  compensated: string[]
  failed: { step: string; message: string }[]
}

/**
 * The original error, flattened so it can cross the Temporal boundary and be rebuilt on the other
 * side. Without this a `WorkflowTerminalError({ type: CONFLICT })` reaches the route handler as an
 * opaque `ActivityFailure` and a 409 becomes a 500.
 */
export type SerializedError = {
  kind: 'app' | 'terminal' | 'plain'
  name: string
  message: string
  /** `ErrorTypes` value, for the two `AppError`-shaped kinds. */
  type?: string
  code?: string
}

/** The payload every step failure carries in its `ApplicationFailure.details`. */
export type StepFailureDetail = {
  /** The `ctx.step` name that failed, or `null` when the handler failed between steps. */
  step: string | null
  nonRetryable: boolean
  error: SerializedError
}

import type { StepFailureDetail } from './types.js'

/**
 * Shared by the driver Workflow, the Activities and the client-side adapter, so it is written
 * against plain object shapes rather than `instanceof ApplicationFailure`: the driver half runs
 * inside Temporal's sandbox, where importing the non-workflow half of the SDK is a bundling
 * hazard for no gain — the failure has already been decoded by the time either side reads it.
 */

/** `ApplicationFailure.type` for every failure this adapter raises. */
export const STEP_FAILURE_TYPE = 'ProteusWorkflowStepFailure'

/** Guards against walking a cyclic `cause` chain, which a hand-written failure could carry. */
const MAX_CAUSE_DEPTH = 16

/**
 * Digs the step detail out of whatever Temporal wrapped it in — `WorkflowFailedError` →
 * `ActivityFailure` → `ApplicationFailure` on the client, one layer less inside the driver.
 * Returns `undefined` for anything this adapter did not raise (a timeout, a cancellation), which
 * both callers treat as "not a step failure" and pass through untouched.
 */
export function readStepFailureDetail(error: unknown): StepFailureDetail | undefined {
  let current: unknown = error

  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current != null; depth += 1) {
    const candidate = current as { type?: unknown; details?: unknown; cause?: unknown }

    if (candidate.type === STEP_FAILURE_TYPE && Array.isArray(candidate.details)) {
      const detail = candidate.details[0]
      if (isStepFailureDetail(detail)) return detail
    }

    current = candidate.cause
  }

  return undefined
}

function isStepFailureDetail(value: unknown): value is StepFailureDetail {
  if (typeof value !== 'object' || value === null) return false
  const detail = value as Partial<StepFailureDetail>
  return typeof detail.nonRetryable === 'boolean' && typeof detail.error?.message === 'string'
}

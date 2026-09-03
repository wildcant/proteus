import { ApplicationFailure } from '@temporalio/common'
import { AppError, ErrorTypes } from '../core/errors/app-error.js'
import { WorkflowTerminalError } from '../core/workflows/types.js'
import { STEP_FAILURE_TYPE } from './failure-details.js'
import type { SerializedError, StepFailureDetail } from './types.js'

/**
 * Errors crossing the Temporal boundary, in both directions.
 *
 * Temporal transports a failure as a protobuf `Failure`, not as a JavaScript error: everything a
 * route handler reads off an `AppError` — `type`, `code` — is gone by the time the client sees it,
 * and `errorHandler` would map a rolled-back checkout to 500 instead of 409. So the Activity
 * flattens the error into the failure's `details` and the adapter rebuilds it, which is what makes
 * the Temporal adapter's HTTP behaviour identical to the simple adapter's.
 *
 * Node-side only: `@temporalio/common` is not part of the workflow sandbox's allowed imports, so
 * the driver reads the same details through `failure-details.ts` instead.
 */

const ERROR_TYPES = new Set<string>(Object.values(ErrorTypes))

/**
 * `WorkflowTerminalError` is a business-rule verdict — "this cart is already completed" — so it
 * must never be retried, however generous the step's policy is. `nonRetryable` is honoured by
 * Temporal itself, ahead of the retry policy, which is why the flag lives on the failure rather
 * than in a `nonRetryableErrorTypes` list the caller could forget to pass.
 */
export function isTerminal(error: unknown): boolean {
  return error instanceof WorkflowTerminalError
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof WorkflowTerminalError) {
    const cause = AppError.isError(error.cause) ? error.cause : undefined
    return {
      kind: 'terminal',
      name: error.name,
      message: error.message,
      type: cause?.type,
      code: cause?.code,
    }
  }

  if (AppError.isError(error)) {
    return { kind: 'app', name: error.name, message: error.message, type: error.type, code: error.code }
  }

  if (error instanceof Error) {
    return { kind: 'plain', name: error.name, message: error.message }
  }

  return { kind: 'plain', name: 'Error', message: String(error) }
}

/**
 * Rebuilds the error a caller would have caught from the simple adapter. Not the same object —
 * the stack is the client's, not the Worker's — but the same class, message, `type` and `code`,
 * which is everything `errorHandler` and the existing tests read.
 */
export function deserializeError(serialized: SerializedError): Error {
  const type = serialized.type && ERROR_TYPES.has(serialized.type) ? (serialized.type as ErrorTypes) : undefined

  if (serialized.kind === 'terminal') {
    return new WorkflowTerminalError(
      new AppError({
        type: type ?? ErrorTypes.UNEXPECTED_STATE,
        message: serialized.message,
        ...(serialized.code ? { code: serialized.code } : {}),
      }),
    )
  }

  if (serialized.kind === 'app') {
    return new AppError({
      type: type ?? ErrorTypes.UNEXPECTED_STATE,
      message: serialized.message,
      ...(serialized.code ? { code: serialized.code } : {}),
    })
  }

  const rebuilt = new Error(serialized.message)
  rebuilt.name = serialized.name
  return rebuilt
}

/**
 * Wraps a step failure so Temporal can carry it and both the driver and the adapter can read it
 * back. `nonRetryable` is decided here rather than by the caller's retry policy: a terminal error
 * and a changed step sequence are verdicts, and re-running them would only produce the same
 * verdict against state that has already moved.
 */
export function toStepApplicationFailure(input: {
  error: unknown
  step: string | null
  nonRetryable: boolean
}): ApplicationFailure {
  const detail: StepFailureDetail = {
    step: input.step,
    nonRetryable: input.nonRetryable,
    error: serializeError(input.error),
  }

  return ApplicationFailure.create({
    type: STEP_FAILURE_TYPE,
    message: input.step ? `step "${input.step}": ${detail.error.message}` : detail.error.message,
    nonRetryable: input.nonRetryable,
    details: [detail],
  })
}

import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { WorkflowTerminalError } from '@core/workflows/types.js'

/**
 * Rethrows a payment module refusal — an amount over what is outstanding or refundable, a provider
 * that cannot take part of an authorization — as terminal, because it is the caller's to fix and a
 * retry would ask the same question. Anything else is rethrown unchanged.
 */
export function asTerminalRefusal(error: unknown): never {
  if (AppError.isError(error) && (error.type === ErrorTypes.INVALID_DATA || error.type === ErrorTypes.NOT_ALLOWED)) {
    throw new WorkflowTerminalError(error)
  }
  throw error
}

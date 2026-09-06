import type { Logger } from '../types/logger.js'
// Relative, not `@workflows/`: this module is reachable through the `backend/test` package export,
// which Node resolves on its own without reading tsconfig paths. Type-only imports survive an alias
// there because they are erased; this one is a value import and would fail at runtime.
import { WorkflowTerminalError } from '../workflows/types.js'
import { AppError, ErrorTypes } from './app-error.js'

const typeToStatus: Record<ErrorTypes, number> = {
  [ErrorTypes.UNAUTHORIZED]: 401,
  [ErrorTypes.FORBIDDEN]: 403,
  [ErrorTypes.NOT_FOUND]: 404,
  [ErrorTypes.NOT_ALLOWED]: 400,
  [ErrorTypes.INVALID_DATA]: 400,
  [ErrorTypes.INVALID_ARGUMENT]: 400,
  [ErrorTypes.CONFLICT]: 409,
  [ErrorTypes.DUPLICATE_ERROR]: 422,
  [ErrorTypes.DB_ERROR]: 500,
  [ErrorTypes.UNEXPECTED_STATE]: 500,
  [ErrorTypes.SERVICE_UNAVAILABLE]: 503,
}

type ApiCode =
  | 'invalid_request_error'
  | 'invalid_state_error'
  | 'not_found'
  | 'service_unavailable'
  | 'unauthorized'
  | 'unknown_error'

const typeToApiCode: Record<ErrorTypes, ApiCode> = {
  [ErrorTypes.UNAUTHORIZED]: 'unauthorized',
  [ErrorTypes.FORBIDDEN]: 'unauthorized',
  [ErrorTypes.NOT_FOUND]: 'not_found',
  [ErrorTypes.NOT_ALLOWED]: 'invalid_request_error',
  [ErrorTypes.INVALID_DATA]: 'invalid_request_error',
  [ErrorTypes.INVALID_ARGUMENT]: 'invalid_request_error',
  [ErrorTypes.CONFLICT]: 'invalid_state_error',
  [ErrorTypes.DUPLICATE_ERROR]: 'invalid_request_error',
  [ErrorTypes.DB_ERROR]: 'unknown_error',
  [ErrorTypes.UNEXPECTED_STATE]: 'invalid_state_error',
  [ErrorTypes.SERVICE_UNAVAILABLE]: 'service_unavailable',
}

const serverErrorTypes = new Set<ErrorTypes>([ErrorTypes.DB_ERROR])

export function errorHandler(
  err: unknown,
  logger: Logger,
): {
  status: number
  /** The error's own `code` when it carries one, and the type's coarse code otherwise. */
  json: { code: string; type: string; message: string }
} {
  // Unwrap WorkflowTerminalError — if it wraps an AppError, use the AppError for HTTP semantics
  if (err instanceof WorkflowTerminalError && AppError.isError(err.cause)) {
    err = err.cause
  }

  if (AppError.isError(err)) {
    const status = typeToStatus[err.type] ?? 500
    const isServer = serverErrorTypes.has(err.type)

    if (status >= 500) {
      logger.error(err)
    } else {
      logger.info(`${status} ${err.type}: ${err.message}`)
    }

    return {
      status,
      json: {
        code: err.code ?? typeToApiCode[err.type] ?? 'unknown_error',
        type: err.type,
        message: isServer ? 'An internal error occurred' : err.message,
      },
    }
  }

  if (err instanceof Error) {
    logger.error(err)
  } else {
    logger.error(String(err))
  }
  return {
    status: 500,
    json: {
      code: 'unknown_error',
      type: 'unknown_error',
      message: 'An internal error occurred',
    },
  }
}

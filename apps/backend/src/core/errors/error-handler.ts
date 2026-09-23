import { i18n } from '@proteus/utils'
import type { Translator } from '../i18n/types.js'
import type { Logger } from '../types/logger.js'
// Relative, not `@workflows/`: this module is reachable through the `backend/test` package export,
// which Node resolves on its own without reading tsconfig paths. Type-only imports survive an alias
// there because they are erased; this one is a value import and would fail at runtime.
import { WorkflowTerminalError } from '../workflows/types.js'
import { AppError, ErrorTypes } from './app-error.js'
import { formatZodIssues } from './format-zod-issues.js'

/** Exported because the OpenAPI generator declares responses from it, so a route's documented
 *  statuses and the ones it actually answers with cannot drift apart. */
export const typeToStatus: Record<ErrorTypes, number> = {
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

const INTERNAL_ERROR = i18n.t('An internal error occurred')

function translateAppError(err: AppError, translator: Translator): string {
  const message = translator.translate(err.msgid, err.values)
  if (!err.issues?.length) return message
  return `${message}: ${formatZodIssues(err.issues, (issue) => translator.translateIssue(issue))}`
}

/**
 * The one place an API Message is translated: `translator` carries the request's language, built by
 * the runtime from `x-proteus-locale`. Logs stay in English.
 */
export function errorHandler(
  err: unknown,
  logger: Logger,
  translator: Translator,
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
        message: isServer ? translator.translate(INTERNAL_ERROR) : translateAppError(err, translator),
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
      message: translator.translate(INTERNAL_ERROR),
    },
  }
}

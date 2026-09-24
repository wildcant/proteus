import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { toValidationIssues } from '@core/errors/format-zod-issues.js'
import type { Translator } from '@core/i18n/types.js'
import { noopLogger } from '@core/logger/noop-logger.js'
import type { Msgid } from '@proteus/utils'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { WorkflowTerminalError } from '../../workflows/types.js'
import { errorHandler } from '../error-handler.js'

/** Answers every message tagged with its language, so the test sees what went through the port. */
const shouting: Translator = {
  locale: 'xx',
  translate: (message, values) => `[xx] ${message} ${JSON.stringify(values ?? {})}`,
  translateIssue: (issue) => `[xx] ${issue.code}`,
}

describe('AppError', () => {
  it('reads English with the values filled in, and keeps the message id and values', () => {
    const error = new AppError({
      type: ErrorTypes.INVALID_DATA,
      message: 'Use {maximum} characters or fewer' as Msgid,
      values: { maximum: 80 },
    })

    expect(error.message).toBe('Use 80 characters or fewer')
    expect(error.msgid).toBe('Use {maximum} characters or fewer')
    expect(error.values).toEqual({ maximum: 80 })
  })

  it('leaves a placeholder with no value as written', () => {
    const error = new AppError({ type: ErrorTypes.INVALID_DATA, message: 'Hello {name}' as Msgid })

    expect(error.message).toBe('Hello {name}')
  })
})

describe('errorHandler', () => {
  it('translates an AppError message id with its values', () => {
    const error = new AppError({ type: ErrorTypes.NOT_FOUND, message: 'Missing {id}' as Msgid, values: { id: 'p_1' } })

    const { status, json } = errorHandler(error, noopLogger, shouting)

    expect(status).toBe(404)
    expect(json).toEqual({ code: 'not_found', type: ErrorTypes.NOT_FOUND, message: '[xx] Missing {id} {"id":"p_1"}' })
  })

  it('translates each validation issue after the message, keeping the path', () => {
    const result = z.object({ name: z.string(), tags: z.array(z.string()) }).safeParse({ tags: [1] })
    const error = new AppError({
      type: ErrorTypes.INVALID_DATA,
      message: 'Invalid request body' as Msgid,
      issues: toValidationIssues(result.error?.issues ?? []),
    })

    const { status, json } = errorHandler(error, noopLogger, shouting)

    expect(status).toBe(400)
    expect(json).toEqual({
      code: 'invalid_request_error',
      type: ErrorTypes.INVALID_DATA,
      message: '[xx] Invalid request body {}: name: [xx] invalid_type; tags.0: [xx] invalid_type',
    })
    expect(error.message).toBe(
      'Invalid request body: name: Invalid input: expected string, received undefined; tags.0: Invalid input: expected string, received number',
    )
  })

  it('translates the AppError a WorkflowTerminalError wraps', () => {
    const cause = new AppError({ type: ErrorTypes.CONFLICT, message: 'Taken' as Msgid })

    const { json } = errorHandler(new WorkflowTerminalError(cause), noopLogger, shouting)

    expect(json.message).toBe('[xx] Taken {}')
  })

  it('translates the generic message for server errors and unknown throws', () => {
    const db = errorHandler(
      new AppError({ type: ErrorTypes.DB_ERROR, message: 'secret' as Msgid }),
      noopLogger,
      shouting,
    )
    const plain = errorHandler(new Error('boom'), noopLogger, shouting)

    expect(db.json.message).toBe('[xx] An internal error occurred {}')
    expect(plain.json.message).toBe('[xx] An internal error occurred {}')
  })
})

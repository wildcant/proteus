import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { Translator } from '@core/i18n/types.js'
import { noopLogger } from '@core/logger/noop-logger.js'
import { describe, expect, it } from 'vitest'
import { WorkflowTerminalError } from '../../workflows/types.js'
import { errorHandler } from '../error-handler.js'

/** Answers every message tagged with its language, so the test sees what went through the port. */
const shouting: Translator = {
  locale: 'xx',
  translate: (message, values) => `[xx] ${message} ${JSON.stringify(values ?? {})}`,
}

describe('AppError', () => {
  it('reads English with the values filled in, and keeps the message id and values', () => {
    const error = new AppError({
      type: ErrorTypes.INVALID_DATA,
      message: 'Use {maximum} characters or fewer',
      values: { maximum: 80 },
    })

    expect(error.message).toBe('Use 80 characters or fewer')
    expect(error.msgid).toBe('Use {maximum} characters or fewer')
    expect(error.values).toEqual({ maximum: 80 })
  })

  it('leaves a placeholder with no value as written', () => {
    const error = new AppError({ type: ErrorTypes.INVALID_DATA, message: 'Hello {name}' })

    expect(error.message).toBe('Hello {name}')
  })
})

describe('errorHandler', () => {
  it('translates an AppError message id with its values', () => {
    const error = new AppError({ type: ErrorTypes.NOT_FOUND, message: 'Missing {id}', values: { id: 'p_1' } })

    const { status, json } = errorHandler(error, noopLogger, shouting)

    expect(status).toBe(404)
    expect(json).toEqual({ code: 'not_found', type: ErrorTypes.NOT_FOUND, message: '[xx] Missing {id} {"id":"p_1"}' })
  })

  it('translates the AppError a WorkflowTerminalError wraps', () => {
    const cause = new AppError({ type: ErrorTypes.CONFLICT, message: 'Taken' })

    const { json } = errorHandler(new WorkflowTerminalError(cause), noopLogger, shouting)

    expect(json.message).toBe('[xx] Taken {}')
  })

  it('translates the generic message for server errors and unknown throws', () => {
    const db = errorHandler(new AppError({ type: ErrorTypes.DB_ERROR, message: 'secret' }), noopLogger, shouting)
    const plain = errorHandler(new Error('boom'), noopLogger, shouting)

    expect(db.json.message).toBe('[xx] An internal error occurred {}')
    expect(plain.json.message).toBe('[xx] An internal error occurred {}')
  })
})

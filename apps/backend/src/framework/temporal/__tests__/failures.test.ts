import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { errorHandler } from '@core/errors/error-handler.js'
import { noopLogger } from '@core/logger/noop-logger.js'
import { WorkflowTerminalError } from '@core/workflows/types.js'
import { createLinguiTranslator } from '@framework/i18n/lingui-translator.js'
import { describe, expect, it } from 'vitest'
import { readStepFailureDetail, type StepFailureDetail } from '../failure-details.js'
import { deserializeError, toStepApplicationFailure } from '../failures.js'
import { payloadConverter } from '../payload-converter.js'

/**
 * A step failure travels Worker → Temporal server → client as a payload, then the adapter rebuilds
 * the error and the route translates it. This walks that path without a server: the failure the
 * Activity raises, its details through the payload converter, and `errorHandler` on the rebuilt
 * error. A plain string, not `i18n.t()`: the extractor scans tests too, and the id is catalogued.
 */
const tooLong = () =>
  new AppError({ type: ErrorTypes.INVALID_DATA, message: 'Use {maximum} characters or fewer', values: { maximum: 80 } })

function acrossTheBoundary(error: unknown): Error {
  const failure = toStepApplicationFailure({ error, step: 'validate-cart', nonRetryable: true })
  const detail = readStepFailureDetail(failure) as StepFailureDetail
  const received = payloadConverter.fromPayload<StepFailureDetail>(payloadConverter.toPayload(detail))
  return deserializeError(received.error)
}

describe('step failures across the Temporal boundary', () => {
  it('keep the message id and values, so the route answers in Spanish', () => {
    const rebuilt = acrossTheBoundary(tooLong())

    expect(rebuilt).toMatchObject({ msgid: 'Use {maximum} characters or fewer', values: { maximum: 80 } })
    expect(rebuilt.message).toBe('Use 80 characters or fewer')

    const { status, json } = errorHandler(rebuilt, noopLogger, createLinguiTranslator('es-CO', 'en'))
    expect(status).toBe(400)
    expect(json.message).toBe('Usa 80 caracteres o menos')
  })

  it('keep them on the AppError a terminal error wraps', () => {
    const rebuilt = acrossTheBoundary(new WorkflowTerminalError(tooLong()))

    expect(rebuilt).toBeInstanceOf(WorkflowTerminalError)
    const { json } = errorHandler(rebuilt, noopLogger, createLinguiTranslator('es-CO', 'en'))
    expect(json.message).toBe('Usa 80 caracteres o menos')
  })
})

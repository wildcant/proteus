import { fillValues } from '@core/i18n/fill-values.js'
import type { Translator } from '@core/i18n/types.js'

/**
 * English with the values filled in — the same idea as `core/logger/noop-logger.ts`, for tests that
 * call `errorHandler` without a request. Here rather than beside the Lingui adapter because nothing
 * in production answers without a request's language.
 */
export const noopTranslator: Translator = {
  locale: 'en',
  translate: (message, values) => fillValues(message, values),
}

import type { Msgid } from '@proteus/utils'
import type { ValidationIssue } from '../errors/format-zod-issues.js'

/**
 * Turns an API Message into the request's language. A port, because `errorHandler` sits in `core/`
 * and `core/` never imports a library; the Lingui adapter lives in `framework/i18n/`.
 *
 * Built per request from `x-proteus-locale` and handed to `errorHandler` by the runtime, never
 * registered in a container scope: only the response translates, so domain code has no way to
 * resolve one.
 *
 * The method is `translate`, not `t`, so `translator.translate(error.msgid)` is never mistaken for
 * a marker by the extractor, and a literal `i18n.t('…')` always means "mark this".
 */
export type Translator = {
  /** The catalog language the messages come out in: `es` for `es-CO`, the fallback otherwise. */
  locale: string
  translate: (message: Msgid, values?: Record<string, unknown>) => string
  /** One validation issue's text: its schema message from the catalog, or Zod's default re-rendered. */
  translateIssue: (issue: ValidationIssue) => string
}

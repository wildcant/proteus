import type { Msgid } from '@proteus/utils'
import { z } from 'zod'
import { messages as catalogMessages } from '../locales/en.js'

/**
 * Validation messages are translated where an issue is shown, never where a schema is built.
 * Schemas stay the static English constants the backend, OpenAPI and `z.infer` read; a per-parse
 * error map cannot replace a message a schema set itself, and `z.config` is process-global, so it
 * would bleed one request's language into another exactly as a global Lingui instance would.
 */

/** The request's own translate function — Lingui's `i18n._` on the per-request instance. */
export type Translate = (id: Msgid, values?: Record<string, unknown>) => string

/** One of Zod's bundled locales, as `z.locales.<language>()` returns it. */
export type ZodLocale = { localeError: z.core.$ZodErrorMap }

const zodLocales: Record<string, () => ZodLocale> = { en: z.locales.en, es: z.locales.es }

/**
 * Zod's own locale for a catalog language, for the fields that carry no message of ours. English
 * when Zod ships none — the same fallback as the catalogs.
 */
export function zodLocaleFor(language: string): ZodLocale {
  return (zodLocales[language] ?? z.locales.en)()
}

// Our messages are exactly the catalog's ids: the English sentence is the msgid.
function isCatalogMessage(message: string): message is Msgid {
  return Object.hasOwn(catalogMessages, message)
}

function renderZodDefault(result: ReturnType<z.core.$ZodErrorMap>): string | undefined {
  if (typeof result === 'string') return result
  return result?.message
}

// The value the issue is about, read back from the parsed value by the issue's path.
function valueAt(value: unknown, path: readonly PropertyKey[]): unknown {
  return path.reduce<unknown>((node, key) => (node as Record<PropertyKey, unknown> | undefined)?.[key], value)
}

/**
 * `value` is what was parsed. Zod drops each issue's `input` unless the parse asked for
 * `reportInput`, and some defaults name it ("expected number, received string"), so pass it where
 * the caller has it — TanStack Form's Standard Schema path cannot ask for `reportInput`.
 */
export function translateIssue(
  issue: z.core.$ZodIssue,
  translate: Translate,
  zodLocale: ZodLocale,
  value?: unknown,
): string {
  // Ours: a catalog id whose placeholders (`{maximum}`, `{minimum}`) come from the issue's own fields.
  if (isCatalogMessage(issue.message)) return translate(issue.message, { ...issue })
  // Zod's own default: re-rendered from the issue in the request's language.
  const raw = { input: valueAt(value, issue.path), ...issue } as z.core.$ZodRawIssue
  return renderZodDefault(zodLocale.localeError(raw)) ?? issue.message
}

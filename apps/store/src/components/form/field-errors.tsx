import type { I18n } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { translateIssue, zodLocaleFor } from '@proteus/http-schemas/i18n'
import { FieldError } from '@proteus/ui'
import type { z } from 'zod'

type FieldErrorMessage = { message?: string }

function isZodIssue(error: unknown): error is z.core.$ZodIssue {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

/**
 * A field's errors in the page's language. TanStack Form validates through Standard Schema, which
 * takes no per-parse options, so the schema's English issues are translated here, at display.
 * `values` is what was parsed — some of Zod's own defaults name the received value.
 */
export function translateFieldErrors(errors: readonly unknown[], i18n: I18n, values?: unknown): FieldErrorMessage[] {
  const zodLocale = zodLocaleFor(i18n.locale)
  return errors.map((error) => {
    if (isZodIssue(error)) {
      return { message: translateIssue(error, (id, params) => i18n._(id, params), zodLocale, values) }
    }
    // Anything else (a plain `{ message }` or a string) was worded by whoever set it.
    if (typeof error === 'string') return { message: error }
    return (error ?? undefined) as FieldErrorMessage
  })
}

/** `FieldError` for a TanStack Form field, its schema errors shown in the page's language. */
export function TranslatedFieldError({ errors, values }: { errors: readonly unknown[]; values?: unknown }) {
  const { i18n } = useLingui()
  return <FieldError errors={translateFieldErrors(errors, i18n, values)} />
}

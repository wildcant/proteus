import { useLingui } from '@lingui/react'
import { FieldError } from '@proteus/ui'
import { translateFieldErrors } from '#/components/form/translate-field-errors'

/** `FieldError` for a TanStack Form field, its schema errors shown in the page's language. */
export function TranslatedFieldError({ errors, values }: { errors: readonly unknown[]; values?: unknown }) {
  const { i18n } = useLingui()
  return <FieldError errors={translateFieldErrors(errors, i18n, values)} />
}

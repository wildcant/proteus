import { useLingui } from '@lingui/react'
import { FieldError } from '@proteus/ui'
import { translateFieldErrors } from '#/components/form/translate-field-errors'

/** `FieldError` for a TanStack Form field, its schema errors shown in the admin's language. */
export function TranslatedFieldError({
  errors,
  values,
  className,
}: {
  errors: readonly unknown[]
  values?: unknown
  className?: string
}) {
  const { i18n } = useLingui()
  return <FieldError className={className} errors={translateFieldErrors(errors, i18n, values)} />
}

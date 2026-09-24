/**
 * Fills `{name}` placeholders from `values`, leaving unknown ones as written. Enough for the English
 * source text, which is where `AppError` builds its `Error.message` and where the noop translator
 * answers from; plural and select forms need the Lingui adapter.
 */
export function fillValues(message: string, values?: Record<string, unknown>): string {
  if (!values) return message
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  )
}

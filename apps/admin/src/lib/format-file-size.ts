import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { activeLocale } from '#/lib/i18n/locale'

const UNITS = [msg`Bytes`, msg`KB`, msg`MB`, msg`GB`, msg`TB`]

/** A byte count as a reader sees it: `1.5 MB`, or `1,5 MB` in Spanish. */
export function formatFileSize(bytes: number, i18n: I18n, decimalPlaces = 2): string {
  if (!Number.isFinite(bytes)) {
    return i18n._(msg`unlimited`)
  }

  const exponent = bytes === 0 ? 0 : Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const unit = UNITS[exponent] ?? msg`Bytes`
  // No grouping: a value stays under 1024 of its unit, and `1,023.5 KB` would change the English.
  const value = new Intl.NumberFormat(activeLocale(), {
    maximumFractionDigits: decimalPlaces,
    useGrouping: false,
  }).format(bytes / 1024 ** exponent)

  return `${value} ${i18n._(unit)}`
}

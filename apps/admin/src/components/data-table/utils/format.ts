import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { activeLocale } from '#/lib/i18n/locale'
import type { FilterDef, FilterValue } from '../types'

export function formatDisplayValue(value: FilterValue | null, def: FilterDef, i18n: I18n): string {
  if (value === null) return ''
  switch (def.type) {
    case 'radio':
    case 'select':
      return def.options.find((o) => o.value === value)?.label ?? String(value)
    case 'multiselect': {
      if (!Array.isArray(value)) return String(value)
      return value.map((v: string) => def.options.find((o) => o.value === v)?.label ?? v).join(', ')
    }
    case 'date': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
      const preset = def.presets?.find((p) => p.value.$gte === value.$gte && p.value.$lte === value.$lte)
      if (preset) return preset.label
      return formatDateRange(value, i18n)
    }
  }
}

function formatDateRange(value: { $gte?: string; $lte?: string }, i18n: I18n): string {
  const fmt = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(activeLocale(), { month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (value.$gte && value.$lte) return `${fmt(value.$gte)} - ${fmt(value.$lte)}`
  if (value.$gte) {
    const date = fmt(value.$gte)
    return i18n._(msg`After ${date}`)
  }
  if (value.$lte) {
    const date = fmt(value.$lte)
    return i18n._(msg`Before ${date}`)
  }
  return ''
}

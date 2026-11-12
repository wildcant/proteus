import type { AdminProductGroupingRule } from '#/api/generated/model'

/** A rule as the structure file writes it: "genero: hombre · estilo: clasicos, running". */
export function formatGroupingRule(rule: NonNullable<AdminProductGroupingRule>): string {
  return Object.entries(rule)
    .map(([key, values]) => `${key}: ${values.join(', ')}`)
    .join(' · ')
}

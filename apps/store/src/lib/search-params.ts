import { defaultStringifySearch } from '@tanstack/react-router'

/**
 * The router's `stringifySearch`: its default, except that an array is written as a repeated key —
 * `?tag=cotton&tag=wool` rather than `?tag=%5B%22cotton%22%2C%22wool%22%5D`. A filter URL is one a
 * shopper reads and shares, and a repeated key is how the web spells several values of one param.
 *
 * Only writing needs this: the default parser already reads a repeated key back as an array.
 */
export function stringifySearch(search: Record<string, unknown>): string {
  const entries = Object.entries(search)
  const single = Object.fromEntries(entries.filter(([, value]) => !Array.isArray(value)))
  const params = new URLSearchParams(defaultStringifySearch(single))
  for (const [key, values] of entries) {
    if (!Array.isArray(values)) continue
    for (const value of values) params.append(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

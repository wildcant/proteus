/** How many countries a cell names before it starts counting the rest. */
const NAMED = 2

/**
 * `Denmark, France + 5 more` — the countries a region sells to, in a cell one line high.
 *
 * A region can cover most of a continent, so the list cannot be written out: the first two names
 * say which part of the world this is, and the count says how much of it. A region selling
 * nowhere reads as an em dash rather than an empty cell, because "none yet" is a state a merchant
 * has to be able to see.
 */
export function summariseCountries(displayNames: string[]): string {
  if (displayNames.length === 0) return '—'

  const named = displayNames.slice(0, NAMED).join(', ')
  const remaining = displayNames.length - NAMED

  return remaining > 0 ? `${named} + ${remaining} more` : named
}

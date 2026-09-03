import type { StoreSavedMethod } from '#/api/generated/model'
import { networkName } from '#/lib/card-networks'

/**
 * What a saved-card row is called and what it is drawn as — the two things about the row that
 * something other than the row itself needs.
 *
 * The checkout selector builds its "use a different card" row from `ROW_CLASS` so the two are the
 * same row, and the Payment Element's `.AccordionItem` is written as this class's twin in
 * `appearance.ts`. Three places, one row, because the third of them lives in a cross-origin
 * iframe no stylesheet of ours can reach.
 */

/** `Visa ending in 4242` — the phrase every label and button on a row is built from. */
export function savedMethodName(method: StoreSavedMethod): string {
  return `${networkName(method.brand)} ending in ${method.last4}`
}

/**
 * The shared row envelope: one hairline, collapsed against its neighbour so the stack reads as a
 * single ruled list rather than a column of separate boxes. Every colour is a `@proteus/ui` token
 * — neither this nor the Appearance config writes a colour literal the other also writes.
 */
export const ROW_CLASS =
  'relative -mt-px flex min-h-15 items-center gap-3 border border-line bg-surface px-4 py-3 first:mt-0 has-[:focus-visible]:z-3'

/** What a row looks like when its surface's radio is on it: a full ink border, no layout shift. */
export const ROW_SELECTED_CLASS = 'z-2 border-ink bg-surface-subtle ring-1 ring-ink ring-inset'

/**
 * A row whose *own* surface is open beneath it, so the real choice is made further down.
 *
 * Filled but not bordered, and for the same reason the Payment Element's `--selected` accordion
 * state is left unbordered inside an open panel: the list should carry exactly one ink envelope,
 * around the thing being paid with. A provider row and the card row inside it both drawing one
 * stacks two black rectangles and makes the shopper look twice to find their own selection.
 */
export const ROW_OPEN_CLASS = 'z-1 bg-surface-subtle'

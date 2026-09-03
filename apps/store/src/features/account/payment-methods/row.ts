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
 *
 * **This side moved to match the gateway's, not the other way round.** `.AccordionItem` in
 * `appearance.ts` is the twin of this class, and the Appearance API decides which properties exist
 * at all: `padding` is settable there and `min-height` is not. A row whose height came from
 * `min-h-15` could therefore never be matched from the other side, so the height is content plus
 * `p-4` on both — 16px, the same figure the Appearance config writes. Hover is the same story in
 * reverse: the gateway's rows filled on hover and ours did not, and a list where half the rows
 * respond to the cursor is the seam AC 9 is about.
 */
export const ROW_CLASS =
  'relative -mt-px flex items-center gap-3 border border-line bg-surface p-4 first:mt-0 hover:bg-surface-subtle has-[:focus-visible]:z-3'

/**
 * Undoes `FieldLabel`'s own `has-data-checked:bg-primary/5`.
 *
 * The primitive paints a second fill over the *label* whenever it contains a checked control, and
 * a label is narrower than the row that holds it — measured at 430px inside a 500px row, so the
 * selected row's fill stopped 70px short of its own right edge, just before the Remove control.
 * The row already says it is selected. Same class of `FieldLabel` leakage as its `w-fit`.
 */
export const ROW_LABEL_CLASS = 'flex min-w-0 flex-1 items-center gap-3 has-data-checked:bg-transparent'

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

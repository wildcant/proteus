/**
 * Brand marks are solid fills on a 24x24 grid, not stroked outlines — so `fill` carries the colour
 * and there is no stroke geometry to configure. `currentColor` is what lets a caller tint a mark
 * with `text-*` and get dark mode for free.
 */
export const defaultAttributes = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
} as const

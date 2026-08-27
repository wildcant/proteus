/**
 * The floor every mark starts from, before the asset's own root attributes and then the caller's
 * props are layered on top. `fill: currentColor` suits a solid mark and is what lets a caller tint
 * one with `text-*` and get dark mode for free; an outline asset overrides it with `fill: none`
 * plus its stroke, declared on its own root.
 */
export const defaultAttributes = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
} as const

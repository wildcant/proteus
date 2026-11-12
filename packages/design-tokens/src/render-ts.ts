// Tokens -> a TS module of raw values, for code that cannot take a class (SVG attributes, canvas,
// charts, inline styles computed at runtime). Lengths stay in px, as designed.
import type { Entry, Tokens } from './tokens.ts'

export function renderTs(tokens: Tokens): string {
  const record = (entries: Entry[]) => Object.fromEntries(entries.map(({ key, value }) => [key, value]))
  const values = {
    colors: Object.fromEntries(
      tokens.themeModes.map((mode) => [mode, Object.fromEntries(tokens.colors.map((c) => [c.name, c.values[mode]]))]),
    ),
    palette: Object.fromEntries(tokens.palette.map(({ key, value }) => [key, value])),
    space: record(tokens.space),
    radius: record(tokens.radius),
    tracking: record(tokens.tracking),
    stroke: record(tokens.stroke),
    fonts: Object.fromEntries(tokens.fonts.map(({ key, family }) => [key, family])),
    responsive: record(tokens.responsive),
    type: Object.fromEntries(tokens.textStyles.map(({ name, description: _, ...style }) => [name, style])),
    other: tokens.other,
  }
  return [
    '// Generated from the FigCraft design file by @proteus/design-tokens. Do not edit: change the design file, then run its tokens:export.',
    `export const tokens = ${JSON.stringify(values, null, 2)} as const`,
    '',
  ].join('\n')
}

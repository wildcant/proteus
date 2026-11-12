import { describe, expect, it } from 'vitest'

import type { ResolvedConfig } from '../config.ts'
import { renderCss } from '../render-css.ts'
import { renderTs } from '../render-ts.ts'
import type { Snapshot, TextStyle, Variable } from '../snapshot.ts'
import { buildTokens } from '../tokens.ts'

const PRIMITIVES = 'VariableCollectionId:1'
const THEME = 'VariableCollectionId:2'
const VIEWPORT = 'VariableCollectionId:3'

const color = (hex: string, a = 1) => ({
  r: Number.parseInt(hex.slice(0, 2), 16) / 255,
  g: Number.parseInt(hex.slice(2, 4), 16) / 255,
  b: Number.parseInt(hex.slice(4, 6), 16) / 255,
  a,
})
const alias = (id: string) => ({ type: 'VARIABLE_ALIAS' as const, id })

function variable(id: string, name: string, collection: string, values: Variable['valuesByMode']): Variable {
  const first = Object.values(values)[0]
  const resolvedType =
    typeof first === 'number' ? 'FLOAT' : typeof first === 'string' ? 'STRING' : ('COLOR' as Variable['resolvedType'])
  return { id, name, description: '', resolvedType, variableCollectionId: collection, valuesByMode: values }
}

function snapshot(textStyles: TextStyle[]): Snapshot {
  const variables = [
    variable('v:ink', 'palette/neutral/950', PRIMITIVES, { [`${PRIMITIVES}/1`]: color('0d1012') }),
    variable('v:paper', 'palette/neutral/0', PRIMITIVES, { [`${PRIMITIVES}/1`]: color('ffffff') }),
    variable('v:space', 'space/4', PRIMITIVES, { [`${PRIMITIVES}/1`]: 16 }),
    variable('v:radius', 'radius/full', PRIMITIVES, { [`${PRIMITIVES}/1`]: 9999 }),
    variable('v:tracking', 'tracking/tight', PRIMITIVES, { [`${PRIMITIVES}/1`]: -2 }),
    variable('v:font', 'font/sans', PRIMITIVES, { [`${PRIMITIVES}/1`]: 'Manrope' }),
    variable('v:chamfer', 'chamfer/s', PRIMITIVES, { [`${PRIMITIVES}/1`]: 6 }),
    variable('c:ink', 'color/ink', THEME, { [`${THEME}/light`]: alias('v:ink'), [`${THEME}/dark`]: alias('v:paper') }),
    variable('c:scrim', 'color/scrim', THEME, {
      [`${THEME}/light`]: color('000000', 0.5),
      [`${THEME}/dark`]: color('000000', 0.5),
    }),
    variable('t:size', 'type/display/size', VIEWPORT, { [`${VIEWPORT}/mobile`]: 32, [`${VIEWPORT}/desktop`]: 48 }),
    variable('t:margin', 'layout/margin', VIEWPORT, { [`${VIEWPORT}/mobile`]: 20, [`${VIEWPORT}/desktop`]: 48 }),
  ]
  const collection = (id: string, name: string, modes: string[]) => ({
    id,
    name,
    defaultModeId: `${id}/${modes[0]?.toLowerCase()}`,
    modes: modes.map((mode) => ({ modeId: `${id}/${mode.toLowerCase()}`, name: mode })),
    variableIds: variables.filter((v) => v.variableCollectionId === id).map((v) => v.id),
  })
  return {
    collections: {
      [PRIMITIVES]: {
        ...collection(PRIMITIVES, 'Primitives', ['1']),
        modes: [{ modeId: `${PRIMITIVES}/1`, name: 'Value' }],
      },
      [THEME]: collection(THEME, 'Theme', ['Light', 'Dark']),
      [VIEWPORT]: collection(VIEWPORT, 'Viewport', ['Mobile', 'Desktop']),
    },
    variables: Object.fromEntries(variables.map((v) => [v.id, v])),
    textStyles,
  }
}

const display: TextStyle = {
  id: 'S:display',
  name: 'type/display',
  description: 'Hero headlines.',
  bound: { fontFamily: 'v:font', fontSize: 't:size' },
  style: {
    fontFamily: 'Manrope',
    fontStyle: 'Extra Bold',
    fontSize: 32,
    case: 'upper',
    letterSpacing: { unit: 'percent', value: -2 },
    lineHeight: { unit: 'percent', value: 90 },
  },
}

function config(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    root: '/project',
    file: '/designs/Shop.figcraft',
    cli: 'figcraft-cli',
    snapshot: '/project/design',
    output: { css: '/project/tokens.gen.css', ts: '/project/tokens.gen.ts' },
    theme: {
      collection: 'Theme',
      modes: [
        { mode: 'Light', selector: ':root' },
        {
          mode: 'Dark',
          selector: ':root[data-theme="dark"]',
          media: { query: '(prefers-color-scheme: dark)', selector: ':root:not([data-theme="light"])' },
        },
      ],
    },
    viewport: {
      collection: 'Viewport',
      modes: [
        { mode: 'Mobile', width: 375 },
        { mode: 'Desktop', width: 1440 },
      ],
      scale: 'fluid',
    },
    textStyles: { prefix: 'type-', form: 'utility' },
    paletteInTheme: false,
    rootFontSize: 16,
    ...overrides,
  }
}

describe('design', () => {
  it('turns the design file into a Tailwind theme: colour modes, fluid sizes, text style classes and raw values', () => {
    const tokens = buildTokens(snapshot([display]), config())
    const css = renderCss(tokens, config())

    // Roles go through an indirection, so a mode swaps only the raw variable; alpha survives.
    expect(css).toContain('--color-ink: var(--ink);')
    expect(css).toMatch(/:root \{\n {2}--ink: #0d1012;\n {2}--scrim: #00000080;/)
    expect(css).toContain(':root[data-theme="dark"] {\n  --ink: #ffffff;')
    expect(css).toContain(
      '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n    --ink: #ffffff;',
    )
    // Primitives land in Tailwind's namespaces; the palette stays out of classes by default.
    expect(css).toContain('--font-sans: "Manrope", ui-sans-serif, system-ui, sans-serif;')
    expect(css).toContain('--spacing-4: 1rem;')
    expect(css).toContain('--radius-full: 624.9375rem;')
    expect(css).toContain('--tracking-tight: -0.02em;')
    expect(css).not.toContain('--color-neutral-950')
    // Viewport numbers become fluid between the two designed widths.
    expect(css).toContain('--type-display-size: clamp(2rem, 1.6479rem + 1.5023vw, 3rem);')
    expect(css).toContain('--layout-margin: clamp(1.25rem, 0.6338rem + 2.6291vw, 3rem);')
    expect(css).toContain(
      '@utility type-display {\n  font-family: var(--font-sans);\n  font-size: var(--type-display-size);\n  font-weight: 800;\n  line-height: 0.9;\n  letter-spacing: -0.02em;\n  text-transform: uppercase;\n}',
    )

    // Anything outside the naming contract is kept for code, not dropped.
    const ts = renderTs(tokens)
    expect(ts).toContain('"chamfer/s": 6')
    expect(ts).toContain('"Dark": {\n      "ink": "#ffffff"')
  })

  it('steps sizes by min-width and doubles the class selector when asked to', () => {
    const stepped = config({
      viewport: {
        collection: 'Viewport',
        modes: [
          { mode: 'Mobile', width: 0 },
          { mode: 'Desktop', width: 1024 },
        ],
        scale: 'steps',
      },
      textStyles: { prefix: 'type-', form: 'doubled' },
    })
    const css = renderCss(buildTokens(snapshot([display]), stepped), stepped)

    expect(css).toContain('--type-display-size: 2rem;')
    expect(css).toContain(
      '@media (min-width: 64rem) {\n  :root {\n    --type-display-size: 3rem;\n    --layout-margin: 3rem;\n  }\n}',
    )
    expect(css).toContain('@layer utilities {\n  .type-display.type-display {')
    expect(css).not.toContain('@utility')
  })

  it('refuses a text style whose font is not bound to a font/* variable', () => {
    const unbound = { ...display, bound: { fontSize: 't:size' } }
    expect(() => buildTokens(snapshot([unbound]), config())).toThrow(
      'type/display: bind its font family to a font/* variable',
    )
  })
})

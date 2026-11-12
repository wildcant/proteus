import { describe, expect, it } from 'vitest'

import type { TokensConfig } from '../config.ts'
import { renderCss } from '../tokens/render-css.ts'
import { renderTs } from '../tokens/render-ts.ts'
import type { EffectStyle, Snapshot, TextStyle, Variable } from '../tokens/snapshot.ts'
import { buildTokens } from '../tokens/tokens.ts'

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

function snapshot(textStyles: TextStyle[], extra: Variable[] = [], effectStyles: EffectStyle[] = []): Snapshot {
  const variables = [
    variable('v:ink', 'palette/neutral/950', PRIMITIVES, { [`${PRIMITIVES}/1`]: color('0d1012') }),
    variable('v:paper', 'palette/neutral/0', PRIMITIVES, { [`${PRIMITIVES}/1`]: color('ffffff') }),
    variable('v:space', 'space/4', PRIMITIVES, { [`${PRIMITIVES}/1`]: 16 }),
    variable('v:radius', 'radius/full', PRIMITIVES, { [`${PRIMITIVES}/1`]: 9999 }),
    variable('v:tracking', 'tracking/tight', PRIMITIVES, { [`${PRIMITIVES}/1`]: -2 }),
    variable('v:font', 'font/sans', PRIMITIVES, { [`${PRIMITIVES}/1`]: 'Manrope' }),
    // A font Tailwind's own stack already names keeps that stack as it is: the browser picks as it always has.
    variable('v:mono', 'font/mono', PRIMITIVES, { [`${PRIMITIVES}/1`]: 'Menlo' }),
    variable('v:chamfer', 'chamfer/s', PRIMITIVES, { [`${PRIMITIVES}/1`]: 6 }),
    variable('c:ink', 'color/ink', THEME, { [`${THEME}/light`]: alias('v:ink'), [`${THEME}/dark`]: alias('v:paper') }),
    variable('c:scrim', 'color/scrim', THEME, {
      [`${THEME}/light`]: color('000000', 0.5),
      [`${THEME}/dark`]: color('000000', 0.5),
    }),
    variable('t:size', 'type/display/size', VIEWPORT, { [`${VIEWPORT}/mobile`]: 32, [`${VIEWPORT}/desktop`]: 48 }),
    variable('t:margin', 'layout/margin', VIEWPORT, { [`${VIEWPORT}/mobile`]: 20, [`${VIEWPORT}/desktop`]: 48 }),
    ...extra,
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
    effectStyles,
  }
}

const value = (v: number | string) => ({ [`${PRIMITIVES}/1`]: v })

// The scales the store reads through Tailwind's own utility names, at Tailwind's own values.
const scales = [
  variable('s:0', 'space/0', PRIMITIVES, value(0)),
  variable('s:1', 'space/1', PRIMITIVES, value(4)),
  variable('s:2.5', 'space/2.5', PRIMITIVES, value(10)),
  variable('s:gutter', 'space/gutter', PRIMITIVES, value(18)),
  variable('r:none', 'radius/none', PRIMITIVES, value(0)),
  variable('w:medium', 'weight/medium', PRIMITIVES, value(500)),
  variable('x:2xs', 'text/2xs/size', PRIMITIVES, value(10)),
  variable('x:sm', 'text/sm/size', PRIMITIVES, value(14)),
  variable('x:sm/l', 'text/sm/leading', PRIMITIVES, value(20)),
  variable('x:xs', 'text/xs/size', PRIMITIVES, value(12)),
  variable('x:xs/l', 'text/xs/leading', PRIMITIVES, value(16)),
  variable('l:snug', 'leading/snug', PRIMITIVES, value(1.375)),
  variable('b:sm', 'breakpoint/sm', PRIMITIVES, value(640)),
  variable('d:450', 'duration/450', PRIMITIVES, value(450)),
  variable('e:drawer', 'ease/drawer', PRIMITIVES, value('cubic-bezier(0.32, 0.72, 0, 1)')),
  variable('c:shadow', 'color/shadow', THEME, {
    [`${THEME}/light`]: color('0d1012', 0.2),
    [`${THEME}/dark`]: color('f4f5f6', 0.2),
  }),
]

const dropShadow = (offset: [number, number], radius: number, spread: number, rgba = color('000000', 0.1)) => ({
  type: 'dropShadow' as const,
  color: rgba,
  offset,
  radius,
  spread,
  visible: true,
})

const effectStyles: EffectStyle[] = [
  {
    id: 'S:xl',
    name: 'shadow/xl',
    description: '',
    effects: [dropShadow([0, 20], 25, -5), dropShadow([0, 8], 10, -6)],
  },
  {
    id: 'S:panel',
    name: 'shadow/panel',
    description: '',
    bound: { 'effects/0/color': 'c:shadow' },
    effects: [dropShadow([0, -8], 24, -8, color('0d1012'))],
  },
]

const textStyle = (
  name: string,
  fontStyle: string,
  bound: TextStyle['bound'],
  lineHeight: TextStyle['style']['lineHeight'],
): TextStyle => ({
  id: `S:${name}`,
  name: `type/${name}`,
  description: '',
  bound: { fontFamily: 'v:font', ...bound },
  style: {
    fontFamily: 'Manrope',
    fontStyle,
    fontSize: 14,
    case: 'original',
    letterSpacing: { unit: 'percent', value: 0 },
    lineHeight,
  },
})

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

function config(overrides: Partial<TokensConfig> = {}): TokensConfig {
  return {
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

describe('tokens', () => {
  it('turns the design file into a Tailwind theme: colour modes, fluid sizes, text style classes and raw values', () => {
    const tokens = buildTokens(snapshot([display]), config())
    const css = renderCss(tokens, config())

    // Roles go through an indirection, so a mode swaps only the raw variable; alpha survives unrounded.
    expect(css).toContain('--color-ink: var(--ink);')
    expect(css).toMatch(/:root \{\n {2}--ink: #0d1012;\n {2}--scrim: rgb\(0 0 0 \/ 0\.5\);/)
    expect(css).toContain(':root[data-theme="dark"] {\n  --ink: #ffffff;')
    expect(css).toContain(
      '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n    --ink: #ffffff;',
    )
    // Primitives land in Tailwind's namespaces; the palette stays out of classes by default.
    expect(css).toContain('--font-sans: "Manrope", ui-sans-serif, system-ui, sans-serif;')
    expect(css).toContain(
      '--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;',
    )
    expect(css).toContain('--spacing-4: 1rem;')
    expect(css).toContain('--radius-full: calc(infinity * 1px);')
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
    // `&&` doubles the selector (`.type-display.type-display`) inside a utility, so it still takes variants:
    // `md:type-display` is `.md\:type-display.md\:type-display` under the breakpoint.
    expect(css).toContain('@utility type-display {\n  && {\n    font-family: var(--font-sans);')
    expect(css).not.toContain('@layer utilities')
  })

  it('carries a text style decoration and its underline offset into the class', () => {
    const link: TextStyle = {
      ...display,
      id: 'S:link',
      name: 'type/link',
      style: { ...display.style, case: 'original', decoration: 'underline', decorationOffset: 4 },
    }
    const css = renderCss(buildTokens(snapshot([link]), config()), config())
    expect(css).toContain('  text-decoration-line: underline;\n  text-underline-offset: 4px;\n}')
  })

  it('refuses a text style whose font is not bound to a font/* variable', () => {
    const unbound = { ...display, bound: { fontSize: 't:size' } }
    expect(() => buildTokens(snapshot([unbound]), config())).toThrow(
      'type/display: bind its font family to a font/* variable',
    )
  })

  it('writes the scales in the form Tailwind declares its own, so the utilities the store uses compute the same', () => {
    const label = textStyle(
      'label',
      'Medium',
      { fontSize: 'x:sm', lineHeight: 'x:sm/l' },
      { unit: 'pixels', value: 20 },
    )
    const body = textStyle('body', 'Regular', { fontSize: 'x:sm' }, { unit: 'percent', value: 140 })
    const tokens = buildTokens(snapshot([label, body], scales, effectStyles), config())
    const css = renderCss(tokens, config())

    // space/1 is Tailwind's step; the multiples of it are implied, anything else is named.
    expect(css).toContain('--spacing: 0.25rem;')
    expect(css).not.toContain('--spacing-2')
    expect(css).not.toContain('--spacing-0')
    expect(css).toContain('--spacing-gutter: 1.125rem;')
    expect(css).toContain('--radius-none: 0;')
    // Tailwind's own full radius, not 9999px.
    expect(css).toContain('--radius-full: calc(infinity * 1px);')
    expect(css).toContain('--font-weight-medium: 500;')
    // A size with a leading pairs them as Tailwind does (a ratio, so it scales with nested sizes).
    expect(css).toContain('--text-sm: 0.875rem;\n  --text-sm--line-height: calc(1.25 / 0.875);')
    expect(css).toContain('--text-xs--line-height: calc(1 / 0.75);')
    expect(css).toContain('--text-2xs: 0.625rem;')
    expect(css).not.toContain('--text-2xs--line-height')
    expect(css).toContain('--leading-snug: 1.375;')
    expect(css).toContain('--breakpoint-sm: 40rem;')
    expect(css).toContain('--transition-duration-450: 450ms;')
    expect(css).toContain('--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);')
    // Shadows: Tailwind's notation; a colour bound to a role follows its mode; alpha is kept exactly.
    expect(css).toContain('--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);')
    expect(css).toContain('--shadow-panel: 0 -8px 24px -8px var(--shadow);')
    expect(css).toContain('--shadow: rgb(13 16 18 / 0.2);')
    expect(css).toContain('--shadow: rgb(244 245 246 / 0.2);')
    // A text style bound to the text scale reads it, so the two never drift.
    expect(css).toContain(
      '@utility type-label {\n  font-family: var(--font-sans);\n  font-size: var(--text-sm);\n  font-weight: 500;\n  line-height: var(--text-sm--line-height);\n}',
    )
    expect(css).toContain(
      '@utility type-body {\n  font-family: var(--font-sans);\n  font-size: var(--text-sm);\n  font-weight: 400;\n  line-height: 1.4;\n}',
    )

    const ts = renderTs(tokens)
    expect(ts).toContain('"panel": "0 -8px 24px -8px var(--shadow)"')
    expect(ts).not.toContain('"ease/drawer"')
  })

  it("checks the viewport modes between a fluid scale's ends against the interpolation, and reads only the ends", () => {
    const four = config({
      viewport: {
        collection: 'Viewport',
        modes: [
          { mode: 'Mobile', width: 375 },
          { mode: 'Sm', width: 640 },
          { mode: 'Desktop', width: 1440 },
        ],
        scale: 'fluid',
      },
    })
    const withSm = (sizeAtSm: number) => {
      const base = snapshot([display])
      const viewport = base.collections[VIEWPORT]
      if (!viewport) throw new Error('no viewport')
      viewport.modes.splice(1, 0, { modeId: `${VIEWPORT}/sm`, name: 'Sm' })
      for (const v of Object.values(base.variables).filter((v) => v.variableCollectionId === VIEWPORT)) {
        const from = v.valuesByMode[`${VIEWPORT}/mobile`] as number
        const to = v.valuesByMode[`${VIEWPORT}/desktop`] as number
        v.valuesByMode[`${VIEWPORT}/sm`] = v.name === 'type/display/size' ? sizeAtSm : from + ((to - from) * 265) / 1065
      }
      return base
    }

    const css = renderCss(buildTokens(withSm(35.98), four), four)
    expect(css).toContain('--type-display-size: clamp(2rem, 1.6479rem + 1.5023vw, 3rem);')
    expect(() => buildTokens(withSm(34), four)).toThrow(
      'type/display/size: Sm (640) holds 34, but the fluid scale gives 35.98 there',
    )
  })
})

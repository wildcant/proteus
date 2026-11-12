// Tokens -> a Tailwind v4 stylesheet.
//
//   @theme        --color-<role>: var(--<role>), --font-*, --spacing-*, --radius-*, --tracking-*
//   :root         --<role> in the first Theme mode, plus the responsive sizes at their base viewport
//   <selector>    --<role> in each other Theme mode (and under its media query, if it has one)
//   @media        the responsive sizes from each later viewport mode up (`steps` scale only)
//   type-<name>   one class per text style
//
// Colour roles go through an indirection (`--color-ink: var(--ink)`) so a mode only swaps the raw
// variable, and every utility (`text-ink`, `bg-ink/40`) follows without a dark: variant.
import type { TokensConfig } from '../config.ts'
import { type Entry, type Length, round, type Tokens, type TypeToken } from './tokens.ts'

type Declarations = [property: string, value: string][]

export function renderCss(tokens: Tokens, config: TokensConfig): string {
  const rem = (px: number) => (px === 0 ? '0' : `${round(px / config.rootFontSize, 4)}rem`)
  const viewport = config.viewport

  // Responsive lengths: the value to declare now, and the later viewports' overrides by min-width.
  const overrides = new Map<number, Declarations>()
  const lengthValue = (property: string, value: Length): string => {
    if (typeof value === 'number') return rem(value)
    if (!viewport) throw new Error(`${property} is responsive but the config has no viewport`)
    const [base, ...later] = viewport.modes
    if (!base) throw new Error('the viewport config has no modes')
    const at = (mode: string) => {
      const px = value[mode]
      if (px === undefined) throw new Error(`${property}: no value for viewport mode ${mode}`)
      return px
    }
    if (viewport.scale === 'fluid') {
      const [to] = later
      if (!to) throw new Error('a fluid viewport needs two modes')
      return fluid(at(base.mode), at(to.mode), base.width, to.width, config.rootFontSize)
    }
    let previous = at(base.mode)
    for (const step of later) {
      const px = at(step.mode)
      if (px === previous) continue
      const list = overrides.get(step.width) ?? []
      list.push([property, rem(px)])
      overrides.set(step.width, list)
      previous = px
    }
    return rem(at(base.mode))
  }

  const theme: Declarations = [
    ...tokens.colors.map(({ name }): [string, string] => [`--color-${name}`, `var(--${name})`]),
    ...(config.paletteInTheme
      ? tokens.palette.map(({ key, value }): [string, string] => [`--color-${key}`, value])
      : []),
    ...tokens.fonts.map(({ key, family }): [string, string] => [`--font-${key}`, fontStack(key, family)]),
    ...themeLengths('spacing', tokens.space, lengthValue),
    ...themeLengths('radius', tokens.radius, lengthValue),
    ...tokens.tracking.map(({ key, value }): [string, string] => [
      `--tracking-${key}`,
      `${round(scalar(value, `tracking/${key}`) / 100, 4)}em`,
    ]),
  ]

  const [firstMode, ...otherModes] = config.theme.modes
  if (!firstMode) throw new Error('theme.modes is empty')
  const colorsIn = (mode: string): Declarations =>
    tokens.colors.map(({ name, values }) => [`--${name}`, values[mode] ?? ''])

  const typeVariables: Declarations = []
  const typeClasses = tokens.textStyles.map((style) =>
    typeClass(style, config, (suffix, value) => {
      if (typeof value === 'number') return rem(value)
      const property = `--${config.textStyles.prefix}${style.name}-${suffix}`
      typeVariables.push([property, lengthValue(property, value)])
      return `var(${property})`
    }),
  )
  const responsive: Declarations = tokens.responsive.map(({ key, value }) => [
    `--${key}`,
    lengthValue(`--${key}`, value),
  ])

  const blocks = [
    '/* Generated from the FigCraft design file by @proteus/design. Do not edit: change the design file, then run its tokens:export. */',
    rule('@theme', theme),
    rule(':root', [...colorsIn(firstMode.mode), ...responsive, ...typeVariables]),
    ...otherModes.flatMap((mode) => [
      rule(mode.selector, colorsIn(mode.mode)),
      ...(mode.media
        ? [`@media ${mode.media.query} {\n${indent(rule(mode.media.selector, colorsIn(mode.mode)))}\n}`]
        : []),
    ]),
    ...[...overrides.entries()]
      .sort(([a], [b]) => a - b)
      .map(([width, declarations]) => `@media (min-width: ${rem(width)}) {\n${indent(rule(':root', declarations))}\n}`),
    ...(config.textStyles.form === 'doubled'
      ? [
          `@layer utilities {\n${typeClasses.map((c) => indent(rule(`.${c.name}.${c.name}`, c.declarations))).join('\n\n')}\n}`,
        ]
      : typeClasses.map((c) => rule(`@utility ${c.name}`, c.declarations))),
  ]
  return `${blocks.filter((block) => block !== '').join('\n\n')}\n`
}

function typeClass(
  style: TypeToken,
  config: TokensConfig,
  length: (suffix: string, value: Length) => string,
): { name: string; declarations: Declarations } {
  const declarations: Declarations = [
    ['font-family', `var(--font-${style.fontKey})`],
    ['font-size', length('size', style.size)],
    ['font-weight', String(style.weight)],
  ]
  if (style.italic) declarations.push(['font-style', 'italic'])
  const lineHeight = style.lineHeight
  if (lineHeight.kind === 'length') declarations.push(['line-height', length('leading', lineHeight.value)])
  if (lineHeight.kind === 'ratio') declarations.push(['line-height', String(round(lineHeight.value, 4))])
  if (style.letterSpacing) declarations.push(['letter-spacing', `${style.letterSpacing}em`])
  if (style.textTransform) declarations.push(['text-transform', style.textTransform])
  return { name: `${config.textStyles.prefix}${style.name}`, declarations }
}

function themeLengths(namespace: string, entries: Entry[], value: (property: string, length: Length) => string) {
  return entries.map(({ key, value: length }): [string, string] => {
    const property = `--${namespace}-${key}`
    return [property, value(property, length)]
  })
}

/** clamp() from `from` px at `fromWidth` to `to` px at `toWidth`, linear in between. */
function fluid(from: number, to: number, fromWidth: number, toWidth: number, rootFontSize: number) {
  const rem = (px: number) => `${round(px / rootFontSize, 4)}rem`
  if (from === to) return rem(from)
  const slope = (to - from) / (toWidth - fromWidth)
  const intercept = from - slope * fromWidth
  const preferred = `${rem(intercept)} + ${round(slope * 100, 4)}vw`
  return `clamp(${rem(Math.min(from, to))}, ${preferred}, ${rem(Math.max(from, to))})`
}

function fontStack(key: string, family: string) {
  const fallback =
    key === 'mono'
      ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
      : key === 'serif'
        ? 'ui-serif, Georgia, serif'
        : 'ui-sans-serif, system-ui, sans-serif'
  return `"${family}", ${fallback}`
}

function scalar(value: Length, name: string) {
  if (typeof value !== 'number') throw new Error(`${name} cannot be responsive`)
  return value
}

function rule(selector: string, declarations: Declarations) {
  if (declarations.length === 0) return ''
  return `${selector} {\n${declarations.map(([p, v]) => `  ${p}: ${v};`).join('\n')}\n}`
}

function indent(text: string) {
  return text
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n')
}

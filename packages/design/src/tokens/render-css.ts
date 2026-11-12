// Tokens -> a Tailwind v4 stylesheet.
//
//   @theme        --color-<role>: var(--<role>), --font-*, --spacing(-*), --radius-*, --font-weight-*, --text-*,
//                 --tracking-*, --leading-*, --breakpoint-*, --transition-duration-*, --ease-*, --shadow-*, each
//                 in the form Tailwind's own theme declares it, so a utility the store uses computes the same
//   :root         --<role> in the first Theme mode, plus the responsive sizes at their base viewport
//   <selector>    --<role> in each other Theme mode (and under its media query, if it has one)
//   @media        the responsive sizes from each later viewport mode up (`steps` scale only)
//   type-<name>   one utility per text style (`doubled`: its selector doubled, `.type-x.type-x`)
//
// Colour roles go through an indirection (`--color-ink: var(--ink)`) so a mode only swaps the raw
// variable, and every utility (`text-ink`, `bg-ink/40`) follows without a dark: variant.
import type { TokensConfig } from '../config.ts'
import { type Entry, type Length, round, type Tokens, type TypeToken } from './tokens.ts'

type Declarations = [property: string, value: string][]

export function renderCss(tokens: Tokens, config: TokensConfig): string {
  const rem = (px: number) => (px === 0 ? '0' : `${round(px / config.rootFontSize, 4)}rem`)
  const remNumber = (px: number) => String(round(px / config.rootFontSize, 4))
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
      // Between the first and the last mode; the ones between are drawing modes, checked by buildTokens.
      const to = later.at(-1)
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
    ...spacing(tokens.space, lengthValue),
    ...tokens.radius.map(({ key, value }): [string, string] => {
      const property = `--radius-${key}`
      // 9999 is how a design file says "pill"; Tailwind's own full radius is unbounded.
      return [
        property,
        typeof value === 'number' && value >= 9999 ? 'calc(infinity * 1px)' : lengthValue(property, value),
      ]
    }),
    ...tokens.weights.map(({ key, value }): [string, string] => [
      `--font-weight-${key}`,
      String(scalar(value, `weight/${key}`)),
    ]),
    ...tokens.text.flatMap(({ key, size, leading }): [string, string][] => [
      [`--text-${key}`, rem(size)],
      // A ratio, as Tailwind writes it, so a nested element with its own size keeps the proportion.
      ...(leading === undefined
        ? []
        : [[`--text-${key}--line-height`, `calc(${remNumber(leading)} / ${remNumber(size)})`] as [string, string]]),
    ]),
    ...tokens.tracking.map(({ key, value }): [string, string] => [
      `--tracking-${key}`,
      `${round(scalar(value, `tracking/${key}`) / 100, 4)}em`,
    ]),
    ...tokens.leading.map(({ key, value }): [string, string] => [
      `--leading-${key}`,
      String(scalar(value, `leading/${key}`)),
    ]),
    ...themeLengths('breakpoint', tokens.breakpoints, lengthValue),
    ...tokens.durations.map(({ key, value }): [string, string] => [
      `--transition-duration-${key}`,
      `${scalar(value, `duration/${key}`)}ms`,
    ]),
    ...tokens.eases.map(({ key, value }): [string, string] => [`--ease-${key}`, value]),
    ...tokens.shadows.map(({ key, value }): [string, string] => [`--shadow-${key}`, value]),
  ]

  const [firstMode, ...otherModes] = config.theme.modes
  if (!firstMode) throw new Error('theme.modes is empty')
  const colorsIn = (mode: string): Declarations =>
    tokens.colors.map(({ name, values }) => [`--${name}`, values[mode] ?? ''])

  const typeVariables: Declarations = []
  const typeClasses = tokens.textStyles.map((style) =>
    typeClass(style, config, (suffix, value) => {
      if (suffix === 'size' && style.sizeKey !== undefined) return `var(--text-${style.sizeKey})`
      if (suffix === 'leading' && style.leadingKey !== undefined) return `var(--text-${style.leadingKey}--line-height)`
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
    // `&&` doubles the selector inside the utility (`.type-x.type-x`, `.md\:type-x.md\:type-x`): it outranks a
    // single utility and still takes variants.
    ...typeClasses.map((c) =>
      config.textStyles.form === 'doubled'
        ? `@utility ${c.name} {\n${indent(rule('&&', c.declarations))}\n}`
        : rule(`@utility ${c.name}`, c.declarations),
    ),
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
  if (style.textDecoration) declarations.push(['text-decoration-line', style.textDecoration])
  // In px, as Tailwind's underline-offset-* writes it.
  if (style.underlineOffset !== undefined) declarations.push(['text-underline-offset', `${style.underlineOffset}px`])
  return { name: `${config.textStyles.prefix}${style.name}`, declarations }
}

/**
 * space/1 is Tailwind's `--spacing`, the step every numbered utility multiplies (`p-4` is four of them).
 * A numbered key on that scale is then implied and not declared again; any other key is `--spacing-<key>`.
 */
function spacing(entries: Entry[], value: (property: string, length: Length) => string): [string, string][] {
  const step = entries.find((e) => e.key === '1')?.value
  if (typeof step !== 'number') return themeLengths('spacing', entries, value)
  const implied = (e: Entry) =>
    /^\d+(\.\d+)?$/.test(e.key) && typeof e.value === 'number' && e.value === Number(e.key) * step
  return [
    ['--spacing', value('--spacing', step)],
    ...themeLengths(
      'spacing',
      entries.filter((e) => !implied(e)),
      value,
    ),
  ]
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

/** Tailwind's own stacks: a family is put in front of its key's, unless the stack already names it. */
const FONT_STACKS: Record<string, string[]> = {
  sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  serif: ['ui-serif', 'Georgia', 'serif'],
  mono: [
    'ui-monospace',
    'SFMono-Regular',
    'Menlo',
    'Monaco',
    'Consolas',
    '"Liberation Mono"',
    '"Courier New"',
    'monospace',
  ],
}

function fontStack(key: string, family: string) {
  const fallback = FONT_STACKS[key] ?? (FONT_STACKS.sans as string[])
  const named = fallback.map((name) => name.replaceAll('"', ''))
  return (named.includes(family) ? fallback : [`"${family}"`, ...fallback]).join(', ')
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

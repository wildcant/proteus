// From the FigCraft snapshot to a plain description of the tokens, independent of any output format.
//
// The naming contract (shared with Atope's exporter, so one design file convention serves every project):
//
//   Theme collection     color/<name>               a colour role, one value per Theme mode
//   any other collection palette/<ramp>/<step>     raw colours the roles alias
//                        space/<key>                spacing; space/1 is the step the numbered keys multiply
//                        radius/<key>               corner radii
//                        tracking/<key>             letter spacing, percent of the font size
//                        leading/<key>              unitless line heights
//                        weight/<key>               font weights
//                        text/<key>/size|leading    the text size scale (px), a leading paired with its size
//                        breakpoint/<key>           viewport widths (px)
//                        duration/<key>             transition durations (ms)
//                        ease/<key>                 timing functions (strings)
//                        stroke/<key>               line widths
//                        font/<key>                 a font family; text styles bind theirs to one of these
//                        type/<name>/size|leading   numbers the type/<name> text style binds
//   Viewport collection  any number                 one value per viewport mode (responsive)
//   Text styles          type/<name>                one class each
//   Effect styles        shadow/<key>               box shadows
//
// A name outside these prefixes is kept in `other` (TS output only) rather than dropped in silence.
import type { TokensConfig } from '../config.ts'
import type { EffectStyle, Rgba, Snapshot, TextStyle, Variable, VariableValue } from './snapshot.ts'

/** A length in px: one value, or one per viewport mode. */
export type Length = number | Record<string, number>

export type Entry = { key: string; value: Length }

type LineHeight = { kind: 'length'; value: Length } | { kind: 'ratio'; value: number } | { kind: 'normal' }

export type TypeToken = {
  name: string
  description: string
  fontKey: string
  family: string
  weight: number
  italic: boolean
  size: Length
  /** The text/<key> the size is bound to, if any: the class then reads `--text-<key>`. */
  sizeKey: string | undefined
  lineHeight: LineHeight
  /** Set when the line height is bound to that same text/<key>/leading. */
  leadingKey: string | undefined
  /** em */
  letterSpacing: number
  textTransform: 'uppercase' | 'lowercase' | 'capitalize' | undefined
}

export type Tokens = {
  themeModes: string[]
  viewportModes: string[]
  colors: { name: string; description: string; values: Record<string, string> }[]
  palette: { key: string; value: string }[]
  space: Entry[]
  radius: Entry[]
  tracking: Entry[]
  leading: Entry[]
  weights: Entry[]
  /** px */
  text: { key: string; size: number; leading: number | undefined }[]
  breakpoints: Entry[]
  /** ms */
  durations: Entry[]
  eases: { key: string; value: string }[]
  shadows: { key: string; value: string }[]
  stroke: Entry[]
  fonts: { key: string; family: string }[]
  /** Numbers in the viewport collection that no text style uses, e.g. layout/margin. */
  responsive: Entry[]
  textStyles: TypeToken[]
  other: Record<string, unknown>
}

const WEIGHTS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  book: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
}

export function buildTokens(snapshot: Snapshot, config: TokensConfig): Tokens {
  const collections = Object.values(snapshot.collections)
  const variables = snapshot.variables
  const collectionNamed = (name: string) => {
    const collection = collections.find((c) => c.name === name)
    if (!collection) throw new Error(`the design file has no "${name}" variable collection`)
    return collection
  }
  const theme = collectionNamed(config.theme.collection)
  const viewport = config.viewport ? collectionNamed(config.viewport.collection) : undefined
  const themeModes = config.theme.modes.map((m) => m.mode)
  const viewportModes = config.viewport?.modes.map((m) => m.mode) ?? []
  for (const mode of themeModes) modeId(theme, mode)
  for (const mode of viewportModes) if (viewport) modeId(viewport, mode)
  // A fluid scale reads only its two ends; the modes between them are there to draw frames at, so
  // they must hold what the browser computes at that width.
  const fluidEnds =
    config.viewport?.scale === 'fluid' ? [config.viewport.modes[0], config.viewport.modes.at(-1)] : undefined

  // A value as seen in the given modes (by collection name). An alias is followed into its own
  // collection, in that collection's mode from `modes`, else its default.
  const valueIn = (variable: Variable, modes: Record<string, string>): VariableValue => {
    const collection = snapshot.collections[variable.variableCollectionId]
    if (!collection) throw new Error(`${variable.name}: unknown collection ${variable.variableCollectionId}`)
    const modeName = modes[collection.name]
    const mode = collection.modes.find((m) => m.name === modeName)?.modeId ?? collection.defaultModeId
    const value = variable.valuesByMode[mode]
    if (value === undefined) throw new Error(`${variable.name}: no value in mode ${modeName ?? 'default'}`)
    if (isAlias(value)) {
      const target = variables[value.id]
      if (!target) throw new Error(`${variable.name}: aliases a missing variable ${value.id}`)
      return valueIn(target, modes)
    }
    return value
  }

  const length = (variable: Variable): Length => {
    if (viewport && variable.variableCollectionId === viewport.id) {
      const values = Object.fromEntries(
        viewportModes.map((mode) => [mode, number(valueIn(variable, { [viewport.name]: mode }), variable)]),
      )
      const [from, to] = fluidEnds ?? []
      if (from && to) {
        for (const between of config.viewport?.modes.slice(1, -1) ?? []) {
          const expected = round(
            (values[from.mode] ?? 0) +
              (((values[to.mode] ?? 0) - (values[from.mode] ?? 0)) * (between.width - from.width)) /
                (to.width - from.width),
            2,
          )
          const held = values[between.mode] ?? 0
          if (Math.abs(held - expected) > 0.01) {
            throw new Error(
              `${variable.name}: ${between.mode} (${between.width}) holds ${held}, but the fluid scale gives ${expected} there`,
            )
          }
        }
      }
      return values
    }
    return number(valueIn(variable, {}), variable)
  }

  const used = new Set<string>()
  const byPrefix = (prefix: string) =>
    Object.values(variables)
      .filter((v) => v.name.startsWith(prefix) && v.variableCollectionId !== theme.id)
      .map((v) => {
        used.add(v.id)
        return v
      })
  const entries = (prefix: string): Entry[] =>
    byPrefix(prefix).map((v) => ({ key: v.name.slice(prefix.length).replaceAll('/', '-'), value: length(v) }))

  const colors = theme.variableIds
    .map((id) => variables[id])
    .filter((v): v is Variable => v?.resolvedType === 'COLOR' && v.name.startsWith('color/'))
    .map((v) => {
      used.add(v.id)
      return {
        name: v.name.slice('color/'.length).replaceAll('/', '-'),
        description: v.description,
        values: Object.fromEntries(themeModes.map((mode) => [mode, hex(valueIn(v, { [theme.name]: mode }), v)])),
      }
    })

  const palette = byPrefix('palette/').map((v) => ({
    key: v.name.slice('palette/'.length).replaceAll('/', '-'),
    value: hex(valueIn(v, {}), v),
  }))
  const fonts = byPrefix('font/').map((v) => ({ key: v.name.slice('font/'.length), family: String(valueIn(v, {})) }))
  const fontKeyOf = new Map(byPrefix('font/').map((v) => [v.id, v.name.slice('font/'.length)]))

  const textStyles = snapshot.textStyles
    .filter((s) => s.name.startsWith('type/'))
    .map((s) => typeToken(s, { variables, fontKeyOf, fonts, length, used }))
  // type/<name>/* numbers reach the output through the text styles that bind them, not on their own.
  byPrefix('type/')

  const space = entries('space/')
  const radius = entries('radius/')
  const tracking = entries('tracking/')
  const leading = entries('leading/')
  const weights = entries('weight/')
  const breakpoints = entries('breakpoint/')
  const durations = entries('duration/')
  const stroke = entries('stroke/')
  const eases = byPrefix('ease/').map((v) => ({ key: v.name.slice('ease/'.length), value: String(valueIn(v, {})) }))

  const textScale = new Map<string, { size?: number; leading?: number }>()
  for (const v of byPrefix('text/')) {
    const match = /^text\/(.+)\/(size|leading)$/.exec(v.name)
    if (!match?.[1]) throw new Error(`${v.name}: name a text scale variable text/<key>/size or text/<key>/leading`)
    const entry = textScale.get(match[1]) ?? {}
    entry[match[2] as 'size' | 'leading'] = scalarNumber(length(v), v.name)
    textScale.set(match[1], entry)
  }
  const text = [...textScale].map(([key, { size, leading }]) => {
    if (size === undefined) throw new Error(`text/${key}/leading has no text/${key}/size`)
    return { key, size, leading }
  })

  const shadows = snapshot.effectStyles
    .filter((s) => s.name.startsWith('shadow/'))
    .map((s) => ({
      key: s.name.slice('shadow/'.length).replaceAll('/', '-'),
      value: shadowValue(s, variables, theme.id),
    }))

  const responsive: Entry[] = viewport
    ? viewport.variableIds
        .map((id) => variables[id])
        .filter((v): v is Variable => v?.resolvedType === 'FLOAT' && !used.has(v.id))
        .map((v) => {
          used.add(v.id)
          return { key: v.name.replaceAll('/', '-'), value: length(v) }
        })
    : []

  const other = Object.fromEntries(
    Object.values(variables)
      .filter((v) => !used.has(v.id) && v.variableCollectionId !== theme.id)
      .map((v) => [v.name, v.resolvedType === 'COLOR' ? hex(valueIn(v, {}), v) : valueIn(v, {})]),
  )

  return {
    themeModes,
    viewportModes,
    colors,
    palette,
    space,
    radius,
    tracking,
    leading,
    weights,
    text,
    breakpoints,
    durations,
    eases,
    shadows,
    stroke,
    fonts,
    responsive,
    textStyles,
    other,
  }
}

function typeToken(
  style: TextStyle,
  context: {
    variables: Snapshot['variables']
    fontKeyOf: Map<string, string>
    fonts: { key: string; family: string }[]
    length: (v: Variable) => Length
    used: Set<string>
  },
): TypeToken {
  const { variables, fontKeyOf, length, used } = context
  const s = style.style
  const bound = (field: keyof NonNullable<TextStyle['bound']>) => {
    const id = style.bound?.[field]
    if (!id) return undefined
    const variable = variables[id]
    if (!variable) throw new Error(`${style.name}: its ${field} is bound to a missing variable ${id}`)
    used.add(id)
    return variable
  }

  const familyVariable = bound('fontFamily')
  const fontKey = familyVariable ? fontKeyOf.get(familyVariable.id) : undefined
  if (!fontKey) throw new Error(`${style.name}: bind its font family to a font/* variable`)
  const family = context.fonts.find((f) => f.key === fontKey)?.family
  if (family !== s.fontFamily) {
    throw new Error(`${style.name}: its font ${s.fontFamily} is not the value of font/${fontKey} (${family})`)
  }

  const weightName = s.fontStyle.toLowerCase().replace(/italic|oblique|[\s_-]/g, '')
  const weight = WEIGHTS[weightName || 'regular']
  if (!weight) throw new Error(`${style.name}: no font weight for the style "${s.fontStyle}"`)

  const sizeVariable = bound('fontSize')
  const leadingVariable = bound('lineHeight')
  const sizeKey = /^text\/(.+)\/size$/.exec(sizeVariable?.name ?? '')?.[1]
  const leadingKey = /^text\/(.+)\/leading$/.exec(leadingVariable?.name ?? '')?.[1]
  const lineHeight: LineHeight = leadingVariable
    ? { kind: 'length', value: length(leadingVariable) }
    : s.lineHeight.unit === 'pixels'
      ? { kind: 'length', value: s.lineHeight.value ?? s.fontSize }
      : s.lineHeight.unit === 'percent'
        ? { kind: 'ratio', value: (s.lineHeight.value ?? 100) / 100 }
        : { kind: 'normal' }

  const letterSpacing =
    s.letterSpacing.unit === 'percent' ? s.letterSpacing.value / 100 : s.letterSpacing.value / s.fontSize

  return {
    name: style.name.slice('type/'.length).replaceAll('/', '-'),
    description: style.description,
    fontKey,
    family: s.fontFamily,
    weight,
    italic: /italic|oblique/i.test(s.fontStyle),
    size: sizeVariable ? length(sizeVariable) : s.fontSize,
    sizeKey,
    lineHeight,
    leadingKey: leadingKey !== undefined && leadingKey === sizeKey ? leadingKey : undefined,
    letterSpacing: round(letterSpacing, 4),
    textTransform: ({ upper: 'uppercase', lower: 'lowercase', title: 'capitalize' } as const)[
      s.case as 'upper' | 'lower' | 'title'
    ],
  }
}

function modeId(collection: { name: string; modes: { modeId: string; name: string }[] }, name: string) {
  const mode = collection.modes.find((m) => m.name === name)
  if (!mode) throw new Error(`the "${collection.name}" collection has no "${name}" mode`)
  return mode.modeId
}

function isAlias(value: VariableValue): value is { type: 'VARIABLE_ALIAS'; id: string } {
  return typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS'
}

function number(value: VariableValue, variable: Variable): number {
  if (typeof value !== 'number') throw new Error(`${variable.name}: expected a number, got ${JSON.stringify(value)}`)
  return value
}

function hex(value: VariableValue, variable: Variable): string {
  if (typeof value !== 'object' || !('r' in value)) {
    throw new Error(`${variable.name}: expected a colour, got ${JSON.stringify(value)}`)
  }
  return colorString(value as Rgba)
}

/** `#rrggbb` when opaque; `rgb(r g b / a)` otherwise, so the alpha is kept as designed, not rounded to 8 bits. */
export function colorString(color: Rgba): string {
  const channels = [color.r, color.g, color.b].map((c) => Math.round(c * 255))
  if (color.a < 1) return `rgb(${channels.join(' ')} / ${round(color.a, 3)})`
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** A shadow style in CSS: Tailwind's notation, a colour bound to a Theme role as `var(--<role>)`. */
function shadowValue(style: EffectStyle, variables: Snapshot['variables'], themeId: string): string {
  const px = (n: number) => (n === 0 ? '0' : `${round(n, 2)}px`)
  return style.effects
    .map((effect, i) => {
      if (effect.type !== 'dropShadow' && effect.type !== 'innerShadow') {
        throw new Error(`${style.name}: effect ${i} is a ${effect.type}; only shadows export`)
      }
      const boundId = style.bound?.[`effects/${i}/color`]
      const role = boundId ? variables[boundId] : undefined
      if (boundId && !(role && role.variableCollectionId === themeId && role.name.startsWith('color/'))) {
        throw new Error(`${style.name}: bind effect ${i}'s colour to a color/* role, not ${role?.name ?? boundId}`)
      }
      const color = role ? `var(--${role.name.slice('color/'.length).replaceAll('/', '-')})` : colorString(effect.color)
      const [x, y] = effect.offset
      return `${effect.type === 'innerShadow' ? 'inset ' : ''}${px(x)} ${px(y)} ${px(effect.radius)} ${px(effect.spread)} ${color}`
    })
    .join(', ')
}

function scalarNumber(value: Length, name: string) {
  if (typeof value !== 'number') throw new Error(`${name} cannot be responsive`)
  return value
}

export function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

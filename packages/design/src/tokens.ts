// From the FigCraft snapshot to a plain description of the tokens, independent of any output format.
//
// The naming contract (shared with Atope's exporter, so one design file convention serves every project):
//
//   Theme collection     color/<name>               a colour role, one value per Theme mode
//   any other collection palette/<ramp>/<step>     raw colours the roles alias
//                        space/<key>                spacing
//                        radius/<key>               corner radii
//                        tracking/<key>             letter spacing, percent of the font size
//                        stroke/<key>               line widths
//                        font/<key>                 a font family; text styles bind theirs to one of these
//                        type/<name>/size|leading   numbers the type/<name> text style binds
//   Viewport collection  any number                 one value per viewport mode (responsive)
//   Text styles          type/<name>                one class each
//
// A name outside these prefixes is kept in `other` (TS output only) rather than dropped in silence.
import type { ResolvedConfig } from './config.ts'
import type { Rgba, Snapshot, TextStyle, Variable, VariableValue } from './snapshot.ts'

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
  lineHeight: LineHeight
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

export function buildTokens(snapshot: Snapshot, config: ResolvedConfig): Tokens {
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
      return Object.fromEntries(
        viewportModes.map((mode) => [mode, number(valueIn(variable, { [viewport.name]: mode }), variable)]),
      )
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
  const stroke = entries('stroke/')

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
    lineHeight,
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
  const color = value as Rgba
  const channels = [color.r, color.g, color.b, ...(color.a < 1 ? [color.a] : [])]
  return `#${channels
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

export function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

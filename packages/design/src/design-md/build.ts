// The token and component snapshots -> DESIGN.md's YAML frontmatter, in Atope's format: colors, typography,
// rounded, spacing and components. The prose under it is hand-written and left alone.
//
//   colors       each Theme role, in the first (default) Theme mode
//   typography   each type/* text style at the base viewport
//   rounded      radius/*        spacing   space/*
//   components   one entry per variant of each exported set (the design-only viewport read at mobile, interaction
//                at rest): its
//                fill, the colour and text style of its first text, and its token-bound size, as references
//                (`{colors.accent}`); left out when `designMd.components` is false
import type { ComponentsContext } from '../components/build.ts'
import { kebab } from '../components/build.ts'
import { type ComponentSet, type Layer, notExportedBecause } from '../components/snapshot.ts'
import type { Entry, Length, Tokens } from '../tokens/tokens.ts'

type Value = string | number | { [key: string]: Value }

export function buildFrontmatter(input: {
  name: string
  description: string
  tokens: Tokens
  /** Left out when `designMd.components` is false. */
  components?: { sets: ComponentSet[]; context: ComponentsContext }
}): string {
  const { tokens } = input
  const baseMode = tokens.themeModes[0] ?? ''
  const baseViewport = tokens.viewportModes[0] ?? ''
  const px = (length: Length) => `${typeof length === 'number' ? length : (length[baseViewport] ?? 0)}px`
  const lengths = (entries: Entry[]) => Object.fromEntries(entries.map(({ key, value }) => [key, px(value)]))

  const typography = Object.fromEntries(
    tokens.textStyles.map((style) => {
      const entry: Record<string, Value> = {
        fontFamily: style.family,
        fontSize: px(style.size),
        fontWeight: style.weight,
      }
      if (style.lineHeight.kind === 'length') entry.lineHeight = px(style.lineHeight.value)
      if (style.lineHeight.kind === 'ratio') entry.lineHeight = style.lineHeight.value
      if (style.letterSpacing) entry.letterSpacing = `${style.letterSpacing}em`
      return [style.name, entry]
    }),
  )

  const lines = [
    `name: ${scalar(input.name)}`,
    `description: ${scalar(input.description)}`,
    `colors: ${flow(Object.fromEntries(tokens.colors.map(({ name, values }) => [name, values[baseMode] ?? ''])))}`,
    `typography: ${flow(typography)}`,
    `rounded: ${flow(lengths(tokens.radius))}`,
    `spacing: ${flow(lengths(tokens.space))}`,
  ]
  if (input.components) lines.push(`components: ${flow(components(input.components.sets, input.components.context))}`)
  return `---\n${lines.join('\n')}\n---\n`
}

/** The document with its frontmatter replaced, or added when it has none. */
export function withFrontmatter(document: string, frontmatter: string) {
  const existing = /^---\n(?:[\s\S]*?\n)?---\n/.exec(document)
  return `${frontmatter}${existing ? document.slice(existing[0].length) : document}`
}

function components(sets: ComponentSet[], context: ComponentsContext) {
  const token = (id: string | undefined, prefix: string) => {
    const name = id ? context.variables[id]?.name : undefined
    return name?.startsWith(prefix) ? name.slice(prefix.length).replaceAll('/', '-') : undefined
  }
  const textStyleNames = Object.fromEntries(context.textStyles.map((s) => [s.id, s.name]))
  const entries: [string, Record<string, Value>][] = []
  for (const set of sets.filter((s) => !notExportedBecause(s, context.config))) {
    const variantProps = set.properties.filter(
      (p) => p.type === 'variant' && p.name !== 'viewport' && p.name !== 'interaction',
    )
    const textProps = new Set(set.properties.filter((p) => p.type === 'text').map((p) => p.name))
    for (const variant of set.variants) {
      const props = Object.fromEntries(
        set.properties.some((p) => p.type === 'variant') ? variant.name.split(', ').map((pair) => pair.split('=')) : [],
      ) as Record<string, string>
      if ((props.viewport ?? 'mobile') !== 'mobile' || (props.interaction ?? 'rest') !== 'rest') continue
      // Named after the set and the values that are not its defaults: button, button-secondary.
      const key = [set.name, ...variantProps.filter((p) => props[p.name] !== p.default).map((p) => props[p.name])]
        .map((part) => kebab(part ?? ''))
        .join('-')
      entries.push([key, entryOf(variant, firstText(variant, textProps), token, textStyleNames)])
    }
  }
  return Object.fromEntries(entries)
}

/** A variant's fill, its first text's colour and style, and its token-bound size, as token references. */
function entryOf(
  variant: Layer,
  label: Layer | undefined,
  token: (id: string | undefined, prefix: string) => string | undefined,
  textStyleNames: Record<string, string>,
) {
  const entry: Record<string, Value> = {}
  const background = token(boundFill(variant), 'color/')
  if (background) entry.backgroundColor = `{colors.${background}}`
  const textColor = label && token(boundFill(label), 'color/')
  if (textColor) entry.textColor = `{colors.${textColor}}`
  const style = label?.textStyle ? textStyleNames[label.textStyle] : undefined
  if (style?.startsWith('type/')) entry.typography = `{typography.${style.slice('type/'.length).replaceAll('/', '-')}}`
  for (const [field, axis] of [
    ['width', 'horizontal'],
    ['height', 'vertical'],
  ] as const) {
    const size = variant.sizing?.[axis] === 'fixed' ? token(variant.boundVariables?.[field], 'space/') : undefined
    if (size) entry[field] = `{spacing.${size}}`
  }
  return entry
}

function boundFill(layer: Layer) {
  return layer.boundVariables?.fill ?? layer.boundVariables?.['fills/0/color']
}

/** The component's own first text, depth first: not inside a nested instance, nor the caller's content in a slot. */
function firstText(layer: Layer, textProps: Set<string>): Layer | undefined {
  for (const child of layer.children ?? []) {
    if (child.visible === false || child.type === 'INSTANCE') continue
    if (child.type === 'TEXT') {
      if (!layer.slot || textProps.has(child.name)) return child
      continue
    }
    const found = firstText(child, textProps)
    if (found) return found
  }
  return undefined
}

/** A YAML flow mapping on one line: `{ ink: "#0d1012", "2": "8px" }`. */
function flow(value: Value): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return JSON.stringify(value)
  const pairs = Object.entries(value).map(
    ([key, v]) => `${/^[A-Za-z_][\w-]*$/.test(key) ? key : JSON.stringify(key)}: ${flow(v)}`,
  )
  return pairs.length ? `{ ${pairs.join(', ')} }` : '{}'
}

/** A plain YAML scalar when it reads as one, else a double-quoted one. */
function scalar(text: string) {
  return /^[^-?:,[\]{}#&*!|>'"%@`\s][^#]*$/.test(text) && !/:\s|\s$/.test(text) ? text : JSON.stringify(text)
}

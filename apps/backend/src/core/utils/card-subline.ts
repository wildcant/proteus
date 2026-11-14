/**
 * The list card's subline, from the structure file's `card.subline` template:
 * `"{type} para {genero|lower} · {estilo}"`.
 *
 * - `{type}` is the product's Type, `{brand}` its brand, and `{<key>}` the values of the field `key`.
 * - `|lower` lower-cases what a placeholder renders.
 * - A field holding several values joins them with the card's `listSeparator`.
 * - The template is split into segments at ` · `. A segment shows only when every placeholder in it
 *   has a value, so "Zapatillas para" never shows without a gender; the segments left are joined by
 *   ` · ` again, and none left is no subline.
 */

/** Where a subline splits into segments that show or vanish on their own. */
const SUBLINE_SEGMENT_SEPARATOR = ' · '

/** The placeholders every template may use beside a field's key. */
export const SUBLINE_BUILTIN_PLACEHOLDERS = ['type', 'brand'] as const

const MODIFIERS = ['lower'] as const

type SublineModifier = (typeof MODIFIERS)[number]

type SublinePart = { text: string } | { key: string; modifiers: SublineModifier[] }

export type SublineTemplate = SublinePart[][]

const PLACEHOLDER = /\{([^{}]*)\}/g

/**
 * The template's segments, each a run of text and placeholders, or what is wrong with it: a brace with
 * no partner, an empty placeholder, or a modifier other than `lower`. Which keys exist is the caller's
 * to check, from {@link sublineKeys}.
 */
export function parseSublineTemplate(template: string): { template: SublineTemplate } | { error: string } {
  const segments: SublineTemplate = []
  for (const written of template.split(SUBLINE_SEGMENT_SEPARATOR)) {
    const parts: SublinePart[] = []
    let last = 0
    for (const match of written.matchAll(PLACEHOLDER)) {
      const text = written.slice(last, match.index)
      if (/[{}]/.test(text)) return { error: 'A "{" or "}" has no partner.' }
      if (text) parts.push({ text })
      const [key = '', ...modifiers] = (match[1] ?? '').split('|').map((piece) => piece.trim())
      if (!key) return { error: 'A placeholder must name a key, like "{type}".' }
      const unknown = modifiers.find((modifier) => !MODIFIERS.includes(modifier as SublineModifier))
      if (unknown !== undefined) return { error: `"${unknown}" is not a modifier; the one there is is "lower".` }
      parts.push({ key, modifiers: modifiers as SublineModifier[] })
      last = match.index + match[0].length
    }
    const rest = written.slice(last)
    if (/[{}]/.test(rest)) return { error: 'A "{" or "}" has no partner.' }
    if (rest) parts.push({ text: rest })
    segments.push(parts)
  }
  return { template: segments }
}

/** The keys a parsed template reads, each once. */
export function sublineKeys(template: SublineTemplate): string[] {
  return [...new Set(template.flatMap((parts) => parts.flatMap((part) => ('key' in part ? [part.key] : []))))]
}

/**
 * The subline for one product: `valuesOf(key)` gives the labels a placeholder shows, empty when the
 * product has none. `null` when no segment has all its values.
 */
export function renderSubline(
  template: SublineTemplate,
  valuesOf: (key: string) => string[],
  listSeparator: string,
): string | null {
  const shown = template.flatMap((parts) => {
    const rendered: string[] = []
    for (const part of parts) {
      if ('text' in part) {
        rendered.push(part.text)
        continue
      }
      const values = valuesOf(part.key).filter((value) => value.trim() !== '')
      if (values.length === 0) return []
      const joined = values.join(listSeparator)
      rendered.push(part.modifiers.includes('lower') ? joined.toLocaleLowerCase() : joined)
    }
    const segment = rendered.join('').trim()
    return segment ? [segment] : []
  })
  return shown.length > 0 ? shown.join(SUBLINE_SEGMENT_SEPARATOR) : null
}

// Stories read a component set's snapshot (`figcraft/components/<Set>.json`) for their default args and
// control options, so Storybook offers exactly what the design file draws.

/** The part of a set snapshot a story reads. */
type ComponentSet = {
  properties: readonly { name: string; default?: unknown; options?: readonly string[] }[]
}

/** A variant property's options, in FigCraft's order. */
export const setOptions = (set: ComponentSet, property: string) => [
  ...(set.properties.find(({ name }) => name === property)?.options ?? []),
]

/** A property's default: a text property's label, or a variant property's default value. */
export const setDefault = (set: ComponentSet, property: string) =>
  String(set.properties.find(({ name }) => name === property)?.default ?? '')

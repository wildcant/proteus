import type { ZodType } from 'zod'

type ZodDef = { type?: string; innerType?: unknown; shape?: Record<string, unknown> }

function getDef(schema: unknown): ZodDef | undefined {
  if (typeof schema !== 'object' || schema === null) return undefined
  const { def } = schema as { def?: unknown }
  if (typeof def !== 'object' || def === null) return undefined
  return def as ZodDef
}

/** Peel optional/nullable/default wrappers to reach the schema underneath. */
function unwrap(schema: unknown): unknown {
  let current = schema
  // Bounded rather than recursive: wrappers never nest deeply, and a malformed def
  // should not hang a render.
  for (let depth = 0; depth < 10; depth++) {
    const def = getDef(current)
    if (!def) return current
    const isWrapper =
      def.type === 'optional' || def.type === 'nullable' || def.type === 'default' || def.type === 'nonoptional'
    if (!isWrapper) return current
    current = def.innerType
  }
  return current
}

function acceptsUndefined(schema: unknown): boolean {
  if (typeof (schema as { safeParse?: unknown })?.safeParse !== 'function') return true
  return (schema as ZodType).safeParse(undefined).success
}

/**
 * Whether `path` names a required field of `schema`.
 *
 * A field is required when its schema rejects `undefined` — that catches `z.string()`,
 * `.min(1)` and `z.email()` alike, and treats anything wrapped in `.optional()` as not
 * required. Wrappers are peeled at every level, so a path can descend through an
 * optional object (`shippingAddress` is `.optional()`, its `postalCode` is not).
 *
 * Anything it cannot resolve — a path absent from the schema, a form with no Zod
 * validator, an array index like `items[0].title` — returns false, so an unknown field
 * simply goes unmarked instead of being marked wrongly.
 *
 * Reads Zod's `.def`, which is public in Zod 4 but still a tighter coupling than
 * `.parse()`. If a Zod upgrade breaks this, the symptom is missing asterisks, not
 * broken validation.
 */
export function isFieldRequired(schema: unknown, path: string): boolean {
  let current: unknown = schema
  for (const segment of path.split('.')) {
    const shape = getDef(unwrap(current))?.shape
    if (!shape) return false
    current = shape[segment]
    if (current === undefined) return false
  }
  return !acceptsUndefined(current)
}

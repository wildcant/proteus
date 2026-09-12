import * as schema from '../../schema.gen.js'

/** Shared drizzle options — schema + casing used by all providers. */
export const DRIZZLE_OPTIONS = { casing: 'snake_case' as const, schema }

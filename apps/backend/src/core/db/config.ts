import * as schema from '../../schema.gen.js'

/** Shared database options — schema + casing used by all providers. */
export const DB_OPTIONS = { casing: 'snake_case' as const, schema }

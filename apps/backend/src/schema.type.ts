import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from './schema.gen.js'

export type DatabaseSchema = typeof schema
export type Database = PostgresJsDatabase<DatabaseSchema>

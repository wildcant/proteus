import type { Sql } from 'postgres'

/**
 * The Postgres extensions Proteus needs. drizzle-kit cannot generate `CREATE EXTENSION`, and a module
 * keeps one migration regenerated from its schema, so a hand-added line there would not survive.
 * They are created here instead, before any module migrates.
 */
const DATABASE_EXTENSIONS = ['pg_trgm']

export async function createDatabaseExtensions(sql: Sql) {
  for (const extension of DATABASE_EXTENSIONS) {
    await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS ${extension}`)
  }
}

import { sql as dsql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeEach } from 'vitest'
import { DRIZZLE_OPTIONS } from '../../src/core/db/config.js'
import { env } from '../../src/env.js'
import { withWorkerDatabase } from './database-url.js'

const sql = postgres(withWorkerDatabase(env.DATABASE_URL), {
  prepare: false,
  // Kept well below the default 10: vitest isolates the module registry per file, so this
  // client is rebuilt for every file, and WORKER_COUNT of them exist at once against a
  // default max_connections of 100.
  max: 5,
  onnotice: () => {
    // noop
  },
})
export const db = drizzle(sql, DRIZZLE_OPTIONS)

/**
 * `TRUNCATE` of every table in `public`, resolved once per test file. The schema itself is
 * built in `global-setup.ts`; this only clears rows, which costs O(tables) rather than
 * O(migrations) and so does not grow as tests write more data.
 *
 * Scoped to `public` on purpose: drizzle's bookkeeping lives in the `drizzle` schema and
 * must survive, or the next file's migrations would replay.
 */
let truncateAll: string | undefined

async function resolveTruncateStatement() {
  const [row] = await sql<{ tables: string | null }[]>`
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') AS tables
    FROM pg_tables
    WHERE schemaname = 'public'
  `
  if (!row?.tables) throw new Error('No tables found in "public" — did globalSetup run?')

  // RESTART IDENTITY keeps order.display_id starting at 1, matching a freshly migrated schema.
  return `TRUNCATE ${row.tables} RESTART IDENTITY CASCADE`
}

beforeEach(async () => {
  truncateAll ??= await resolveTruncateStatement()
  await db.execute(dsql.raw(truncateAll))
})

afterAll(async () => {
  await sql.end()
})

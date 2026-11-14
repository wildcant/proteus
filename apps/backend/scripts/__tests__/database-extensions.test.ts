import { test } from '@tests/setup/test-extend.js'
import { sql } from 'drizzle-orm'

test('a migrated database has pg_trgm, so trigram similarity runs', async ({ db, expect }) => {
  const [row] = await db.execute<{ score: number }>(sql`SELECT similarity('zapatilla', 'zapatila') AS score`)

  expect(row?.score).toBeGreaterThan(0.5)
})

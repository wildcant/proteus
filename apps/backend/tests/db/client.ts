import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { DRIZZLE_OPTIONS } from '../../src/core/db/config.js'
import { DEFAULT_TEST_DATABASE_URL, withAppDatabase, withWorkerDatabase } from '../setup/database-url.js'

const DATABASE_URL = process.env.POOLER_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL

// Under vitest this resolves to the worker's own database, matching `db-setup.ts`. Under Playwright
// — the specs reaching these factories through `src/test-exports.ts` — it resolves to the suite's
// own database, matching the backend process `defineE2eConfig` started for it. Neither variable is
// set outside those two, and never both, so anything else stays on the base database.
const sql = postgres(withAppDatabase(withWorkerDatabase(DATABASE_URL)), {
  prepare: false,
  max: 5,
  onnotice: () => {
    // noop
  },
})
export const db = drizzle(sql, DRIZZLE_OPTIONS)

export async function shutdown() {
  await sql.end()
}

import { DEFAULT_TEST_DATABASE_URL, withAppDatabase } from 'backend/test/database-url'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const DATABASE_URL = process.env.POOLER_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL

// The suite's own database, matching the backend process `defineE2eConfig` started for it. Outside
// an e2e run `E2E_APP` is unset and this stays on the base database.
const sql = postgres(withAppDatabase(DATABASE_URL), {
  prepare: false,
  // The truncate loop in `global-setup.ts` raises a NOTICE per cascaded table, and postgres-js
  // prints the whole notice object by default — dozens of them ahead of the first spec.
  onnotice: () => {
    // noop
  },
})
export const db = drizzle(sql, { casing: 'snake_case' })

export async function shutdown() {
  await sql.end()
}

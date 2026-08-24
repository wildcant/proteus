import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { DRIZZLE_OPTIONS } from '../../src/core/db/config.js'
import { withWorkerDatabase } from '../setup/database-url.js'

const DATABASE_URL = process.env.POOLER_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5433/proteus_test'

// Under vitest this resolves to the worker's own database, matching `db-setup.ts`. Outside it
// — the e2e server seeding through `src/test-exports.ts` — it stays on the base database.
const sql = postgres(withWorkerDatabase(DATABASE_URL), {
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

import { withAppDatabase } from 'backend/test/database-url'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const DATABASE_URL = process.env.POOLER_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5433/proteus_test'

// The suite's own database, matching the backend process `defineE2eConfig` started for it. Outside
// an e2e run `E2E_APP` is unset and this stays on the base database.
const sql = postgres(withAppDatabase(DATABASE_URL), { prepare: false })
export const db = drizzle(sql, { casing: 'snake_case' })

export async function shutdown() {
  await sql.end()
}

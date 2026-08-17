import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { DRIZZLE_OPTIONS } from '../../src/core/db/config.js'

const DATABASE_URL = process.env.POOLER_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5433/proteus_test'

const sql = postgres(DATABASE_URL, { prepare: false, onnotice: () => {} })
export const db = drizzle(sql, DRIZZLE_OPTIONS)

export async function shutdown() {
  await sql.end()
}

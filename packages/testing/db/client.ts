import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/proteus_test'

const sql = postgres(DATABASE_URL, { prepare: false })
export const db = drizzle(sql, { casing: 'snake_case' })

export async function shutdown() {
  await sql.end()
}

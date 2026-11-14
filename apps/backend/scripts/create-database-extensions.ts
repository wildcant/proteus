/**
 * The first step of `db:migrate`: creates the database extensions before the per-module migrations.
 * `db:migrate` sets MIGRATING, so `env.DATABASE_URL` is DIRECT_DATABASE_URL, as for drizzle-kit.
 */

import postgres from 'postgres'
import { env } from '../src/env.js'
import { createDatabaseExtensions } from './database-extensions.js'

const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1, onnotice: () => undefined })

try {
  await createDatabaseExtensions(sql)
} finally {
  await sql.end()
}

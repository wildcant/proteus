/**
 * Seed the declared feature catalogue into the permission table.
 *
 * Usage: pnpm --filter backend exec tsx scripts/seed-permissions.ts
 *
 * This is the CI/CD counterpart of the access-control postLoader's sync,
 * which is skipped on the workerd runtime. Run this script against
 * the production database before deploying to Workers.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { DB_OPTIONS } from '../src/core/db/config.js'
import { env } from '../src/env.js'
import { syncPermissions } from '../src/modules/access-control/sync-permissions.js'

const client = postgres(env.POOLER_DATABASE_URL, { prepare: false })
const db = drizzle(client, DB_OPTIONS)
const getDb = () => db

await syncPermissions(getDb)
console.info('Seeded permissions')

await client.end()

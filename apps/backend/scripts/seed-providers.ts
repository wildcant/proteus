/**
 * Seed all module providers into the database.
 *
 * Usage: npx tsx scripts/seed-providers.ts
 *
 * This is the CI/CD counterpart of the provider loaders' DB upsert,
 * which is skipped on the workerd runtime. Run this script against
 * the production database before deploying to Workers.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { DRIZZLE_OPTIONS } from '../src/core/db/config.js'
import { env } from '../src/env.js'
import { syncFulfillmentProviders } from '../src/modules/fulfillment/index.js'
import { syncNotificationProviders } from '../src/modules/notification/index.js'
import { syncPaymentProviders } from '../src/modules/payment/index.js'

const client = postgres(env.POOLER_DATABASE_URL, { prepare: false })
const db = drizzle(client, DRIZZLE_OPTIONS)
const getDb = () => db

await syncPaymentProviders(getDb)
console.info('Seeded payment providers')

await syncFulfillmentProviders(getDb)
console.info('Seeded fulfillment providers')

await syncNotificationProviders(getDb)
console.info('Seeded notification providers')

await client.end()

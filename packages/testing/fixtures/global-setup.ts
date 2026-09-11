import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { DEFAULT_TEST_DATABASE_URL, withAppDatabase } from 'backend/test/database-url'
import { sql } from 'drizzle-orm'
import { db, shutdown } from '../db/client.js'

/**
 * The suite's own database — `proteus_test_store`, `proteus_test_admin`. Creating and migrating it
 * belongs to `backend/scripts/prepare-test-database.ts`, which the web server command runs: by the
 * time this hook is reached Playwright has already started that server, and a database it could
 * not connect to would have failed there first.
 */
const DATABASE_URL = withAppDatabase(process.env.POOLER_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL)

export default async function globalSetup() {
  await db.execute(sql`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$
  `)

  await shutdown()

  // Re-seed providers after truncation. Needed because the backend server may be reused
  // across test runs (reuseExistingServer: true) and won't re-run its boot-time seeding.
  //
  // dotenvx leaves a variable alone when the environment already carries one, so passing the
  // suite's database here is what keeps the seed off the base one — this process still holds the
  // unsuffixed URL that `.env.test` supplied.
  execSync('pnpm --filter backend run db:seed:providers:test', {
    stdio: 'inherit',
    env: { ...process.env, POOLER_DATABASE_URL: DATABASE_URL },
  })

  // Markets, for the same reason and one more: the storefront reads its routable URL segments
  // from the sellable countries, so with none seeded there is no market to render at all. After
  // the providers, because each region is linked to the providers that exist when it is created.
  //
  // Same env override as the providers above, and for the same reason — without it this seeds the
  // *base* database while the suite runs against its own, and the storefront answers every request
  // with "the store does not sell in its default market".
  execSync('pnpm --filter backend run db:seed:markets:test', {
    stdio: 'inherit',
    env: { ...process.env, POOLER_DATABASE_URL: DATABASE_URL },
  })

  rmSync('playwright/.auth', { recursive: true, force: true })
}

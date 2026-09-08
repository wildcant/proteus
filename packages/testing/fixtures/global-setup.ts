import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { db, shutdown } from '../db/client.js'

export default async function globalSetup() {
  // Ensure test DB schema is up-to-date (idempotent — skips already-applied migrations)
  execSync('npm run --workspace=backend db:migrate:test', { stdio: 'inherit' })

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
  execSync('npm run --workspace=backend db:seed:providers:test', { stdio: 'inherit' })

  // Markets, for the same reason and one more: the storefront reads its routable URL segments
  // from the sellable countries, so with none seeded there is no market to render at all. After
  // the providers, because each region is linked to the providers that exist when it is created.
  execSync('npm run --workspace=backend db:seed:markets:test', { stdio: 'inherit' })

  rmSync('playwright/.auth', { recursive: true, force: true })
}

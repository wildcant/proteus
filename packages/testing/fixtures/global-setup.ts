import { rmSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { db, shutdown } from '../db/client.js'

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

  rmSync('playwright/.auth', { recursive: true, force: true })

  await shutdown()
}

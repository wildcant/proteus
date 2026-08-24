import { sql as dsql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'
import { DRIZZLE_OPTIONS } from '../../src/core/db/config.js'
import { env } from '../../src/env.js'
import { WORKER_COUNT, withWorkerDatabase } from './database-url.js'
import { migrateAll } from './db-migrations.js'

/**
 * Arbitrary constant. Advisory locks share one namespace per database, so it only has to be a
 * value nothing else in this codebase picks.
 */
const RUN_LOCK_KEY = 8_312_004

/**
 * Builds one schema per worker database, once for the whole run. Per-test isolation is a
 * TRUNCATE in `db-setup.ts`, which is ~9x cheaper than re-migrating.
 *
 * The DROP is load-bearing and must not be optimised away into "migrate only if needed":
 * we regenerate migrations in place under the same tag, so a changed file keeps its old
 * name and drizzle's recorded hash would no longer match. Every run has to start cold.
 */
export async function setup() {
  const lock = await claimRun()

  try {
    const urls = Array.from({ length: WORKER_COUNT }, (_, index) =>
      withWorkerDatabase(env.DATABASE_URL, String(index + 1)),
    )

    await createMissingDatabases(urls)
    await Promise.all(urls.map(migrateDatabase))
  } catch (error) {
    await lock.end()
    throw error
  }

  return async () => {
    await lock.end()
  }
}

/**
 * Worker database names are derived from `VITEST_POOL_ID`, which restarts at 1 for every run —
 * so two concurrent runs claim the same databases and the second one's `DROP SCHEMA` pulls the
 * tables out from under the first. That has cost real debugging time more than once, usually
 * from an editor watcher nobody remembered was running, and it surfaces as unrelated-looking
 * failures deep in the suite.
 *
 * A session-scoped advisory lock turns that into an immediate, legible error instead. Postgres
 * releases it when the connection drops, so a killed run leaves nothing to clean up.
 */
async function claimRun() {
  const lock = connect(env.DATABASE_URL)
  const [row] = await lock<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${RUN_LOCK_KEY}) AS locked`

  if (!row?.locked) {
    await lock.end()
    throw new Error(
      'Another vitest run already holds the test databases. Both would migrate the same ' +
        'proteus_test_* databases and corrupt each other.\n' +
        'Find it with `pgrep -fl vitest` — an editor watcher (vitest-vscode) is the usual culprit.',
    )
  }

  return lock
}

/**
 * Creating a database is a file copy of `template1`, so it is left in place between runs and
 * only the first run on a machine pays for it. Serial because concurrent `CREATE DATABASE`
 * calls contend on the same template.
 */
async function createMissingDatabases(urls: string[]) {
  const names = urls.map((url) => new URL(url).pathname.slice(1))
  const admin = connect(env.DATABASE_URL)

  try {
    const existing = await admin<{ datname: string }[]>`
      SELECT datname FROM pg_database WHERE datname = ANY(${names})
    `
    const present = new Set(existing.map((row) => row.datname))

    for (const name of names.filter((name) => !present.has(name))) {
      await admin.unsafe(`CREATE DATABASE "${name}"`)
    }
  } finally {
    await admin.end()
  }
}

async function migrateDatabase(url: string) {
  const sql = connect(url)
  const db = drizzle(sql, DRIZZLE_OPTIONS)

  try {
    await db.execute(dsql`SET client_min_messages = WARNING`)
    await db.execute(dsql`DROP SCHEMA IF EXISTS drizzle CASCADE`)
    await db.execute(dsql`DROP SCHEMA IF EXISTS public CASCADE`)
    await db.execute(dsql`CREATE SCHEMA public`)
    await migrateAll(db)
  } finally {
    await sql.end()
  }
}

function connect(url: string): Sql {
  return postgres(url, {
    prepare: false,
    max: 2,
    onnotice: () => {
      // noop
    },
  })
}

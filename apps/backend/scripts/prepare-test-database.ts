import { execSync } from 'node:child_process'
import postgres from 'postgres'

/**
 * Creates and migrates the database a `dev:test` backend is about to boot against.
 *
 * This has to run before the server, not inside a Playwright `globalSetup`, because Playwright
 * starts `webServer` first — the server's own connection is what fails, before any setup hook gets
 * a turn. It only became load-bearing when each e2e suite got a database of its own
 * (`proteus_test_store`, `proteus_test_admin`): those are not the `POSTGRES_DB` the container
 * creates, and its data directory is tmpfs, so every docker restart is a cold cluster.
 *
 * Resetting rows is still `globalSetup`'s job. This only guarantees the schema exists.
 */

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/proteus_test'

/**
 * Arbitrary constant, distinct from the ones the vitest and Playwright setups take. Advisory locks
 * share one namespace per database and all three are taken on a database nothing under test writes.
 */
const CREATE_LOCK_KEY = 8_312_006

const target = process.env.DIRECT_DATABASE_URL || process.env.POOLER_DATABASE_URL || DEFAULT_DATABASE_URL
const name = new URL(target).pathname.slice(1)

await createIfMissing()

// `db:migrate` sets MIGRATING, which is what points `env.DATABASE_URL` at DIRECT_DATABASE_URL.
execSync('npm run db:migrate', {
  stdio: 'inherit',
  env: { ...process.env, DIRECT_DATABASE_URL: target },
})

/**
 * `CREATE DATABASE` copies template1, and two at once fail with "source database is being accessed
 * by other users" — which is exactly what the store and admin suites do under `verify:full`. The
 * lock serialises them. It is taken on the cluster's own `postgres` database: always present, and
 * never a target of these suites, so holding it blocks nothing but another copy of this script.
 */
async function createIfMissing() {
  const maintenanceUrl = new URL(target)
  maintenanceUrl.pathname = '/postgres'

  const admin = postgres(maintenanceUrl.toString(), {
    prepare: false,
    max: 1,
    onnotice: () => {
      // noop
    },
  })

  try {
    await admin`SELECT pg_advisory_lock(${CREATE_LOCK_KEY})`
    const [existing] = await admin<{ datname: string }[]>`SELECT datname FROM pg_database WHERE datname = ${name}`
    if (existing) return

    console.info(`[test-db] creating ${name}`)
    await admin.unsafe(`CREATE DATABASE "${name}"`)
  } finally {
    // Ends the session, which is what releases the lock.
    await admin.end()
  }
}

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { sql as dsql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeEach } from 'vitest'
import { DRIZZLE_OPTIONS } from '../../src/core/db/config.js'
import { env } from '../../src/env.js'

const sql = postgres(env.DATABASE_URL, {
  prepare: false,
  onnotice: () => {
    // noop
  },
})
export const db = drizzle(sql, DRIZZLE_OPTIONS)

const backendRoot = join(import.meta.dirname, '../../src')
const modulesRoot = join(backendRoot, 'modules')

const moduleMigrations = readdirSync(modulesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    migrationsFolder: join(modulesRoot, entry.name, 'migrations'),
    migrationsTable: `migrations_${entry.name}`,
  }))
  .filter(({ migrationsFolder }) => {
    try {
      readdirSync(migrationsFolder)
      return true
    } catch {
      return false
    }
  })

moduleMigrations.push({
  migrationsFolder: join(backendRoot, 'link-modules/migrations'),
  migrationsTable: 'migrations_links',
})

beforeEach(async () => {
  await db.execute(dsql`SET client_min_messages = WARNING`)
  await db.execute(dsql`DROP SCHEMA IF EXISTS drizzle CASCADE`)
  await db.execute(dsql`DROP SCHEMA IF EXISTS public CASCADE`)
  await db.execute(dsql`CREATE SCHEMA public`)
  for (const config of moduleMigrations) {
    await migrate(db, config)
  }
  await db.execute(dsql`SET client_min_messages = NOTICE`)
})

afterAll(async () => {
  await sql.end()
})

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const backendRoot = join(import.meta.dirname, '../../src')
const modulesRoot = join(backendRoot, 'modules')

/** One migration folder per module, plus the cross-module link tables. */
export const moduleMigrations = readdirSync(modulesRoot, { withFileTypes: true })
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

export async function migrateAll<T extends Record<string, unknown>>(db: PostgresJsDatabase<T>) {
  for (const config of moduleMigrations) {
    await migrate(db, config)
  }
}

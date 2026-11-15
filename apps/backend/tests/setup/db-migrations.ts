import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import type { Sql } from 'postgres'
import { createDatabaseExtensions } from '../../scripts/database-extensions.js'
import { EXTENSIONS_ROOT, extensionModules, FIXTURE_EXTENSIONS_ROOT } from '../../scripts/extension-modules.js'

const backendRoot = join(import.meta.dirname, '../..')
const modulesRoot = join(backendRoot, 'src/modules')

/**
 * Every drizzle-kit config `db:migrate` runs, plus the fixture extension's: one per core module
 * with tables, the cross-module link tables, then each extension module. The fixture's tables exist
 * only in the test databases, which is where the fixture extension runs.
 */
const databaseConfigs = [
  ...readdirSync(modulesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(modulesRoot, entry.name, 'database.config.ts'))
    .filter((config) => existsSync(config)),
  join(backendRoot, 'src/link-modules/database.config.ts'),
  ...[...extensionModules(EXTENSIONS_ROOT), ...extensionModules(FIXTURE_EXTENSIONS_ROOT)].flatMap(
    ({ databaseConfig }) => (databaseConfig ? [databaseConfig] : []),
  ),
]

type DatabaseConfig = { out?: string; migrations?: { table?: string } }

/**
 * The folder and migrations table each config names, read from the config itself so the test
 * database records migrations under the same table `db:migrate` does.
 */
async function migrationsOf(file: string) {
  const { default: config }: { default: DatabaseConfig } = await import(pathToFileURL(file).href)
  if (!config.out || !config.migrations?.table) {
    throw new Error(`${file} must name its migrations folder (out) and its migrations table (migrations.table)`)
  }

  return { migrationsFolder: resolve(backendRoot, config.out), migrationsTable: config.migrations.table }
}

export async function migrateAll<T extends Record<string, unknown>>(db: PostgresJsDatabase<T> & { $client: Sql }) {
  await createDatabaseExtensions(db.$client)
  for (const file of databaseConfigs) {
    await migrate(db, await migrationsOf(file))
  }
}

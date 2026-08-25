import type { Dirent } from 'node:fs'
import { readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import type { Model } from './types.js'

export const BACKEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const MODULES_DIR = join(BACKEND_ROOT, 'src/modules')
const LINK_DEFINITIONS_DIR = join(BACKEND_ROOT, 'src/link-modules/definitions')

function typescriptFiles(directory: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }

  return entries.flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return typescriptFiles(path)
    // Barrels re-export the same table objects the model files already yield, so skipping them
    // keeps each table attributed to the file that actually declares it.
    if (entry.name === 'index.ts') return []
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

/** The barrel a module's models are reached through, whether or not the file exists yet. */
export function barrelOf(module: string): string {
  const { directory } = modelDirectories().find((entry) => entry.module === module) ?? { directory: MODULES_DIR }
  return relative(BACKEND_ROOT, join(directory, 'index.ts'))
}

/**
 * The tables each module's barrel actually re-exports. A model the barrel misses is invisible to
 * the cascade graph, which is built from the barrel and nothing else — so the table would keep its
 * foreign keys and quietly stop being reached by them.
 *
 * A missing barrel yields no tables rather than throwing: that is a violation to report, not a
 * crash, and a module with no models at all has nothing to export.
 */
export async function collectBarrelTables(): Promise<Map<string, Set<PgTable>>> {
  const barrels = new Map<string, Set<PgTable>>()

  for (const { module, directory } of modelDirectories()) {
    const tables = new Set<PgTable>()
    barrels.set(module, tables)

    const exports = await import(pathToFileURL(join(directory, 'index.ts')).href).catch(() => null)
    if (!exports) continue

    for (const value of Object.values(exports as Record<string, unknown>)) {
      if (is(value, PgTable)) tables.add(value)
    }
  }

  return barrels
}

function modelDirectories(): { module: string; directory: string }[] {
  const modules = readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ module: entry.name, directory: join(MODULES_DIR, entry.name, 'models') }))

  return [...modules, { module: 'link-modules', directory: LINK_DEFINITIONS_DIR }]
}

/**
 * Every drizzle table in the codebase, discovered by walking the model directories rather than
 * read from a registry — a new module is covered the moment its files exist, with nothing to
 * remember to update.
 */
export async function collectModels(): Promise<Model[]> {
  const models: Model[] = []
  const seen = new Set<PgTable>()

  for (const { module, directory } of modelDirectories()) {
    for (const file of typescriptFiles(directory)) {
      const exports: Record<string, unknown> = await import(pathToFileURL(file).href)
      for (const value of Object.values(exports)) {
        if (!is(value, PgTable) || seen.has(value)) continue
        seen.add(value)
        models.push({ module, file: relative(BACKEND_ROOT, file), table: value })
      }
    }
  }

  return models
}

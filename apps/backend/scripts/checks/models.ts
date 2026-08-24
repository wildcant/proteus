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

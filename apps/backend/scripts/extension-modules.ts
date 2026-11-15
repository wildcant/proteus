/**
 * Where extension modules live on disk, for the database tooling that reads them without running
 * them: the schema generator, the schema checks, the db diagram and the test database setup.
 *
 * Two roots. `src/extensions/` holds a fork's own extensions and is empty upstream;
 * `tests/extension-fixture/` holds the fixture extension the test suite exercises, so the
 * mechanism stays covered while no real extension exists. Only the test database setup, the schema
 * checks and `db:generate` read the fixture root — production code never sees it.
 */

import type { Dirent } from 'node:fs'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BACKEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const EXTENSIONS_ROOT = join(BACKEND_ROOT, 'src/extensions')
export const FIXTURE_EXTENSIONS_ROOT = join(BACKEND_ROOT, 'tests/extension-fixture')

export type ExtensionModule = {
  /** The extension's folder name, which is its name (`pisos-dj`). */
  extension: string
  /** The module's folder name under `modules/`. */
  module: string
  /** Absolute path of the module folder. */
  directory: string
  /** Absolute path of its drizzle-kit config, when it has one. */
  databaseConfig: string | undefined
}

function directoriesIn(directory: string): Dirent[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    // Upstream ships no extension, and a fork may have none either: an absent root is no modules.
    return []
  }
}

/** Every module of every extension under `root`, sorted by extension then module. */
export function extensionModules(root: string = EXTENSIONS_ROOT): ExtensionModule[] {
  return directoriesIn(root).flatMap((extension) =>
    directoriesIn(join(root, extension.name, 'modules')).map((module) => {
      const directory = join(root, extension.name, 'modules', module.name)
      const databaseConfig = join(directory, 'database.config.ts')
      return {
        extension: extension.name,
        module: module.name,
        directory,
        databaseConfig: existsSync(databaseConfig) ? databaseConfig : undefined,
      }
    }),
  )
}

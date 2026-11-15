/**
 * Where the backend's generators read their files from, how a generated file names what it imports,
 * and how a generator prints what it found.
 *
 * Each of the three reads one folder of core (`src/workflows/`, `src/subscribers/`, `src/jobs/`)
 * and the folder of the same name in every extension (`src/extensions/<ext>/workflows/`, …). Their
 * outputs stay where core's always were, so an import path is computed from the output file rather
 * than spelled as a fixed prefix.
 *
 * Every name an extension adds to one of those namespaces carries its runtime prefix (`<ext>.`), so a
 * later core name cannot collide with it. The duplicate checks each generator already runs then
 * cover core against extensions and extensions against each other.
 */

import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasPrefix, runtimePrefix } from './extension-names.js'
import { collect, type SourceFileInput } from './ts-source.js'

export type RuntimeFolder = 'workflows' | 'subscribers' | 'jobs'

/** A source file, and the extension it belongs to; `undefined` for core. */
export type RuntimeSourceFile = SourceFileInput & { extension: string | undefined }

export type Problem = { location: string; message: string; remedy: string }

/** The backend this script lives in, `apps/backend`. Tests pass another one. */
export const BACKEND = resolve(import.meta.dirname, '..')

/** Repo root of a backend, because locations are printed repo-relative, as clickable paths. */
export function repoRootOf(backend: string): string {
  return resolve(backend, '../..')
}

/** The folders directly in `directory`, by name, sorted. Empty when it is absent, as an extensions root upstream is. */
export function directoriesIn(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

/** Extension folder names under `src/extensions/`, sorted. */
export function extensionNames(backend: string): string[] {
  return directoriesIn(join(backend, 'src/extensions'))
}

/** Core's `src/<folder>/`, then each extension's `src/extensions/<ext>/<folder>/` in name order. */
export function collectRuntimeSources(backend: string, folder: RuntimeFolder): RuntimeSourceFile[] {
  const root = repoRootOf(backend)
  const core = collect(join(backend, 'src', folder), root).map((file) => ({ ...file, extension: undefined }))
  const extensions = extensionNames(backend).flatMap((extension) => {
    const directory = join(backend, 'src/extensions', extension, folder)
    if (!existsSync(directory)) return []
    return collect(directory, root).map((file) => ({ ...file, extension }))
  })

  return [...core, ...extensions]
}

/**
 * The specifier `output` imports `file` by: relative, `./` when it is beside or below, and `.js` as
 * everything else in this backend. `file` is repo-relative, as `collect` yields it.
 */
export function moduleSpecifier(backend: string, output: string, file: string): string {
  const path = relative(dirname(output), join(repoRootOf(backend), file))
    .replaceAll('\\', '/')
    .replace(/\.ts$/, '.js')
  return path.startsWith('.') ? path : `./${path}`
}

/** Core entries first, then each extension's, each group in module order. */
export function byOwnerThenModule<T extends { extension: string | undefined; module: string }>(a: T, b: T): number {
  return (a.extension ?? '').localeCompare(b.extension ?? '') || a.module.localeCompare(b.module)
}

/** A problem when an extension's `name` lacks its runtime prefix; `kind` is `workflow`, `job`, … */
export function unprefixedName(
  kind: string,
  entry: { name: string; extension: string | undefined; location: string },
): Problem | undefined {
  if (entry.extension === undefined) return undefined

  const prefix = runtimePrefix(entry.extension)
  if (hasPrefix(entry.name, prefix)) return undefined

  return {
    location: entry.location,
    message: `the ${kind} "${entry.name}" in extension "${entry.extension}" does not start with "${prefix}"`,
    remedy: `name it "${prefix}${entry.name}"; an extension's runtime names carry its prefix so a later core name cannot collide`,
  }
}

/** Whether the module at `url` is the script node was started with, rather than an import of it. */
export function isEntryPoint(url: string): boolean {
  const entry = process.argv[1]
  return entry !== undefined && resolve(entry) === fileURLToPath(url)
}

const BOLD = '\x1b[1m'
export const RED = '\x1b[0;31m'
export const GREEN = '\x1b[0;32m'
export const YELLOW = '\x1b[0;33m'
export const DIM = '\x1b[2m'
export const RESET = '\x1b[0m'

/** The rule a generator's failure output opens with, named for the generator. */
export function heading(title: string): void {
  console.info('')
  console.info(`${RED}${BOLD}${title}${RESET} ${DIM}${'━'.repeat(Math.max(0, 76 - title.length))}${RESET}`)
  console.info('')
}

/** Every problem under the generator's heading: where, what, and the remedy. */
export function report(title: string, problems: Problem[]): void {
  heading(title)
  for (const problem of problems) {
    console.info(`  ${DIM}${problem.location}${RESET}`)
    console.info(`    ${problem.message}`)
    console.info(`    ${YELLOW}→${RESET} ${problem.remedy}`)
    console.info('')
  }
}

import { existsSync, readdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Messages } from '@lingui/core'

/**
 * The message catalogs the backend translator merges: core's (the backend's own and
 * `@proteus/http-schemas`') first, then each extension's, in extension-name order. A later catalog
 * overrides an earlier one id by id, so two catalogs translating one message differently would
 * answer in whichever loads last — the extension generator fails on that instead, through
 * `catalogConflicts`.
 */

/** One catalog, by language, and where it came from for the finding. */
export type NamedCatalog = { source: string; messages: Record<string, Messages> }

const BACKEND_ROOT = resolve(import.meta.dirname, '..')

/**
 * The compiled catalogs (`{language}.ts`, what the runtime imports) in a `locales/` folder, or
 * undefined when the folder has none: an extension without messages has no catalog.
 */
export async function readCatalog(localesDirectory: string): Promise<Record<string, Messages> | undefined> {
  if (!existsSync(localesDirectory)) return undefined
  const files = readdirSync(localesDirectory).filter((file) => file.endsWith('.ts'))
  if (files.length === 0) return undefined
  const entries = await Promise.all(
    files.map(async (file) => {
      const module = (await import(pathToFileURL(join(localesDirectory, file)).href)) as { messages: Messages }
      return [basename(file, '.ts'), module.messages] as const
    }),
  )
  return Object.fromEntries(entries)
}

/** Core's catalog, merged as the translator merges it: the schemas' messages under the backend's. */
export async function readCoreCatalog(): Promise<NamedCatalog> {
  const [schemas = {}, backend = {}] = await Promise.all([
    readCatalog(resolve(BACKEND_ROOT, '../../packages/http-schemas/locales')),
    readCatalog(resolve(BACKEND_ROOT, 'locales')),
  ])
  const languages = [...new Set([...Object.keys(schemas), ...Object.keys(backend)])]
  const messages = Object.fromEntries(
    languages.map((language) => [language, { ...schemas[language], ...backend[language] }]),
  )
  return { source: 'core', messages }
}

/**
 * One finding per message two catalogs translate differently, in one language. Compared in the
 * compiled form, which is what the translator reads; an id two catalogs translate alike is not a
 * conflict, since either answer is the same.
 */
export function catalogConflicts(catalogs: NamedCatalog[]): string[] {
  const first = new Map<string, { source: string; translation: string }>()
  const conflicts: string[] = []
  for (const { source, messages } of catalogs) {
    for (const [language, catalog] of Object.entries(messages)) {
      for (const [id, compiled] of Object.entries(catalog)) {
        const key = `${language}\0${id}`
        const translation = JSON.stringify(compiled)
        const earlier = first.get(key)
        if (!earlier) {
          first.set(key, { source, translation })
          continue
        }
        if (earlier.translation === translation) continue
        conflicts.push(
          `catalog conflict: "${id}" (${language}) is translated differently by ${earlier.source} and ${source}`,
        )
      }
    }
  }
  return conflicts
}

/** Where an extension's HTTP schemas catalog lives, when it has one. */
export function httpSchemasLocales(extension: string): string {
  return resolve(BACKEND_ROOT, '../../packages/http-schemas/src/extensions', extension, 'locales')
}

/**
 * Each extension's catalogs in the order the translator merges them: by name, and for one extension
 * its HTTP schemas' catalog before its own. `directory` is the extension's folder (`src/extensions/<name>`,
 * or the test fixture's).
 */
export async function readExtensionCatalogs(
  extensions: { name: string; directory: string }[],
): Promise<NamedCatalog[]> {
  const sorted = [...extensions].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const catalogs = await Promise.all(
    sorted.flatMap(({ name, directory }) => [
      readCatalog(httpSchemasLocales(name)).then((messages) =>
        messages ? { source: `extension "${name}" (HTTP schemas)`, messages } : undefined,
      ),
      readCatalog(join(directory, 'locales')).then((messages) =>
        messages ? { source: `extension "${name}"`, messages } : undefined,
      ),
    ]),
  )
  return catalogs.filter((catalog) => catalog !== undefined)
}

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@lingui/cli'

const EXTENSIONS = 'src/extensions'

/** The test fixture extension, whose catalog the translations gate checks like a fork's. */
const FIXTURE_EXTENSION = 'tests/extension-fixture/fixture'

// An extension's catalog is its own, so a fork's messages never land in core's catalog and a sync of
// Proteus never conflicts on their reference lines. One catalog per extension folder that marks a
// message (or already has a catalog, so removing its last message empties it rather than orphaning
// it); an extension without messages stays without a `locales/` folder.
function marksMessages(directory: string): boolean {
  if (existsSync(join(directory, 'locales'))) return true
  return readdirSync(directory, { recursive: true, encoding: 'utf8' }).some(
    (file) => file.endsWith('.ts') && readFileSync(join(directory, file), 'utf8').includes('i18n.t('),
  )
}

const extensionsRoot = fileURLToPath(new URL(`./${EXTENSIONS}/`, import.meta.url))
const extensionCatalogs = readdirSync(extensionsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && marksMessages(join(extensionsRoot, entry.name)))
  .map(({ name }) => `${EXTENSIONS}/${name}`)
  .concat(FIXTURE_EXTENSION)
  .map((directory) => ({ path: `<rootDir>/${directory}/locales/{locale}`, include: [`<rootDir>/${directory}`] }))

// API Messages. There are no macros here: every message is marked with `i18n.t('…')` from
// @proteus/utils, which the extractor recognises by name, so the English sentence is the msgid.
// The compiled `locales/{en,es}.ts` are committed beside the `.po` files, because neither tsx nor a
// Worker can import a `.po` at runtime; an extension's travel in `src/extensions/registry.gen.ts`.
// `scripts/verify.sh` fails when any of them is stale.
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'es'],
  catalogs: [
    { path: '<rootDir>/locales/{locale}', include: ['<rootDir>/src'], exclude: [`<rootDir>/${EXTENSIONS}`] },
    ...extensionCatalogs,
  ],
})

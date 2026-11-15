import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@lingui/cli'

const EXTENSIONS = 'src/extensions'

// An extension's catalog is its own, so a fork's messages never land in the package's catalog and a
// sync of Proteus never conflicts on them. One catalog per extension folder that marks a message (or
// already has a catalog, so removing its last message empties it rather than orphaning it); an
// extension without messages stays without a `locales/` folder.
function marksMessages(directory: string): boolean {
  if (existsSync(join(directory, 'locales'))) return true
  return readdirSync(directory, { recursive: true, encoding: 'utf8' }).some(
    (file) => file.endsWith('.ts') && readFileSync(join(directory, file), 'utf8').includes('i18n.t('),
  )
}

const extensionsRoot = fileURLToPath(new URL(`./${EXTENSIONS}/`, import.meta.url))
const extensionCatalogs = readdirSync(extensionsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && marksMessages(join(extensionsRoot, entry.name)))
  .map(({ name }) => ({
    path: `<rootDir>/${EXTENSIONS}/${name}/locales/{locale}`,
    include: [`<rootDir>/${EXTENSIONS}/${name}`],
    exclude: ['**/*.test.ts'],
  }))

// Validation messages. Schemas stay static constants, so every message is marked with `i18n.t('…')`
// from @proteus/utils — the extractor recognises it by name and the English sentence is the msgid —
// and translated where the issue is shown, by `translateIssue` in src/i18n.ts. The compiled
// `locales/{en,es}.ts` are committed beside the `.po` files and exported as
// `@proteus/http-schemas/locales/{language}`, so the store, the backend and the admin merge them
// next to their own; an extension's as `@proteus/http-schemas/extensions/<ext>/locales/{language}`.
// `scripts/verify.sh` fails when any of them is stale.
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'es'],
  catalogs: [
    {
      path: '<rootDir>/locales/{locale}',
      include: ['<rootDir>/src'],
      exclude: ['**/*.test.ts', `<rootDir>/${EXTENSIONS}`],
    },
    ...extensionCatalogs,
  ],
})

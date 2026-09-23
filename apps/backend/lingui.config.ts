import { defineConfig } from '@lingui/cli'

// API Messages. There are no macros here: every message is marked with `i18n.t('…')` from
// @proteus/utils, which the extractor recognises by name, so the English sentence is the msgid.
// The compiled `locales/{en,es}.ts` are committed beside the `.po` files, because neither tsx nor a
// Worker can import a `.po` at runtime. `scripts/verify.sh` fails when either is stale.
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'es'],
  catalogs: [{ path: '<rootDir>/locales/{locale}', include: ['<rootDir>/src'] }],
})

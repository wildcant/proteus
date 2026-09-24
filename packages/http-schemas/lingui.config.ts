import { defineConfig } from '@lingui/cli'

// Validation messages. Schemas stay static constants, so every message is marked with `i18n.t('…')`
// from @proteus/utils — the extractor recognises it by name and the English sentence is the msgid —
// and translated where the issue is shown, by `translateIssue` in src/i18n.ts. The compiled
// `locales/{en,es}.ts` are committed beside the `.po` files and exported as
// `@proteus/http-schemas/locales/{language}`, so the store, the backend and the admin merge them
// next to their own. `scripts/verify.sh` fails when either is stale.
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'es'],
  catalogs: [{ path: '<rootDir>/locales/{locale}', include: ['<rootDir>/src'], exclude: ['**/*.test.ts'] }],
})

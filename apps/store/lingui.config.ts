import { defineConfig } from '@lingui/cli'

// Store copy. `.po` only: `@lingui/vite-plugin` compiles each one on import, so nothing compiled is
// committed. Validation messages come from `@proteus/http-schemas/locales/{language}`, merged next to
// these by `src/lib/i18n/catalogs.ts`; API Messages arrive already translated.
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'es'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}',
      include: ['<rootDir>/src'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '<rootDir>/src/api/generated/**'],
    },
  ],
})

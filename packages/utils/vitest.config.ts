import { defineConfig } from 'vitest/config'

/**
 * Pure functions only, the same split `apps/admin/vitest.config.ts` draws: anything needing a
 * database lives in the backend suite and anything needing a browser lives in Playwright.
 */
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})

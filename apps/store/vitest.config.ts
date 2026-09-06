import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Pure logic only, mirroring the admin's suite. Everything that needs a browser lives in
 * Playwright and everything that needs a database lives in the backend suite; this covers the
 * functions in between — the shopper-facing payment copy, whose bucketing rule is far easier to
 * see the edges of here than through a rendered card form.
 */
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  resolve: { alias: { '#': fileURLToPath(new URL('./src', import.meta.url)) } },
})

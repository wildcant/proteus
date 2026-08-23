import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Pure logic only. Everything that needs a database lives in the backend suite, and everything
 * that needs a browser lives in Playwright — this covers the handful of functions in between.
 */
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  resolve: { alias: { '#': fileURLToPath(new URL('./src', import.meta.url)) } },
})

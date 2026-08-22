import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Deliberately separate from `vite.config.ts`, which loads the app's plugins. These are
 * pure-function tests — no app runtime, no router.
 */
export default defineConfig({
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

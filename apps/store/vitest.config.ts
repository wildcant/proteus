import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Deliberately separate from `vite.config.ts`: that one loads the Cloudflare plugin, which rejects
 * the Node externals vitest needs. These are pure-function tests — no app runtime, no worker.
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

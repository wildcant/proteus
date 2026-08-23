import { resolve } from 'node:path'
import { config } from '@dotenvx/dotenvx'
import { defineConfig } from 'vitest/config'
import { WORKER_COUNT } from './tests/setup/database-url.js'

const { parsed: testEnv } = config({ path: resolve(__dirname, '../../.env.test'), override: true })

export default defineConfig({
  resolve: {
    alias: {
      '@tests': resolve(__dirname, './tests'),
      '@core': resolve(__dirname, './src/core'),
      '@framework': resolve(__dirname, './src/framework'),
      '@workflows': resolve(__dirname, './src/workflows'),
    },
  },
  test: {
    env: testEnv ?? {},
    include: ['./src/**/*.test.{ts,tsx}'],
    globalSetup: ['./tests/setup/global-setup.ts'],
    setupFiles: ['./tests/setup/setup-test-env.ts'],
    // One database per worker (see tests/setup/database-url.ts) is what makes this safe.
    maxWorkers: WORKER_COUNT,
    restoreMocks: true,
    coverage: {
      include: ['src/**/*.{ts}'],
    },
  },
})

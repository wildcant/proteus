import { resolve } from 'node:path'
import { config } from '@dotenvx/dotenvx'
import { defineConfig, type ViteUserConfig } from 'vitest/config'
import { WORKER_COUNT } from './tests/setup/database-url.js'

const { parsed: testEnv } = config({ path: resolve(__dirname, '../../.env.test'), override: true })

/**
 * Exported so `vitest.temporal.config.ts` can run the same files with the same aliases and the same
 * database, and differ in exactly one place: the setup file that pins the workflow engine. Anything
 * that lands here applies to both runs, which is what makes the parity claim mean something.
 */
export const testAliases = {
  '@tests': resolve(__dirname, './tests'),
  '@core': resolve(__dirname, './src/core'),
  '@framework': resolve(__dirname, './src/framework'),
  '@workflows': resolve(__dirname, './src/workflows'),
}

export const testConfig: ViteUserConfig['test'] = {
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
}

export default defineConfig({
  resolve: { alias: testAliases },
  test: testConfig,
})

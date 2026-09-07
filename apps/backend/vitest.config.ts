import { resolve } from 'node:path'
import { config } from '@dotenvx/dotenvx'
import { configDefaults, defineConfig, type ViteUserConfig } from 'vitest/config'
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
  '@env': resolve(__dirname, './src/env.ts'),
  '@framework': resolve(__dirname, './src/framework'),
  '@server': resolve(__dirname, './src/server'),
  '@workflows': resolve(__dirname, './src/workflows'),
}

/** Named separately so the parity config can append to it without widening its type back to a union. */
export const testSetupFiles = ['./tests/setup/setup-test-env.ts']

/**
 * Tests that boot their own Temporal server, run by `test:temporal:server` and by nothing else.
 *
 * `TestWorkflowEnvironment.createTimeSkipping()` downloads a server binary on first run and
 * webpack-bundles the workflow sandbox — a minutes-long, network-dependent boot that the rest of
 * the suite needs nothing but Postgres for. They cover the adapter's wiring to the SDK, which
 * changes about as often as the SDK version does, so paying that on every `npm test` buys very
 * little.
 *
 * It is a filename convention rather than a list so a new one lands in the right bucket by being
 * named, and cannot rejoin the default run by being forgotten. `replay.test.ts` and
 * `payload-converter.test.ts` deliberately keep the plain suffix: they cover the same mechanism
 * with no server at all, which is where the edge cases belong.
 */
export const TEMPORAL_SERVER_TESTS = './src/**/*.server.test.{ts,tsx}'

export const testConfig: ViteUserConfig['test'] = {
  env: testEnv ?? {},
  include: ['./src/**/*.test.{ts,tsx}'],
  // Both the default run and the parity run read this, which is what keeps them the same file set.
  exclude: [...configDefaults.exclude, TEMPORAL_SERVER_TESTS],
  globalSetup: ['./tests/setup/global-setup.ts'],
  setupFiles: testSetupFiles,
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

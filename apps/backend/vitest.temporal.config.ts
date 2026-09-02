import { defineConfig } from 'vitest/config'
import { testAliases, testConfig, testSetupFiles } from './vitest.config.js'

/**
 * The parity suite (D5): the *existing* backend tests, run again with the engine pinned to Temporal.
 *
 * Same files, same assertions, same database — the only difference is one extra setup file, which
 * sets the default `projectConfig.workflows.engine` to `temporal` before any container is built.
 * There is no `WORKFLOW_ENGINE` env var and no separate expectations file, deliberately: a
 * divergence between this run and `npm test` is an adapter bug, and it can only be that if both runs
 * are asserting the same things.
 *
 * Needs a Temporal server (`docker compose -f apps/backend/docker-compose.yml up -d --wait`), which
 * is why it is a separate script and stays out of `verify.sh`.
 */
export default defineConfig({
  resolve: { alias: testAliases },
  test: {
    ...testConfig,
    setupFiles: [...testSetupFiles, './tests/setup/pin-temporal-engine.ts'],
    /**
     * Every step is a task-queue round trip now, and the first workflow in a process also builds the
     * sandbox bundle and connects twice. The default 5s budget measures Temporal rather than the
     * code under test.
     */
    testTimeout: 120_000,
    hookTimeout: 180_000,
    teardownTimeout: 30_000,
  },
})

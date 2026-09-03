import { defineConfig } from 'vitest/config'
import { TEMPORAL_SERVER_TESTS, testAliases, testConfig, testSetupFiles } from './vitest.config.js'

/**
 * The tests that boot a Temporal server of their own — the adapter end to end, the nested-workflow
 * topology the production Worker deploys, and the ping smoke test.
 *
 * Split out of `npm test` because `TestWorkflowEnvironment.createTimeSkipping()` downloads a server
 * binary on first run and webpack-bundles the workflow sandbox, three times over. That is minutes
 * and a network dependency on a cold cache, paid by every full run, to cover the seam between this
 * adapter and the SDK — which moves when the SDK version does and not otherwise.
 *
 * Everything else is deliberately unchanged from the default config: same env, same global setup,
 * same setup files. These tests do not touch the database, but `setup-test-env.ts` is what turns
 * `console.error`/`warn` into thrown errors, and `temporal-test-env.ts` is written against that.
 *
 * Not a substitute for `test:temporal`, which is the parity suite — the *rest* of the tests run
 * against a Docker Temporal. This one runs three files against a server they start themselves.
 */
export default defineConfig({
  resolve: { alias: testAliases },
  test: {
    ...testConfig,
    include: [TEMPORAL_SERVER_TESTS],
    // `testConfig` excludes this glob so the other two runs skip it; here it is the whole point.
    exclude: [],
    setupFiles: testSetupFiles,
    /**
     * Booting the time-skipping server and bundling the sandbox is a per-file cost measured in
     * minutes, not the default 5 seconds. The files also declare their own timeouts inline, which
     * is what makes them readable on their own; this is the floor under them.
     */
    testTimeout: 120_000,
    hookTimeout: 180_000,
    teardownTimeout: 30_000,
  },
})

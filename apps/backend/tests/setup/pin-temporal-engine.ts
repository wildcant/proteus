import { pinTestWorkflowEngine } from './workflow-engine.js'

/**
 * The one line that makes the parity suite a parity suite.
 *
 * `vitest.temporal.config.ts` loads this after `setup-test-env.ts`, so every container the run
 * builds is wired to the Temporal adapter instead of the in-process one. Nothing else differs: the
 * same test files, the same assertions, the same database. Any divergence between the two runs is an
 * adapter bug by definition (D5).
 */
pinTestWorkflowEngine('temporal')

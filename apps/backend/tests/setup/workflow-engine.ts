import type { WorkflowEngineName } from '@core/config/types.js'

/**
 * Which engine `createTestContainer` pins when a test does not ask for one.
 *
 * It is a module-level value rather than an environment variable on purpose. D4 forbids a
 * `WORKFLOW_ENGINE` env var — the choice is a composition-root decision, not a deployment knob —
 * and `RUNTIME` is `node` under vitest, so the derived default is Temporal and *every* workflow test
 * would need a running server. Both suites therefore pin explicitly through
 * `projectConfig.workflows.engine`, and this is where the two differ: the default run leaves it at
 * `simple`, and `vitest.temporal.config.ts` adds a setup file that flips it to `temporal` before any
 * test builds a container.
 *
 * Vitest resets the module registry per test file, so this is re-initialised — and the setup file
 * re-runs — for every file. That is why it needs no reset hook.
 */
let pinned: WorkflowEngineName = 'simple'

export function pinTestWorkflowEngine(engine: WorkflowEngineName): void {
  pinned = engine
}

export function pinnedTestWorkflowEngine(): WorkflowEngineName {
  return pinned
}

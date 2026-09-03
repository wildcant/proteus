import type { WorkflowEngineName } from '../config/types.js'

/**
 * Which adapter runs when nothing pins one.
 *
 * There is no `WORKFLOW_ENGINE` env var and there is not meant to be: the choice is not free per
 * deployment. Temporal's Worker needs `@temporalio/core-bridge`, a native addon workerd cannot
 * load, so the workerd build has exactly one option and picking it is not a decision anyone should
 * be able to get wrong from a `.env` file. Node has both, and durability is what it is deployed
 * for, so it gets Temporal.
 *
 * A caller that genuinely needs the other one — the Worker process itself, which runs nested
 * workflows in-process, and the test suite, which must not require a Temporal server — says so
 * through `projectConfig.workflows.engine` at the composition root, where the reason is visible
 * next to the choice.
 */
export function resolveWorkflowEngineName(input: {
  configured: WorkflowEngineName | undefined
  runtime: 'node' | 'workerd'
}): WorkflowEngineName {
  if (input.configured) return input.configured
  return input.runtime === 'workerd' ? 'simple' : 'temporal'
}

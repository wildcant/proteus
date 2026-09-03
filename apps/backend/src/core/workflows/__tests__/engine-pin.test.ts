import { Context } from '@temporalio/activity'
import { test } from '@tests/setup/test-extend.js'
import { pinnedTestWorkflowEngine } from '@tests/setup/workflow-engine.js'
import { createWorkflow } from '../types.js'

/**
 * Proof that a run executed on the engine it claims to pin.
 *
 * Without this, `test:temporal` degrading into a second run of the simple suite is invisible: the
 * same files pass either way, and the only signal is that it still takes four minutes. That is
 * the failure shape the purity check has a fixture-integrity pass for, and until now the parity
 * suite — the more load-bearing of the two artefacts — had nothing equivalent.
 *
 * It asserts *where the step body ran*, not what the config said. `Context.current()` resolves only
 * inside a Temporal Activity, so a step that can name its own workflow id was executed by the
 * Worker, over the task queue, through the driver — the whole path the parity claim rests on. A
 * config read-back would have proved that a value was set; this proves it was used, and it fails if
 * the harness silently stops routing as much as if the pin does.
 *
 * It runs in both configs on purpose, asserting the engine each run pins rather than a fixed one, so
 * the default suite is equally protected against silently acquiring a Temporal dependency.
 *
 * What it does not cover: a test that passes its own `config.projectConfig.workflows.engine` still
 * gets that engine, because `withPinnedEngine` supplies a default rather than an override. Such a
 * test would run on the simple adapter inside the parity run and nothing here would notice. Nothing
 * does that today, and a test naming an engine is a visible line in a diff rather than a silent
 * drift — but it is the residual, and it is the reason this file asserts one path rather than
 * standing in for all of them.
 */

/** The workflow id, when this is running inside a Temporal Activity; `null` when it is not. */
function temporalWorkflowId(): string | null {
  try {
    return Context.current().info.workflowExecution?.workflowId ?? null
  } catch {
    // `Context.current()` throws outside an Activity — which is exactly the simple adapter's answer.
    return null
  }
}

const whereDidThisRun = createWorkflow<void, string | null>('engine-pin-probe', (ctx) =>
  ctx.step('locate', async () => temporalWorkflowId()),
)

test.describe('the pinned workflow engine', () => {
  test('is the one that actually runs the steps', async ({ createTestContainer, expect }) => {
    await createTestContainer()

    const ranInsideActivity = await whereDidThisRun.run()

    if (pinnedTestWorkflowEngine() === 'temporal') {
      // The adapter builds ids as `${prefix}${workflow.name}-${ulid()}`, so the name is in there.
      expect(
        ranInsideActivity,
        'the step did not run inside a Temporal Activity, so this run is not on the engine it pins',
      ).toEqual(expect.stringContaining('engine-pin-probe'))
    } else {
      expect(
        ranInsideActivity,
        'the step ran inside a Temporal Activity, but this run pins the simple adapter',
      ).toBeNull()
    }
  })
})

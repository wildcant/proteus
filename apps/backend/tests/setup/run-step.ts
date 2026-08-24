/**
 * Runs a bare workflow step. Steps are written to be composed into a workflow, so testing one
 * on its own means wrapping it in a throwaway workflow — which several test files used to do
 * by hand, once per test.
 */

import { createWorkflow, type WorkflowContext } from '@core/workflows/types.js'

export type WorkflowStep<TInput, TOutput> = (ctx: WorkflowContext, input: TInput) => Promise<TOutput>

/**
 * The failure `runStepAndCompensate` injects. A distinct type so the helper can swallow its own
 * scaffolding while still surfacing anything the step under test throws.
 */
class DeliberateFailure extends Error {
  constructor() {
    super('deliberate failure to trigger compensation')
    this.name = 'DeliberateFailure'
  }
}

/** Runs one step as a single-step workflow, against whatever container is currently registered. */
export function runStep<TInput, TOutput>(step: WorkflowStep<TInput, TOutput>, input: TInput): Promise<TOutput> {
  return createWorkflow<TInput, TOutput>('test-run-step', (ctx, stepInput) => step(ctx, stepInput)).run(input)
}

/**
 * Runs the step, then fails the workflow so the step's compensation runs.
 *
 * The injected failure is swallowed — asserting on it would assert the scaffolding rather than
 * the code. Anything the step itself throws propagates, so a step that dies on the forward path
 * still fails the test rather than looking like a successful rollback.
 */
export async function runStepAndCompensate<TInput>(step: WorkflowStep<TInput, unknown>, input: TInput): Promise<void> {
  const workflow = createWorkflow<TInput, void>('test-run-step-and-compensate', async (ctx, stepInput) => {
    await step(ctx, stepInput)
    await ctx.step('deliberate-failure', async () => {
      throw new DeliberateFailure()
    })
  })

  try {
    await workflow.run(input)
  } catch (error) {
    if (error instanceof DeliberateFailure) return
    throw error
  }
}

import { Context } from '@temporalio/activity'
import type { AwilixContainer } from 'awilix'
import type { Logger } from '../core/types/logger.js'
import { ContainerRegistrationKeys } from '../core/utils/index.js'
import { isTerminal, toStepApplicationFailure } from './failures.js'
import type { WorkflowRegistry } from './registry.js'
import {
  advanceWorkflow as advanceReplay,
  compensateWorkflow as compensateReplay,
  StepExecutionError,
  StepSequenceChangedError,
} from './replay.js'
import type {
  AdvanceWorkflowInput,
  AdvanceWorkflowResult,
  CompensateWorkflowInput,
  CompensateWorkflowResult,
} from './types.js'

/**
 * Throwaway activity proving the round-trip: the Worker resolves it by name, runs it in a normal
 * Node process, and hands the return value back to the workflow. Reading `Context.current()` is
 * what makes that claim checkable — only code executing as an Activity can.
 */
export async function ping(name: string): Promise<string> {
  const { activityType, attempt } = Context.current().info
  return `pong: ${name} (activity ${activityType}, attempt ${attempt})`
}

export type WorkflowActivities = {
  advanceWorkflow(input: AdvanceWorkflowInput): Promise<AdvanceWorkflowResult>
  compensateWorkflow(input: CompensateWorkflowInput): Promise<CompensateWorkflowResult>
}

/** The full activity surface the Worker registers and `workflows.ts` proxies. */
export type Activities = WorkflowActivities & { ping: typeof ping }

/**
 * The two Activities that actually run Proteus code.
 *
 * A factory rather than module-level exports, because these need the DI container and the
 * workflow registry: building either at import time would make every consumer of this module —
 * including the type-only import in the sandboxed `workflows.ts`, and the adapter's own tests —
 * open a database pool.
 */
export function createWorkflowActivities(deps: {
  container: AwilixContainer
  registry: WorkflowRegistry
}): WorkflowActivities {
  const { container, registry } = deps
  const stepContext = { container }

  function resolve(name: string) {
    const definition = registry.get(name)
    if (definition) return definition

    // Non-retryable on purpose: a name the Worker does not know is a deploy problem, and retrying
    // it just fills history until the workflow times out.
    throw toStepApplicationFailure({
      error: new Error(`No workflow is registered as "${name}" on this Worker`),
      step: null,
      nonRetryable: true,
    })
  }

  function log(): Logger | undefined {
    return container.hasRegistration(ContainerRegistrationKeys.LOGGER)
      ? container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      : undefined
  }

  return {
    async advanceWorkflow(input) {
      const definition = resolve(input.name)

      try {
        const result = await advanceReplay(definition, stepContext, input)
        log()?.debug(
          result.done
            ? `[temporal] ${input.name} finished after ${input.outputs.length} step(s)`
            : `[temporal] ${input.name} completed step ${input.outputs.length + 1} "${result.step}"`,
        )
        return result
      } catch (error) {
        throw asStepFailure(error)
      }
    },

    async compensateWorkflow(input) {
      const definition = resolve(input.name)
      const result = await compensateReplay(definition, stepContext, input.input, input.outputs)

      log()?.debug(
        result.compensated.length
          ? `[temporal] ${input.name} rolled back: ${result.compensated.join(', ')}`
          : `[temporal] ${input.name} had nothing to roll back`,
      )

      return result
    },
  }
}

/**
 * Turns whatever the replay threw into the one failure shape the driver and the adapter read.
 *
 * `nonRetryable` is set here, not left to the retry policy: a `WorkflowTerminalError` is a
 * business-rule verdict and a changed step sequence is a deploy incident, and re-running either
 * only produces the same answer against state that has already moved on.
 */
function asStepFailure(error: unknown): unknown {
  if (error instanceof StepExecutionError) {
    return toStepApplicationFailure({
      error: error.original,
      step: error.step,
      nonRetryable: isTerminal(error.original) || error.original instanceof StepSequenceChangedError,
    })
  }

  if (error instanceof StepSequenceChangedError) {
    return toStepApplicationFailure({ error, step: null, nonRetryable: true })
  }

  return error
}

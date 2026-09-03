import { Context } from '@temporalio/activity'
import type { AwilixContainer } from 'awilix'
import type { Logger } from '../core/types/logger.js'
import { ContainerRegistrationKeys } from '../core/utils/index.js'
import { isTerminal, toStepApplicationFailure } from './failures.js'
import type { WorkflowRegistry } from './registry.js'
import {
  advanceWorkflow as advanceReplay,
  ConcurrentStepError,
  compensateWorkflow as compensateReplay,
  StepExecutionError,
  StepSequenceChangedError,
} from './replay.js'
import { STEP_ACTIVITY_NAMES } from './step-names.js'
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

/**
 * The two real Activities plus one alias per `ctx.step` name, every alias being `advanceWorkflow`
 * under another name. The aliases exist only to be *scheduled*: the Temporal UI labels a timeline
 * row with the Activity type, so scheduling `authorize-payment` is what makes the row say
 * `authorize-payment` instead of `advanceWorkflow`.
 */
export type RegisteredWorkflowActivities = WorkflowActivities & {
  [stepName: string]: WorkflowActivities['advanceWorkflow'] | WorkflowActivities['compensateWorkflow']
}

/** The full activity surface the Worker registers and `workflows.ts` proxies. */
export type Activities = WorkflowActivities & { ping: typeof ping }

/**
 * Adds the step-name aliases to an activity map. Every Worker in the process registers its
 * activities through here, which is what makes registration and the lookahead filter one decision
 * instead of two: this spreads `STEP_ACTIVITY_NAMES`, and `advanceWorkflow` below reports a
 * lookahead only for a name in that same set. A name that is not registered is never reported, so
 * it is never scheduled, so it cannot fail as `ActivityNotFound`.
 */
export function withStepActivities(activities: WorkflowActivities): RegisteredWorkflowActivities {
  const registered: RegisteredWorkflowActivities = { ...activities }
  for (const name of STEP_ACTIVITY_NAMES) registered[name] = activities.advanceWorkflow
  return registered
}

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
}): RegisteredWorkflowActivities {
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

  return withStepActivities({
    async advanceWorkflow(input) {
      const definition = resolve(input.name)

      try {
        const result = await advanceReplay(definition, stepContext, input)
        log()?.debug(
          result.done
            ? `[temporal] ${input.name} finished after ${input.outputs.length} step(s)`
            : `[temporal] ${input.name} completed step ${input.outputs.length + 1} "${result.step}"`,
        )

        // The lookahead is a promise to the driver that it may schedule an Activity by this name,
        // so it is only kept for a name this Worker actually registered.
        if (result.done || !result.next) return result
        return STEP_ACTIVITY_NAMES.has(result.next) ? result : { ...result, next: null }
      } catch (error) {
        throw asStepFailure(error)
      }
    },

    async compensateWorkflow(input) {
      const definition = resolve(input.name)
      const result = await compensateReplay(definition, stepContext, input.input, input.outputs)

      const logger = log()
      logger?.debug(
        result.compensated.length
          ? `[temporal] ${input.name} rolled back: ${result.compensated.join(', ')}`
          : `[temporal] ${input.name} had nothing to roll back`,
      )

      // At error level, not debug: a compensation that threw has left something behind — an order,
      // a reservation, an authorized payment — and nothing else in the system will mention it.
      for (const failure of result.failed) {
        logger?.error(`[temporal] ${input.name} could not roll back "${failure.step}": ${failure.message}`)
      }

      return result
    },
  })
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
      nonRetryable: isTerminal(error.original) || isDeployOrCodeFault(error.original),
    })
  }

  if (isDeployOrCodeFault(error)) {
    return toStepApplicationFailure({ error, step: null, nonRetryable: true })
  }

  return error
}

/**
 * A changed step sequence and a concurrent `ctx.step` are both facts about the code that is
 * deployed, not about the attempt. Running them again produces the same answer against state that
 * has moved on, so they are never retried.
 */
function isDeployOrCodeFault(error: unknown): boolean {
  return error instanceof StepSequenceChangedError || error instanceof ConcurrentStepError
}

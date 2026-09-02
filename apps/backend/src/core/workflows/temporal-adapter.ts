import type { Client } from '@temporalio/client'
import type { Duration, RetryPolicy } from '@temporalio/common'
import { ulid } from 'ulid'
import { createTemporalClient, type TemporalClientHandle } from '../../temporal/client.js'
import { PROTEUS_WORKFLOW_TYPE, TEMPORAL_TASK_QUEUE } from '../../temporal/config.js'
import { readStepFailureDetail } from '../../temporal/failure-details.js'
import { deserializeError } from '../../temporal/failures.js'
import type { DriverInput } from '../../temporal/types.js'
import type { StepContext, WorkflowDefinition, WorkflowEngine } from './types.js'

/**
 * `WorkflowEngine` backed by Temporal.
 *
 * Every workflow runs as an execution of one generic driver (`proteusWorkflow`), which asks a
 * replay Activity for one step at a time. Nothing about a workflow's own code is visible from
 * here: this side only names it, hands over the input, and waits.
 *
 * The wait is deliberate. `.run()` is called from HTTP handlers that return the workflow's result
 * to the shopper, so the semantics stay synchronous — the same call, the same result, the same
 * error, plus one task-queue round trip per step. What changes is that the execution now survives
 * the process running it.
 */

export type TemporalWorkflowEngineOptions = {
  /**
   * Per-step retry opt-in, keyed by workflow name and then step name:
   *
   * ```ts
   * createTemporalWorkflowEngine({ retry: { 'complete-cart': { 'authorize-payment': { maximumAttempts: 3 } } } })
   * ```
   *
   * It lives here rather than on `ctx.step` because the port does not change in this scope, and it
   * is empty by default because today's steps are not idempotent: `add-to-cart` creates line
   * items, `create-order-fulfillment` moves stock. A step earns an entry once it is proven safe to
   * run twice — not before.
   */
  retry?: Record<string, Record<string, RetryPolicy>>
  /**
   * What a workflow declared `idempotent: true` gets for every one of its steps. The flag has been
   * on `WorkflowConfig` since ADR-0009 and ignored by every adapter to date; this is the meaning
   * it finally gets.
   */
  idempotentRetry?: RetryPolicy
  /** How long a single step may take. One step, not the whole workflow. */
  startToCloseTimeout?: Duration
  taskQueue?: string
  /** Prefixes the generated workflow id, so several stacks can share one namespace. */
  workflowIdPrefix?: string
  /** Supplies the client instead of connecting from `env` — the adapter's own tests use it. */
  connect?: () => Promise<TemporalClientHandle>
}

/**
 * `close()` is additive to the port: the engine owns a gRPC connection, and the process that built
 * it has to be able to give it back.
 */
export type TemporalWorkflowEngine = WorkflowEngine & { close: () => Promise<void> }

/** Generous, because a step can be a payment authorization against a third party. */
const DEFAULT_START_TO_CLOSE_TIMEOUT: Duration = '5 minutes'

/** Modest and bounded: an idempotent step is safe to repeat, not free to repeat forever. */
const DEFAULT_IDEMPOTENT_RETRY: RetryPolicy = {
  maximumAttempts: 3,
  initialInterval: '1s',
  backoffCoefficient: 2,
}

export function createTemporalWorkflowEngine(options: TemporalWorkflowEngineOptions = {}): TemporalWorkflowEngine {
  const taskQueue = options.taskQueue ?? TEMPORAL_TASK_QUEUE
  const startToCloseTimeout = options.startToCloseTimeout ?? DEFAULT_START_TO_CLOSE_TIMEOUT
  const connect = options.connect ?? createTemporalClient

  // Connected on first use rather than at bootstrap: building the container must not require a
  // reachable Temporal server, or every script and test that only touches the database would.
  let handle: Promise<TemporalClientHandle> | undefined

  async function client(): Promise<Client> {
    handle ??= connect()
    return (await handle).client
  }

  async function run<TInput, TOutput>(
    workflow: WorkflowDefinition<TInput, TOutput>,
    input: TInput,
    // The container the caller passes is the API process's. Steps run in the Worker against its
    // own container, so this one goes unused — durable execution is exactly the case where the
    // caller's process is not where the work happens.
    _stepContext: StepContext,
  ): Promise<TOutput> {
    const connected = await client()

    const driver: DriverInput = {
      name: workflow.name,
      input,
      retry: options.retry?.[workflow.name] ?? {},
      startToCloseTimeout,
      ...(workflow.idempotent ? { defaultRetry: options.idempotentRetry ?? DEFAULT_IDEMPOTENT_RETRY } : {}),
    }

    try {
      const output = await connected.workflow.execute(PROTEUS_WORKFLOW_TYPE, {
        taskQueue,
        workflowId: `${options.workflowIdPrefix ?? ''}${workflow.name}-${ulid()}`,
        args: [driver],
      })
      return output as TOutput
    } catch (error) {
      throw restoreCallerError(error)
    }
  }

  return {
    run,
    async close() {
      const connected = await handle
      handle = undefined
      await connected?.close()
    },
  }
}

/**
 * Rebuilds the error the caller would have got from the simple adapter.
 *
 * Without this a route handler sees a `WorkflowFailedError` wrapping an `ActivityFailure`, and
 * `errorHandler` — which reads `AppError.type` — turns a "cart is already completed" 409 into a
 * 500. Anything this adapter did not raise (a timeout, a cancellation, a connection failure) is
 * passed through untouched: inventing an `AppError` for it would hide a real infrastructure
 * failure behind a business-looking status.
 *
 * The Temporal chain is not attached as `cause`, deliberately — `WorkflowTerminalError` carries
 * its `AppError` there, and that is what `errorHandler` unwraps to decide the status code.
 */
function restoreCallerError(error: unknown): unknown {
  const detail = readStepFailureDetail(error)
  return detail ? deserializeError(detail.error) : error
}

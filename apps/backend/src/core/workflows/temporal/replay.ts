import { AppError, ErrorTypes } from '../../errors/app-error.js'
import type { StepAction, StepCompensation, StepContext, WorkflowContext, WorkflowDefinition } from '../types.js'
import { chainStepFingerprint } from './fingerprint.js'
import type { AdvanceWorkflowInput, AdvanceWorkflowResult, CompensateWorkflowResult, StepOutput } from './types.js'

/**
 * The bridge between a closure-based workflow handler and Temporal's name-registered Activities.
 *
 * A `ctx.step` action captures handler-local variables, so it cannot be shipped anywhere. What
 * *can* be shipped is the list of outputs the handler has produced so far — so instead of moving
 * the closure, this re-runs the handler from the top with a context whose `step()` hands back
 * stored outputs for everything already done and executes exactly the next one.
 *
 * Memoization keys on **call index, not step name**. A `ctx.step` inside a loop emits the same
 * name every iteration, and name-keyed memoization would collapse the iterations into one.
 *
 * The price is that the glue between steps re-runs on every attempt: `complete-cart`'s 13 steps
 * cost 91 glue executions across the run. Glue is `.map`/`.filter`/string building today, and
 * keeping it that way — pure and cheap — is the invariant the whole design rests on.
 */

/** A completed step, recovered while replaying, that still has a rollback to run. */
type CompletedStep = {
  name: string
  compensation: StepCompensation<unknown>
  output: unknown
}

/** Raised when the deployed handler no longer matches the step sequence an execution recorded. */
export class StepSequenceChangedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StepSequenceChangedError'
  }
}

/**
 * Raised when a handler asks for two steps at once.
 *
 * The whole replay rests on `ctx.step` being sequential: `index` advances per call, and there is
 * one slot for the step being executed. `Promise.all([ctx.step(a), ctx.step(b)])` would run both
 * actions inside one Activity, record only whichever settled last, and re-execute the other on the
 * next advance — a double execution with no error anywhere and no trace in history. No workflow
 * does this today, and this is what keeps that true: the invariant is load-bearing enough to
 * assert rather than to document.
 */
export class ConcurrentStepError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConcurrentStepError'
  }
}

/** Carries the failing step's name out of the replay so the Activity can name it in the failure. */
export class StepExecutionError extends Error {
  readonly step: string | null
  readonly original: unknown

  constructor(step: string | null, original: unknown) {
    super(original instanceof Error ? original.message : String(original))
    this.name = 'StepExecutionError'
    this.step = step
    this.original = original
  }
}

type ReplayOutcome =
  /** The handler ran out of stored outputs, so the next step was reached. */
  | { kind: 'reached'; step: string; fingerprint: string }
  /** The handler returned without asking for another step: the workflow is finished. */
  | { kind: 'returned'; output: unknown }
  /** The handler threw — between steps, or from the action of the step being executed. */
  | { kind: 'threw'; step: string | null; error: unknown }

type ReplayResult = {
  outcome: ReplayOutcome
  /** Steps replayed from stored output that registered a compensation, in registration order. */
  completed: CompletedStep[]
  /** Set only when `onNextStep` was `execute` and the action resolved. */
  executed?: { step: string; output: unknown; fingerprint: string }
  /**
   * The name of the step *after* the executed one, read off the handler before abandoning it.
   *
   * Nothing in the execution needs this — it exists so the driver can label the Activity it is
   * about to schedule, which is otherwise `advanceWorkflow` fourteen times in a row in the Temporal
   * UI. Absent when the executed step was the last one, when the handler threw in the glue that
   * follows it, or when nothing was executed at all.
   */
  lookahead?: string
}

type ReplayOptions = {
  definition: WorkflowDefinition<unknown, unknown>
  input: unknown
  stepContext: StepContext
  outputs: StepOutput[]
  /** Fingerprint of the stored sequence, or `null` to skip the check (nothing stored, or unwinding). */
  fingerprint: string | null
  /** `execute` runs the first uncompleted step; `stop` unwinds without running anything. */
  onNextStep: 'execute' | 'stop'
}

async function replay(options: ReplayOptions): Promise<ReplayResult> {
  const { definition, input, stepContext, outputs, fingerprint, onNextStep } = options

  const completed: CompletedStep[] = []
  let index = 0
  let chain: string | null = null
  let outcome: ReplayOutcome | undefined
  let executed: ReplayResult['executed']
  let lookahead: string | undefined
  /** The first uncompleted step reached, if any. Guards the invariant — see `ConcurrentStepError`. */
  let nextStep: string | undefined

  /**
   * The handler is abandoned rather than unwound once the target step is done: `step()` returns a
   * promise that never settles, so the handler simply stops at its next `await`. A thrown sentinel
   * would read more directly but is not safe here — a handler is free to wrap a step in
   * `try`/`catch`/`finally`, and either would swallow the sentinel or run cleanup that has no
   * business running on a partial replay.
   */
  const abandoned = new Promise<never>(() => {
    // Never settles. That is the mechanism, not an omission.
  })
  let release: () => void = () => {
    // Replaced synchronously by the `stopped` executor below.
  }
  const stopped = new Promise<void>((resolve) => {
    release = resolve
  })

  const ctx: WorkflowContext = {
    async step<T>(name: string, action: StepAction<T>, compensation?: StepCompensation<T>): Promise<T> {
      const at = index
      index += 1
      chain = chainStepFingerprint(chain, name)

      if (at < outputs.length) {
        // The last stored step is where a changed sequence first becomes detectable, and it is the
        // last moment before an action runs against outputs that may not be its own.
        if (at === outputs.length - 1 && fingerprint !== null && chain !== fingerprint) {
          throw new StepSequenceChangedError(
            `Workflow "${definition.name}" changed shape while an execution was in flight: replaying ` +
              `${outputs.length} completed step(s) ending at "${name}" produced fingerprint ${chain}, but ` +
              `the execution recorded ${fingerprint}.`,
          )
        }

        const stored = outputs[at]?.value
        if (compensation) {
          completed.push({ name, compensation: compensation as StepCompensation<unknown>, output: stored })
        }
        return stored as T
      }

      if (nextStep !== undefined) {
        // The handler gets exactly one more `ctx.step` after the executed one resolved, and this is
        // it: the lookahead. Its action is never run — the name is the whole point — so the double
        // execution `ConcurrentStepError` exists to prevent cannot happen on this path.
        if (executed) {
          lookahead = name
          release()
          return abandoned
        }

        throw new ConcurrentStepError(
          `Workflow "${definition.name}" asked for step "${name}" while "${nextStep}" was already the ` +
            'first uncompleted one. Steps must be awaited one at a time: two in flight at once run ' +
            'both actions in a single attempt, record only one, and re-execute the other.',
        )
      }
      nextStep = name

      if (onNextStep === 'stop') {
        outcome = { kind: 'reached', step: name, fingerprint: chain }
        release()
        return abandoned
      }

      try {
        const output = await action(stepContext)
        executed = { step: name, output, fingerprint: chain }
        outcome = { kind: 'reached', step: name, fingerprint: chain }

        // Deliberately *not* abandoned here, unlike every other exit from this function. Handing
        // back the real output lets the handler run its glue as far as the next `ctx.step`, whose
        // name is what labels the following Activity. That glue is the same glue the next attempt
        // would replay anyway, so this costs nothing beyond running it one step earlier — and it
        // is pure and synchronous, which `scripts/replay-purity.ts` enforces rather than
        // hopes for. A handler that awaits something non-`ctx.step` here would stall this Activity
        // until `startToCloseTimeout` instead of being abandoned, which is exactly what that
        // check's `await-outside-step` rule is for.
        return output as T
      } catch (error) {
        // A failed step abandons as before: rethrowing into the handler would run its `catch` and
        // `finally`, which the simple adapter does and this one deliberately does not.
        outcome = { kind: 'threw', step: name, error }
        release()
        return abandoned
      }
    },
  }

  await Promise.race([
    stopped,
    definition.handler(ctx, input).then(
      (output) => {
        // Reached during the lookahead: the handler had no further step and ran to its return
        // inside the Activity that executed the last one. That step is this replay's outcome, and
        // overwriting it here would drop its output on the floor. The next advance replays into
        // the same return with the output stored and reports `done` then.
        if (executed) return

        // Fewer `ctx.step` calls than there are stored outputs means steps were removed under a
        // running execution — the same hazard the fingerprint catches, one index further on.
        outcome =
          index < outputs.length
            ? {
                kind: 'threw',
                step: null,
                error: new StepSequenceChangedError(
                  `Workflow "${definition.name}" changed shape while an execution was in flight: the handler ` +
                    `now finishes after ${index} step(s), but the execution recorded ${outputs.length}.`,
                ),
              }
            : { kind: 'returned', output }
      },
      (error) => {
        // Same reasoning as above, and the more important half: glue that throws *after* a step
        // succeeded must not fail that step. Its output is already earned and has to reach history,
        // or the next attempt re-runs an action that has already had its effect. The throw is not
        // lost — the next advance replays into it with no step in flight and reports it there.
        if (executed) return

        outcome = { kind: 'threw', step: null, error }
      },
    ),
  ])

  if (!outcome) {
    // Unreachable: the race only settles through one of the three branches above. Kept as a throw
    // so the type narrows without a non-null assertion.
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: `Workflow "${definition.name}" ended its replay without producing an outcome`,
    })
  }

  return { outcome, completed, ...(executed ? { executed } : {}), ...(lookahead ? { lookahead } : {}) }
}

/**
 * Runs the workflow forward by exactly one step and reports what happened.
 *
 * One step per Activity is what makes the whole thing resumable: every output lands in Temporal's
 * history before the next action starts, so a Worker that dies takes at most the step it was in
 * the middle of, never the ones before it.
 */
export async function advanceWorkflow(
  definition: WorkflowDefinition<unknown, unknown>,
  stepContext: StepContext,
  input: AdvanceWorkflowInput,
): Promise<AdvanceWorkflowResult> {
  const result = await replay({
    definition,
    input: input.input,
    stepContext,
    outputs: input.outputs,
    fingerprint: input.fingerprint,
    onNextStep: 'execute',
  })

  if (result.outcome.kind === 'threw') throw new StepExecutionError(result.outcome.step, result.outcome.error)
  if (result.outcome.kind === 'returned') return { done: true, output: result.outcome.output }

  const executed = result.executed
  if (!executed) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: `Workflow "${definition.name}" reached step "${result.outcome.step}" without executing it`,
    })
  }

  return {
    done: false,
    step: executed.step,
    output: executed.output,
    fingerprint: executed.fingerprint,
    next: result.lookahead ?? null,
  }
}

/**
 * Replays the completed steps without executing anything and runs their compensations in reverse
 * registration order — the same unwind the simple adapter does, reconstructed from stored outputs
 * instead of from an in-memory stack.
 *
 * Compensation errors are swallowed, exactly as in `simple-adapter.ts`: every compensation gets
 * its turn, and the failure the caller sees is the one that started the rollback. They are
 * *reported*, though — a rollback that fails every compensation and says nothing is the one
 * outcome here that looks identical to a rollback that worked.
 *
 * The fingerprint is deliberately *not* checked here. A mismatch is already an incident, and the
 * only thing worse than unwinding with the deployed handler is not unwinding at all.
 */
export async function compensateWorkflow(
  definition: WorkflowDefinition<unknown, unknown>,
  stepContext: StepContext,
  input: unknown,
  outputs: StepOutput[],
): Promise<CompensateWorkflowResult> {
  // A handler that throws in its glue on the way back still leaves everything it managed to
  // replay in `completed`, so the unwind covers as much as it could reach.
  const result = await replay({ definition, input, stepContext, outputs, fingerprint: null, onNextStep: 'stop' })

  const compensated: string[] = []
  const failed: CompensateWorkflowResult['failed'] = []

  for (const entry of [...result.completed].reverse()) {
    try {
      await entry.compensation(entry.output, stepContext)
      compensated.push(entry.name)
    } catch (error) {
      // Swallowed so the remaining compensations still run — matching the simple adapter — but
      // handed back rather than dropped.
      failed.push({ step: entry.name, message: error instanceof Error ? error.message : String(error) })
    }
  }

  return { compensated, failed }
}

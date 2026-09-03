import { ErrorTypes } from '@core/errors/app-error.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { createWorkflow, type WorkflowDefinition, WorkflowTerminalError } from '@core/workflows/types.js'
import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { vi } from 'vitest'
import { chainStepFingerprint } from '../fingerprint.js'
import {
  advanceWorkflow,
  ConcurrentStepError,
  compensateWorkflow,
  StepExecutionError,
  StepSequenceChangedError,
} from '../replay.js'
import type { StepOutput } from '../types.js'

/**
 * The replay mechanism on its own, with no Temporal in the picture.
 *
 * Everything here is what the `advanceWorkflow` Activity does between receiving a list of stored
 * outputs and returning the next one — the part where a workflow written against the in-process
 * adapter has to behave identically. `temporal-adapter.server.test.ts` covers the same ground through a
 * real server; this covers it in milliseconds, which is why the edge cases live here.
 */

function makeContext() {
  const container = createContainer()
  container.register({ greeting: asValue('hello') })
  return { container }
}

/** Boxes literal step outputs the way the driver does, so a void step survives the wire. */
function stored(...values: unknown[]): StepOutput[] {
  return values.map((value) => ({ value }))
}

/** `WorkflowEngine` erases the type parameters, and so does the Activity that calls this. */
function erase<TInput, TOutput>(workflow: WorkflowDefinition<TInput, TOutput>): WorkflowDefinition<unknown, unknown> {
  return workflow as unknown as WorkflowDefinition<unknown, unknown>
}

/** Drives a workflow to completion one `advanceWorkflow` call at a time, as the driver does. */
async function runToCompletion<TInput, TOutput>(workflow: WorkflowDefinition<TInput, TOutput>, input: TInput) {
  const definition = erase(workflow)
  const stepContext = makeContext()
  const outputs: StepOutput[] = []
  let fingerprint: string | null = null

  for (;;) {
    const result = await advanceWorkflow(definition, stepContext, {
      name: workflow.name,
      input,
      outputs,
      fingerprint,
    })
    if (result.done) return { output: result.output as TOutput, outputs: outputs.map((entry) => entry.value) }

    outputs.push({ value: result.output })
    fingerprint = result.fingerprint
  }
}

test.describe('replay', () => {
  test('executes exactly one step per call and returns the handler value', async ({ expect }) => {
    const calls: string[] = []

    const workflow = createWorkflow<{ x: number }, number>('add-ten', async (ctx, input) => {
      const a = await ctx.step('add-five', async () => {
        calls.push('add-five')
        return input.x + 5
      })
      const b = await ctx.step('add-five-more', async () => {
        calls.push('add-five-more')
        return a + 5
      })
      return b
    })

    const { output, outputs } = await runToCompletion(workflow, { x: 1 })

    expect(output).toBe(11)
    expect(outputs).toEqual([6, 11])
    // The glue re-runs on every replay; the actions must not. This is the whole contract.
    expect(calls).toEqual(['add-five', 'add-five-more'])
  })

  test('passes the container to step actions', async ({ expect }) => {
    const workflow = createWorkflow<void, string>('resolve-greeting', async (ctx) =>
      ctx.step('greet', async ({ container }) => container.resolve('greeting') as string),
    )

    const { output } = await runToCompletion(workflow, undefined)
    expect(output).toBe('hello')
  })

  test('memoizes on call index, so a step inside a loop does not collapse', async ({ expect }) => {
    const seen: number[] = []

    const workflow = createWorkflow<void, number[]>('loop-steps', async (ctx) => {
      const collected: number[] = []
      for (const value of [1, 2, 3]) {
        collected.push(
          await ctx.step('double', async () => {
            seen.push(value)
            return value * 2
          }),
        )
      }
      return collected
    })

    const { output } = await runToCompletion(workflow, undefined)

    expect(output).toEqual([2, 4, 6])
    // Name-keyed memoization would have run the action once and reused its output three times.
    expect(seen).toEqual([1, 2, 3])
  })

  test('refuses two steps in flight at once rather than silently double-executing one', async ({ expect }) => {
    const second = vi.fn(async () => 'second')

    const workflow = createWorkflow<void, void>('concurrent', async (ctx) => {
      await Promise.all([
        ctx.step('first', async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          return 'first'
        }),
        ctx.step('second', second),
      ])
    })

    const failure = await advanceWorkflow(erase(workflow), makeContext(), {
      name: 'concurrent',
      input: undefined,
      outputs: [],
      fingerprint: null,
    }).catch((error: unknown) => error)

    expect((failure as StepExecutionError).original).toBeInstanceOf(ConcurrentStepError)
    // The part that matters: one Activity records one output, so the second action running here
    // would be executed again on the next advance — a double charge with nothing in history.
    expect(second).not.toHaveBeenCalled()
  })

  test('names the step the next advance will run, without running it', async ({ expect }) => {
    const second = vi.fn(async () => 'second')

    const workflow = createWorkflow<void, string>('lookahead', async (ctx) => {
      const one = await ctx.step('first', async () => 'first')
      const two = await ctx.step('second', second)
      return `${one}/${two}`
    })

    const result = await advanceWorkflow(erase(workflow), makeContext(), {
      name: 'lookahead',
      input: undefined,
      outputs: [],
      fingerprint: null,
    })

    // The label the driver puts on the *next* Activity, which is the only reason this exists.
    expect(result).toMatchObject({ done: false, step: 'first', output: 'first', next: 'second' })
    // Reading the name must not cost an execution: that would be the double-run the whole
    // one-step-per-Activity design is built to prevent.
    expect(second).not.toHaveBeenCalled()
  })

  test('keeps the last step as its own outcome when the handler returns during the lookahead', async ({ expect }) => {
    const workflow = createWorkflow<void, string>('two-steps', async (ctx) => {
      const one = await ctx.step('first', async () => 'A')
      const two = await ctx.step('second', async () => 'B')
      return `${one}${two}`
    })

    const last = await advanceWorkflow(erase(workflow), makeContext(), {
      name: 'two-steps',
      input: undefined,
      outputs: stored('A'),
      fingerprint: chainStepFingerprint(null, 'first'),
    })

    // The handler runs to its `return` inside this Activity, having no third step to look ahead to.
    // Reporting that return here would finish the workflow with "B" never recorded — right answer,
    // missing history, and nothing to compensate `second` from.
    expect(last).toMatchObject({ done: false, step: 'second', output: 'B', next: null })

    const { output, outputs } = await runToCompletion(workflow, undefined)
    expect(output).toBe('AB')
    expect(outputs).toEqual(['A', 'B'])
  })

  test('does not fail a step because the glue after it threw', async ({ expect }) => {
    const workflow = createWorkflow<void, string>('glue-throws', async (ctx) => {
      const one = await ctx.step('first', async () => 'earned')
      if (one === 'earned') throw new Error('glue exploded')
      return one
    })

    const advance = (outputs: StepOutput[], fingerprint: string | null) =>
      advanceWorkflow(erase(workflow), makeContext(), { name: 'glue-throws', input: undefined, outputs, fingerprint })

    // The step succeeded and its output has to reach history, or the next attempt re-runs an action
    // that has already had its effect. The lookahead saw the throw instead of a step name.
    const first = await advance([], null)
    expect(first).toMatchObject({ done: false, step: 'first', output: 'earned', next: null })

    // Not swallowed, just deferred: the next advance replays into the same throw with no step in
    // flight and reports it as a between-steps failure.
    const failure = await advance(stored('earned'), chainStepFingerprint(null, 'first')).catch(
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(StepExecutionError)
    expect((failure as StepExecutionError).step).toBeNull()
    expect((failure as StepExecutionError).original).toMatchObject({ message: 'glue exploded' })
  })

  test('reports the failing step and rethrows the original error', async ({ expect }) => {
    const workflow = createWorkflow<void, void>('failing', async (ctx) => {
      await ctx.step('boom', async () => {
        throw new WorkflowTerminalError({ type: ErrorTypes.CONFLICT, message: 'Cart is already being completed' })
      })
    })

    const failure = await advanceWorkflow(erase(workflow), makeContext(), {
      name: 'failing',
      input: undefined,
      outputs: [],
      fingerprint: null,
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(StepExecutionError)
    expect(failure).toMatchObject({ step: 'boom' })
    expect((failure as StepExecutionError).original).toBeInstanceOf(WorkflowTerminalError)
  })

  test('abandons a handler that wrapped a step in try/catch, where the simple adapter recovers', async ({ expect }) => {
    /**
     * The one divergence between the two engines that ordinary code can reach by accident, pinned
     * here so it cannot drift silently. `scripts/checks/replay-purity.ts` rejects this shape and
     * `core/workflows/readme.md` documents it; this is the evidence behind both.
     *
     * A factory, so each engine gets a handler with its own recording arrays and neither run can
     * see the other's.
     */
    const makeWorkflow = () => {
      const ran: string[] = []

      const workflow = createWorkflow<void, string>('recovers-in-handler', async (ctx) => {
        try {
          return await ctx.step('charge', async () => {
            throw new Error('step blew up')
          })
        } catch {
          ran.push('catch')
          return 'handler-caught-it'
        } finally {
          ran.push('finally')
        }
      })

      return { workflow, ran }
    }

    const underSimple = makeWorkflow()
    await expect(createSimpleWorkflowEngine().run(underSimple.workflow, undefined, makeContext())).resolves.toBe(
      'handler-caught-it',
    )
    expect(underSimple.ran).toEqual(['catch', 'finally'])

    const underReplay = makeWorkflow()
    const failure = await advanceWorkflow(erase(underReplay.workflow), makeContext(), {
      name: 'recovers-in-handler',
      input: undefined,
      outputs: [],
      fingerprint: null,
    }).catch((error: unknown) => error)

    // The handler stopped at the `await` and was never resumed, so neither clause ran and the
    // failure reaches the caller instead of the handler's recovery value.
    expect(failure).toBeInstanceOf(StepExecutionError)
    expect(failure).toMatchObject({ step: 'charge' })
    expect(underReplay.ran).toEqual([])
  })

  test('runs compensations in reverse order, swallowing their errors', async ({ expect }) => {
    const unwound: string[] = []

    const workflow = createWorkflow<void, void>('compensating', async (ctx) => {
      await ctx.step(
        'first',
        async () => 'a',
        async (output) => {
          unwound.push(`first:${output}`)
        },
      )
      await ctx.step(
        'second',
        async () => 'b',
        async () => {
          throw new Error('compensation failed')
        },
      )
      await ctx.step(
        'third',
        async () => 'c',
        async (output) => {
          unwound.push(`third:${output}`)
        },
      )
      await ctx.step('fails', async () => {
        throw new Error('boom')
      })
    })

    const result = await compensateWorkflow(erase(workflow), makeContext(), undefined, stored('a', 'b', 'c'))

    expect(unwound).toEqual(['third:c', 'first:a'])
    // The middle one threw, so it is absent from the report — and did not stop the one before it.
    expect(result.compensated).toEqual(['third', 'first'])
  })

  test('does not compensate a step whose action failed', async ({ expect }) => {
    const compensate = vi.fn()

    const workflow = createWorkflow<void, void>('failed-step', async (ctx) => {
      await ctx.step('only', async () => 'done', compensate)
    })

    // The failing step never made it into `outputs`, which is what keeps it out of the unwind.
    await compensateWorkflow(erase(workflow), makeContext(), undefined, [])

    expect(compensate).not.toHaveBeenCalled()
  })

  test('refuses to replay when a step was inserted under a running execution', async ({ expect }) => {
    const before = createWorkflow<void, void>('shape', async (ctx) => {
      await ctx.step('authorize-payment', async () => 'paid')
      await ctx.step('create-order', async () => 'ordered')
    })

    const after = createWorkflow<void, void>('shape', async (ctx) => {
      await ctx.step('check-fraud', async () => 'clean')
      await ctx.step('authorize-payment', async () => 'paid')
      await ctx.step('create-order', async () => 'ordered')
    })

    const fingerprint = chainStepFingerprint(null, 'authorize-payment')

    const failure = await advanceWorkflow(erase(after), makeContext(), {
      name: 'shape',
      input: undefined,
      // One completed step: the payment. Under the new shape, index 0 is the fraud check, so
      // replaying would hand "paid" to a step that never produced it.
      outputs: stored('paid'),
      fingerprint,
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(StepExecutionError)
    expect((failure as StepExecutionError).original).toBeInstanceOf(StepSequenceChangedError)
    expect((failure as StepExecutionError).original).toMatchObject({
      message: expect.stringContaining('changed shape while an execution was in flight'),
    })
    // Sanity: the unchanged shape replays without complaint.
    await expect(
      advanceWorkflow(erase(before), makeContext(), {
        name: 'shape',
        input: undefined,
        outputs: stored('paid'),
        fingerprint,
      }),
    ).resolves.toMatchObject({ done: false, step: 'create-order' })
  })

  test('refuses to finish when steps were removed under a running execution', async ({ expect }) => {
    const shortened = createWorkflow<void, void>('shrunk', async (ctx) => {
      await ctx.step('one', async () => 1)
    })

    const failure = await advanceWorkflow(erase(shortened), makeContext(), {
      name: 'shrunk',
      input: undefined,
      outputs: stored(1, 2),
      fingerprint: chainStepFingerprint(chainStepFingerprint(null, 'one'), 'two'),
    }).catch((error: unknown) => error)

    expect((failure as StepExecutionError).original).toBeInstanceOf(StepSequenceChangedError)
  })
})

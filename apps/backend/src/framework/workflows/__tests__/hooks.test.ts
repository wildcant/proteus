import { BigNumber } from '@core/bignumber.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { AppContainer } from '@core/types/container.js'
import type { HookHandlerDefinition } from '@core/workflows/hook-handler.js'
import { defineHook, defineHookHandler, hookStep, runHook } from '@core/workflows/hooks.js'
import { createWorkflow, type WorkflowContext } from '@core/workflows/types.js'
import type { Msgid } from '@proteus/utils'
import { test } from '@tests/setup/test-extend.js'
import { registerHookHandlers } from '../hook-handlers.js'

/**
 * One test-only hook, run by two test-only workflows, on whichever engine the run pins — so the same
 * file is the hook's parity journey under `pnpm test` and `pnpm test:temporal`.
 *
 * Side effects are recorded in `journal`, a module-level array: the parity harness runs its Worker
 * in this process, so a step's Activity writes to the same array the assertion reads.
 */

type QuoteInput = { amount: number }
type Quote = { total: BigNumber; source: string }

const quoteHook = defineHook<QuoteInput, Quote>({
  name: 'test-quote',
  throws: [ErrorTypes.CONFLICT] as const,
  fallback: async ({ amount }) => ({ total: new BigNumber(amount), source: 'core' }),
})

let journal: string[] = []

/** Read by the `deploy` step, which stands in for a deploy landing between two steps of one run. */
let deployedNext: HookHandlerDefinition[] = []

function quoteHandler(extension: string, run: (input: QuoteInput) => Promise<Quote>): HookHandlerDefinition {
  const handler = defineHookHandler(quoteHook, {
    run,
    compensate: async (output) => {
      journal.push(`${extension} undid ${output.total.toFixed()}`)
    },
  })
  return { ...handler, extension }
}

const doubling = (extension: string) =>
  quoteHandler(extension, async ({ amount }) => ({ total: new BigNumber(amount * 2), source: extension }))

const failing = (error: Error) =>
  quoteHandler('alpha', async () => {
    throw error
  })

const quoteWorkflow = createWorkflow<{ amount: number; fail: boolean }, Quote>(
  { name: 'test-quote-workflow', throws: [...quoteHook.throws] },
  async (ctx, input) => {
    await ctx.step(
      'reserve',
      async () => 'reserved',
      async () => {
        journal.push('reserve undone')
      },
    )
    const quote = await hookStep(ctx, quoteHook, { amount: input.amount })
    await ctx.step('finish', async () => {
      if (input.fail) throw new Error('deliberate failure after the hook')
    })
    return quote
  },
)

const redeployWorkflow = createWorkflow<{ amount: number; fail: boolean }, Quote>(
  { name: 'test-quote-redeploy', throws: [...quoteHook.throws] },
  async (ctx, input) => {
    const quote = await hookStep(ctx, quoteHook, { amount: input.amount })
    await ctx.step('deploy', async ({ container }) => registerHookHandlers(container, deployedNext))
    await ctx.step('finish', async () => {
      if (input.fail) throw new Error('deliberate failure after the deploy')
    })
    return quote
  },
)

/** The step names a workflow asks for, read by driving its handler with a recording context. */
async function stepNames(container: AppContainer, input: { amount: number; fail: boolean }): Promise<string[]> {
  const names: string[] = []
  const ctx: WorkflowContext = {
    step: async (name, action) => {
      names.push(name)
      return action({ container })
    },
  }
  await quoteWorkflow.handler(ctx, input)
  return names
}

const conflict = () => new AppError({ type: ErrorTypes.CONFLICT, message: 'The quote is no longer available' as Msgid })

test.describe('workflow hooks', () => {
  test.beforeEach(() => {
    journal = []
    deployedNext = []
  })

  test('run the fallback without a handler and the handler with one, as the same single step', async ({
    createTestContainer,
    expect,
  }) => {
    const bare = await createTestContainer({ hookHandlers: [] })
    const fallback = await quoteWorkflow.run({ amount: 5, fail: false })
    expect(fallback.source).toBe('core')
    // A BigNumber, after crossing the payload converter on Temporal.
    expect(fallback.total.toFixed()).toBe('5')
    const withoutHandler = await stepNames(bare, { amount: 5, fail: false })

    // Built last, so the engine runs on it: the replaced handler map is this container's own.
    const handled = await createTestContainer({ hookHandlers: [doubling('alpha')] })
    const quote = await quoteWorkflow.run({ amount: 5, fail: false })
    expect(quote.source).toBe('alpha')
    expect(quote.total.toFixed()).toBe('10')

    expect(withoutHandler).toEqual(['reserve', 'hook:test-quote', 'finish'])
    expect(await stepNames(handled, { amount: 5, fail: false })).toEqual(withoutHandler)

    // Outside a workflow the same resolution applies, per container.
    expect((await runHook(handled, quoteHook, { amount: 3 })).source).toBe('alpha')
    expect((await runHook(bare, quoteHook, { amount: 3 })).source).toBe('core')
  })

  test('compensate earlier steps when the handler throws, mapping undeclared errors to unexpected state', async ({
    createTestContainer,
    expect,
  }) => {
    await createTestContainer({ hookHandlers: [failing(conflict())] })
    await expect(quoteWorkflow.run({ amount: 5, fail: false })).rejects.toMatchObject({
      cause: { type: ErrorTypes.CONFLICT },
    })
    expect(journal).toEqual(['reserve undone'])

    journal = []
    const container = await createTestContainer({ hookHandlers: [failing(new Error('socket hang up'))] })
    await expect(quoteWorkflow.run({ amount: 5, fail: false })).rejects.toMatchObject({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: expect.stringContaining('socket hang up'),
    })
    expect(journal).toEqual(['reserve undone'])

    await expect(runHook(container, quoteHook, { amount: 5 })).rejects.toMatchObject({
      type: ErrorTypes.UNEXPECTED_STATE,
    })
  })

  test("undo the handler's work only while the handler that produced it is still registered", async ({
    createTestContainer,
    expect,
  }) => {
    const alpha = doubling('alpha')

    await createTestContainer({ hookHandlers: [alpha] })
    deployedNext = [alpha]
    await expect(redeployWorkflow.run({ amount: 5, fail: true })).rejects.toThrow('deliberate failure')
    expect(journal).toEqual(['alpha undid 10'])

    // Replaced by another extension's handler, then removed: neither undoes alpha's output.
    for (const next of [[doubling('beta')], []]) {
      journal = []
      await createTestContainer({ hookHandlers: [alpha] })
      deployedNext = next
      await expect(redeployWorkflow.run({ amount: 5, fail: true })).rejects.toThrow('deliberate failure')
      expect(journal).toEqual([])
    }
  })

  test('keep the recorded output when a handler is registered mid-run', async ({ createTestContainer, expect }) => {
    // On Temporal every later step replays the handler from the top; a hook step whose name or
    // presence depended on the handler would fail that replay as a changed step sequence.
    await createTestContainer({ hookHandlers: [] })
    deployedNext = [doubling('alpha')]
    const quote = await redeployWorkflow.run({ amount: 5, fail: false })
    expect(quote).toMatchObject({ source: 'core' })
  })

  test('reject a second handler for one hook', async ({ createTestContainer, expect }) => {
    await expect(createTestContainer({ hookHandlers: [doubling('alpha'), doubling('beta')] })).rejects.toMatchObject({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: expect.stringContaining('"alpha" and "beta"'),
    })
  })
})

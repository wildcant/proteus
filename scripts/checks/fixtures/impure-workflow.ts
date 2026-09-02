/**
 * The check's own test case: workflow handlers that break replay purity in every way
 * `../replay-purity.ts` knows how to detect, plus one it cannot see into.
 *
 * Deliberately outside `apps/backend/src/` so it is never registered, never imported by application
 * code, never typechecked as part of the backend, and never mistaken for a real workflow. The check
 * runs over this file first and fails if any rule stops firing — a checker that has quietly stopped
 * matching reads exactly like a clean tree, and this is the only thing that tells the two apart.
 *
 * Do not fix the code below. Every line here is the point.
 */

import { createWorkflow } from '../../../apps/backend/src/core/workflows/types.js'

type Input = { cartId: string }

declare const container: { resolve: (key: string) => { load: (id: string) => Promise<string> } }
declare const chunks: AsyncIterable<string>
declare function loadCart(id: string): Promise<{ total: number }>
declare const db: { query: (context: unknown) => Promise<number> }
declare function loadCartWith(context: unknown, id: string): Promise<{ total: number }>

/** Type arguments on purpose: every real workflow has them, so the check has to see through them. */
export const impureWorkflow = createWorkflow<Input, string>('impure-fixture', async (ctx, input) => {
  // await-outside-step: I/O between steps re-runs on every replay.
  const cart = await loadCart(input.cartId)

  // await-outside-step, handed `ctx` so it looks like a shared step helper. Passing the context is
  // not what makes something a step — these are raw I/O, and only the `…Step` naming convention
  // separates them from `notifyOnFailureStep` and friends.
  const rows = await db.query(ctx)
  const other = await loadCartWith(ctx, input.cartId)

  // wall-clock: a different value on every replay.
  const startedAt = new Date()
  const stamp = Date.now()

  // randomness: likewise.
  const nonce = Math.random()

  // crypto: a fresh id per replay is a different workflow.
  const traceId = crypto.randomUUID()

  // container-access: services belong to the step that is handed the container.
  const cartService = container.resolve('cartService')

  // process-env: read once at startup through src/env.ts, not here.
  const region = process.env.REGION

  // await-outside-step, over a sequence this time.
  for await (const line of chunks) {
    if (line === 'stop') break
  }

  // A type argument here too — `ctx.step<T>(…)` has to be recognised as a step, or everything
  // inside it would be reported as impure.
  const recorded = await ctx.step<string>('record', async () => {
    // Everything in here is fine: a step action runs once and its output is stored.
    const at = new Date()
    return `${at.toISOString()} ${cart.total} ${rows} ${other.total} ${startedAt.getTime()} ${stamp} ${nonce} ${traceId} ${region}`
  })

  return `${recorded} ${await cartService.load(input.cartId)}`
})

/** No type arguments, so the untyped call form is covered too. */
export const untypedImpureWorkflow = createWorkflow('untyped-impure-fixture', async (ctx, input: Input) => {
  await ctx.step('start', async () => input.cartId)
  return Date.now()
})

/** The handler is not inline, so nothing about its body is visible to a single-file check. */
const detachedHandler = async (ctx: { step: (name: string, action: () => Promise<string>) => Promise<string> }) =>
  ctx.step('detached', async () => 'done')

export const detachedWorkflow = createWorkflow('detached-fixture', detachedHandler)

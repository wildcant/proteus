# Hooks

A hook is a named point in a core workflow where a store's extension may replace core's
computation with its own: core defines the hook and its fallback, an extension registers at most one
handler. This covers defining a hook, running it from a workflow or a route, and writing its handler.
Not webhooks — those are the `/hooks/` API scope in [routes](../../api/__docs__/routes.md).

Why a hook is always one step, which handler's compensation runs and how errors are reported is
mechanism, in [`src/framework/workflows/README.md`](../../../../../apps/backend/src/framework/workflows/README.md#hooks).
The workflow around it follows [workflows](./workflows.md).

## Structure

```
src/workflows/{domain}/
  {workflow-name}.ts            # exports the hook (defineHook) and runs it: hookStep(ctx, someHook, input)
src/extensions/{ext}/hooks/
  {hook-name}.ts                # export const handler = defineHookHandler(someHook, { … })
```

## Shape

```ts
// src/workflows/order/create-draft-order.ts — core owns the name, the types and the fallback
export const orderChargesHook = defineHook<OrderChargesInput, OrderCharges>({
  name: 'order-charges',
  throws: [ErrorTypes.INVALID_DATA] as const,
  fallback: async (input, { container }) => computeCharges(input),
})
```

```ts
// the same file: one step, and the hook's errors on the workflow's contract
export const createDraftOrderWorkflow = createWorkflow<Input, Output>(
  { name: 'create-draft-order', throws: [...orderChargesHook.throws] },
  async (ctx, input) => {
    const cart = await ctx.step('load-cart', async ({ container }) => /* … */)
    const charges = await hookStep(ctx, orderChargesHook, { cart })
    // …
  },
)
```

```ts
// src/extensions/my-store/hooks/order-charges.ts — the one handler
export const handler = defineHookHandler(orderChargesHook, {
  run: async (input, { container }) => /* … */,
  compensate: async (output, { container }) => /* undo run, if run wrote anything */,
})
```

A route that previews the value outside a workflow calls
`runHook(req.scope, orderChargesHook, input)` and declares `[...orderChargesHook.throws]` in its own
`…Throws`.

## Rules

### Core adds a hook only with the workflow that needs it

A hook is a promise to forks that the point stays put. Define one when a store needs to change that
computation, in the same change as the workflow that runs it — never speculatively.

### A hook is run through `hookStep`, never by resolving its handler yourself

`hookStep` is one step named `hook:<name>` whether or not a handler is registered. Looking the
handler up in the glue, or calling a step only when one exists, makes the step sequence depend on
which extensions are deployed, and a deploy then breaks every Temporal execution in flight.

### Whoever runs a hook declares its errors

A workflow running `hookStep` and a route running `runHook` spread `...someHook.throws` into their
own `throws`. A route calling that workflow already inherits them through `...workflow.throws`. A
handler error the hook does not declare reaches the client as an unexpected-state error, so the
hook's `throws` is everything a handler may say.

### A handler returns small plain data and does nothing else

- **Small, plain data.** Its output is a step output: it is re-sent on every later Temporal Activity
  of the execution, and it may hold only what the payload converter carries — JSON values, `Date`,
  `BigNumber`. `HookValue` makes anything else a type error.
- **No events.** Events are emitted from a workflow's final step; a handler is not one.
- **No steps of its own.** It gets a `StepContext`, not a `WorkflowContext`, so it cannot.
- **Never another workflow's `.run()`.** That nests a second workflow inside one step, with none of
  its steps journaled.
- **Compensation undoes only what `run` did.** It runs only for the handler that produced the
  output; a handler with nothing to undo leaves `compensate` out. "Produced" compares the
  extension's name, not the handler's code: if the same extension ships a changed handler between a
  step and its rollback, the new `compensate` undoes the old `run`'s work, so keep it able to.
- **Free of side effects when the hook runs outside a workflow.** `runHook` never compensates.

### One handler per hook

The extension generator rejects a second handler for the same hook. There are no chains.

### A test that needs a different handler builds its container last

Handlers live on the container, but the workflow engine holds one global container, so `.run()` uses
the last one built. Build the container with
`createTestContainer({ extensions: { ...testExtensions, hookHandlers: [...] } })` — `[]` for the
fallback — after any other container in the test, and run the workflow then.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `omits-hook-errors` | that a workflow running `hookStep` and a route running `runHook` spread the hook's `throws` |

The rule sits at `standards/rules/backend/` beside `route-omits-workflow-errors`, because the claim
spans workflows and routes, core's and extensions'.

## What is deliberately not enforced

- **That a handler's output is small.** `HookValue` checks its shape; size depends on the data.
- **That a handler emits no events and runs no workflow.** It is extension code calling services
  through the container; a rule cannot tell an emit inside a service from one in the handler.
- **That a hook run outside a workflow has a side-effect-free handler.** Whether `run` writes is
  behaviour, not shape.
- **That a changed handler reached the Temporal Worker.** The Worker imports handlers at start, so
  it needs a restart after a change — in development, its dev process restarts on a change under
  `src/extensions/`; in production, the API and the Worker deploy together.

## Relationship with workflows

A hook step is an ordinary step to everything in [workflows](./workflows.md): it may not sit behind
an `if`, inside a loop or a `try`, and its binding counts as produced by a step, because `hookStep`
is a `…Step` helper handed `ctx`.

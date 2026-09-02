# Workflow Engine

A lightweight, step-based workflow engine inspired by [Medusa's workflow system](https://docs.medusajs.com/learn/fundamentals/workflows). Workflows compose multi-step operations with automatic rollback (saga pattern) when a step fails.

## Quick start

```ts
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'

export const checkoutWorkflow = createWorkflow<{ cartId: string }, void>(
  'checkout',
  async (ctx, input) => {
    const reservation = await ctx.step(
      'reserve-inventory',
      async ({ container }) => {
        const inventory = container.resolve('inventoryService')
        return inventory.reserve(input.cartId)
      },
      // Compensation — runs automatically if a later step fails
      async (reservation, { container }) => {
        const inventory = container.resolve('inventoryService')
        await inventory.release(reservation.id)
      },
    )

    await ctx.step('charge-payment', async ({ container }) => {
      const payment = container.resolve('paymentService')
      const ok = await payment.charge(input.cartId)
      if (!ok) throw new WorkflowTerminalError('Payment declined')
      // ^ If this throws, the reserve-inventory compensation runs
    })
  },
)

// Call it like a function — the global engine runs it
await checkoutWorkflow.run({ cartId: 'cart_123' })
```

## Architecture

The engine follows the same ports & adapters pattern as the rest of the codebase:

```
types.ts            — Port interfaces (WorkflowEngine, WorkflowContext, etc.)
engine-selection.ts — Which adapter a composition root wires, derived from RUNTIME
simple-adapter.ts   — In-process adapter (runs steps sequentially, compensates on error)
temporal-adapter.ts — Durable adapter (runs each step as a Temporal Activity)
```

### Key types

| Type | Role |
|------|------|
| `WorkflowEngine` | Driven port — how steps are executed and compensated |
| `WorkflowContext` | Provides `ctx.step()` inside a workflow handler |
| `Workflow<TInput, TOutput>` | A defined workflow with a `.run(input)` method |
| `WorkflowTerminalError` | Signals an unrecoverable failure (triggers compensation) |
| `StepContext` | Passed to every step action — contains the DI `container` |

### Global registration

At startup, call `setWorkflowEngine()` once to wire the engine and DI container:

```ts
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'

setWorkflowEngine(createSimpleWorkflowEngine(), container)
```

After this, any workflow created with `createWorkflow()` can call `.run(input)` without passing an engine or container — they use the global registration implicitly.

## Features

### Steps with compensation (saga pattern)

Each step can optionally register a compensation function. If any step throws, all previously completed compensations run in **reverse order** — like unwinding a stack:

```ts
await ctx.step('step-name', action, compensation)
//                          ^^^^^^  ^^^^^^^^^^^^
//                          runs    runs on rollback (receives action's return value)
```

- Only **completed** steps are compensated — a step whose action threw is skipped
- Compensation errors are swallowed so all compensations get a chance to run
- Steps without a compensation function are simply skipped during rollback

### WorkflowTerminalError

Throw `WorkflowTerminalError` to signal a business-rule failure. It supports an optional `cause` for wrapping lower-level errors:

```ts
throw new WorkflowTerminalError(
  'Insufficient inventory',
  new AppError({ type: AppError.Types.INVALID_DATA, message: 'SKU-001 out of stock' }),
)
```

### Workflow configuration

`createWorkflow` accepts either a name string or a config object:

```ts
createWorkflow('my-workflow', handler)
createWorkflow({ name: 'my-workflow', idempotent: true }, handler)
```

The `idempotent` flag declares that every step of the workflow is safe to run twice. The simple
adapter ignores it; the Temporal adapter gives such a workflow a default retry policy.

### DI container access

Every step receives the Awilix container, so steps resolve services the same way route handlers do:

```ts
await ctx.step('fetch-data', async ({ container }) => {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)
  return cartService.listLineItems({ cartId })
})
```

## Simple adapter

`createSimpleWorkflowEngine()` is an in-process engine that:

1. Runs steps sequentially in the order they appear
2. Treats **all** errors as terminal (triggers compensation)
3. Runs compensations in reverse order, swallowing compensation errors
4. Re-throws the original error after compensation completes

This is sufficient for single-process deployments, and it is what the workerd build uses.

## Temporal adapter

`createTemporalWorkflowEngine(options)` runs the same workflows durably, with **no change to any
workflow file**. A workflow author writes `ctx.step` exactly as before.

### How a closure crosses a process boundary

A step action is a closure over handler-local variables; a Temporal Activity is a name-registered
function taking serializable arguments. The closure cannot be shipped, so the outputs are shipped
instead. Every workflow runs as an execution of one generic driver:

```ts
let outputs = []
while (true) {
  const r = await executeActivity('advanceWorkflow', { name, input, outputs, fingerprint })
  if (r.done) return r.output
  outputs.push(r.output)
}
```

The `advanceWorkflow` Activity runs in the Worker process, with the DI container. It looks the
workflow up by name in `src/temporal/registry.ts`, re-executes its handler from the top with a
replay `ctx` whose `step()` returns stored outputs for completed steps and executes exactly the
next one, then stops. Compensation is the same replay, backwards.

Two consequences worth knowing before writing a workflow:

- **Handler bodies must stay pure between steps.** The glue re-runs on every replay —
  `complete-cart`'s 14 steps cost 91 glue executions. `Date.now()`, `Math.random()` or a service
  call between steps corrupts a replay rather than failing it.
- **Memoization keys on call index, not step name**, so a `ctx.step` inside a loop works.

### What is different from the simple adapter, and what is not

| | Simple | Temporal |
|---|---|---|
| Step order, compensation order, swallowed compensation errors | same | same |
| Error a caller catches (class, message, `AppError.type`) | same | same |
| Default retry | none | none (`maximumAttempts: 1`) |
| Survives the process dying mid-workflow | no | yes |

Retry is opt-in because today's steps are not idempotent, and it is configured on the adapter
rather than on `ctx.step`, because the port does not change:

```ts
createTemporalWorkflowEngine({ retry: { 'complete-cart': { 'authorize-payment': { maximumAttempts: 3 } } } })
```

`createWorkflow({ name, idempotent: true })` opts a whole workflow into a default policy.
`WorkflowTerminalError` never retries, whatever the policy says.

### Shape fingerprint

The driver carries a rolling hash of the step names completed so far. If a deploy adds, removes or
reorders a step under a running execution, the stored outputs no longer line up; the Activity
throws non-retryably instead of replaying into the wrong step. Temporal Worker Versioning is the
real answer and is the recorded follow-up.

### Choosing an engine

`resolveWorkflowEngineName` derives it from `RUNTIME` — `workerd` cannot load
`@temporalio/core-bridge`, so it gets the simple adapter; `node` gets Temporal. There is no
`WORKFLOW_ENGINE` env var. A composition root pins the other one through
`projectConfig.workflows.engine`: the Worker process pins `simple` so nested `.run()` calls stay
in-process, and the test container pins `simple` so the suite needs no Temporal server.

`check:deps` enforces the boundary — `no-temporal-in-workerd` fails if `src/index.workerd.ts` can
reach `@temporalio/*` or `src/temporal/` at all.

## Testing

Workflows are testable without a real database — mock the services and register them in a test container:

```ts
const container = createContainer()
container.register({
  [Modules.CART]: asValue(mockCartService),
  [Modules.INVENTORY]: asValue(mockInventoryService),
})

setWorkflowEngine(createSimpleWorkflowEngine(), container)

const result = await myWorkflow.run({ cartId: 'cart_1' })
```

Tests live in `__tests__/simple-adapter.test.ts`. The Temporal adapter's own tests are
`src/temporal/__tests__/` — `replay.test.ts` for the replay mechanism with no server, and
`temporal-adapter.test.ts` against `@temporalio/testing`'s time-skipping server.

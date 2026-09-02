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
  call between steps corrupts a replay rather than failing it. This is a checked rule, not advice:
  see [The purity rule](#the-purity-rule) below.
- **Memoization keys on call index, not step name**, so a `ctx.step` inside a loop works.
- **One step at a time.** `Promise.all([ctx.step(a), ctx.step(b)])` would run both actions in one
  attempt and record only one; the replay rejects the second call rather than letting the other be
  executed twice. Steps inside a step action are fine — it is `ctx.step` itself that is sequential.

### The purity rule

> Inside a `createWorkflow` handler, everything outside a `ctx.step` callback must be pure and
> synchronous.

`scripts/checks/replay-purity.ts` parses every handler under `src/workflows/` and enforces it. It
runs in `verify.sh`'s `conventions` job, or on its own with `npm run check:workflow-purity`. In the
handler body, outside every `ctx.step` callback, these are rejected:

| Rejected | Instead |
|---|---|
| `await` anything | `await ctx.step(…)`, or `await someStep(ctx, …)` — a helper handed `ctx` that calls `ctx.step` itself, like `notifyOnFailureStep` |
| `for await (…)` | collect inside a step action, iterate the result synchronously |
| `new Date()`, `Date.now()` | take the timestamp inside a step action, where it is recorded once and replayed |
| `Math.random()`, `crypto.*` | generate inside a step action, so every replay sees the same value |
| `process.env` | the validated `env` object from `src/env.ts`, read once at startup |
| `container.*` | resolve services inside a step action, which is handed the container |

`new Date(iso)` is a parse and is allowed; it is the zero-argument form that reads a clock. The step
*name* argument is inside the checked region too, because it is rebuilt on every replay like the rest
of the glue.

What it does not do: it does not follow imports, so helpers under `src/workflows/*/utils/` are trusted
to be pure; and it does not police step concurrency, which the replay asserts at runtime instead. It
checks itself against `scripts/checks/fixtures/impure-workflow.ts` before checking anything else — a
rule that has silently stopped matching produces exactly the output of a clean tree, and that fixture
is what tells the two apart.

It lives at the repo root rather than in `apps/backend/scripts/checks/` for one reason: `typescript`
resolves to 7.x inside `apps/backend` — the native compiler, which ships no JS parser API — while the
root has the 6.x that the admin and store apps build with.

### What is different from the simple adapter, and what is not

| | Simple | Temporal |
|---|---|---|
| Step order, compensation order, swallowed compensation errors | same | same |
| `AppError` and `WorkflowTerminalError` a caller catches (class, message, `type`) | same | same |
| A *custom* `Error` subclass thrown by a step | arrives as itself | arrives as `Error` with the same `name` and `message` |
| Default retry | none | none (`maximumAttempts: 1`) |
| Survives the Worker restarting *between* steps | no | yes |
| Survives the Worker dying *during* a step | no | no — see below |
| Accumulated payload per run | none | O(n²) — see below |

The one row that is not "same" for an ordinary caller is the third: only the two error shapes the
adapter knows how to rebuild survive as classes. Anything else crosses the wire as `{ name, message }`
and comes back as a plain `Error`, so `catch (e) { if (e instanceof MyError) … }` on a bespoke class
thrown from a step will not hold. Match on `error.name` if you need that —
`tests/setup/run-step.ts` does exactly this for its own injected sentinel.

Retry is opt-in because today's steps are not idempotent, and it is configured on the adapter
rather than on `ctx.step`, because the port does not change:

```ts
createTemporalWorkflowEngine({ retry: { 'complete-cart': { 'authorize-payment': { maximumAttempts: 3 } } } })
```

`maximumAttempts` is required. Temporal reads both an absent value and `0` as *unlimited*, so a
policy meant to tune backoff alone would opt a card authorization into retrying forever;
`createTemporalWorkflowEngine` rejects such a policy at the composition root.

`createWorkflow({ name, idempotent: true })` opts a whole workflow into a default policy.
`WorkflowTerminalError` never retries, whatever the policy says.

### What retry does not cover

Retry is arranged only *after* a first attempt has reported which step failed, so two things fall
outside it. Both are deliberate; neither is obvious from the option name.

- **A Worker that dies mid-step gets no retry, opted in or not.** The activity hits
  `startToCloseTimeout` (5 minutes by default) and fails as a `TimeoutFailure`, which names no
  step, so there is no policy to look up — the execution compensates and fails instead of resuming.
  That is right for a half-run non-idempotent step and wrong for one declared safe to repeat, which
  is the case retry classically exists for. Changing it is a decision, not a patch: the driver
  knows the step *index* even when it cannot know the name.
- **Backoff restarts on the retry.** The retry is a second Activity invocation whose first attempt
  fires immediately, so `{ maximumAttempts: 3, initialInterval: '30s' }` waits `[0s, 30s]` rather
  than the `[30s, 60s]` a single Temporal policy would. `startToCloseTimeout` is likewise per
  invocation, not per logical step.

### Accumulated payload

Every `advanceWorkflow` call carries every prior step's output, so request *k* ships outputs
1..*k*-1 and the bytes over a run grow with the square of the step count. Temporal enforces a hard
2 MiB per-message gRPC limit, so what matters is the **largest single request**, not the total.

Measured, not modelled — `npm run --workspace=backend measure:workflow-payload -- 1 10 25 50 100`
runs real `complete-cart` executions and reads the encoded bytes out of Temporal's history:

| line items | largest request | total shipped | % of 2 MiB |
|---|---|---|---|
| 1 | 1.7 KiB | 12.6 KiB | 0.08% |
| 25 | 2.7 KiB | 17.6 KiB | 0.13% |
| 100 | 5.9 KiB | 33.4 KiB | 0.29% |

The largest request grows by ~43 B per line item and would reach 2 MiB at roughly 48,000 of them. The
`OrderDTO` and `PaymentDTO` that dominate the payload are fixed-size; the only per-item term is
`reserve-inventory`'s list of reservation ids. **This does not bind for `complete-cart`** — but a
workflow whose step output grows with its input is a different question, and that script is how to
answer it. Full numbers and the escape hatch: ADR-0021.

### Shape fingerprint

The driver carries a rolling hash of the step names completed so far. If a deploy adds, removes or
reorders a step under a running execution, the stored outputs no longer line up; the Activity
throws non-retryably instead of replaying into the wrong step. Temporal Worker Versioning is the
real answer and is the recorded follow-up.

### Adding a Temporal feature to the port later

The port is frozen in this scope (ADR-0009's signatures, unchanged), but it was shaped so it can grow
without breaking any of the 72 existing `ctx.step` call sites. If `sleep`, `childWorkflow` or
`signal` is ever needed, the path is already open:

1. **Add it as an optional member of `WorkflowContext`.** It is an interface, so `sleep?(ms): Promise<void>`
   is additive; the simple adapter leaves it undefined and a workflow that needs it checks.
2. **If `step` itself needs configuration, add an overload** — `step(config, action, compensation)`
   beside the existing `step(name, action, compensation)`. The name is the first parameter precisely
   so a config object can take its place without touching a call site.
3. **New adapter knobs go in the options object**, not the factory's arity:
   `createTemporalWorkflowEngine(opts)` already takes one, which is why per-step retry could be added
   in this scope without changing the port.
4. **Negotiate the capability at wiring time, not at request time.** A workflow that declares it needs
   a Temporal-only feature should fail at `setWorkflowEngine()`, when the composition root is choosing
   an engine — not at the first shopper's checkout on workerd. Not implemented; nothing here
   precludes it, and `WorkflowConfig` is where such a declaration would go, next to `idempotent`.

The thing not to do is let a Temporal concept reach a workflow file. `src/workflows/` has zero
imports from `src/temporal/` today and should keep it — a feature that cannot be expressed without
breaking that is a port change, and a port change is an ADR.

### Choosing an engine

`resolveWorkflowEngineName` derives it from `RUNTIME` — `workerd` cannot load
`@temporalio/core-bridge`, so it gets the simple adapter; `node` gets Temporal. There is no
`WORKFLOW_ENGINE` env var. A composition root pins the other one through
`projectConfig.workflows.engine`: the Worker process pins `simple` so nested `.run()` calls stay
in-process, and the test container pins whichever engine the suite is proving.

`check:deps` enforces the boundary — `no-temporal-in-workerd` fails if `src/index.workerd.ts` can
reach `@temporalio/*` or `src/temporal/` at all.

**A workerd deployment therefore has no durable execution.** That is deliberate and recorded as an
accepted limitation in ADR-0022, along with the table of what each runtime does and does not get.

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

### The parity suite

Correctness of the Temporal adapter is not argued from its own unit tests. The *existing* backend
suite runs a second time with the engine pinned to Temporal, asserting exactly the same things:

```bash
docker compose -f apps/backend/docker-compose.yml up -d --wait   # Temporal
npm run --workspace=backend test              # 70 files, engine pinned to simple
npm run --workspace=backend test:temporal     # the same 70 files, pinned to temporal
```

Both report 827 passed / 3 skipped. Same files, same assertions, two engines — so a divergence
between them is an adapter bug by definition, not a difference of opinion between two test suites.

Neither run reads an environment variable to decide. `tests/setup/workflow-engine.ts` holds the
default the container pins, `vitest.temporal.config.ts` adds one setup file that flips it, and both
travel through `projectConfig.workflows.engine`. The Worker lives in the vitest process
(`tests/setup/temporal-parity.ts`) because each vitest worker owns its own database, so a Worker
started anywhere else would run steps against the wrong one.

`test:temporal` is **not** in `verify.sh`'s default job list: it needs Docker, and `npm run verify`
has to keep working for contributors who have not started Temporal.

### Seeing durability actually work

```bash
docker compose -f apps/backend/docker-compose.yml up -d --wait
docker compose -f apps/backend/docker-compose.test.yml up -d --wait
npm run --workspace=backend db:migrate:test
npm run --workspace=backend temporal:crash-resume
```

Starts `complete-cart`, stops the Worker mid-run, starts a new one, and prints from Temporal's own
history which OS process ran each of the 14 steps. Pass `--hard` to send SIGKILL instead of draining,
which demonstrates the other half — a step lost with its Worker is not retried, and the execution
compensates. Both behaviours are explained in ADR-0021.

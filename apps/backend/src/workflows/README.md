# Workflows

Workflows orchestrate cross-module mutations with compensation-based rollback.

## Directory Layout

```
workflows/
  {domain}/
    {workflow-name}.ts          # Workflow definition
    steps/                      # Reusable steps (mutations with compensation)
      {step-name}.ts
    utils/                      # Pure data transformations (no I/O, no services)
      {function-name}.ts
    __tests__/
      {name}.test.ts
```

## Three Building Blocks

### 1. Workflows

Created with `createWorkflow()`. Compose steps via `ctx.step()`. The workflow engine runs steps sequentially and unwinds compensations on failure.

```ts
export const myWorkflow = createWorkflow<Input, Output>('my-workflow', async (ctx, input) => {
  const result = await ctx.step('step-name', action, compensation)
  return result
})
```

- Called from route handlers via `workflow.run(input)`
- Each step receives `{ container }` to resolve services
- Compensation receives the step's return value + `{ container }`

### 2. Steps

Reusable `ctx.step()` wrappers that live in `steps/`. Use for mutations that need rollback.

```ts
export async function myStep(ctx: WorkflowContext, input: MyInput): Promise<MyOutput> {
  return ctx.step<MyOutput>(
    'step-name',
    async ({ container }) => { /* action */ },
    async (output, { container }) => { /* compensation */ },
  )
}
```

Steps can also be used for side-effect-only operations without compensation (e.g., `sendNotificationsStep`), or for compensation-only patterns where the action is a no-op and the compensation fires on workflow failure (e.g., `notifyOnFailureStep`).

### 3. Utils

Pure functions in `utils/`. Data in, data out. No services, no I/O, no side effects.

Use utils when you need to stitch together data from multiple modules without coupling to their services. The caller (a route handler or a step) fetches the raw data, and the util transforms it.

```ts
// Pure: caller fetches links + prices, util stitches them together
export function buildStartingPrices(
  variants: { id: string; productId: string }[],
  links: ProductVariantPriceSetDTO[],
  calculatedPrices: CalculatedPriceSetDTO[],
): Map<string, CalculatedPriceSetDTO>
```

Utils are reusable from both route handlers and workflow steps. They are the right home for cross-module data stitching that would otherwise create unreadable chains of Maps and lookups in route handlers.

## When to Use What

| Need | Use |
|---|---|
| Cross-module mutation with rollback | Workflow with `ctx.step()` |
| **Several mutations, all in one module** | **One service method wrapped in `this.withTransaction` — not a workflow** |
| Reusable mutation logic shared across workflows | Step in `steps/` |
| Data transformation / cross-module stitching | Pure function in `utils/` |
| Single-module read query | Call the service directly in the route handler |
| Cross-module read, however many services | Call them directly in the route handler |

## Key Rules

- **A database transaction beats compensation wherever it reaches.** Compensation is hand-written
  rollback: every step needs one, each has to stay correct as its action changes, and the
  compensation can itself fail and leave the half-applied state it existed to prevent. Postgres has
  none of those failure modes. So mutations that all land in one module belong in one service method
  under `this.withTransaction`; a workflow is what you reach for once they span modules.
- **The module boundary is where the transaction stops.** The modules share a database, but a
  `Context` is only threaded within one module's own service and repositories — nothing hands
  another module's service a transaction to join, and a step resolves each service independently.
  Inside a module, `createWithTransaction` joins an existing `context.transaction` rather than
  nesting, so a method can sequence its own methods atomically by passing `ctx` down as their
  `context` — `upsertPriceSets` in `pricing-module-service.ts`. `add-to-cart` applies the same rule
  from the workflow side: the cart and its line items are one step because they are one module.
- **Crossing a module boundary is not itself the signal — mutating across one is.** A read that
  touches three modules stays in the route handler; there is nothing to unwind, so there is nothing
  for a workflow to do.
- **Workflows orchestrate multi-step operations.** Steps can be mutations with compensation, read-only queries, or data transformations.
- **Steps need `WorkflowContext`.** They can only run inside a workflow, not from route handlers directly.
- **Utils are pure.** No services, no `container`, no async I/O. If it needs a service, it's a step, not a util.
- **Compensation reverses the action.** Store enough state in the step's return value to undo it.
- **`WorkflowTerminalError`** signals a step has permanently failed — triggers compensation of all successful steps. Currently equivalent to throwing any error (the simple adapter has no retry logic), but marks the intent: this failure is unrecoverable and retrying would produce the same result.

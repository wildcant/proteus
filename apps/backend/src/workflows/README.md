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
| Reusable mutation logic shared across workflows | Step in `steps/` |
| Data transformation / cross-module stitching | Pure function in `utils/` |
| Single-module read query | Call the service directly in the route handler |

## Key Rules

- **Workflows orchestrate multi-step operations.** Steps can be mutations with compensation, read-only queries, or data transformations.
- **Steps need `WorkflowContext`.** They can only run inside a workflow, not from route handlers directly.
- **Utils are pure.** No services, no `container`, no async I/O. If it needs a service, it's a step, not a util.
- **Compensation reverses the action.** Store enough state in the step's return value to undo it.
- **`WorkflowTerminalError`** skips compensation and fails immediately. Use for validation errors where rollback is unnecessary (e.g., "cart already completed").

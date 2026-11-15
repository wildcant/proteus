# 9. Workflow Engine and Step Pattern

**Status:** Accepted. Amended by [ADR-0038](0038-extensions-are-a-forks-backend-code-beside-proteus.md): workflow hooks (`hookStep`, `runHook`) join the vocabulary, built on `ctx.step` with no change to the port.

## Context

ADR 0002 (No Cross-Module Transactions) deferred cross-module consistency to "the workflow/saga layer." Route handlers have been accumulating orchestration logic — resolving multiple module services, fetching data across module boundaries, and assembling cross-module results. This logic is not reusable across entry points and has no compensation capability.

Medusa uses a declarative DAG-based workflow engine (~6,000 lines of infrastructure) with proxy-based step recording, graph walking, and serializable state. This exists because Medusa needs to serialize, inspect, and replay workflow state across a distributed system.

This prototype is a single-process application. We need the orchestration benefits (reusable composition, compensation, observability) without the DAG infrastructure.

## Decision

### Workflow Engine Port

A workflow is an async function that receives a `WorkflowContext` and typed input. The context provides `step()` — a method to run named operations with optional compensation. The engine adapter determines execution semantics.

```typescript
interface WorkflowContext {
  step<T>(
    name: string,
    action: (input: T, context: { container: AwilixContainer }) => Promise<T>,
    compensation?: (output: T, context: { container: AwilixContainer }) => Promise<void>
  ): Promise<T>
}

interface WorkflowDefinition<TInput, TOutput> {
  name: string
  handler: (ctx: WorkflowContext, input: TInput) => Promise<TOutput>
}
```

Two adapters back the same port:

| Concern | Simple adapter | Restate adapter |
|---|---|---|
| Execution | Direct function call | Durable, journaled |
| Retries | None — all errors are terminal | Automatic for transient errors |
| Compensation | In-memory reverse list | Durable — survives crashes |
| Idempotency | None | Built into Restate's journal |
| Infrastructure | Zero | Restate server |

The workflow code is identical across adapters. Only the wiring changes.

### Workflow-Step Separation

**Workflows are pure composition.** They chain `ctx.step()` calls and do plain data transformation between them. They never import or resolve services. They never touch the DI container.

**Steps are the unit of work.** Each step receives `(input, { container })` and resolves whatever module services it needs at runtime. This keeps modules decoupled — a step can use multiple module services without those modules knowing about each other.

```typescript
const confirmInventory = defineWorkflow({
  name: "confirm-inventory",
  handler: async (ctx, input) => {
    const lineItems = await ctx.step("get-line-items", (_, { container }) => {
      const cartService = container.resolve(Modules.CART)
      return cartService.listLineItems({ cartId: input.cartId })
    })

    const links = await ctx.step("get-variant-links", (_, { container }) => {
      const linkService = container.resolve("linkService")
      return linkService.repo("productVariantInventoryItem")
        .find({ variantId: { $in: variantIds } })
    })

    // Pure logic — no step needed
    return assembleAvailability(lineItems, links)
  },
})
```

### Step Placement

1. **Default: inline** in the workflow handler. Small steps stay right there.
2. **Extract to same file** when the step body is large enough to hurt readability.
3. **Extract to `steps/` directory** only when a step is reused across multiple workflows.

### Route Handler Role

Route handlers become thin — parse input, execute workflow, format response. All orchestration logic moves to workflows.

### Data Flow

**Default:** Steps call individual module services. The workflow assembles the cross-module picture in plain logic between steps. Each module only touches its own tables.

**Escape hatch:** When a single JOIN is genuinely needed for performance/UX, the link repository (see ADR 0004) hosts it as a typed method. The step calls this method instead of making separate module service calls.

### File Structure

```
src/workflows/
  <domain>/
    <workflow-name>.ts
    steps/                    -- only when steps are reused
  engine/
    types.ts                  -- WorkflowContext, WorkflowDefinition
    simple-adapter.ts         -- in-process engine
```

### Why Not Medusa's Declarative DAG

Medusa's `createWorkflow` builds a dependency graph at definition time. Step calls don't execute — they record graph nodes. Values are proxies. This requires `transform()`, `when()`, `parallelize()` as graph operations, plus ~6,000 lines of infrastructure.

We use standard async/await with real values:

| Medusa feature | Our approach |
|---|---|
| `transform()` | Inline code — just a function call |
| `when()` | `if` statement |
| `parallelize()` | `Promise.all()` on `ctx.step()` calls |
| DAG visualization | Not available — not needed for single-process |
| Workflow serialization | Not built-in — Restate handles this at the adapter level |

## Consequences

- Cross-module orchestration has a clear home (`src/workflows/`) outside any individual module
- Route handlers stay thin and focused on HTTP concerns
- The same orchestration logic is reusable from any entry point (API routes, server functions, CLI)
- Steps are independently testable with fake containers
- Compensation/rollback is built into the step model — failed workflows can undo completed steps
- The workflow engine is swappable — simple adapter for dev/tests, Restate for production durability
- No proxy magic, no DAG infrastructure, no framework lock-in
- Developers must think about step granularity — too coarse and compensation is imprecise, too fine and the workflow is noisy

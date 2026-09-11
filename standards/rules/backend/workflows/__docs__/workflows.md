# Workflows

Workflows orchestrate **cross-module mutations** with compensation-based rollback. This covers the
three kinds of file that live under `src/workflows/` — the workflow, the steps it composes and the
pure utils either may call — and when each one is the right answer.

The engine underneath, its two adapters and the replay rules they impose are mechanism, and live in
[`src/core/workflows/README.md`](../../../../../apps/backend/src/core/workflows/README.md). The route
that decides to call a workflow in the first place is in
[route helpers](../../api/__docs__/route-helpers.md).

## Structure

```
workflows/
  {domain}/
    {workflow-name}.ts          # workflow definition
    steps/                      # reusable steps (mutations with compensation)
      {step-name}.ts
    utils/                      # pure data transformations (no I/O, no services)
      {function-name}.ts
    __tests__/
      {name}.test.ts
```

## Shape

```ts
export const myWorkflow = createWorkflow<Input, Output>('my-workflow', async (ctx, input) => {
  const result = await ctx.step('step-name', action, compensation)
  return result
})
```

```ts
// steps/my-step.ts — a step reusable across workflows
export async function myStep(ctx: WorkflowContext, input: MyInput): Promise<MyOutput> {
  return ctx.step<MyOutput>(
    'step-name',
    async ({ container }) => {
      /* action */
    },
    async (output, { container }) => {
      /* compensation */
    },
  )
}
```

## Rules

### Reach for a workflow only once the mutations cross modules

| Need | Use |
|---|---|
| Cross-module mutation with rollback | Workflow with `ctx.step()` |
| **Several mutations, all in one module** | **One service method wrapped in `this.withTransaction` — not a workflow** |
| Reusable mutation logic shared across workflows | Step in `steps/` |
| Data transformation / cross-module stitching | Pure function in `utils/` |
| Single-module read query | Call the service directly in the route handler |
| Cross-module read, however many services | Call them directly in the route handler |

**A database transaction beats compensation wherever it reaches.** Compensation is hand-written
rollback: every step needs one, each has to stay correct as its action changes, and the compensation
can itself fail and leave the half-applied state it existed to prevent. Postgres has none of those
failure modes.

**The module boundary is where the transaction stops.** The modules share a database, but a `Context`
is only threaded within one module's own service and repositories — nothing hands another module's
service a transaction to join, and a step resolves each service independently. Inside a module,
`createWithTransaction` joins an existing `context.transaction` rather than nesting, so a method can
sequence its own methods atomically by passing `ctx` down as their `context` — `upsertPriceSets` in
`pricing-module-service.ts`. `add-to-cart` applies the same rule from the workflow side: the cart and
its line items are one step because they are one module.

**Crossing a module boundary is not itself the signal — mutating across one is.** A read that touches
three modules stays in the route handler; there is nothing to unwind, so there is nothing for a
workflow to do.

### Steps are awaited one after another

Never `Promise.all([ctx.step(...), ctx.step(...)])`, even when the steps touch disjoint data and the
engine tolerates it. Compensation is one array pushed to in order and unwound in reverse, which only
means anything over a sequential history — concurrent steps have no defined rollback order, and
parallel step support is engine work that has not been done. Where the parallelism is genuinely
available, write the steps in sequence and record the opportunity as `// TODO(workflows): …` — the
repo's convention is a parenthesised topic (`TODO(locking)`, `TODO(pricing)`), not a bare TODO.

Concurrency *inside* one step's action is fine and common: one step means one compensation whatever
its action fans out over, which is why `create-payment-collection-for-cart` reads line items and
shipping methods with a `Promise.all`.

Serial order also narrows a compensation test. If step 1 throws, step 2 never runs — so drive a
rollback test from a step downstream of everything you want to see unwound.

### A step owns its compensation; a util owns nothing

A step is a mutation plus the undo for it, so store enough state in the step's return value to
reverse the action. Steps can also be side-effect-only with no compensation
(`sendNotificationsStep`), or compensation-only — the action a no-op and the compensation firing on
workflow failure (`notifyOnFailureStep`). They need a `WorkflowContext`, so they run only inside a
workflow and never from a route handler.

**Utils are pure.** Data in, data out: no services, no `container`, no async I/O. If it needs a
service it is a step, not a util. Their value is stitching data from several modules without coupling
to any of their services — the caller fetches the raw rows and the util transforms them, which is
what makes the same function reachable from a route handler and a workflow step alike:

```ts
// Pure: caller fetches links + prices, util stitches them together
export function buildStartingPrices(
  variants: { id: string; productId: string }[],
  links: ProductVariantPriceSetDTO[],
  calculatedPrices: CalculatedPriceSetDTO[],
): Map<string, CalculatedPriceSetDTO>
```

### A workflow declares what it raises

`throws` on the `createWorkflow` config is the workflow's half of the error contract, and it exists so
a route can spread it. `WorkflowTerminalError` is how a step says a failure is permanent — it
triggers compensation of every successful step. It is currently equivalent to throwing any error,
the simple adapter having no retry logic, but it marks the intent: retrying would produce the same
result.

A step that lives in its own file exports its own `…Throws` const for the workflow to spread, the
same way a route spreads the workflow's. Nothing in the chain restates a type it did not raise.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `workflow-parallelises-steps` | that `ctx.step` calls are awaited in sequence, never inside a `Promise.all` |
| `workflow-util-is-not-pure` | that a `utils/` helper does no I/O and takes no service |
| `workflow-throws-undeclared-error` | that a type raised as `WorkflowTerminalError` is on the `throws` list |
| `workflow-declares-unthrown-error` | that a type on the list is one the file actually raises |

`standards/README.md` covers how rules run, how their tests work, and how to suppress one.

### Exemptions

`workflow-declares-unthrown-error` is suppressed where the throw belongs to a module service the
workflow calls rather than to the workflow file, so the declaration is right and ast-grep cannot see
the raise. Write the reason above the suppression.

## What is deliberately not enforced

- **That a workflow crosses modules.** The whole argument above is that a single-module sequence
  belongs in one service method, and nothing checks it. A rule reading a workflow file sees
  `container.resolve(...)` calls, not which module each service came from — and the counting is the
  easy half; the hard half is that two services from one module are still one transaction's worth of
  work. [`route-chains-mutations-on-one-service`](../../api/__docs__/route-helpers.md) catches the
  shape at the route, which is where it is usually written. The same goes for the claim above it —
  that a transaction beats compensation wherever it reaches. Which of the two a set of mutations
  needs is a design judgement about where they land, and the one shape of it that is syntactic is
  already that rule's.
- **That compensation actually reverses the action.** A compensation is an arbitrary function; that
  it undoes what the action did is a claim about behaviour, and the only thing that can check it is a
  rollback test driven from a step downstream.
- **Purity beyond the file.** `workflow-util-is-not-pure` matches an `await`, an `async` keyword or a
  service-typed parameter. A util that calls an impure import is invisible to it, and
  `check:workflow-purity` does not help — that script owns the *handler* body and does not follow
  imports, so nothing else is watching a `utils/` file.
- **That a `TODO(workflows)` gets written.** The rule refuses the `Promise.all`; recording why the
  parallelism was available is the convention it cannot see the absence of.

## Relationship with routes

A route that runs a workflow inherits its failures, and must spread rather than restate them:
`export const PostThrows = [...completeCartWorkflow.throws, ErrorTypes.CONFLICT] as const`. That
claim spans both sides of the call, which is why `route-omits-workflow-errors` sits at
`standards/rules/backend/` rather than inside either directory and globs both `src/api/**/route.ts`
and `src/workflows/**/*.ts`. Its Enforcement row is in
[routes](../../api/__docs__/routes.md#enforcement), where the file it flags lives.

Which mutations justify a workflow at all is the last row of the table in
[route helpers](../../api/__docs__/route-helpers.md).

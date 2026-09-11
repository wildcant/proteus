# Route helpers

Where the logic goes when a handler gets long. The rule the four file kinds imply: **a handler calls
out, it does not carry its own helpers.** A function defined beside a handler in `route.ts` is
invisible to everything else — the next route that needs it writes its own copy, and the handler it
was meant to shorten can no longer be read without also reading the helpers above and below it.

What a route file must hold is next door in [routes](./routes.md). The workflow at the far end of the
last option is in [workflows](../../workflows/__docs__/workflows.md).

## Structure

Four destinations, none of them `route.ts`:

```
src/api/<scope>/<domain>/middlewares.ts   — a guard or a fetch two routes share
src/modules/<name>/services/              — anything that mutates, behind one method
src/workflows/<domain>/<name>.ts          — mutations that cross a module boundary
src/workflows/<domain>/utils/             — pure shaping, data in and data out
```

## Rules

Two questions place the helper. Does it take `req`? Does it call a service?

| | **Calls no service** | **Calls a service** |
|---|---|---|
| **Takes no `req`** | Pure function in `src/workflows/<domain>/utils/` | Reads only → inline it. Mutates → a transactional method on that module's service; a workflow only once the mutations cross modules |
| **Takes `req`** | Inline it — it is a guard clause | Inline it too, unless a second route needs it — then a middleware in `middlewares.ts` |

Note which question the top-right cell does *not* ask: how many services it touches. Crossing a
module boundary is not by itself a reason to leave the handler — mutating across one is.

### Pure → a util

It qualifies only if it names no service, no `container` and no `req`, and awaits nothing. Pass the
narrowed value rather than the request: a helper reading `req.body.data` is request-shaped, one
taking `data` is pure. File it under the domain whose data it shapes, not the route that happens to
call it — `build-starting-prices.ts` sits in `workflows/product/utils/` and is called from a route
handler and a workflow step alike.

### Several reads, even across modules → inline them

A read has nothing to unwind, so there is nothing for a workflow to compensate and no transaction to
hold it together. Two services queried in sequence to answer one question is a handler doing its job,
however many modules the answer touches: resolve both, read both, return. It stays inline no matter
how long the chain gets.

What a long read chain usually wants is a comment, not a file. `store/carts/[id]/shipping-options`
resolves the cart's country by falling back from the shipping address to the region the cart was
opened in — three reads across two modules, and the part worth extracting is the paragraph
explaining why the address wins, not the code.

The exception is the pure half. Once the reads are done, shaping the rows into the response is a
util (above) — `buildStartingPrices` takes variants, links and prices already fetched by the caller.
Extract the shaping, leave the fetching.

### Mutations that must not half-happen → one transaction, then a workflow

The goal is atomicity; a workflow is one way to buy it and not the cheap one. Take the first of these
that covers the case:

| The mutations | Use |
|---|---|
| One mutation | Just call the service |
| Several, all in one module | One method on that service, wrapped in `this.withTransaction` |
| Several, spanning modules | A workflow with `ctx.step()` compensation |

**Prefer the transaction wherever it reaches.** Postgres already unwinds a failed transaction, so a
single method gets atomicity with no compensation to write, none to keep correct as the action
changes, and no half-applied state to reason about — compensation is hand-written rollback that can
itself fail, and every step needs one.

Where it reaches is one module. The modules share a database, but a `Context` is only ever threaded
within a module's own service and repositories — nothing hands another module's service a
transaction to join, and a workflow step resolves each service independently. That is the boundary
compensation exists to cover, and the only one it has to.

Chaining a module's own methods inside one transaction is already the pattern:
`createWithTransaction` joins an existing `context.transaction` instead of opening a nested one
(`core/utils/with-transaction.ts`), so an outer method passes `ctx` down as each callee's `context`
and the whole sequence commits or rolls back once — see `upsertPriceSets` in
`pricing-module-service.ts`, which calls `createPriceSets` and `updatePriceSets` that way while both
stay independently callable. `capturePayment` (write the capture row, update the payment) and
`setDefaultAddress` (release the old flags, claim the new) are the two-mutation shape.

Workflows already draw the line this way from their own side: `add-to-cart` keeps the cart and its
line items in one step because they are "one module, so the cart module writes them in a single
transaction", and `set-product-options` does the same for options and the variant moves they force.
A workflow reaching for a step per mutation inside one module is buying compensation it could have
had for free.

So "these must not half-happen" is not on its own a workflow signal — ask which module they land in
first. Wrapping a single service call in `createWorkflow` buys no compensation and costs a file.

### Fetch or validation reused by several routes → a middleware

Reuse is the gate, not shape. A fetch or a refusal that only one route makes stays inline at the top
of that handler, however middleware-shaped it looks: a `middlewares.ts` export wired into a single
definition splits one flow across two files and buys nothing back. It earns the move when a second
route needs the same thing — then it is a middleware of one of two kinds, guarding the request by
throwing (`validateAddressOwnership` in `store/customers/middlewares.ts`) or enriching it by putting
a value on `req` for the handler to narrow (`attachCustomer` in `store/middlewares.ts`).

Middlewares run before `input` is validated, so path params and body are still unvalidated inside
one — a guard that needs the parsed body cannot be one, no matter how many routes want it.

### Several calls chained on one service → a method on that service

A route that resolves one module's service and then chains two or more of its methods — or whose read
decides its own write — is describing that module's behaviour in the route file. Move it behind a
single method and let the route ask for what it wants. This is not a workflow: workflows exist to
cross modules, and a module sequencing its own calls is just a method. If that method grows, the
module splits internally behind a private collaborator (`ProductOptionService` inside `product`) and
its public surface stays one service.

Two things follow from where the method now sits. It can wrap the sequence in one transaction, which
is why this is the answer to a multi-mutation route and not merely a tidier one — see above. And the
read that decided the write happens inside that transaction rather than before it, so the decision
cannot be made stale by a concurrent request between the two calls, which is a correctness gap the
route could not close from where it stood.

A helper can straddle two boxes — pure shaping wrapped around a service call, or a `req` read
wrapped around one. Split it rather than pick a winner: each half moves to the box it lands in on
its own.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `route-declares-helper-function` | that a handler calls out rather than carrying its own helpers |
| `route-chains-mutations-on-one-service` | that two mutations on one module share a transaction behind one method |

Both were written against the code that broke them, and both still flag it: the country fallback that
was a `function` in `shipping-options/route.ts`, and the create→authorize→capture and delete→add
sequences that are now `markPaymentCollectionAsPaid` and `setShippingMethod`.
`standards/README.md` covers how rules run, how their tests work, and how to suppress one. Neither
has an exemption today.

## What is deliberately not enforced

- **Which module a service belongs to.** `route-chains-mutations-on-one-service` keys on the
  variable name, so it sees one *service*, not one module. Two services resolved from the same
  module read as unrelated and go unreported. The rule errs this way on purpose: the opposite error
  flags a cross-module sequence, which is the case that legitimately is a workflow.
- **Whether a call mutates.** A prefix list stands in for that — `create`, `softDelete`, `capture`
  and the rest. A mutating method named outside it is invisible, and `ensure` is excluded by hand
  because `ensureAccountHolders` provisions at a gateway and cannot join a transaction anyway.
- **That a read chain stays inline.** There is no shape to match — the compliant version is an
  absence. `route-declares-helper-function` catches the form it takes when someone extracts one.
- **The arrow form of a helper.** `route-declares-helper-function` is a bare `function_declaration`
  check, which works because handlers are always `export const GET = async (req) => …`. A helper
  written as `const shape = (rows) => …` is not matched: excluding the five handler names would mean
  matching every remaining file-scope arrow, which reaches past helpers to the `Input` / `Output` /
  `Throws` constants the file is required to export. The `function` form is where the helpers this
  rule was written for actually appeared.
- **The placement itself.** Both rules say a helper is in the wrong place; neither says which of the
  four destinations is the right one. That is the whole of the table above, and it turns on whether a
  call mutates and which module it lands in — two things a rule reading one file cannot know.

## Relationship with workflows

The last cell of the table is a workflow, and it is the expensive one. [Workflows](../../workflows/__docs__/workflows.md)
argues the same boundary from the other side: a step per mutation inside one module is compensation
bought where a transaction was free.

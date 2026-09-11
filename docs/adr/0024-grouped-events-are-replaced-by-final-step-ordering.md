# 24. Grouped Events Are Replaced by Final-Step Ordering

**Status:** Accepted

## Context

The reference implementation this codebase's module and workflow vocabulary comes from — Medusa —
gives its event bus a **grouping** API alongside publish: an emit can carry an `eventGroupId`, the
bus stages those events instead of delivering them, and the surrounding operation ends by calling
`releaseGroupedEvents(groupId)` on success or `clearGroupedEvents(groupId)` on failure.

The question this ADR answers is whether the event bus in ADR-0023 needs the same thing. It is worth
recording rather than dropping, because the *problem* grouping solves is real here too: an event
delivered for an operation that then rolled back is an email about an order that does not exist.

## Why Medusa needs it

Their events fire as a side effect of ORM writes, deep inside services, before anyone knows whether
the surrounding operation commits. By the time a workflow decides to compensate, the emits have
already happened. Staging is the only place left to put the decision, so the bus grows two more
methods and every emit site grows a group id to thread through.

## Decision

**No `eventGroupId`, no staging store, no `releaseGroupedEvents` / `clearGroupedEvents` on the port.
A workflow publishes from its final step, and that ordering is the whole transactional story.**

```ts
// the last step of complete-cart
await ctx.step('publish-order-placed', async ({ container }) => {
  const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
  await bus.emit('order.placed', { id: order.id })
})
```

A workflow that fails earlier never reaches that line, so a compensated checkout publishes nothing.
Under Temporal, a crash after an earlier step resumes and eventually does reach it.

**This is stronger than what staging gives, not a weaker substitute for it.** Medusa's local bus loses
staged events when the process restarts; a durable execution resumes and publishes. The guarantee
grouping is reached for is here already, as ordering, because this codebase does not have the problem
that forces the staging design: nothing emits as a side effect of a write, so there is never an event
in flight before the operation's outcome is known.

### What the alternatives cost

**Adding the two methods as no-ops** advertises a guarantee nothing implements. That is the same
mistake as putting `delaySeconds` on a port one adapter cannot honour: the signature is the contract,
and a caller who reads it and gets nothing has been lied to by the type system.

**Building them for real** means threading a group id through every module call so that a service two
frames down can associate its emit with the caller's group. The one-method `WorkflowContext` cannot
carry it without a port change, and a port change to the workflow engine to serve the event bus is
precisely the coupling `event-bus-and-workflows-stay-peers` exists to forbid. It would need its own
ADR, and would earn one only if the premise below stopped holding.

## Consequences

**An emit from outside a workflow has no transactional story at all**, and grouping would not have
given it one. A route handler that commits and then publishes can lose the event in between, because
neither `queue.send()` nor an activity start runs inside the Drizzle transaction. ADR-0023 records
that residual and names the fix: an outbox table, which is adapter internals rather than a port
change, and which would close the gap for grouped and ungrouped emits alike.

**One publisher per event, by convention rather than by rule.** The ordering guarantee only holds
while the emit is in the final step, so an emit added halfway through a workflow quietly gives it
up. Nothing enforces the placement today; `standards/rules/backend/subscribers/__docs__/events.md`
says it, and the
`complete-cart` test that asserts a compensated checkout publishes nothing is what would notice.

## What would trigger revisiting

Grouping earns its machinery the moment an event has to be published from somewhere that does not
know whether its caller will succeed. Concretely:

- **Entity-level CRUD events derived from repository writes.** Medusa's motivating case. Drizzle
  repositories have no equivalent hook seam today, and hand-writing per-table emits is not worth it
  — but a generic `afterCommit` seam would put emits back underneath the caller's decision, and
  staging would be the answer again.
- **A module service that publishes on its own.** Same shape one layer up: the service does not know
  whether the workflow calling it will compensate.
- **One workflow needing several events delivered atomically.** Two emits in a final step are two
  independent deliveries, and the second can be lost while the first is not. Nothing needs this yet
  — both v1 events are single — and a subscriber that reads state through the id tolerates it.

Until one of those is real, the ordering rule is the cheaper design and the stronger guarantee.

## References

- ADR-0023 — the event bus this decision is part of
- `apps/backend/src/workflows/cart/complete-cart.ts` — `publish-order-placed`, the final step
- `apps/backend/src/workflows/cart/__tests__/complete-cart.test.ts` — "publishes nothing when the
  checkout compensates"

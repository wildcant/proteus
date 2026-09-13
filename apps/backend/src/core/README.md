# `core/`

What is *known*: the vocabulary every layer is written in, and the ports it calls through. Nothing
here starts a process, opens a connection, listens on a port or reads a clock — which is why every
file in this directory can be constructed inside a unit test with no runtime at all, and why
`framework/` may import `core/` but never the reverse. The boundary and the test that decides it are
in [ADR-0026](../../../../docs/adr/0026-core-is-known-framework-runs.md).

## What is here

| Directory | Holds |
|---|---|
| `types/` | The DTO and port vocabulary — one folder per domain, plus `common.ts`, `context.ts`, `config.ts` |
| `utils/` | The module and provider primitives: `Module()`, `BaseRepository`, `createWithTransaction`, `ContainerRegistrationKeys`, the `abstract-*-provider` base classes, the filter builders |
| `errors/` | `AppError`, the db error mapper, the error handler, zod issue formatting |
| `db/` | `BaseRepository`'s query building, the `timestamps` columns, the index helpers, the cascade graph and walker, the `DbProvider` port and its two adapters |
| `bignumber.ts` | Money and quantity arithmetic |
| `logger/` | `noop-logger.ts`, the null object — see below |
| `auth/` | Token and verification helper types and utilities |
| `event-bus/` | The port only: `events.ts`, `types.ts` |
| `workflows/` | The port only: `types.ts` |

`event-bus/` and `workflows/` appear on both sides of the line, which is the split doing its job
rather than duplication. A port lives here so that a workflow, a subscriber or a module service names
it without learning which runtime it is on; the adapter behind it lives in `framework/` because
choosing one is exactly what differs between node and workerd.

## What a port costs at runtime

`core/types/` holds the interfaces module services implement, and two directories here hold nothing
but a port: `event-bus/{events,types}.ts` and `workflows/types.ts`. The engines behind them —
Temporal, Cloudflare Queues, the in-process adapter — live in `framework/`, and the caller never
names one.

The mechanism is the container, not an import, and `utils/container.ts` names the five things asked
for by key rather than by file — `GET_DB`, `DB_PROVIDER`, `LOGGER`, `LINK` and `EVENT_BUS`, in
`ContainerRegistrationKeys`. A workflow that publishes resolves `EVENT_BUS` and gets whichever
adapter that process's composition root registered; the same workflow file runs on node against
Temporal and on workerd against Cloudflare Queues without a branch, because the only thing it ever
named was the type. That is what makes the 41 files in `src/workflows/` and the 6 in
`src/subscribers/` runtime-agnostic, and it is the reason a subscriber is written to the *weakest*
adapter's guarantees — at-least-once, no dedup — rather than to the one it happens to run on today
([ADR-0023](../../../../docs/adr/0023-event-bus-is-one-port-over-three-adapters.md)).

The cost is that a port cannot be followed. Reading `publish()` here tells you the contract and not
what happens; the transports are in `framework/event-bus/`, and each has its own README.

## What `db/` does when a repository runs

`BaseRepository(table)` receives `{ getDb }` — always a factory, never an instance, because the
workerd runtime creates a connection per request through `AsyncLocalStorage` and a captured instance
would leak one request's I/O into another's. What the factory reaches is the `DbProvider` port in
`db/ports.ts`, and each runtime has its own adapter beside it: `node-provider.ts` hands out one
singleton pool, `workers-provider.ts` a per-request connection, and a repository never learns which.
Every query it builds filters `deletedAt IS NULL`, so soft-delete is the default read rather than a
flag callers remember.

`buildCascadeGraph` is called once per module at bootstrap, over the `models` object of that
module's `Module()` definition, and the result is shared by that module's repositories. It is scoped
to one module because no foreign key crosses a module boundary — so module scope is already the
whole graph, and the cascade never has to consult another module's tables
([ADR-0016](../../../../docs/adr/0016-derived-soft-delete-cascade.md)).

## Why a logger implementation lives here

`logger/noop-logger.ts` is a null object, not an adapter: it satisfies the `Logger` port by doing
nothing, and it needs no process to exist. It is here rather than beside the Winston and Console
loggers because the code that reaches for it is module code — each module's `sync-providers.ts`
constructs its repository and service by hand, outside the container, to upsert providers on
workerd, and has to hand the constructor something.

That is not a detail: while `noopLogger` sat in `framework/logger/`, it was the single reason
`modules/` imported `framework/` at all, and the rule that now forbids the business layers from
naming the runtime could not be written without carving out an exception for it.

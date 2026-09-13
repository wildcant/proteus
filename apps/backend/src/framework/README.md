# `framework/`

What *runs*: everything that starts a process, builds a container, opens a connection, serves a
request or schedules work. If a thing would differ between node and workerd, it is here — that is
the test, and [ADR-0026](../../../../docs/adr/0026-core-is-known-framework-runs.md) is where it and the
one-way rule (`framework/` imports `core/`, never the reverse) are recorded.

Nothing in `modules/`, `workflows/`, `subscribers/`, `link-modules/` or `providers/` may name this
directory. They call ports; `runtime/` decides what is behind them.

## What is here

| Directory | Holds |
|---|---|
| `bootstrap/` | `bootstrapModule`, the step every composition root runs per module |
| `config/` | The `projectConfig` loader, a singleton |
| `http/` | `ports.ts`, `applyMiddleware` and the middlewares, multipart, content type, CORS, namespace auth, the route sorter, `openapi/` |
| `runtime/` | The three containers, and the two platform adapters — `express/` on node, `hono/` elsewhere |
| `logger/` | The Console and Winston loggers |
| `scheduler/` | The cron runners: `bullmq/` on node, `kuron/` on workerd |
| `temporal/` | Client, config, payload converter, failure encoding — shared by two engines |
| `event-bus/` | The engines: inline, Cloudflare Queues and Temporal adapters, and the registry |
| `workflows/` | The engines: the in-process adapter, the Temporal adapter and its Worker |

`event-bus/`, `workflows/` and `logger/` are the three names that also exist under `core/`: the first
two hold nothing but the port there, and the null logger is there for the reason
[`core/README.md`](../core/README.md) gives. That is the split doing its job rather than duplication.

## Three composition roots, one bootstrap

`src/container.ts` exposes `bootstrapContainer`, which registers the modules, the link service and
the workflow engine into one shared Awilix container. It is never called directly — three roots in
`runtime/` call it, and which one runs is which process you started:

- **`container.node.ts`** — the API server. A module-level `await`, so the container is a singleton
  built once at import.
- **`container.worker.ts`** — `createWorkerContainer(...)`, a factory rather than a singleton. A
  Worker pins its own engine and bus, and importing the node root would build the API's container,
  engine and connections inside a process that wants none of them.
- **`container.workerd.ts`** — built per request, taking the queue binding as an argument because a
  binding is a live object only the runtime can hand over.

`bootstrap/bootstrapModule` is the step underneath all three: it gives each module a *private*
container holding its repositories, runs its loaders, constructs the service, and registers only
that service in the shared container. A module therefore cannot reach a sibling's repository even
by accident ([ADR-0001](../../../../docs/adr/0001-per-module-container-isolation.md)).

## How the runtime picks an adapter

`workflows/engine-selection.ts` and `event-bus/adapter-selection.ts` answer the same question the
same way, and neither reads an environment variable. That is deliberate: `@temporalio/core-bridge`
is a native addon workerd cannot load, and Cloudflare Queues do not exist outside workerd, so each
runtime has exactly one production answer and it is not something a `.env` file should be able to
get wrong.

```
runtime: 'workerd'  ->  workflow engine: simple      event bus: cloudflare-queues
runtime: 'node'     ->  workflow engine: temporal    event bus: temporal
```

A caller that needs the other one pins it through `projectConfig` at its own composition root, where
the reason sits next to the choice — the Worker process runs nested workflows in-process, and the
test suite must not require a Temporal server to emit an event. `bootstrapContainer` refuses to boot
when a pinned adapter's factory is missing, rather than quietly falling back to a different one.

## A request, end to end

`src/routes.ts` imports every `definitions.ts` once, sorts them so a literal segment beats a
parameter, wraps each handler with `applyMiddleware` — validation, query parsing, auth — and
registers it into the OpenAPI document. The result is `PreparedRoute[]`, and a platform adapter
serves it: `runtime/express/app.ts` on node, `runtime/hono/app.ts` elsewhere. `src/start.ts` is
what wires the rest of the node process around that app — Swagger UI over the two generated
documents, the scheduler monitor, the health route, and an ordered shutdown that closes the server,
the scheduler, the workflow engine, the database pool and the container in that order.

Each adapter parses the query string with `qs` — Express through its `query parser` setting, Hono per
request — because every list endpoint documents nested operator params (`$eq`, `$in`, `$gte`) and
neither platform's own parser produces them: Express 5's default flattens `?id[$in][]=a` into the
literal key `id[$in][]`.

`http/ports.ts` is the contract in the middle. A handler is typed `HttpRequest<Input, Middlewares>`
and returns `HttpResult`, and neither type names Express, Hono or workerd — which is what lets the
same route file run under all three, and why `http/` holds the request-shaped machinery (multipart,
content type, CORS, namespace auth, OpenAPI registration) while `runtime/` holds the platforms.

## Temporal plumbing is shared, one way

`temporal/` holds what the workflow engine and the event bus both need — the client, the payload
converter, the failure encoding — and it may reach `core/` and nothing else in `framework/`. The
engines import the plumbing; the plumbing never imports an engine, which is what stops it quietly
becoming the workflow engine again. `workflows/` and `event-bus/` are peers and may not import each
other at all, on either side of the `core`/`framework` line.

Both have their own README, because the two transports have different delivery guarantees and that
is the thing a reader actually needs: [`workflows/README.md`](workflows/README.md),
[`event-bus/README.md`](event-bus/README.md), and [`temporal/README.md`](temporal/README.md) for why
the shared folder exists.

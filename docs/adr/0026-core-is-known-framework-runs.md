# 26. `core/` Is What Is Known, `framework/` Is What Runs

**Status:** Accepted

## Context

`src/core/` and `src/framework/` had no stated boundary. Neither name says what belongs in it, and
the drift showed in the measurements: `core/` held 10,764 lines across 155 files, `framework/` held
1,384 across 24. Three folders whose only job is to start or serve a process — `core/bootstrap/`,
`core/config/`, `core/openapi/` — were filed under `core/`, and the two Temporal Worker entrypoints
were filed there too.

Medusa was the original reference for this architecture, so it was the first place to look. Its
`@medusajs/framework` is two things at once: the application runtime — bootstrapping, HTTP routing,
convention loaders, config, logger, telemetry — and the *published import surface* every third-party
app codes against. Roughly half its mass is the second thing: one-line re-export shims over
`@medusajs/utils`, `types`, `modules-sdk`, `orchestration` and `workflows-sdk`; `src/deps/*` vendoring
MikroORM, Awilix, pg, zod and OTel under the Medusa namespace so the whole ecosystem pins one version;
a subpath-exports map that *is* the supported API contract; and `build-tools/` compiling a user's app.
This repo publishes nothing and has no user-code folder. That half has no analogue here, and building
it would mean maintaining a facade for an audience of one.

What does transfer is the stack underneath it. Medusa layers **vocabulary** (`types`, `utils`) below
**machinery** (`orchestration`, `modules-sdk`, `query`, `workflows-sdk`) below the **application
runtime** (`framework`). Proteus had all three in `core/`, and a slice of the third in `framework/`.

The import graph had already diagnosed the problem. There were exactly **five** non-test
`core → framework` edges, and every one was a misfiling rather than a coupling:

| Edge | What it really was |
|---|---|
| `core/auth/utils/validate-token.ts` → `framework/http/types` | typed `MiddlewareFunction` — an HTTP middleware living in `core/` |
| `core/auth/utils/validate-scope-provider-association.ts` → same | the same, next door to `framework/http/middlewares/authenticate.ts` |
| `core/openapi/register-route.ts` → `framework/http/types` | OpenAPI registration is HTTP |
| `core/workflows/temporal/worker.ts` → `framework/runtime/container.worker` | a Worker entrypoint is a process |
| `core/event-bus/temporal/worker.ts` → same | the same |

The remaining fourteen were tests reaching for `noopLogger` — a null-object implementation of the
`core/types/logger.ts` port that had been filed in the adapter layer, and the single reason
`modules/` imported `framework/` at all.

## Decision

**`core/` is what is *known*. `framework/` is what *runs*.**

The test, which is deliberately this repo's own rather than Medusa's:

> If it would differ between node and workerd, or needs a process, a port, a request, a clock or a
> connection to exist — **`framework/`**.
> If it would be identical inside a unit test with no process at all — **`core/`**.

Medusa's boundary is about *who may import a thing*, because its framework is published. Ours is
about *which runtime a thing runs on*, because the recurring cost here is the node/workerd split.
The consequence is a one-way rule: **`framework/` imports `core/`, never the reverse.**

Applied, this moved 63 files. Ports stayed in `core/` and engines went to `framework/`:
`core/event-bus/{events,types}.ts` and `core/workflows/types.ts` are the contracts that 41 files in
`src/workflows/` and 6 in `src/subscribers/` are written against, and none of those imports changed.
The adapters behind them — Temporal, Cloudflare Queues, the in-process engine — moved to
`framework/{event-bus,workflows}/`, along with `framework/temporal/` (connecting to a server runs),
`framework/bootstrap/`, `framework/config/` and `framework/http/{ports,openapi}/`. `noopLogger` went
the other way, to `core/logger/`.

`core/config` split rather than moved: every cross-layer consumer imported only its *types*, never
the manager, so `ConfigModule` and friends became `core/types/config.ts` and only the singleton that
loads them went to `framework/config/`. That split is what keeps `workflows → framework` at zero.

`src/server/` — by then a single file, `ports.ts` — disappeared into `framework/http/`, and with it
the `@server/*` alias.

Enforced by **`business-layers-do-not-import-the-runtime`**: `modules/`, `workflows/`,
`subscribers/`, `link-modules/` and `providers/` may not import `src/framework/` or `src/routes.ts`.
Moving `noopLogger` down is what let this rule name all of `framework/` instead of carving out a
subfolder. `__tests__/` is exempt — a test may construct the engine it is testing.

## Alternatives rejected

**Medusa's package split.** Separate npm packages are how Medusa *enforces* this boundary, because
a package cannot import what it does not depend on. Folders plus dependency-cruiser get the same
enforcement here at a tenth of the cost, and none of the publishing machinery is needed.

**A facade layer.** Re-exporting `core/` through `framework/` so callers have one import path is what
`@medusajs/framework/utils` does for third parties. Here it would be a barrel nothing goes through,
which is a category this repo is actively removing.

**`ports.ts` into `core/`.** The HTTP port looks like a port and `core/` holds ports, but `core/` is
what *every* layer may reach and the whole value of this one is that eight layers cannot see it.
Filed in `core/`, the rule that forbids it would have to name one path inside the folder named
"what everyone may use".

**Excluding `*.gen.ts` from the cruise**, which is how `apps/store` keeps generated files from
dominating its graph. Here it would silently defang `no-temporal-in-workerd`: that rule is
`reachable: true`, and `index.workerd.ts` reaches Temporal *through* `registry.gen.ts`. The generated
registries stay in the graph and are treated as composition roots instead.

## Consequences

`core/` is a sink — its only outgoing edges are to root vocabulary files (`env.ts`,
`schema.type.ts`). `core → framework`, `core → workflows` and `modules → framework` are all zero,
where the first was 5, the second 30 and the third 4.

`shared-temporal-stays-shared` got *simpler*: when the plumbing lived in `core/` the rule had to
enumerate the core primitives it was allowed to reach, because every import was read against its own
layer. With `core/` below it, only its framework siblings need naming.

`event-bus-and-workflows-stay-peers` now spans the split —
`^src/(?:core|framework)/(event-bus|workflows)/` with a `$1` backreference — so the pair is feature
against feature rather than folder against folder, and each engine can still import its own port
across the `core`/`framework` line.

Two edges remain that point upward, both generated composition roots and both declared as such:
`framework/workflows/temporal/registry.gen.ts` reaches `src/workflows/`, and
`framework/event-bus/registry.ts` reaches `src/subscribers/`. They are the same shape as
`src/routes.ts` reaching `src/api/`.

The open question this leaves is one level down: `core/` is still 10k lines, and the vocabulary /
machinery boundary inside it — `types` and `utils` below `db`, `event-bus` and `workflows` — is not
stated or enforced.

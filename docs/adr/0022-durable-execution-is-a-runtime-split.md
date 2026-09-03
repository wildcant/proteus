# 22. Durable Execution Is a Runtime Split, and Cloudflare Does Not Get It

**Status:** Accepted

## Context

This backend deploys to two materially different runtimes. `wrangler.jsonc` builds
`src/index.workerd.ts` for Cloudflare Workers; `src/start.ts` runs an Express server on Node. Both
compose the same modules through the same `bootstrapContainer`.

ADR-0021 adds a durable `WorkflowEngine` backed by Temporal. Temporal's TypeScript Worker needs
`@temporalio/core-bridge`, a native Rust addon. **workerd cannot load native addons.** There is no
version of this that runs a Worker on Cloudflare, and no amount of adapter design changes that: the
constraint is the runtime, not the code.

What could have been built instead is a client-only path — workerd starts an execution over gRPC and
some Node process elsewhere runs the steps. That is a different deployment topology (a Worker fleet
Cloudflare does not host), a different failure mode for the request path, and a second design to keep
correct. It was considered and rejected for this scope.

## Decision

**The engine is derived from the runtime, not configured per deployment.**

```ts
// src/core/workflows/engine-selection.ts
runtime === 'workerd' ? 'simple' : 'temporal'
```

There is deliberately **no `WORKFLOW_ENGINE` environment variable**. The choice is not free per
deployment — workerd has exactly one option — and picking it is not something anyone should be able
to get wrong from a `.env` file. A composition root that genuinely needs the other engine says so
through `projectConfig.workflows.engine`, in code, next to the reason: the Temporal Worker pins
`simple` for itself so that the two workflows calling another workflow's `.run()` from inside a step
stay inline, and the test container pins one per suite so the default run needs no Temporal server.

`check:deps` enforces the boundary structurally: `no-temporal-in-workerd` fails if
`src/index.workerd.ts` can reach `@temporalio/*` or `src/temporal/` at all, through any path.

**The consequence is accepted and stated plainly: a Cloudflare deployment of this backend has no
durable execution.** Its workflows run in-process. A `complete-cart` interrupted between
`authorize-payment` and `record-transactions` is lost there, exactly as it was before ADR-0021, and
compensation only runs if the process lives long enough to run it. Node deployments get durability,
history, per-step resume and the Temporal UI.

| | workerd / Hono (Cloudflare) | node / Express (AWS) |
|---|---|---|
| Adapter | `simple` | `temporal` |
| Step order, compensation order, error identity | same | same |
| Survives the process restarting *between* steps | no | yes |
| Survives the process dying *during* a step | no | no (ADR-0021) |
| Execution history / UI | none | Temporal UI |

## Consequences

**A bug can now be reproducible on one runtime and not the other.** That is the real cost of this
decision, and it is why D5 made acceptance a *parity suite* rather than a set of adapter unit tests:
`npm run --workspace=backend test:temporal` runs the existing 69 test files with the same assertions
against Temporal, and both runs report 817 passed / 3 skipped. Same tests, same expectations, two
engines — a divergence is an adapter bug by definition. It stays out of `verify.sh`'s default job
list because it needs Docker, and `verify.sh` has to keep working for contributors who have not
started Temporal.

Read that number for what it is. At most 24 of the 69 files can reach the pinned engine — the
workflow tests, the API tests whose routes dispatch a workflow, and the engine-pin probe — so it is
evidence that nothing diverges *where the adapter is reachable*, not 817 assertions of adapter
coverage. ADR-0021's Evidence section carries the breakdown. What the suite does cover is the whole
surface a workerd deployment and a Node deployment share, which is what this decision put at risk.

**The two runtimes' durability guarantees must not be assumed equal by anything downstream.** Nothing
in `src/api/` or `src/workflows/` knows which engine it is on, and that is the point of the port —
but an operational decision (which runtime serves checkout) is now also a durability decision.

**Temporal Worker Versioning is a required follow-up before any production use.** ADR-0021's shape
fingerprint makes an in-flight deploy *fail loudly* rather than replay into the wrong step; it does
not make the deploy safe. A deploy that changes a workflow's step sequence while executions are
running will fail those executions and run their compensations. Worker Versioning / Build IDs is the
mechanism that pins an execution to the code it started under, and it is not built here.

**AWS deployment is out of scope and stays out.** The repo has no AWS deployment of any kind — no
Dockerfile, no Terraform, no ECS or App Runner config. Producing one requires an unresolved decision
— self-hosted Temporal on ECS versus Temporal Cloud — which is a cost and operations call rather than
an implementation detail. This project ends at: it works locally, the parity suite proves it, these
ADRs record why.

## Local topology

Temporal runs in the existing Compose stack, on the existing Postgres — `temporalio/auto-setup`
pointed at the `postgres:17` service with its own `temporal` and `temporal_visibility` databases,
plus `temporalio/ui`. Two services, no second data volume.

One hazard worth knowing: `npm run --workspace=backend db:reset` drops and recreates only the
`proteus` database, so workflow history survives it. `docker compose down -v` wipes Temporal's
history along with everything else.

## References

- ADR-0021 — the adapter, its replay design, and what it costs
- `apps/backend/src/core/workflows/engine-selection.ts` — the derivation, with the reasoning inline
- `apps/backend/deps-analyzer/.dependency-cruiser.cjs` — `no-temporal-in-workerd`
- `apps/backend/docker-compose.yml` — the local Temporal services

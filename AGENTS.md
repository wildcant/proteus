# AGENTS.md

Guidance for coding agents working in this repository. Personal, untracked preferences go in AGENTS.local.md, never here.

## Commands

```bash
# Install
npm install
npm run setup                  # install + pull dotenvx keys + generate apps/backend/.env.workerd

# Dev — the whole stack is five processes plus Docker. In VS Code, run the `dev` task
# (Cmd+Shift+B): it brings up Postgres + Temporal, then the API, both Workers, store and admin,
# and opens the three URLs. `dev: workerd` is the same session on the workerd runtime.
docker compose -f apps/backend/docker-compose.yml up -d --wait postgres temporal temporal-ui
npm run --workspace=backend dev            # API at :3000 (Swagger at /admin/docs/, /store/docs/)
npm run --workspace=backend worker:dev     # Temporal Worker for src/workflows (watch mode)
npm run --workspace=backend worker:events  # Temporal Worker for src/subscribers
npm run --workspace=store dev              # Storefront at :3001
npm run --workspace=admin dev              # Admin SPA at :3002
                                           # Temporal UI at :8088

# Stop the compose-run Workers when running them locally. Both poll the same task queues, and
# whichever is free claims the task — leaving both up makes edits appear to apply at random.

# Database (Docker Postgres)
npm run --workspace=backend db:start        # Start Postgres
npm run --workspace=backend db:migrate:dev  # Run migrations (every module + link-modules)
npm run --workspace=backend db:generate     # Generate migration after a schema change
npm run --workspace=backend db:seed:dev     # Seed dev data
npm run --workspace=backend db:test:up      # Test Postgres — needed by the backend + e2e suites
npm run --workspace=backend stack:reset     # Wipe the volume and rebuild: proteus *and* Temporal's
                                            # two databases, then migrate + seed. db:reset drops
                                            # proteus only, so workflow history survives it

# Testing
npm run --workspace=backend test                          # Full backend suite (~96s)
npm run --workspace=backend test:gate                     # The slice `verify` runs
npx -w backend vitest run src/modules/product             # Single module
npx -w backend dotenvx run -f ../../.env.test -- vitest run src/modules/product  # With env
npm run --workspace=backend test:temporal                 # Needs a Temporal server up
npm run --workspace=store test                            # Unit (node) + component (Chromium)
npm run --workspace=store test:e2e                        # Playwright; :e2e:dev for the UI
npm run --workspace=admin test:e2e

# Linting & type-checking
npm run check                  # Biome lint + format (warnings do not fail)
npm run typecheck              # root tooling scripts (tsconfig.json), then every workspace with a
                               # typecheck script, via `pnpm -r` — so a new workspace needs no edit
npm run check:standards        # ast-grep rules; :test runs the rules' own tests

# Verification gate — run after finishing any implementation task
npm run verify                 # Formats, then eleven gates in parallel: typecheck, lint
                               # (warnings fail here), the code standards, the import structure
                               # rules, one version per declared dependency, generated-file
                               # currency, Spectral on both OpenAPI specs, `test:gate`, the
                               # http-schemas bound tests, the store's unit + component tests, and
                               # the utils tests. ~16s. Component tests need
                               # `npx playwright install chromium`.
npm run verify -- --ci         # CI mode: fails on unformatted files instead of rewriting them
                               # (implied when the CI env var is set)
npm run verify:full            # Every test, in parallel: the whole backend suite, the store's unit
                               # and component tests, the http-schemas and utils package tests, and
                               # both Playwright e2e suites. No static checks — that is verify.
                               # Needs the test database up. Excludes the Temporal suites, which
                               # need a server of their own.

# scripts/verify.sh is the single definition of what "checked" means here. A new project-wide
# check belongs in its JOBS list; nothing else aggregates them.

# Each e2e suite owns its database, backend process, Temporal task queue and Worker, so the two
# run concurrently — and so a Worker started by `worker:dev` cannot execute a suite's workflow
# against the dev database. packages/testing/fixtures/e2e-config.ts holds the port map and the
# queue names, and is where a new suite is defined.

# Code generation — all four outputs are committed. Only the two registries are checked for
# drift, by `verify`'s `generated` gate; the Orval clients and routeTree.gen.ts are not.
npm run openapi:generate                        # OpenAPI spec → Orval clients (admin + store)
npm run --workspace=backend workflows:generate  # src/workflows → temporal/registry.gen.ts  (gated)
npm run --workspace=backend subscribers:generate # src/subscribers → registry.gen.ts        (gated)
npm run --workspace=admin generate-routes       # TanStack Router route tree
```

## Project Structure

Monorepo with npm workspaces:

- `apps/backend` — API server (Ports & Adapters / Hexagonal Architecture)
- `apps/admin` — Admin SPA (TanStack Router + React Query + React Table)
- `apps/store` — Storefront (TanStack Start on workerd; selective SSR)
- `packages/http-schemas` — Shared Zod schemas (`./admin`, `./store`, `./auth`, `./common`, `./bounded`)
- `packages/ui` — Component library (shadcn/base-nova style, @base-ui/react primitives)
- `packages/utils` — Shared utilities (date/number formatting)
- `packages/icons` — Generated icon components (`build:icons` from `assets/`)
- `packages/testing` — Shared Playwright/Vitest fixtures, e2e port + database map, global setup
- `packages/frontend-structure` — The Bulletproof React layout rules both frontends are checked against

Path aliases: backend `@core/*`, `@framework/*`, `@server/*`, `@workflows/*`, `@env`, `@tests/*`;
both frontends `#/*` → `./src/*`.

## Backend Architecture

### Module System

Each module at `apps/backend/src/modules/{name}/` follows one layout, and **the list is closed** —
eight folders and four root files, enforced by `module-holds-only-known-file-kinds`. Nesting
*inside* them is unconstrained.

- `models/` — Drizzle table definitions (use the `timestamps` helper from `src/core/db/columns.ts`)
- `repositories/` — Extend `BaseRepository(table)`, receive `{ getDb }` factory
- `services/` — Business logic implementing an interface from `src/core/types/`
- `migrations/` — drizzle-kit output; regenerated in place, never hand-edited
- `__tests__/` — Every test the module has, including pure-function ones
- `utils/` — optional; pure helpers a service consumes
- `loaders/` — optional; provider registration into the local container
- `providers/` — optional; a provider that ships with the module
- `index.ts` — `Module()` factory definition, and the module's whole public surface
- `database.config.ts` — drizzle-kit config
- `provider-declarations.ts` — optional; the configured providers
- `sync-providers.ts` — optional; out-of-band provider upsert for workerd

Only `services/` and `index.ts` are universal. A module that owns no tables has no `models/`,
`repositories/`, `migrations/` or `database.config.ts` — `file` is the one today. Full table:
`standards/rules/backend/modules/__docs__/modules.md`.

Modules: auth, cart, customer, file, fulfillment, inventory, notification, order, payment, pricing,
product, region, store, user.

A module too large for one service class splits internally: the module service constructs the
collaborator from its own injected dependencies and keeps it private. Nothing registers or exports
it, so the module's public surface stays exactly one service — see `ProductOptionService` inside
`product`. Splitting into two *modules* is usually not the alternative, because the cascade graph is
built per module from one models barrel, so tables with foreign keys between them must share one.

### Two-Container Bootstrap

`src/container.ts` creates a shared Awilix container. Each module gets a private local container with its repos. Only the module's service is exposed to the shared container. Modules cannot access each other's internals.

Registration keys: `GET_DB`, `DB_PROVIDER`, `LOGGER`, `LINK`, `EVENT_BUS` (in `ContainerRegistrationKeys`).

### Cross-Module Patterns

- **Link modules** (`src/link-modules/`) — Cross-module join tables and relations. Accessed via `LinkService.repo("cartProduct")`. Two types: writeable (own table + BaseRepository) and readonly (Drizzle relations only + ReadonlyLinkRepository).
- **Workflows** (`src/workflows/`) — Cross-module orchestration with `ctx.step()` calls and compensation for rollback. Executed by a Temporal Worker on node, by a simple in-process engine on workerd. Workflow handlers must stay replay-pure (`check:workflow-purity`).
- **Subscribers** (`src/subscribers/`) — Work caused by something that happened, off the caller's critical path. Two transports with different guarantees, so a subscriber is written idempotent and the event it handles is published from a workflow's final step — `standards/rules/backend/subscribers/__docs__/`, and ADR-0023, ADR-0024.

### Server & Routing

- `src/server/app.ts` — Zero-dependency router: `fetch(Request) → Response`. File-based route discovery from `src/api/`.
- `src/server/platforms.ts` — Platform adapters (Node via Hono, Express with Swagger, Workers).
- `src/server/api-caller.ts` — Backend-as-library adapter for TanStack Start server functions (no HTTP round-trip).
- Route files: `src/api/admin/{resource}/route.ts` export `GET`, `POST`, etc.; `definitions.ts` wires each handler to its schemas, auth and OpenAPI metadata.
- Handlers declare the errors they raise with `throws` — see `docs/middleware-and-openapi.md`. Webhooks under `src/api/hooks/` are the carve-out: they verify by signature inside the handler, because a middleware runs before input validation and signature checks need the raw bytes.
- Query parsing uses `qs` (supports nested operator params like `$eq`, `$in`, `$gte`).

### Key Conventions

- `getDb` is always a factory function `() => Database`, never a direct instance. Repositories call `getDb()` and support transaction context via `getClient(context?)`.
- `createWithTransaction(getDb)` wraps mutations. Services use `this.withTransaction(context, async (ctx) => { ... })`, and an outer method passes `ctx` down so a whole sequence commits or rolls back once.
- Date handling: DB stores `timestamptz` → Drizzle returns `Date` → DTOs use `Date` → API serializes to ISO strings. In `http-schemas`, use `dateToIso` pipeline and `z.input` (not `z.infer`) for entity types.
- Soft-delete by default: every table has `deletedAt`, BaseRepository auto-filters.
- SQL-level prefixed IDs (e.g., `cus_550e8400...`) generated by Postgres.
- `DbProvider` port: Node uses singleton pool; Workers uses per-request connection via AsyncLocalStorage.

## Frontend Apps

Both frontends follow [Bulletproof React](https://github.com/alan2207/bulletproof-react): unidirectional,
feature-based. A feature at `src/features/{name}/` may contain only `api/`, `assets/`,
`components/`, `hooks/`, `stores/`, `types/`, `utils/` — a closed vocabulary, enforced from
`packages/frontend-structure` through each app's `structure/.dependency-cruiser.cjs`. Anything
deeper than that second level is the feature's own business.

The admin is a plain SPA: Vite + TanStack Router, built to a static `dist` and deployed to
Cloudflare Pages. The store is **not** — it is TanStack Start on workerd with selective SSR.
`src/start.ts` sets `defaultSsr: false` because auth tokens and cart IDs live in `localStorage`,
which the server cannot read; `__root__` and `_main` carry `ssr: true` to provide the document shell
and `<Outlet />`, and the two product routes opt in for SEO. Adding a route means deciding which
side it is on — see ADR-0013.

Both apps call the backend through typed clients Orval generates from its OpenAPI spec into
`src/api/generated/` (tags-split mode), over a custom fetcher at `src/lib/fetcher.ts` that
`qs.stringify()`s nested query params. The store additionally calls the backend as a library from
server functions.

### Admin DataTable System (`src/components/data-table/`)

Consumer API: `useDefineTable<T>(config)` returns a table definition passed to `<DataTable use={table} />`.

All table state (pagination, sorting, filters, search) lives in URL params via TanStack Router. Params are prefixed per table instance (e.g., `products_offset`, `products_order`).

Global cell renderers (datetime, date, boolean, text) configured via `configureDataTable()` in `main.tsx`. Cell resolution order: inline `cell` fn → named `render` string → text fallback.

### Route-Driven Modals

Create/edit forms open as child routes using `RouteFocusModal` (full viewport drawer) or `RouteDrawer` (side drawer). `RouteModalForm` wraps TanStack Form with an unsaved-changes guard via `useBlocker()`. See ADR-0019.

### Dependency Rules (dependency-cruiser)

- Admin app must not import store schemas from http-schemas
- `@tanstack/react-table` imports only allowed inside `components/data-table/`
- No circular dependencies; the store's feature graph is acyclic (ADR-0020)

## Testing

### The four test levels

| Level | Where | What it may fake |
| --- | --- | --- |
| Unit | `apps/*/src/**/*.test.ts` (node) | nothing — pure functions |
| Component | `apps/store/src/**/*.browser.test.tsx` (Vitest Browser Mode, real Chromium) | nothing — props in, render out |
| API / integration | `apps/backend/src/**/__tests__` | the third-party gateway, at the module boundary |
| E2E | `apps/*/tests/e2e` (Playwright, real backend) | the third party only — **never our own API** |

**Never fake a response from our own backend in an e2e test.** Faking Stripe is right; faking
`GET /store/payment-methods` is not — it deletes the route, the service and the ordering rule from
the test while leaving it green. A wallet is arranged by *shopping*, and the fake gateway holds what
the checkout saved (`apps/backend/tests/mocks/msw/handlers/stripe-wallet.ts`). If a claim seems to
need a stubbed endpoint, it belongs at a lower level.

**Write fewer, longer tests.** E2E setup is expensive, so one test per *user journey*, not one per
assertion — merge tests that share an arrange phase, and keep them separate only when the persona,
the app or the data shape genuinely differs. Thirteen one-assertion wallet specs are what made
stubbing look necessary in the first place.

**Assert what the shopper sees, not what the database holds.** A DB query in an e2e assertion is a
smell: status changed → assert the badge; record deleted → assert the empty state. DB helpers are
for setup. The same goes for reading request bodies off the wire — the one exception here is
`tests/setup/payment-sessions.ts`, which counts sessions because "no intent until Place order" has
no visual surface at all.

**An assertion that cannot fail is not a test, and a gate that cannot fail is not a gate.** Before
calling either one done, name the mutation it would catch and run that mutation — then restore it,
and say in your reply that you did. Two shapes that are always vacuous: asserting a void call
resolves to `undefined` (the return type guarantees it; a bare `await` already says "did not throw"),
and asserting a list is empty when the test never created anything (that is the starting state, so
it passes against an empty function). The fix is to put a real neighbouring row in the way — link
image A, remove never-linked image B, assert A survived. Same practice for tooling: after changing a
lint or convention gate, reintroduce the violation and confirm it goes red.

Backend tests are integration tests against a real Postgres database. Custom Vitest fixtures in `tests/setup/test-extend.ts` provide:
- `getDb` — Factory function `() => dbInstance`
- `logger` — noopLogger
- `dto.generate` — Faker-based data builders (e.g., `generateCreateProductDTO`)

Tests construct services manually with injected repos. The suite claims its worker databases
(`proteus_test_1..N`) with an advisory lock, so a second vitest run — an orphaned process, or an
editor's watcher — fails rather than corrupting the first.

## Code Style

- **Biome** for linting and formatting (spaces, 120 char lines, single quotes, no semicolons, trailing commas)
- **Never use `snake_case`.** Use `camelCase` for variables, functions, parameters, and properties. Use `PascalCase` for classes, types, and components. Use `CONSTANT_CASE` for enum members and true constants. This is enforced by Biome's `useNamingConvention` rule.
- Backend: TypeScript strict mode with `noUncheckedIndexedAccess`
- Use simple, direct variable names. No unnecessary suffixes like `Result`, `Data`, `Value`, `Info`. Name variables for what they represent, not their type or origin. Never abbreviate variable names (e.g., `namespaceAuthMiddleware` not `nsAuth`, `configuration` not `cfg`, `repository` not `repo`). Clarity over brevity.
- Prefer guard clauses over nested conditionals. Check unusual conditions early and return, keeping the happy path linear and unindented. See `docs/refactoring/guard-clauses.md`.
- Comments should explain *why*, not *what*. Don't restate the code — document the intent, business reason, or non-obvious constraint.
- For best-effort async calls, use `.catch((e) => this.logger.error(e))` instead of wrapping in try/catch with an empty or comment-only catch block.
- Use `Promise.all` with `.map()` instead of `for` loops with `await` inside when iterations are independent.
- Use `type` instead of `interface`. Interfaces allow declaration merging on name overlap, which can cause subtle bugs. Composable `type` aliases with `&` intersections are safer and more predictable. Biome enforces this in admin and store (`useConsistentTypeDefinitions`); the backend is not covered, so there it is a convention you have to keep.
- **Never use non-null assertions (`!`).** Use proper narrowing (guard clauses, `if` checks, `?.`, `?? fallback`, or explicit error throws) instead.
- **Never use `any`.** If the type feels like `unknown`, stop and find a more precise type — a generic, a union, a mapped type, or a named type from the codebase.
- **Tailwind v4 canonical classes.** Always use the short canonical form for Tailwind classes. Write `text-foreground` not `text-(--foreground)` or `text-[var(--foreground)]`. Write `max-w-350` not `max-w-[1400px]`. Only use the `(--var)` syntax for CSS variables that are NOT registered in the `@theme` (e.g., component-scoped variables like `--drawer-height`).

## Documentation

Architecture Decision Records in `docs/adr/` (0001–0024, indexed by `docs/architecture-decisions.md`).

**Before writing or moving any document, read `standards/README.md` — "Where a document goes".** It
carries the decision table and the tie-breakers, and it is the only copy: *how to build a kind of
thing* goes in a `__docs__/` beside the rules that hold it, one file per use case; *how the machine
works* goes in the `README.md` of the code directory, and a directory with nothing mechanical to say
has none; *why* goes in an ADR; vocabulary goes in `CONTEXT.md`; and `docs/` takes only what spans
several areas and is owned by none.

That README is also the front door to the standards themselves — which live in `standards/rules/`,
each app's `structure/.dependency-cruiser.cjs`, `biome.json`, the Spectral ruleset, or
`apps/backend/scripts/checks/` — and defines the words for them in "The words": a standard is a
convention with a check behind it, and a check that is not a rule owes a recorded reason.

Cross-cutting guides in `docs/`: `backend-test-infrastructure.md`, `error-handling.md`,
`middleware-and-openapi.md`, `soft-delete-cascade.md`, `product-options.md`.
The backend's use-case guides live in `standards/rules/backend/*/__docs__/` — `api/` (routes,
route helpers), `modules/` (modules, adding a module), `workflows/` and `subscribers/` (events,
subscribers).

Work in progress lives in `.scratch/<feature>/` — the spec at `.scratch/<feature>/spec.md`, its tickets in
`.scratch/<feature>/issues/`. That is the issue tracker for this repo; GitHub Issues is not used. Once the work
has shipped, a distilled reference spec is written to `docs/specs/<feature>.md` marked `**Status:** shipped.` —
the scratch folder stays as the working record.

Domain vocabulary is in `CONTEXT.md` at the root. It is a glossary only: no implementation detail, no decisions.
Decisions go in an ADR.

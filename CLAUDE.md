# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install
npm install

# Dev servers
npm run --workspace=backend dev          # API at :3000 (Swagger at /admin/docs/, /store/docs/)
npm run --workspace=admin dev            # Admin SPA at :3002
npm run --workspace=store dev         # Storefront at :3001

# Database (Docker Postgres)
npm run --workspace=backend db:start        # Start Postgres
npm run --workspace=backend db:migrate:dev  # Run migrations
npm run --workspace=backend db:generate     # Generate migration after schema change
npm run --workspace=backend db:seed:dev     # Seed dev data

# Testing
npm run --workspace=backend test                          # All backend tests
npx -w backend vitest run src/modules/product             # Single module tests
npx -w backend dotenvx run -f ../../.env.test -- vitest run src/modules/product  # With env

# Linting & type-checking
npm run check                  # Biome lint + format (warnings do not fail)
npm run typecheck              # All workspaces

# Verification gate — run after finishing any implementation task
npm run verify                 # format, then typecheck + lint + convention checks + dependency
                               # rules + backend API tests, in parallel. Lint warnings fail here.
                               # Runs src/api tests only; run the full suite separately before a PR
npm run verify -- --ci         # CI mode: fails on unformatted files instead of rewriting them
                               # (implied when the CI env var is set)

# Code generation
npm run openapi:generate       # Dump OpenAPI spec → regenerate Orval clients (admin + store)
npm run --workspace=admin openapi:client    # Admin Orval client only
npm run --workspace=admin generate-routes   # TanStack Router route tree
```

## Project Structure

Monorepo with npm workspaces:

- `apps/backend` — API server (Ports & Adapters / Hexagonal Architecture)
- `apps/admin` — Admin SPA (TanStack Router + React Query + React Table)
- `apps/store` — Storefront SPA (TanStack Start, backend-as-library)
- `packages/http-schemas` — Shared Zod schemas (exports `./admin` and `./store`)
- `packages/ui` — Component library (shadcn/base-nova style, @base-ui/react primitives)
- `packages/utils` — Shared utilities (date formatting via date-fns)

## Backend Architecture

### Module System

Each module at `apps/backend/src/modules/{name}/` follows an identical layout:
- `models/` — Drizzle table definitions (use `timestamps` helper from `src/core/db/columns.ts`)
- `repositories/` — Extend `BaseRepository(table)`, receive `{ getDb }` factory
- `services/` — Business logic implementing an interface from `src/core/types/`
- `__tests__/` — Integration tests
- `index.ts` — `Module()` factory definition
- `database.config.ts` — Drizzle migration config

Modules: cart, customer, fulfillment, inventory, payment, product, user.

A module too large for one service class splits internally: the module service constructs the
collaborator from its own injected dependencies and keeps it private. Nothing registers or exports
it, so the module's public surface stays exactly one service — see `ProductOptionService` inside
`product`. Splitting into two *modules* is usually not the alternative, because the cascade graph is
built per module from one models barrel, so tables with foreign keys between them must share one.

### Two-Container Bootstrap

`src/container.ts` creates a shared Awilix container. Each module gets a private local container with its repos. Only the module's service is exposed to the shared container. Modules cannot access each other's internals.

Registration keys: `GET_DB`, `DB_PROVIDER`, `LOGGER`, `LINK` (in `ContainerRegistrationKeys`).

### Cross-Module Patterns

- **Link modules** (`src/link-modules/`) — Cross-module join tables and relations. Accessed via `LinkService.repo("cartProduct")`. Two types: writeable (own table + BaseRepository) and readonly (Drizzle relations only + ReadonlyLinkRepository).
- **Workflows** (`src/workflows/`) — Cross-module orchestration with `ctx.step()` calls and compensation for rollback.

### Server & Routing

- `src/server/app.ts` — Zero-dependency router: `fetch(Request) → Response`. File-based route discovery from `src/api/`.
- `src/server/platforms.ts` — Platform adapters (Node via Hono, Express with Swagger, Workers).
- `src/server/api-caller.ts` — Backend-as-library adapter for TanStack Start server functions (no HTTP round-trip).
- Route files: `src/api/admin/{resource}/route.ts` export `GET`, `POST`, etc. Middleware via `middlewares.ts`.
- Query parsing uses `qs` library (supports nested operator params like `$eq`, `$in`, `$gte`).

### Key Conventions

- `getDb` is always a factory function `() => Database`, never a direct instance. Repositories call `getDb()` and support transaction context via `getClient(context?)`.
- `createWithTransaction(getDb)` wraps mutations. Services use `this.withTransaction(context, async (ctx) => { ... })`.
- Date handling: DB stores `timestamptz` → Drizzle returns `Date` → DTOs use `Date` → API serializes to ISO strings. In `http-schemas`, use `dateToIso` pipeline and `z.input` (not `z.infer`) for entity types.
- Soft-delete by default: every table has `deletedAt`, BaseRepository auto-filters.
- SQL-level prefixed IDs (e.g., `cus_550e8400...`) generated by Postgres.
- `DbProvider` port: Node uses singleton pool; Workers uses per-request connection via AsyncLocalStorage.

## Admin App Architecture

### Stack

TanStack Router + React Query + React Table + TanStack Form + Zod v4. Path alias: `#/*` → `./src/*`.

### API Layer

Orval generates typed API clients from the backend's OpenAPI spec into `src/api/generated/` (tags-split mode). Custom fetcher at `src/lib/fetcher.ts` uses `qs.stringify()` for nested query params.

Feature modules wrap generated functions with React Query hooks in `features/{name}/api/`. Every mutation hook accepts an optional `UseMutationOptions` parameter, shows an error toast on failure, and forwards callbacks. See `docs/mutation-hooks.md` for the full pattern.

Every query is an exported `*QueryOptions` factory built with `queryOptions()`; hooks and route loaders both read that one factory, and queries never toast. See `docs/query-hooks.md`.

### DataTable System (`src/components/data-table/`)

Consumer API: `useDefineTable<T>(config)` returns a table definition passed to `<DataTable use={table} />`.

All table state (pagination, sorting, filters, search) lives in URL params via TanStack Router. Params are prefixed per table instance (e.g., `products_offset`, `products_order`).

Global cell renderers (datetime, date, boolean, text) configured via `configureDataTable()` in `main.tsx`. Cell resolution order: inline `cell` fn → named `render` string → text fallback.

### Route-Driven Modals

Create/edit forms open as child routes using `RouteFocusModal` (full viewport drawer) or `RouteDrawer` (side drawer). `RouteModalForm` wraps TanStack Form with an unsaved-changes guard via `useBlocker()`.

### Features Structure

Each feature at `src/features/{name}/` co-locates:
- `api/` — React Query hooks and mutation factories
- `components/` — Feature-specific UI
- `hooks/` — `useDefineTable` config, form hooks

### Form Hooks

Form logic lives in `features/{name}/hooks/use-{action}-form.ts`, not in components. Components only render fields. See `docs/form-hooks.md` for the full pattern.

### Dependency Rules (dependency-cruiser)

- Admin app must not import store schemas from http-schemas
- `@tanstack/react-table` imports only allowed inside `components/data-table/`
- No circular dependencies

## Testing

Backend tests are integration tests against a real Postgres database. Custom Vitest fixtures in `tests/setup/test-extend.ts` provide:
- `getDb` — Factory function `() => dbInstance`
- `logger` — noopLogger
- `dto.generate` — Faker-based data builders (e.g., `generateCreateProductDTO`)

Tests construct services manually with injected repos. Vitest config at `apps/backend/vitest.config.ts` runs tests sequentially (`fileParallelism: false`). Path aliases: `@tests/*`, `@core/*`.

### Test data comes from factories, per test

Every row a test needs is created **by that test** and disposed with it. `apps/store/playwright.config.ts`
sets `fullyParallel: true`, so specs run concurrently against one database and each test's rows are
visible to the others.

- **Never create fixture data in `beforeAll`/`afterAll`.** Two specs owning one set of shared rows is
  a race: whichever finishes first tears down what the other is still using. This has already caused
  `Entity with id "so_..." not found` in checkout. Use `await using` so the lifetime is the test's.
- **Look for an existing factory before writing setup by hand.** `factories.create.*` and
  `factories.destroy.*` come from the `factories` fixture; `apps/backend/tests/factories/db/` is the
  full list. `shippingOptionWithZone` already existed while two specs hand-rolled it in `beforeAll`.
- **Composed factories return their parts plus `Symbol.asyncDispose`, and take `Partial` overrides per
  entity.** `db/product-with-pricing.ts` is the reference; `db/shipping-option-with-zone.ts` follows it.
  A composition used by more than one spec belongs in `db/`; one specific to a single spec stays in
  that spec — see `createProductWithColourways` in `tests/e2e/products.spec.ts` — and returns a
  disposable the same way.
- **Anything globally unique, or listed in the UI, must be unique per test.** Product option titles are
  unique by title, so they are suffixed with the product id. Shipping options are listed together at
  the delivery step, so their name carries a random suffix.
- **Select the row you created — never `.first()`.** A neighbouring test's row may render first and
  will vanish when that test disposes it. Assert against the factory's own return value:
  `getByRole('radio', { name: shipping.name })`.

Global setup (`packages/testing/fixtures/global-setup.ts`) is for provider registrations and schema
only — it truncates every table and seeds payment/fulfillment/notification providers. Merchant or
catalogue data is fixture data and does not belong there.

## Code Style

- **Biome** for linting and formatting (spaces, 120 char lines, single quotes, no semicolons, trailing commas)
- **Never use `snake_case`.** Use `camelCase` for variables, functions, parameters, and properties. Use `PascalCase` for classes, types, and components. Use `CONSTANT_CASE` for enum members and true constants. This is enforced by Biome's `useNamingConvention` rule.
- Frontend: `type` over `interface` (enforced in store app)
- Backend: TypeScript strict mode with `noUncheckedIndexedAccess`
- Use simple, direct variable names. No unnecessary suffixes like `Result`, `Data`, `Value`, `Info`. Name variables for what they represent, not their type or origin. Never abbreviate variable names (e.g., `namespaceAuthMiddleware` not `nsAuth`, `configuration` not `cfg`, `repository` not `repo`). Clarity over brevity.
- Prefer guard clauses over nested conditionals. Check unusual conditions early and return, keeping the happy path linear and unindented. See `docs/refactoring/replace_nested_conditional_with_guard_clauses.txt`.
- Comments should explain *why*, not *what*. Don't restate the code — document the intent, business reason, or non-obvious constraint.
- For best-effort async calls, use `.catch((e) => this.logger.error(e))` instead of wrapping in try/catch with an empty or comment-only catch block.
- Use `Promise.all` with `.map()` instead of `for` loops with `await` inside when iterations are independent.
- Use `type` instead of `interface`. Interfaces allow declaration merging on name overlap, which can cause subtle bugs. Composable `type` aliases with `&` intersections are safer and more predictable.
- **Never use non-null assertions (`!`).** Use proper narrowing (guard clauses, `if` checks, `?.`, `?? fallback`, or explicit error throws) instead.
- **Never use `any`.** If the type feels like `unknown`, stop and find a more precise type — a generic, a union, a mapped type, or a named type from the codebase.
- **Tailwind v4 canonical classes.** Always use the short canonical form for Tailwind classes. Write `text-foreground` not `text-(--foreground)` or `text-[var(--foreground)]`. Write `max-w-350` not `max-w-[1400px]`. Only use the `(--var)` syntax for CSS variables that are NOT registered in the `@theme` (e.g., component-scoped variables like `--drawer-height`).

## Documentation

Architecture Decision Records in `docs/adr/`. Guides at `docs/adding-a-module.md`, `docs/backend-test-infrastructure.md`, `docs/error-handling.md`, `docs/form-hooks.md`, `docs/mutation-hooks.md`, `docs/query-hooks.md`, `docs/middleware-and-openapi.md`, `docs/soft-delete-cascade.md`, `docs/product-options.md`.

A convention that can be checked is checked, and the check is a rule file rather than a script.
Dependency rules go in each app's `deps-analyzer/.dependency-cruiser.cjs`; code-shape rules — what a
file's contents must look like — go in `ast-grep/rules/`, whose tree mirrors the code it governs.
`ast-grep/README.md` says where a new rule goes and how to exempt a considered exception. Reach for
a script only after showing a rule cannot express it.

Work in progress lives in `.scratch/<feature>/` — the spec at `.scratch/<feature>/spec.md`, its tickets in
`.scratch/<feature>/issues/`. That is the issue tracker for this repo; GitHub Issues is not used. Once the work
has shipped, a distilled reference spec is written to `docs/specs/<feature>.md` marked `**Status:** shipped.` —
the scratch folder stays as the working record.

Domain vocabulary is in `CONTEXT.md` at the root. It is a glossary only: no implementation detail, no decisions.
Decisions go in an ADR.

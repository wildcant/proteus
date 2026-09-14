# AGENTS.md

<!-- Personal preferences go in .codex/AGENTS.md. A repository AGENTS.override.md replaces this file. -->

## Instruction Discovery

Read `.codex/AGENTS.md` (if it exists) before starting any task for the personal working agreements used in this project.

Before editing a file, read applicable nested `AGENTS.md` files along its directory path (or
`AGENTS.override.md` where present). Follow their pointers to relevant standards. Documentation
paths in these instructions are relative to the repository root unless explicitly stated otherwise.

## Commands

```bash
# Install
pnpm install
pnpm run setup

# Dev (six processes + Docker)
docker compose -f apps/backend/docker-compose.yml up -d --wait postgres temporal temporal-ui
pnpm --filter backend run dev               # API :3000
pnpm --filter backend run worker:dev        # Temporal Worker (workflows)
pnpm --filter backend run worker:events:dev # Temporal Worker (subscribers)
pnpm --filter backend run worker:cron:dev   # Temporal Worker (jobs/cron)
pnpm --filter store run dev                 # Storefront :3001
pnpm --filter admin run dev                 # Admin :3002

# Database
pnpm --filter backend run db:migrate:dev
pnpm --filter backend run db:generate
pnpm --filter backend run db:seed:dev
pnpm --filter backend run db:test:up
pnpm --filter backend run stack:reset  # wipes proteus + Temporal DBs, then migrate + seed

# Testing
pnpm --filter backend run test
pnpm --filter backend run test:gate
pnpm --filter backend exec vitest run src/modules/product
pnpm --filter store run test
pnpm --filter store run test:e2e
pnpm --filter admin run test:e2e

# Linting & type-checking
pnpm run check
pnpm run typecheck
pnpm run check:standards

# Code generation — all outputs committed; never hand-edit a .gen.ts file
pnpm run openapi:generate
pnpm --filter backend run workflows:generate
pnpm --filter backend run subscribers:generate
pnpm --filter backend run jobs:generate
pnpm --filter backend run schema:generate
pnpm --filter admin run generate-routes
```

## Verification

- After implementation tasks, run `pnpm run verify` (formats files and runs the standard gates).
  Use `pnpm run verify --ci` when formatting must be checked without rewriting files.
- **Store-only implementation**: skip `pnpm run verify`. Run
  `pnpm exec biome check --write apps/store/src` and `pnpm --filter store run typecheck`, then verify visually.
- **Documentation-only changes**: check the diff and referenced paths; implementation gates are not required.
- **Never run Playwright e2e unprompted.** Offer it, don't run it. This includes
  `pnpm run verify:full`, which runs storefront and admin e2e suites alongside other tests
  and does not run static checks. Run it only when the user requests that suite or authorizes its e2e tests.

## Dependencies

Adding an import to a workspace means adding the package to that workspace's `package.json`.
Shared versions use `"catalog:"` in manifests, resolved in `pnpm-workspace.yaml`. Siblings use
`"workspace:*"`. `verify` fails on duplicate versions or unused declarations.

## Backend Architecture

<!-- Detail for each area is in .claude/rules/backend-*.md, loaded when touching those paths. -->
Read the applicable `AGENTS.md` in `apps/backend/src/{core,framework,modules,workflows,subscribers,api}/`
for pointers to detailed standards.

- **`core/`** = vocabulary and ports. **`framework/`** = containers, adapters, transports. `framework/` imports `core/`, never the reverse. Layers below (`modules/`, `workflows/`, `subscribers/`) import `core/` only.
- **Modules** follow a closed layout at `src/modules/{name}/`. Tables with foreign keys between them share one module.
- **Module isolation**: one shared Awilix container + one private container per module. Only the service is exposed — use link modules or workflows for cross-module work.
- **Link modules** (`src/link-modules/`) — cross-module join tables via `LinkService.repo()`.
- **Workflows** (`src/workflows/`) — cross-module mutations with compensation.
- **Subscribers** (`src/subscribers/`) — async side-effects, idempotent, published from a workflow's final step.
- **Endpoints** = `route.ts` (handler + schemas) + `definitions.ts` (auth, matcher, OpenAPI).

## Frontend Apps

<!-- Detail in .claude/rules/frontend-*.md, loaded when touching those paths. -->
Read `apps/store/src/AGENTS.md` or `apps/admin/src/AGENTS.md` for pointers to detailed frontend standards.

Both apps follow Bulletproof React: features at `src/features/{name}/` with a closed set of subfolders (`api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`).

The store uses TanStack Start on workerd with selective SSR — adding a route means choosing server vs. client (ADR-0013). A server-rendered route cannot detect viewport, so structure changes between breakpoints need two DOM trees or a stacking layout, never a client-side media query.

Both apps use Orval-generated clients in `src/api/generated/` over `src/lib/fetcher.ts`.

## Testing

- **Never fake our own backend in e2e.** Fake the third-party gateway only.
- **Write fewer, longer tests.** One test per user journey, not per assertion.
- **UI/e2e tests assert what the user sees.** Backend persistence tests may assert database state.
- **An assertion that cannot fail is not a test.** For each new or changed test, identify the behavior change it catches.
  For regression tests, temporarily reintroduce the bug, confirm the test fails, then restore the fix.
- Backend tests run against real Postgres. Fixtures in `tests/setup/test-extend.ts` provide `getDb`, `logger`, `dto.generate`.

## Code Style

- **Biome**: spaces, 120 chars, single quotes, no semicolons, trailing commas.
- **Naming**: `camelCase` variables/functions/properties, `PascalCase` classes/types/components, `CONSTANT_CASE` enum members. Use `snake_case` only when required by an external contract or an established API.
- **Variables**: name for what they represent, no suffixes (`Result`, `Data`), no abbreviations (`repo`, `cfg`) in new variable names. Preserve established API names such as `LinkService.repo()`.
- **Guard clauses** over nested conditionals.
- **Comments**: *why*, not *what*.
- **Async best-effort**: `.catch((e) => this.logger.error(e))`, not try/catch with empty catch.
- **`Promise.all`** with `.map()` for independent iterations.
- **`type`** over `interface` everywhere.
- **No barrels**, no non-null assertions (`!`), no `any`.
- **Tailwind v4**: canonical short forms. `text-foreground` not `text-(--foreground)`. `(--var)` syntax only for CSS vars not in `@theme`.

## Project Conventions

- **Tickets are read-only.** Never edit `.scratch/<feature>/issues/` files. Read the **Blocked by** line first. Skim the next ticket before designing — it may reshape the current one.
- **No guards against hypothetical users.** Solo developer, not in production. Delete the thing instead of guarding it. Fewer moving parts over safety nets.
- **Document the present, not the past.** If a passage only records that something changed, delete it — that belongs in git history or an ADR.
- **Check Shopify and Medusa before inventing a guard.** For "what should the admin do when X", check both before designing. Bring divergences as named decisions, not objections.
- **Never name the reference brand** in code, comments, CSS, or `.scratch/`. Use "the reference" or `<Brand>`.
- **Mobile-first storefront.** Phone layout as base classes; `sm:`/`lg:` only to add. Never desktop-first undone with `lg:hidden`.

# AGENTS.md

<!-- Personal preferences go in AGENTS.override.md, never here. -->

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

# Verification gate — run after finishing any implementation task
pnpm run verify       # ~60s. formats + twelve parallel gates
pnpm run verify --ci  # fails on unformatted files instead of rewriting
pnpm run verify:full  # all tests in parallel, no static checks

# Code generation — all outputs committed; never hand-edit a .gen.ts file
pnpm run openapi:generate
pnpm --filter backend run workflows:generate
pnpm --filter backend run subscribers:generate
pnpm --filter backend run jobs:generate
pnpm --filter backend run schema:generate
pnpm --filter admin run generate-routes
```

## Dependencies

Adding an import to a workspace means adding the package to that workspace's `package.json`.
Shared versions use `"catalog:"` in manifests, resolved in `pnpm-workspace.yaml`. Siblings use
`"workspace:*"`. `verify` fails on duplicate versions or unused declarations.

## Backend Architecture

<!-- Detail for each area is in .claude/rules/backend-*.md, loaded when touching those paths. -->

- **`core/`** = vocabulary and ports. **`framework/`** = containers, adapters, transports. `framework/` imports `core/`, never the reverse. Layers below (`modules/`, `workflows/`, `subscribers/`) import `core/` only.
- **Modules** follow a closed layout at `src/modules/{name}/`. Tables with foreign keys between them share one module.
- **Module isolation**: one shared Awilix container + one private container per module. Only the service is exposed — use link modules or workflows for cross-module work.
- **Link modules** (`src/link-modules/`) — cross-module join tables via `LinkService.repo()`.
- **Workflows** (`src/workflows/`) — cross-module mutations with compensation.
- **Subscribers** (`src/subscribers/`) — async side-effects, idempotent, published from a workflow's final step.
- **Endpoints** = `route.ts` (handler + schemas) + `definitions.ts` (auth, matcher, OpenAPI).

## Frontend Apps

<!-- Detail in .claude/rules/frontend-*.md, loaded when touching those paths. -->

Both apps follow Bulletproof React: features at `src/features/{name}/` with a closed set of subfolders (`api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`).

The store uses TanStack Start on workerd with selective SSR — adding a route means choosing server vs. client (ADR-0013). A server-rendered route cannot detect viewport, so structure changes between breakpoints need two DOM trees or a stacking layout, never a client-side media query.

Both apps use Orval-generated clients in `src/api/generated/` over `src/lib/fetcher.ts`.

## Testing

- **Never fake our own backend in e2e.** Fake the third-party gateway only.
- **Write fewer, longer tests.** One test per user journey, not per assertion.
- **Assert what the user sees**, not what the DB holds.
- **An assertion that cannot fail is not a test.** Before calling it done, name the mutation it catches, run it, then restore it.
- Backend tests run against real Postgres. Fixtures in `tests/setup/test-extend.ts` provide `getDb`, `logger`, `dto.generate`.

## Code Style

- **Biome**: spaces, 120 chars, single quotes, no semicolons, trailing commas.
- **Naming**: `camelCase` variables/functions/properties, `PascalCase` classes/types/components, `CONSTANT_CASE` enum members. Never `snake_case`.
- **Variables**: name for what they represent, no suffixes (`Result`, `Data`), no abbreviations (`repo`, `cfg`).
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
- **Store-only work**: skip `pnpm verify`. Run `pnpm exec biome check --write apps/store/src` + `pnpm --filter store run typecheck`, then verify visually.
- **Never run Playwright e2e unprompted.** Offer it, don't run it.

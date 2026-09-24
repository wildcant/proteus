# AGENTS.md

<!-- Personal preferences go in .codex/AGENTS.md. A repository AGENTS.override.md replaces this file. -->

## Instruction Discovery

Read `.codex/AGENTS.md` (if exist) before start task. Have personal working agreement for project.

Before edit file, read nested `AGENTS.md` along directory path (or `AGENTS.override.md` if there). Follow pointer to standard. Doc path relative to repo root unless say otherwise.

## Commands

```bash
# Install
pnpm install
pnpm run setup

# Dev (seven processes + Docker)
docker compose -f apps/backend/docker-compose.yml up -d --wait postgres temporal temporal-ui
pnpm --filter backend run dev               # API :3000
pnpm --filter backend run worker:dev        # Temporal Worker (workflows)
pnpm --filter backend run worker:events:dev # Temporal Worker (subscribers)
pnpm --filter backend run worker:cron:dev   # Temporal Worker (jobs/cron)
pnpm --filter store run dev                 # Storefront :3001
pnpm --filter admin run dev                 # Admin :3002
pnpm run dev:translations                   # Lingui watcher (backend compile, store + admin extract)

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

- After implementation task, run `pnpm run verify` (format file, run standard gate).
  Use `pnpm run verify --ci` when must check format without rewrite file.
- **Store-only implementation**: skip `pnpm run verify`. Run
  `pnpm exec biome check --write apps/store/src` and `pnpm --filter store run typecheck`, then check with eye.
- **Documentation-only changes**: check diff and referenced path. No need implementation gate.
- **Never run Playwright e2e unprompted.** Offer it, no run it. This include
  `pnpm run verify:full`, which run storefront and admin e2e suite with other test
  and no run static check. Run only when user ask for suite or allow e2e test.

## Dependencies

Add import to workspace mean add package to that workspace `package.json`.
Shared version use `"catalog:"` in manifest, resolve in `pnpm-workspace.yaml`. Sibling use
`"workspace:*"`. `verify` fail on duplicate version or unused declaration.

## Backend Architecture

<!-- Detail for each area is in .claude/rules/backend-*.md, loaded when touching those paths. -->
Read applicable `AGENTS.md` in `apps/backend/src/{core,framework,modules,workflows,subscribers,api}/`
for pointer to detailed standard.

- **`core/`** = vocabulary and port. **`framework/`** = container, adapter, transport. `framework/` import `core/`, never reverse. Layer below (`modules/`, `workflows/`, `subscribers/`) import `core/` only.
- **Modules** follow closed layout at `src/modules/{name}/`. Table with foreign key between them share one module.
- **Module isolation**: one shared Awilix container + one private container per module. Only service exposed — use link module or workflow for cross-module work.
- **Link modules** (`src/link-modules/`) — cross-module join table via `LinkService.repo()`.
- **Workflows** (`src/workflows/`) — cross-module mutation with compensation.
- **Subscribers** (`src/subscribers/`) — async side-effect, idempotent, publish from workflow final step.
- **Endpoints** = `route.ts` (handler + schema) + `definitions.ts` (auth, matcher, OpenAPI).

## Frontend Apps

<!-- Detail in .claude/rules/frontend-*.md, loaded when touching those paths. -->
Read `apps/store/src/AGENTS.md` or `apps/admin/src/AGENTS.md` for pointer to detailed frontend standard.

Both app follow Bulletproof React: feature at `src/features/{name}/` with closed set of subfolder (`api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`).

Store use TanStack Start on workerd with selective SSR — add route mean choose server vs. client (ADR-0013). Server-rendered route no can detect viewport, so structure change between breakpoint need two DOM tree or stacking layout, never client-side media query.

Both app use Orval-generated client in `src/api/generated/` over `src/lib/fetcher.ts`.

## Testing

- **Never fake our own backend in e2e.** Fake third-party gateway only.
- **Write fewer, longer tests.** One test per user journey, no per assertion.
- **UI/e2e tests assert what the user sees.** Backend persistence test can assert database state.
- **An assertion that cannot fail is not a test.** For each new or changed test, name behavior change it catch.
  For regression test, put bug back for moment, confirm test fail, then restore fix.
- Backend test run against real Postgres. Fixture in `tests/setup/test-extend.ts` give `getDb`, `logger`, `dto.generate`.

## Code Style

- **Biome**: space, 120 char, single quote, no semicolon, trailing comma.
- **Naming**: `camelCase` variable/function/property, `PascalCase` class/type/component, `CONSTANT_CASE` enum member. Use `snake_case` only when external contract or established API demand it.
- **Variables**: name for what they mean, no suffix (`Result`, `Data`), no abbreviation (`repo`, `cfg`) in new variable name. Keep established API name such as `LinkService.repo()`.
- **Guard clauses** over nested conditional.
- **Comments**: *why*, not *what*.
- **Async best-effort**: `.catch((e) => this.logger.error(e))`, not try/catch with empty catch.
- **`Promise.all`** with `.map()` for independent iteration.
- **`type`** over `interface` everywhere.
- **No barrels**, no non-null assertion (`!`), no `any`.
- **Tailwind v4**: canonical short form. `text-foreground` not `text-(--foreground)`. `(--var)` syntax only for CSS var not in `@theme`.

## Project Conventions

- **Tickets are read-only.** Never edit `.scratch/<feature>/issues/` file. Read **Blocked by** line first. Skim next ticket before design — it may reshape current one.
- **No guards against hypothetical users.** Solo developer, not in production. Delete thing instead of guard it. Fewer moving part over safety net.
- **Document the present, not the past.** If passage only record that something change, delete it — that belong in git history or ADR.
- **Check Shopify and Medusa before inventing a guard.** For "what should the admin do when X", check both before design. Bring divergence as named decision, not objection.
- **Never name the reference brand** in code, comment, CSS, or `.scratch/`. Use "the reference" or `<Brand>`.
- **Mobile-first storefront.** Phone layout as base class; `sm:`/`lg:` only to add. Never desktop-first undone with `lg:hidden`.
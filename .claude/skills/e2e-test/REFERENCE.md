# Playwright Patterns

## Core Principles

1. **Assert what users see** — Test visible outcomes, not implementation details. See assertion priority rules below.
2. **Real server, real DB** — Tests run against the actual app with a real Postgres database. No mocking the backend — setup creates real state, tests verify real behavior.
3. **Fewer, longer tests** — Group related assertions into one test per user journey. Don't split steps that share the same setup (authenticate, seed, navigate) into separate `test()` blocks — the duplicated arrange phase is expensive and the isolation is false. Multiple act-assert cycles within one test are encouraged. See "Test Granularity" section below.
4. **Explore before you assert** — Use Playwright MCP tools (`browser_snapshot`, `browser_find`) to inspect the actual DOM before writing selectors.
5. **Auth as feature vs auth as setup** — When testing login itself, go through the UI flow. When testing something *behind* login, treat auth as setup via `authenticate()`.

## Assertion Priority Rules
1. **`getByRole`** — most preferred; semantic, matches how users/assistive tech interact. Always pass `{ name }` to scope by accessible name.
2. **`getByLabel`** — scopes to a labeled region; chain with `getByText` to assert content within it.
3. **`getByText`** — prefer scoped (chained after getByRole/getByLabel) over page-wide.
4. **`toHaveURL`** — least preferred; only use when the URL itself is being tested (e.g. redirects). Use regex when query params may vary: `await expect(page).toHaveURL(/\/products/)`.

Scope assertions: chain locators to narrow context rather than asserting broadly.
- `page.getByLabel('My note').getByText('content')` over `page.getByText('content')`

## Layered Test Infrastructure

```
@proteus/testing package      → Shared fixtures, factories, global setup
  packages/testing/fixtures/  → test-extend.ts (test, navigate, authenticate, factories, cleanup)
  packages/testing/fixtures/  → global-setup.ts (truncate all tables, clear auth cache)
  packages/testing/db/        → Drizzle client for test DB

Backend factories             → DB record creation with automatic disposal
  apps/backend/tests/factories/db/ → createUser, createProduct, createProductVariant, createCustomer
  apps/backend/src/test-exports.ts → Re-exports factories as `backend/test`

App configs
  apps/admin/playwright.config.ts  → baseURL :3012, webServer starts backend + admin
  apps/store/playwright.config.ts  → baseURL :3011, webServer starts backend + store
```

## Fixtures

All fixtures are defined in `packages/testing/fixtures/test-extend.ts` and available in every test via `import { test, expect } from '@proteus/testing'`.

### `navigate({ to, params? })`
Type-safe navigation using TanStack Router path interpolation. Calls `page.goto()` with `waitUntil: 'networkidle'`.
- **Always use `navigate`** — never call `page.goto()` directly.

### `authenticate({ as: 'admin' | 'customer' })`
Session setup via `playwright-persona`. Creates a real user in the DB, logs in through the UI, and caches the session for reuse across tests in the same worker.

### `factories`
- `factories.create.*` — Insert into DB with `await using` for auto-cleanup. Returns the full row + `Symbol.asyncDispose`.
  - `factories.create.user()`, `factories.create.customer()`, `factories.create.product({ status: 'published' })`, `factories.create.productVariant({ productId })`
- `factories.generate.*` — Pure data generators (no DB). For form values and DTOs.
  - `factories.generate.user()`, `factories.generate.product()`, `factories.generate.loginForm()`, `factories.generate.customerSignupForm()`

### `cleanup`
For side-effect data the app creates during the test. Register teardown callbacks:
```ts
cleanup.add(() => deleteProductById(createdId))
```
Callbacks run in reverse order after the test, before `await using` disposes.

## Test Data Factories (`apps/backend/tests/factories/db/`)

Three kinds of generators exist. Each has a distinct purpose — don't mix them.

### 1. DB generators — `generateX(overrides?: Partial<CreateX>): CreateX`
Pure functions that return a full DB insert shape. Used by `createX()` to seed data directly.
- **Strictly typed** — accepts `Partial<CreateX>`, returns `CreateX` (Drizzle `$inferInsert` types from the module's schema).
- **Every field faked** — no partial subsets. All columns get a realistic value via `@faker-js/faker`.
- **Booleans** → `faker.datatype.boolean()` — never hardcode `true`/`false`.
- **Enums/status** → `faker.helpers.arrayElement([...all values])` — check the Drizzle schema enum definition first.
- **Numeric columns** → use the appropriate `faker.number.*` with realistic ranges.
- **Prefixed IDs** → fake with proper prefixes matching the module (`prod_`, `cus_`, `usr_`, `variant_`).
- **FK fields** that reference a NOT NULL column use a placeholder ID (e.g. `prod_${faker.string.alphanumeric(32)}`). `createX` always overrides them.
- Always end with `...overrides` spread.

### 2. Form-value generators — `generateXFormValues()`
Lightweight objects shaped for UI form fields in E2E tests. Located in `packages/testing/factories/form-values.ts`.
- `generateLoginFormValues()` → `{ email, password }`
- `generateRegisterFormValues()` → `{ firstName, lastName, email, password }`
- These are **not** DB insert types — they map to what a form expects, not what a table stores.

### 3. `createX()` — persist + dispose
Calls `generateX(overrides)` and inserts into the DB via Drizzle. Returns the full DB row + `[Symbol.asyncDispose]()`.
- For entities with auth (user, customer): also creates `authIdentity` + `providerIdentity` rows, and returns the plaintext `password` alongside the DB row.
- The dispose function deletes the record and its auth rows (cascading manually where needed).
- Each factory also exports a standalone `deleteXById()` for use with the `cleanup` fixture.

### Adding a new factory
1. Create `apps/backend/tests/factories/db/{entity}.ts` with `generateX`, `createX`, and `deleteXById`.
2. Re-export from `apps/backend/tests/factories/db/index.ts`.
3. Add to the `factories` fixture in `packages/testing/fixtures/test-extend.ts` (both `generate` and `create`).

## Test Data & Cleanup

### Setup data — `await using`
```ts
await using product = await factories.create.product({ status: 'published' })
await using variant = await factories.create.productVariant({ productId: product.id })
```
Cleanup runs automatically even if the test fails.

### Side-effect data — `cleanup` fixture
When the app creates records during a test (e.g. creating a product through the UI):
```ts
const createdId = page.url().split('/products/')[1]?.split('/')[0]
if (createdId) cleanup.add(() => deleteProductById(createdId))
```
Register cleanup as early as possible — right after you know *what* the app will create.

### Rules
- **Never use global bulk deletes** in tests. `globalSetup` truncates all tables before the run; individual tests scope deletes to their own data.
- Import `deleteProductById`, `deleteUserById`, etc. from `backend/test` — never query the DB directly in test files.

## No Direct DB Access in Test Files

Test files (`apps/{admin,store}/tests/e2e/*.spec.ts`) must **never** import `db`, `schema`, or query the database directly. All DB reads and writes go through factory functions from `backend/test`.

- Before creating a new helper, check if one already exists in `apps/backend/tests/factories/db/`.
- If none exists, add it there — never inline the query in the spec file.
- This keeps tests focused on UI behavior and centralizes DB access for easier maintenance and reuse.

## Test Granularity — Fewer, Longer Tests

Based on Kent C. Dodds' ["Write Fewer, Longer Tests"](https://kentcdodds.com/blog/write-fewer-longer-tests). E2E setup is expensive (browser, auth, navigation, DB seeding), so this applies even more strongly than in unit tests.

**Merge when tests share the same arrange phase.** If two tests authenticate the same persona, seed similar data, and navigate to the same page — combine them into one test with multiple act-assert cycles.

**One test per user journey, not one test per assertion.** A journey like "list products, create product, view detail, edit, delete" is one test, not five.

**Keep tests separate when the setup genuinely differs:**
- Different personas (admin vs customer)
- Different apps (admin vs store)
- Different data shapes (published product vs draft)

## Visual Assertions Over DB Assertions

E2E tests verify the **user experience**, not database state. Always prefer asserting what the user sees on screen over querying the DB to check a value.

- **Status changed?** → Assert the badge/label text in the UI, not `row.status` in the DB.
- **Record deleted?** → Assert the empty state message or that the row disappeared from the table, not that a DB query returns `undefined`.
- **Record created?** → Assert the toast, redirect, or new row in the list — not that a DB query returns a row.
- **DB queries in assertions are a code smell.** If the only way to verify an outcome is a DB query, question whether the UI is surfacing the information — it usually is (toast, badge, empty state, redirect).
- **DB helpers are for setup, not assertions.** Use `factories.create.*` to arrange test data, then assert exclusively through the page.

## Known Component Issues

### base-ui Drawer — `aria-hidden` blocks `getByRole`

The `@base-ui/react` Drawer (used by `RouteDrawer` in the admin app) renders **two portal instances** when opened via direct navigation (`page.goto`). Both portals get `aria-hidden="true"` and `data-base-ui-inert`, which means:
- `getByRole('button')` returns 0 results inside the drawer
- `getByRole('dialog')` returns 0 results
- The first portal is stale and intercepts pointer events

**Workaround:** Use CSS selectors scoped to the last `[role="dialog"]`:
```ts
const drawer = page.locator('[role="dialog"]').last()
await drawer.locator('input[placeholder="Product title"]').fill(updatedTitle)
await drawer.locator('button', { hasText: 'Save' }).click()
```

This does NOT affect `RouteFocusModal` — only `RouteDrawer`.

## Authentication Patterns
- **Testing auth as a feature**: Create user via `factories.create.user()`, go through login flow, assert outcome.
- **Testing behind auth**: Use `authenticate({ as: 'admin' })` — handles persona creation, login, and session caching.
- When verifying session state, use `expect().toBeVisible()` (assertion), not `.isVisible()` (boolean return).

## MSW in Backend Tests

MSW (`msw/node`) is used in **backend integration tests** to mock third-party APIs (currently Resend for emails). This is separate from E2E tests.

- `apps/backend/tests/mocks/handlers.ts` — Aggregates handler arrays
- `apps/backend/tests/mocks/resend.ts` — Mocks `api.resend.com/emails`
- `apps/backend/tests/mocks/on-unhandled-request.ts` — Whitelist: only `localhost`/`127.0.0.1` passes through; everything else throws

E2E tests do **not** use MSW — they hit the real backend which uses MSW to mock its own outbound calls.

## Debugging Parallel Test Interference

When a test passes in isolation but fails with parallel workers, another test is likely mutating shared data. **Never apply speculative fixes** (extra timeouts, retries, arbitrary waits) — find the root cause first.

### Step 1: Bisect — find the conflicting file pair

Use the CLI to narrow down which file causes the conflict — no code changes needed:

```bash
# Confirm the test passes alone
npx -w admin playwright test products.spec.ts

# Pair it with suspect files to find the conflict
npx -w admin playwright test products.spec.ts auth.spec.ts --workers=2

# Or exclude a file from the full suite to confirm
npx -w admin playwright test --ignore-pattern="**/auth.spec.ts" --workers=4
```

### Step 2: Trace — capture evidence of what went wrong

Once you've found the conflicting pair, re-run with tracing enabled to get a full timeline:

```bash
npx -w admin playwright test products.spec.ts auth.spec.ts --workers=2 --trace on
```

Then inspect the trace:

```bash
npx playwright show-trace ./test-results/<failing-test>/trace.zip
```

### Step 3: Diagnose — identify the root cause

Look for these common interference patterns in the offending test:
- **Global bulk deletes** — `DELETE FROM table` with no WHERE clause cascading to other tests' data via FKs
- **Shared table mutations** — writes/updates to rows that other tests read
- **Non-scoped cleanup** — teardown that nukes all records instead of just the test's own

### Step 4: Fix — scope the mutation

Only after confirming the root cause, apply a targeted fix. The fix is almost always scoping the mutation to the test's own data (by ID, product ID, user ID, etc.) rather than operating globally.

## Config Patterns

- `webServer` in `playwright.config.ts` auto-starts the backend + app before tests
- `webServer.env` **replaces** the inherited process env — any env var the app needs at startup must be passed explicitly
- `reuseExistingServer: true` skips startup when dev servers are already running (faster local iteration)

## Debugging

### UI Mode
Launch with `npx -w admin playwright test --ui` for a full visual debugging environment with watch mode.

### Trace Viewer
```bash
npx -w admin playwright test --trace on          # Capture trace
npx playwright show-trace ./test-results/*/trace.zip  # Inspect
```
Traces show DOM snapshots, network requests, console logs, and timing.

### Playwright MCP
Use Playwright MCP tools (`browser_navigate`, `browser_snapshot`, `browser_find`, `browser_click`) to interactively explore the UI and verify selectors before writing test code.

---
name: e2e-test
description: Write Playwright E2E tests following best practices. Use when creating, editing, or debugging E2E test files.
allowed-tools: Read Grep Glob Bash(pnpm --filter admin exec playwright *) Bash(pnpm --filter store exec playwright *) mcp__playwright__*
---

## Project-Specific Setup

Two apps have E2E tests: **admin** (`apps/admin`) and **store** (`apps/store`).
Both share the `@proteus/testing` package (`packages/testing/`) for fixtures, factories, and global setup.

### Key files
- `packages/testing/fixtures/test-extend.ts` — Custom Playwright fixtures (`test`, `expect`, `navigate`, `authenticate`, `factories`, `cleanup`)
- `packages/testing/fixtures/global-setup.ts` — Truncates all public tables + clears auth cache before the run
- `packages/testing/db/client.ts` — Drizzle client for test DB (`127.0.0.1:5433/proteus_test`)
- `packages/testing/factories/form-values.ts` — Form-value generators (`generateLoginFormValues`, `generateRegisterFormValues`)
- `apps/backend/tests/factories/db/` — DB factories (`createUser`, `createProduct`, `createProductVariant`, `createCustomer`) exported via `backend/test`
- `apps/admin/playwright.config.ts` — Admin config (baseURL `:3012`, webServer starts backend + admin)
- `apps/store/playwright.config.ts` — Store config (baseURL `:3011`, webServer starts backend + store)
- `apps/{admin,store}/tests/e2e/*.spec.ts` — Test files

### Test data rules
- **Use `factories` fixture** — `factories.create.*` for DB records, `factories.generate.*` for data shapes
- **Use `await using`** with `Symbol.asyncDispose` for automatic cleanup — never leave orphaned test data
- **Use `cleanup` fixture** for side-effect data the app creates during the test (e.g. `cleanup.add(() => deleteProductById(id))`)
- **Auth uses `playwright-persona`** — `authenticate({ as: 'admin' })` or `authenticate({ as: 'customer' })` with automatic session caching
- **Never create fixture data in `beforeAll`/`afterAll`** — specs run in parallel (`fullyParallel: true`) against one database, so shared rows owned by two specs race and one tears down what the other is using. Create per test with `await using`.
- **Check `apps/backend/tests/factories/db/` before hand-rolling setup** — a composed factory may already exist (`shippingOptionWithZone`, `productWithPricing`). Composed factories take `Partial` overrides per entity and return their parts plus `Symbol.asyncDispose`; `db/product-with-pricing.ts` is the reference.
- **Make globally-unique or UI-listed values unique per test** — option titles are suffixed with the product id, shipping option names with a random string, because other tests' rows render alongside yours.
- **Select the row you created, never `.first()`** — a neighbour's row may render first and disappear when that test disposes it: `getByRole('radio', { name: shipping.name })`.

### Where a test goes
- **One spec per domain, not per surface.** Before creating a new `*.spec.ts`, check whether one for
  that domain already exists and add to it — `product-media.spec.ts` was written alongside
  `products.spec.ts` and merged back into it. A suite split per screen stops being navigable.
  Put the primary journey first in the file.
- **A separate spec needs a reason you can name**, and it is about what is being exercised rather
  than about size: `checkout-payment`, `checkout-async-payment` and `saved-cards` are three specs
  because they cover a card payment, the classification of a payment still settling, and a wallet
  across two surfaces — different claims, not different screens.
- **Shared helpers that are not Playwright fixtures go in `tests/setup/utils.ts`**, imported as
  `'../setup/utils.js'`. `imageFile` there returns an in-memory PNG for `setInputFiles`, so upload
  tests need no fixture files on disk.

### Running tests
```bash
pnpm --filter admin exec playwright test                    # All admin tests
pnpm --filter admin exec playwright test products           # Single test file
pnpm --filter store exec playwright test                    # All store tests
pnpm --filter admin exec playwright test --ui               # UI mode for debugging
pnpm --filter admin exec playwright test --trace on         # Capture trace for debugging
```

## Instructions

1. Explore the UI with Playwright MCP tools before writing assertions — use `browser_snapshot` / `browser_find` to get the accessibility tree and verify selectors against the actual rendered DOM
2. One test per *user journey*, not per assertion — E2E setup is expensive, so merge tests that
   share an arrange phase and keep them apart only when the persona, the app or the data shape
   genuinely differs. Create isolated data per test and clean up after.
3. Assert what users see, not implementation details
4. Run the test after writing it — verify it passes before moving on

## Known Gotchas

### base-ui Drawer `aria-hidden` issue
The `@base-ui/react` Drawer (used by `RouteDrawer`) renders **two portal instances** when opened, both with `aria-hidden="true"`. This means `getByRole` queries find nothing inside the drawer. Use CSS selectors scoped to the last dialog instead:
```ts
const drawer = page.locator('[role="dialog"]').last()
await drawer.locator('input[placeholder="..."]').fill('value')
await drawer.locator('button', { hasText: 'Save' }).click()
```

## Reference

For detailed patterns, consult [REFERENCE.md](REFERENCE.md) when needed:
- Assertion priority and locator scoping
- Test infrastructure layers and fixture design
- Authentication, data cleanup, and API mocking patterns
- Debugging with UI mode and trace viewer

$ARGUMENTS

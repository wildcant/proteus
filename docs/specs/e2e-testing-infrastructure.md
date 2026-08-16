# E2E Testing Infrastructure

## Problem Statement

Proteus has 103 backend integration tests but zero frontend tests. The admin and store apps have no way to verify that authentication flows, page rendering, form submissions, and navigation work correctly end-to-end. Regressions in the frontend or in the contract between frontend and backend are caught manually. The project needs Playwright E2E tests with proper data seeding, session management, external service mocking, and automatic cleanup — matching the patterns already proven in a sister project.

## Solution

Add Playwright E2E testing infrastructure across the monorepo. A new `packages/testing` package provides shared fixtures (type-safe navigation, multi-persona authentication, cleanup queues) and data factories (direct DB insert with disposable cleanup). Each frontend app gets its own Playwright config and test directory. The backend gains MSW server-side mocking for external services (Resend) and a `./test` export entry point for its Drizzle table definitions. Initial test coverage targets auth flows and product pages for both admin and store apps.

## User Stories

1. As a developer, I want to run `npm run --workspace=admin test:e2e` to execute all admin E2E tests, so that I can verify admin app behavior before merging.
2. As a developer, I want to run `npm run --workspace=store test:e2e` to execute all store E2E tests, so that I can verify storefront behavior before merging.
3. As a developer, I want to run `npm run test:e2e -- --ui` in either app to launch Playwright's visual UI mode, so that I can iterate on tests with a live feedback loop.
4. As a developer, I want tests to start the backend and frontend dev servers automatically via Playwright's webServer config, so that I don't need to manually start services before running tests.
5. As a developer, I want tests to reuse an already-running backend server when developing locally, so that I can keep the backend up in a separate terminal without conflicts.
6. As a developer, I want a `navigate` fixture that provides type-safe TanStack Router navigation with path interpolation, so that test navigation is consistent with the app's route definitions.
7. As a developer, I want an `authenticate` fixture backed by `playwright-persona` that caches sessions to disk, so that auth setup runs once per persona and subsequent tests reuse the cached session.
8. As a developer, I want an `admin` persona that creates a fully loginable user via direct DB insert (auth_identity + provider_identity + user), so that admin tests can authenticate without going through the registration flow every time.
9. As a developer, I want a `customer` persona that creates a pre-verified customer via direct DB insert, so that store tests can authenticate without email verification overhead.
10. As a developer, I want a `cleanup` fixture that accepts async callbacks and runs them in reverse order after the test, so that app-created side-effect data is cleaned up even when tests fail.
11. As a developer, I want `createUser()` and `createCustomer()` factory functions that return the created record plus a `Symbol.asyncDispose` method, so that I can use `await using` for automatic cleanup.
12. As a developer, I want `generateLoginFormValues()` and `generateRegisterFormValues()` helpers that return faker-based form data, so that I can fill UI forms with realistic unique values.
13. As a developer, I want `createProduct()` factory functions for seeding product data directly into the DB, so that product page tests have data to display without going through the UI.
14. As a developer, I want a `globalSetup` that truncates all tables and clears cached persona sessions before the test suite, so that each full test run starts from a clean state.
15. As a developer, I want MSW server-side mocking to intercept outbound Resend API calls in the backend process, so that E2E tests don't send real emails while still exercising the notification code path.
16. As a developer, I want an `onUnhandledRequest` handler that throws for any non-localhost request without a matching MSW handler, so that missing mocks are caught immediately rather than silently hitting production APIs.
17. As a developer, I want the backend to expose table definitions and the password hasher via a `./test` package export, so that `packages/testing` can import them without circular dependencies.
18. As a developer, I want admin auth tests that verify login with valid credentials, login with invalid credentials, logout, and unauthenticated redirect behavior, so that the auth flow is regression-tested.
19. As a developer, I want store auth tests that verify login, registration, email verification, forgot password, and unauthenticated redirect behavior, so that the customer auth flow is regression-tested.
20. As a developer, I want admin product tests that verify the product list, create form, detail page, and variant navigation, so that the core admin CRUD flow is regression-tested.
21. As a developer, I want store product tests that verify the product list and detail pages, so that the storefront browsing experience is regression-tested.
22. As a developer, I want tests to run fully in parallel locally with randomly generated data to avoid collisions, so that the test suite stays fast as it grows.
23. As a developer, I want `.gitignore` entries for Playwright artifacts (reports, results, auth cache), so that test output doesn't pollute the repository.

## Implementation Decisions

### Package structure

A new `packages/testing` workspace package (`@proteus/testing`) holds all shared E2E infrastructure: Drizzle test DB client, data factories, Playwright fixtures, and globalSetup. Each frontend app has its own `playwright.config.ts` and `tests/e2e/` directory. Configs are fully independent (no shared base config object) — apps only import fixtures and factories from the shared package.

### Backend test export entry point

The backend adds a `src/test-exports.ts` file that re-exports Drizzle table definitions (`authIdentityTable`, `providerIdentityTable`, `userTable`, `customerTable`, `productTable`) and the password hasher (`hashPassword`, `ScryptConfig`). This is exposed via a `"./test"` conditional export in the backend's `package.json`. `packages/testing` lists `"backend": "*"` as a devDependency. The dependency graph is acyclic: `packages/testing` → `apps/backend` (one direction only). Backend integration tests continue using their own separate factories unchanged.

### Server orchestration

Each app's Playwright config declares a `webServer` array with two entries: the backend test server (port 3010, `reuseExistingServer: true`) and the app's own Vite dev server (admin on port 3012, store on port 3011). The backend `dev:test` script sets `MOCKS=true` and loads `.env.test`. The DB runs on its standard test port (5433 via `docker-compose.test.yml`).

### Authentication via personas

Two personas using `playwright-persona`: `admin` (user actor) and `customer` (customer actor). Persona `createSession` does direct DB inserts (3-table auth chain: auth_identity → provider_identity → user/customer) with Scrypt password hashing at fast test params (`logN: 1, r: 1, p: 1`), then logs in through the real UI form. Sessions are cached to disk at `playwright/.auth/`. `destroySession` hard-deletes the auth_identity (FK cascades to provider_identity) and the user/customer record.

For admin users, `auth_identity.appMetadata` is set to `{ userId: <usr_id>, registered: true }`. For store customers, it's `{ customerId: <cus_id>, registered: true }`. Customers are inserted pre-verified (no auth_verification record) so the persona avoids the email verification step. The verification flow is tested separately in a dedicated auth spec.

### Data factories (3-layer pattern)

Each entity has three layers: (1) `generateX(overrides?)` — pure faker-based function returning a full DB insert shape, (2) `createX(overrides?)` — inserts into the DB and returns the row plus `Symbol.asyncDispose` for automatic cleanup via `await using`, (3) `deleteXById(id)` — hard-deletes the record. Non-nullable FK fields in `createX` are enforced via TypeScript `Pick<>` in the function signature.

### Cleanup strategy

Three levels: (1) `await using` with `Symbol.asyncDispose` on every factory-created record (hard-delete on dispose, runs even on test failure), (2) `cleanup` fixture for app-created side-effect data (queue of callbacks, reverse execution order), (3) `globalSetup` truncates all public tables and clears persona session cache before the full suite. Hard-delete is used over soft-delete in dispose functions to keep the test DB clean.

### MSW server-side mocking

MSW handlers live in `apps/backend/tests/mocks/`. The backend entry point conditionally imports and starts the MSW server when `process.env.MOCKS === 'true'`. Initial scope: Resend email API handler (`POST https://api.resend.com/emails`). An `onUnhandledRequest` function passes through localhost/127.0.0.1 requests and throws for everything else, catching missing mocks immediately. Stripe and SendGrid handlers are deferred until tests need them.

### Navigate fixture

Wraps `page.goto()` with `waitUntil: 'networkidle'` and provides type-safe TanStack Router path interpolation via `resolvePath` + `interpolatePath`. Tests use `navigate({ to: '/products/$id', params: { id: product.id } })` instead of raw `page.goto()`.

### Test DB client

`packages/testing` creates its own standalone Drizzle client connecting directly to the test Postgres (`postgresql://postgres:postgres@127.0.0.1:5433/proteus_test`). This client is used only for data seeding and cleanup — completely independent of the backend's `DbProvider` port.

### ADR compliance

- ADR-0003 (SQL-level prefixed IDs): Factory inserts let Postgres generate IDs via the `CONCAT('prefix_', gen_random_uuid())` defaults — factories do not generate IDs manually unless needed for FK linking.
- ADR-0006 (soft-delete): The app's BaseRepository auto-filters `deletedAt IS NULL`. E2E tests assert through the UI (which respects soft-delete filtering) rather than querying the DB directly.
- ADR-0012 (single auth identity per email): Factory `createUser`/`createCustomer` creates exactly one auth_identity + one provider_identity per email, consistent with the auth module's constraint.

## Testing Decisions

### What makes a good E2E test

Tests assert what users see, not implementation details. The assertion priority is: `getByRole` (with accessible name) > `getByLabel` > scoped `getByText` > `toHaveURL` (only for redirects). DB queries in test assertions are a code smell — the UI should surface every outcome worth testing. Tests are organized as fewer, longer journeys rather than many small isolated assertions, because E2E setup cost (browser, auth, navigation, DB seeding) is high. Tests that share the same arrange phase should be merged into one test with multiple act-assert cycles.

### Test seams

Two seams, both at natural system boundaries:

1. **The browser** (primary) — Playwright drives the rendered UI. The entire stack below is exercised end-to-end: SPA → HTTP → backend services → Postgres. No internal mocking.

2. **Outbound HTTP boundary** (secondary) — MSW intercepts `fetch()` in the backend Node process. Requests to localhost pass through (real DB, real backend). Requests to external domains (Resend) are intercepted. This is the boundary between the system under test and the outside world.

### Modules tested

- **Admin auth**: login (valid/invalid credentials), logout, unauthenticated redirect
- **Admin products**: list page with seeded data, create form submission, detail page rendering, variant navigation
- **Store auth**: login (valid/invalid), registration, email verification, forgot password, unauthenticated redirect
- **Store products**: list page, detail page

### Prior art

The sister project `openwav-enterprise` has 18 E2E spec files using the same patterns (playwright-persona, `await using` cleanup, MSW two-layer mocking, `navigate` fixture, `cleanup` fixture). The skill definition at `.claude/skills/e2e-test/` in that project documents the conventions. The backend integration tests in this repo (`apps/backend/tests/`) demonstrate the factory pattern, Vitest fixtures, and DB setup/teardown that E2E factories will mirror at the DB-insert level.

### Data isolation for parallel tests

Tests generate unique data via `@faker-js/faker` (random emails, names, product titles). No test uses hardcoded identifiers that could collide. Cleanup via `Symbol.asyncDispose` ensures each test removes its own data. Global bulk deletes (e.g., `DELETE FROM products` with no WHERE) are banned — cleanup is always scoped by the test's own record IDs. If parallel interference occurs, the debugging protocol is: bisect the conflicting file pair, run with `--trace on`, inspect the trace to find the shared mutation, scope the fix.

## Out of Scope

- **CI/CD integration** — No GitHub Actions workflows. The setup code (scripts, configs) is included for future CI enablement but no workflow files are created.
- **Browser-side MSW** — Only server-side MSW (`msw/node`) is set up. Browser-side interception (`@msw/playwright`) is deferred until per-test overrides are needed.
- **Stripe and SendGrid mock handlers** — Only Resend is mocked. Other external services are added when tests exercise flows that hit them.
- **Role-based personas** — Only `admin` (user) and `customer` personas. Additional roles (e.g., admin with limited permissions) are added when RBAC is implemented.
- **Full test coverage** — Only auth and product page tests. Coverage of other features (customers, settings, users/invites, cart, checkout) is incremental.
- **Visual regression testing** — No screenshot comparison. Tests assert DOM state via Playwright locators.
- **Backend-as-library testing** — The store's backend-as-library pattern is deprecated and not considered in the testing architecture.
- **Shared Playwright base config** — Each app has fully independent config. No shared config object or factory function.

## Further Notes

### Dev workflow scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Backend test server | `npm run --workspace=backend dev:test` | Starts backend on :3010 with `MOCKS=true` and `.env.test` |
| Admin test server | `npm run --workspace=admin dev:test` | Starts admin Vite on :3012 with `.env.test` |
| Store test server | `npm run --workspace=store dev:test` | Starts store Vite on :3011 with `.env.test` |
| Admin E2E tests | `npm run --workspace=admin test:e2e` | Runs admin Playwright suite (auto-starts servers) |
| Store E2E tests | `npm run --workspace=store test:e2e` | Runs store Playwright suite (auto-starts servers) |
| Admin E2E UI mode | `npm run --workspace=admin test:e2e:dev` | Launches Playwright UI for visual debugging |
| Store E2E UI mode | `npm run --workspace=store test:e2e:dev` | Launches Playwright UI for visual debugging |

### Auth token details

| App | localStorage key | Post-login redirect | Auth endpoint |
|-----|-----------------|---------------------|---------------|
| Admin | `proteus_admin_token` | `/` | `POST /auth/user/emailpass` |
| Store | `proteus_store_token` | `/account` | `POST /auth/customer/emailpass` |

### User creation DB insert sequence (admin)

1. `INSERT INTO auth_identity` with `appMetadata: { userId: <usr_id>, registered: true }`
2. `INSERT INTO provider_identity` with `authIdentityId`, `entityId` (email), `provider: 'emailpass'`, `providerMetadata: { password: <scrypt_hash> }`
3. `INSERT INTO user` with `id: <usr_id>`, `email`, `name`

### Customer creation DB insert sequence (store)

1. `INSERT INTO auth_identity` with `appMetadata: { customerId: <cus_id>, registered: true }`
2. `INSERT INTO provider_identity` with `authIdentityId`, `entityId` (email), `provider: 'emailpass'`, `providerMetadata: { password: <scrypt_hash> }`
3. `INSERT INTO customer` with `id: <cus_id>`, `firstName`, `lastName`, `email`, `status: 'active'`

### Dependencies to install

- `packages/testing`: `@faker-js/faker`, `@playwright/test`, `@tanstack/react-router`, `drizzle-orm`, `playwright-persona`, `postgres`, `scrypt-kdf`, `backend` (devDep)
- `apps/admin`: `@proteus/testing`, `@playwright/test` (devDeps)
- `apps/store`: `@proteus/testing`, `@playwright/test` (devDeps)
- `apps/backend`: `msw` (devDep)

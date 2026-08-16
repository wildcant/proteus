# 01 — Foundation: backend test exports + packages/testing

**What to build:** The shared E2E testing foundation that all frontend test suites depend on. After this ticket, a developer can import factories from `@proteus/testing`, seed a user/customer/product into the test DB, and get automatic cleanup via `await using`. The Playwright fixtures (navigate, authenticate, cleanup) and globalSetup are ready for apps to consume.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Backend test exports

- [ ] Add `src/test-exports.ts` that re-exports Drizzle table definitions (`authIdentityTable`, `providerIdentityTable`, `userTable`, `customerTable`, `productTable`) and the password hasher (`hashPassword`, `ScryptConfig`)
- [ ] Add `"./test": "./src/test-exports.ts"` to the backend `package.json` exports field (alongside the existing `"./api"` export)

## packages/testing package

- [ ] Create `packages/testing/package.json` with name `@proteus/testing`, type `module`, and devDependencies: `backend`, `@faker-js/faker`, `@playwright/test`, `@tanstack/react-router`, `drizzle-orm`, `playwright-persona`, `postgres`, `scrypt-kdf`
- [ ] Add `packages/testing` to the root `package.json` workspaces (already covered by `packages/*` glob — verify it resolves)
- [ ] Run `npm install` to link the new workspace

## DB client

- [ ] Create `packages/testing/db/client.ts` — standalone Drizzle client connecting to `postgresql://postgres:postgres@127.0.0.1:5433/proteus_test` via `postgres` driver with `{ prepare: false }`

## Data factories

- [ ] Create `packages/testing/factories/user.ts` with:
  - `generateUser(overrides?)` — pure function returning full `user` table insert shape (faker data for all fields)
  - `createUser(overrides?)` — inserts 3-table auth chain (auth_identity with `appMetadata: { userId, registered: true }` → provider_identity with Scrypt-hashed password at `logN: 1, r: 1, p: 1` → user), returns row + plaintext password + `Symbol.asyncDispose` (hard-delete)
  - `deleteUserById(userId)` — hard-deletes auth_identity (FK cascades to provider_identity) + user record
- [ ] Create `packages/testing/factories/customer.ts` with:
  - `generateCustomer(overrides?)` — full `customer` table insert shape
  - `createCustomer(overrides?)` — 3-table auth chain (auth_identity with `appMetadata: { customerId, registered: true }` → provider_identity → customer with `status: 'active'`), pre-verified (no auth_verification record), returns row + password + `Symbol.asyncDispose`
  - `deleteCustomerById(customerId)` — hard-deletes auth_identity + customer record
- [ ] Create `packages/testing/factories/product.ts` with:
  - `generateProduct(overrides?)` — full `product` table insert shape
  - `createProduct(overrides?)` — inserts and returns row + `Symbol.asyncDispose`
- [ ] Create `packages/testing/factories/form-values.ts` with:
  - `generateLoginFormValues()` — `{ email, password }`
  - `generateRegisterFormValues()` — `{ firstName, lastName, email, password }`

## Playwright fixtures

- [ ] Create `packages/testing/fixtures/test-extend.ts` with custom Playwright fixtures:
  - `navigate` — type-safe TanStack Router navigation via `resolvePath` + `interpolatePath`, wraps `page.goto()` with `waitUntil: 'networkidle'`
  - `authenticate` — two personas via `playwright-persona`:
    - `admin`: `createSession` inserts user via `createUser()`, logs in through UI (fill email/password, submit, wait for redirect to `/`), caches session to `playwright/.auth/`; `verifySession` navigates to `/` and checks authenticated state; `destroySession` calls `deleteUserById`
    - `customer`: `createSession` inserts customer via `createCustomer()`, logs in through UI, waits for redirect to `/account`; `destroySession` calls `deleteCustomerById`
  - `cleanup` — queue of async callbacks, runs in reverse registration order after test
- [ ] Export `test` and `expect` from the fixtures file

## Global setup

- [ ] Create `packages/testing/fixtures/global-setup.ts` — truncates all public tables via `TRUNCATE TABLE ... CASCADE`, clears persona session cache (`rm -rf playwright/.auth/`)

## Package entry point

- [ ] Create `packages/testing/index.ts` (or appropriate exports in package.json) so apps can import: `import { test, expect } from '@proteus/testing/fixtures/test-extend'`, `import { createUser } from '@proteus/testing/factories/user'`, etc.

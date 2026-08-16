# 04 — Store E2E setup + auth tests

**What to build:** The complete Playwright setup for the store app and auth E2E tests covering the full customer authentication lifecycle. After this ticket, running `npm run --workspace=store test:e2e` starts the backend test server (with MSW intercepting Resend) and store Vite dev server, executes auth tests covering login, registration, email verification, forgot password, and unauthenticated redirect, and reports results.

**Blocked by:**
- 01 — Foundation: backend test exports + packages/testing
- 02 — Backend MSW server-side mocking (registration and forgot-password flows trigger emails via Resend)

**Status:** ready-for-agent

- [ ] Install `@proteus/testing` and `@playwright/test` as devDependencies in `apps/store`
- [ ] Create `apps/store/playwright.config.ts`:
  - `globalSetup` pointing to `@proteus/testing` globalSetup
  - `testDir: './tests/e2e'`
  - `fullyParallel: true`, `forbidOnly` on CI, retries on CI, single worker on CI
  - `baseURL: 'http://localhost:3011'`
  - `trace: 'on-first-retry'`
  - Chromium project only
  - `webServer` array: backend on :3010 (`reuseExistingServer: true`) and store Vite on :3011
- [ ] Add scripts to store `package.json`:
  - `"dev:test": "dotenvx run --env-file=../../.env.test -- vite dev --port 3011"`
  - `"test:e2e": "dotenvx run --env-file=../../.env.test -- playwright test"`
  - `"test:e2e:dev": "npm run test:e2e -- --ui"`
- [ ] Add `.gitignore` entries for Playwright artifacts (if not already added by ticket 03)
- [ ] Create `apps/store/tests/e2e/auth.spec.ts` using `test` and `expect` from `@proteus/testing` fixtures:
  - Test: login with valid credentials — create customer via `createCustomer()` with `await using`, navigate to `/login`, fill email and password, submit, assert redirect to `/account`
  - Test: login with invalid credentials — navigate to `/login`, fill wrong credentials, submit, assert error message visible
  - Test: register new customer — navigate to `/login`, switch to register view, fill registration form with `generateRegisterFormValues()`, submit, assert verification-pending state shown (MSW intercepts the Resend email call)
  - Test: forgot password — navigate to `/forgot-password`, fill email, submit, assert confirmation message visible (MSW intercepts email)
  - Test: unauthenticated access — navigate to `/account`, assert redirect to `/login`
- [ ] Verify: `npm run --workspace=store test:e2e` runs all auth tests and they pass

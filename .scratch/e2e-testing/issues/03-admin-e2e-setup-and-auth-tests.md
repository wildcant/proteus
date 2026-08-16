# 03 — Admin E2E setup + auth tests

**What to build:** The complete Playwright setup for the admin app and the first passing E2E test suite. After this ticket, running `npm run --workspace=admin test:e2e` starts the backend test server and admin Vite dev server, executes auth tests covering login, logout, invalid credentials, and unauthenticated redirect, and reports results.

**Blocked by:** 01 — Foundation: backend test exports + packages/testing

**Status:** ready-for-agent

- [ ] Install `@proteus/testing` and `@playwright/test` as devDependencies in `apps/admin`
- [ ] Create `apps/admin/playwright.config.ts`:
  - `globalSetup` pointing to `@proteus/testing` globalSetup
  - `testDir: './tests/e2e'`
  - `fullyParallel: true`, `forbidOnly` on CI, retries on CI, single worker on CI
  - `baseURL: 'http://localhost:3012'`
  - `trace: 'on-first-retry'`
  - Chromium project only
  - `webServer` array: backend on :3010 (`reuseExistingServer: true`) and admin Vite on :3012
- [ ] Add scripts to admin `package.json`:
  - `"dev:test": "dotenvx run --env-file=../../.env.test -- vite dev --port 3012"`
  - `"test:e2e": "dotenvx run --env-file=../../.env.test -- playwright test"`
  - `"test:e2e:dev": "npm run test:e2e -- --ui"`
- [ ] Add `.gitignore` entries for Playwright artifacts: `playwright-report/`, `test-results/`, `playwright/.auth/`
- [ ] Create `apps/admin/tests/e2e/auth.spec.ts` using `test` and `expect` from `@proteus/testing` fixtures:
  - Test: login with valid credentials — create user via `createUser()` with `await using`, navigate to `/login`, fill email and password fields, submit, assert redirect to `/`
  - Test: login with invalid credentials — navigate to `/login`, fill wrong credentials, submit, assert error message visible
  - Test: logout — authenticate as admin persona, trigger logout, assert redirect to `/login`
  - Test: unauthenticated access — navigate to protected routes (e.g. `/`, `/products`), assert redirect to `/login`
- [ ] Verify: `npm run --workspace=admin test:e2e` runs all auth tests and they pass

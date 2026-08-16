# 02 — Backend MSW server-side mocking

**What to build:** MSW server-side infrastructure that intercepts outbound HTTP calls from the backend process during E2E tests. After this ticket, starting the backend with `MOCKS=true` intercepts Resend email API calls and throws on any other unhandled external request. The `dev:test` script is available for running the backend in test mode.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Install `msw` as a devDependency in `apps/backend`
- [ ] Create `apps/backend/tests/mocks/on-unhandled-request.ts` — localhost/127.0.0.1 passes through, all other hostnames throw with a descriptive error identifying the service (include `api.resend.com` → "Resend" in the service map)
- [ ] Create `apps/backend/tests/mocks/resend.ts` — MSW handler array for `POST https://api.resend.com/emails` returning a success response (mock email ID)
- [ ] Create `apps/backend/tests/mocks/handlers.ts` — aggregates and exports all handler arrays (starts with just `resendHandlers`)
- [ ] Create `apps/backend/tests/mocks/server.ts` — `setupServer(...handlers)` and exports the server + `onUnhandledRequest`
- [ ] Add conditional MSW initialization in the backend entry point: when `process.env.MOCKS === 'true'`, dynamically import `../tests/mocks/server.js` and call `server.listen({ onUnhandledRequest })`
- [ ] Add `dev:test` script to backend `package.json`: `"dev:test": "MOCKS=true dotenvx run --env-file=../../.env.test -- tsx watch src/index.ts --port 3010"`
- [ ] Verify: starting the backend with `npm run --workspace=backend dev:test` boots successfully, and any outbound fetch to `api.resend.com` is intercepted by MSW rather than hitting the real API

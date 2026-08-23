# Reusable API Test Setup — Refactor Plan

Seven backend test files hand-roll the same bootstrap: a `DbProvider` stub, a
`bootstrapContainer` call, route selection, an Express app, and — in one case — an HTTP
server. This replaces that with one `createApi` helper exposed through the vitest fixture.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where it lives | `apps/backend/tests/setup/create-api.ts` | Bootstrap concern, sits next to `db-setup.ts`; `tests/utils/` is for leaf helpers like `make-request.ts` |
| How tests reach it | vitest fixture `createApi` | `getDb`/`logger` are already fixtures; the fixture also owns teardown, so no test writes an `afterEach` |
| Created per test, not per suite | `beforeEach` | `bootstrapContainer` measures 7–10ms warm — caching it would buy nothing and force `getContainer()` indirection |
| Route ordering | `RoutesSorter`, the class `prepareRoutes` uses | Both auth tests currently reimplement it by hand; the sorter produces the identical order |
| Namespace auth | Off by default, `namespaceAuth: true` opt-in | Turning it on flips `uploads` from 400 to 401 and needs tokens threaded through both product files — a separate piece of work |
| Route selection | Mount everything passed; `matchers` narrows | Closer to production than the current per-test `.filter(...)`; mounting sibling routes is harmless |
| Server | Always a listening `http.Server` | Removes the cart test's bespoke setup, and its no-jitter requirement becomes true for everyone |
| Container override seam | `register(container)` hook | Modelled on Medusa's `hooks.beforeServerStart`; the sanctioned place to swap a provider instead of `vi.spyOn` after the fact |
| Disposal | `close()` disposes the container, and runs on the failure path | Nothing disposes containers today — 611 tests, 611 containers, each holding twelve modules |
| The auth files' `post()` wrapper | Left where it is | It shapes supertest responses; folding it in starts a parallel HTTP client inside the fixture |

## What is duplicated today

| Block | Files | Lines each |
|---|---|---|
| `DbProvider` stub | 7 | 7 |
| `bootstrapContainer({ logger, dbProvider })` | 7 | 1 |
| `definitions.filter(...).map(→ PreparedRoute)` | 4 | 8 |
| Hand-rolled route ordering | 2 (auth) | 10 |
| `createExpressApp({ routes, container, logger, corsOrigins: [] })` | 4 | 1 |
| Persistent `http.Server` start + `afterEach` close | 1 (cart) | 12 |
| `findDefinition` + `applyMiddleware` | 2 (products) | 6 |

Two of these are more than copy-paste:

**The auth tests reimplement `RoutesSorter`.** `prepareRoutes` (`src/routes.ts:100`) sorts
definitions so static segments match before params. `auth.api.test.ts:34-38` and
`auth-verification.api.test.ts:50-56` rebuild that ordering by hand. Traced against their
matchers, the real sorter produces the same result: `/auth/token/refresh` and
`/auth/verification/*` land in the `static` bucket, `register` in `static` beneath the
`:actorType/:authProvider` params branch, and bare `authenticate` in `params`.

**The tests skip `applyNamespaceAuth`, which production applies.** `prepareRoutes` calls it
on every definition. No test does. That is why `/admin/uploads/presigned-urls` — which has no
`auth` key and therefore defaults to `'required'` — returns 400 for a malformed MIME type
instead of 401 for a missing token.

## The helper

`apps/backend/tests/setup/create-api.ts`:

```ts
export type CreateApiOptions = {
  /** Definitions to mount. Sorted with the same RoutesSorter the real server uses. */
  definitions?: RouteDefinition[]
  /** Mount only these matchers. Omitted mounts everything passed. */
  matchers?: string[]
  /** Config overrides, e.g. authVerificationsPerActor. */
  config?: InputConfig
  /** Inject the namespace auth middleware prepareRoutes applies to /admin and /store. */
  namespaceAuth?: boolean
  /** Runs after the container is built, before the server listens — the place to
   *  register a fake provider or override a registration for this test. */
  register?: (container: AwilixContainer) => void | Promise<void>
}

export type TestApi = {
  container: AwilixContainer
  /** supertest bound to an already-listening server, so no ephemeral server is created
   *  per call — that startup jitter is enough to stop concurrent requests overlapping. */
  request: Agent
  /** The middleware-wrapped handler, for tests that call a route without HTTP. */
  handler: (method: string, matcher: string) => RouteHandler
  /** Idempotent. Closes the server and disposes the container. */
  close: () => Promise<void>
}

export async function createApi(
  deps: { getDb: () => Database; logger: Logger },
  options: CreateApiOptions = {},
): Promise<TestApi>
```

### Implementation sketch

```ts
/** `applyNamespaceAuth` prepends to `definition.middlewares` in place and is not
 *  idempotent, so a copy keeps a second `createApi` in the same file from stacking a
 *  second auth middleware onto the shared definition object. */
function withNamespaceAuth(definition: RouteDefinition): RouteDefinition {
  const copy: RouteDefinition = { ...definition }
  applyNamespaceAuth(copy)
  return copy
}

const listen = (app: Express) =>
  new Promise<Server>((resolve) => {
    const server = createServer(app)
    server.listen(0, () => resolve(server))
  })

export async function createApi(deps, options = {}) {
  const { getDb, logger } = deps

  const dbProvider: DbProvider = {
    getDb,
    withConnection: (fn) => fn(),
    shutdown: async () => {
      // The pool belongs to db-setup.ts and outlives every container built here.
    },
  }

  const selected = (options.definitions ?? []).filter(
    (definition) => !options.matchers || options.matchers.includes(definition.matcher),
  )
  const mounted = options.namespaceAuth ? selected.map(withNamespaceAuth) : selected

  const container = await bootstrapContainer({ logger, dbProvider, config: options.config })

  let server: Server | undefined
  let closed = false

  const close = async () => {
    if (closed) return
    closed = true
    const running = server
    if (running) await new Promise<void>((resolve) => running.close(() => resolve()))
    await container.dispose()
  }

  try {
    await options.register?.(container)

    if (mounted.length > 0) {
      const routes = new RoutesSorter(mounted).sort().map((definition) => ({
        method: definition.method,
        matcher: definition.matcher,
        handler: applyMiddleware(definition),
      }))
      server = await listen(createExpressApp({ routes, container, logger, corsOrigins: [] }))
    }
  } catch (error) {
    // Otherwise a container — and its twelve modules — leaks for every failed setup.
    await close()
    throw error
  }

  return {
    container,
    get request() {
      if (!server) throw new Error('createApi mounted no routes, so nothing is listening')
      return request(server)
    },
    handler: (method, matcher) => {
      const definition = mounted.find((d) => d.method === method && d.matcher === matcher)
      if (!definition) throw new Error(`No route definition for ${method} ${matcher}`)
      return applyMiddleware(definition)
    },
    close,
  }
}
```

Two things to check while writing it:

- `{ ...definition }` spreads the `GetRoute | BodyRoute` union. If `tsc` will not accept the
  result as `RouteDefinition`, narrow on `definition.method` instead of annotating the copy.
- `container.dispose()` has never been called in this codebase. Confirm no module registers a
  disposer that misbehaves against the shared pool — it should not, since `dbProvider.shutdown`
  is a no-op here by design.

### Fixture wiring

`apps/backend/tests/setup/test-extend.ts`, alongside `dto` / `factories` / `service`:

```ts
export type Fixtures = {
  // …
  /** Builds a bootstrapped container, and an Express server when definitions are passed.
   *  Everything it creates is closed after the test. */
  createApi: (options?: CreateApiOptions) => Promise<TestApi>
}

async createApi({ getDb, logger }, use) {
  const created: TestApi[] = []
  await use(async (options) => {
    const api = await createApi({ getDb, logger }, options)
    created.push(api)
    return api
  })
  await Promise.all(created.map((api) => api.close()))
}
```

The object key does not shadow the import, so the fixture body calls the real `createApi`
directly — the same shape the existing `makeRequest` fixture uses.

## Migration, file by file

### `src/api/store/carts/__tests__/cart.api.test.ts`

Before — 25 lines of `beforeEach` plus an `afterEach`:

```ts
let server: Server
let container: AwilixContainer

test.beforeEach(async ({ getDb, logger }) => {
  const dbProvider: DbProvider = { getDb, withConnection: (fn) => fn(), shutdown: async () => {} }
  container = await bootstrapContainer({ logger, dbProvider })
  const routes = cartDefinitions
    .filter((definition) => definition.matcher === '/store/carts/:id/complete')
    .map((definition) => ({ method: definition.method, matcher: definition.matcher, handler: applyMiddleware(definition) }))
  server = createServer(createExpressApp({ routes, container, logger, corsOrigins: [] }))
  await new Promise<void>((resolve) => { server.listen(0, resolve) })
})

test.afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})
```

After:

```ts
let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: cartDefinitions })
})
```

`completeCartConcurrently` and the single-request call switch from `request(server)` to
`api.request`; `container` becomes `api.container`. The comment explaining why the server is
started up front moves into `create-api.ts`, where it now applies to every test.

### `src/api/auth/__tests__/auth.api.test.ts`

The 31-line `beforeEach` — stub, bootstrap, `relevant` filter, `ordered` array, map, app —
becomes:

```ts
test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: authDefinitions })
  authService = api.container.resolve<IAuthModuleService>(Modules.AUTH)
})
```

`post()` stays, retargeted at `api.request`.

### `src/api/auth/__tests__/auth-verification.api.test.ts`

Same, with the config carried through:

```ts
test.beforeEach(async ({ createApi }) => {
  api = await createApi({
    definitions: authDefinitions,
    config: {
      projectConfig: {
        http: { authVerificationsPerActor: { customer: [{ entityType: 'email', authProvider: 'emailpass' }] } },
      },
    },
  })
  authService = api.container.resolve<IAuthModuleService>(Modules.AUTH)
})
```

### `src/api/admin/uploads/__tests__/uploads.api.test.ts`

```ts
test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: uploadDefinitions })
})
```

`postPresignedUrl` switches to `api.request`. The `matcher` filter goes — the other three
upload routes are never called.

### `src/api/admin/products/__tests__/product.api.test.ts` and `src/api/store/products/__tests__/product.api.test.ts`

These never touch HTTP; they invoke handlers directly. The local `findDefinition` helper is
deleted and every

```ts
const handler = applyMiddleware(findDefinition('POST', '/admin/products'))
```

becomes

```ts
const handler = api.handler('POST', '/admin/products')
```

`makeRequest({ scope: container, … })` becomes `makeRequest({ scope: api.container, … })`.
Since no `matchers` is passed and mounting is free of side effects, both files pass their
whole `definitions` array.

### `src/framework/runtime/__tests__/multipart-files.test.ts`

Needs the container only — it builds `PreparedRoute[]` by hand and drives both the Express
and Hono adapters:

```ts
test.beforeEach(async ({ createApi }) => {
  api = await createApi()
})
```

No routes mounted means no server started; the test keeps calling `createExpressApp` and
`createHonoApp` itself.

## Phases

Each phase ends green before the next starts.

**Phase 1 — add the helper.** Write `create-api.ts`, wire the fixture, change no tests.
Verify with `npm run typecheck` and a full suite run.

**Phase 2 — the four supertest files.** cart, both auth files, uploads. This is where the
hand-rolled ordering is deleted, so watch for auth route-matching regressions specifically:
if `RoutesSorter` were wrong, `/auth/user/emailpass/register` would be swallowed by
`/auth/:actorType/:authProvider` and the register tests would fail on the response shape.

**Phase 3 — the two product files.** Mechanical: `findDefinition` → `api.handler`,
`container` → `api.container`.

**Phase 4 — `multipart-files.test.ts`.**

**Phase 5 — verify.** `npm run verify`, then the full backend suite, then
`npx depcruise src/` — `tests/setup/` is not covered by `no-direct-factory-imports-in-tests`
(which only guards `^tests/factories/`), so importing the type from a `__tests__` file is
allowed, but confirm rather than assume.

## File summary

| File | Change |
|---|---|
| `tests/setup/create-api.ts` | **new** — the helper |
| `tests/setup/test-extend.ts` | `createApi` fixture + `Fixtures` entry |
| `src/api/store/carts/__tests__/cart.api.test.ts` | 25-line `beforeEach` + `afterEach` → 3 lines |
| `src/api/auth/__tests__/auth.api.test.ts` | 31 → 4; ordering deleted |
| `src/api/auth/__tests__/auth-verification.api.test.ts` | 49 → 6; ordering deleted |
| `src/api/admin/uploads/__tests__/uploads.api.test.ts` | 20 → 3 |
| `src/api/admin/products/__tests__/product.api.test.ts` | stub + `findDefinition` deleted |
| `src/api/store/products/__tests__/product.api.test.ts` | stub + `findDefinition` deleted |
| `src/framework/runtime/__tests__/multipart-files.test.ts` | stub deleted |

Net: roughly 150 lines of setup removed, and one place that knows how to stand up the API.

## Deliberately out of scope

- **Making API tests authenticate like production.** The `namespaceAuth` flag ships now;
  flipping it on for `/admin` and `/store` routes means issuing tokens in the uploads and
  product tests, and is its own piece of work.
- **`api.input(overrides)`** pre-binding `scope` so the product files drop `scope:` from ~20
  `makeRequest` call sites. A bigger diff in those files than the bootstrap change itself.
- **Suite performance.** ~90% of test time is schema re-creation, which this refactor does
  not touch. See `docs/research/test-suite-migration-and-parallelism.md`.

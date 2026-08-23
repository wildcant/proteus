# Backend Test Patterns

## Core Principles

1. **Real database, real container.** Tests bootstrap the actual DI container and run against
   Postgres. Nothing about the module graph is stubbed, so a passing test means the wiring works.
2. **A test file describes behaviour, not infrastructure.** Bootstrap, route mounting, server
   startup, DTO shapes and service resolution all live in `tests/`. What is left in the test
   file is arrange-act-assert.
3. **Anything a test does not assert on should be faked.** Hardcoding a value the test does not
   care about implies a dependency that is not real, and hides the ones that are.
4. **Every layer takes `Partial` overrides, and they are always optional.** A caller names only
   what matters to it.

## Standing Up the API — `createApi`

`createApi` is a fixture. It builds the container, mounts definitions through the same
`RoutesSorter` the real server uses, applies middleware, and starts a listening server.
Everything it creates is closed after the test — no `afterEach` required.

```ts
import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import cartDefinitions from '../definitions.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: cartDefinitions })
})
```

### Options
| Option | Purpose |
|---|---|
| `definitions` | Route definitions to mount. Sorted with the real `RoutesSorter` |
| `matchers` | Narrow to specific matchers. Omitted mounts everything passed |
| `config` | `InputConfig` overrides, e.g. `authVerificationsPerActor` |
| `namespaceAuth` | Inject the auth middleware `prepareRoutes` applies to `/admin` and `/store`. Off by default |
| `register` | Runs after the container is built, before the server listens — where a fake provider is registered |

### What it returns
| Member | Use |
|---|---|
| `container` | Hand to service factories |
| `get/post/put/patch/delete` | JSON verbs → `{ status, body }`, typed by the route's output schema |
| `request` | Raw supertest, for multipart, response headers, cookies |
| `close()` | Idempotent; the fixture calls it |

**Mount the whole `definitions` array.** Mounting sibling routes has no side effects and is
closer to production than a per-test `.filter(...)`.

**Never hand-roll route ordering.** Two auth test files used to rebuild `RoutesSorter`'s output
by hand. The sorter produces the same order — static segments before params.

### Every route goes over HTTP

There is one way to exercise a route: the verbs. They set `Content-Type`, send the body, and
unwrap the response, so no test writes its own `post()` helper.

```ts
const { status, body } = await api.post('/auth/user/emailpass/register', {
  email: 'reg@example.com',
  password: 'secret123',
})
```

`(path, body?, options?)` where options is `{ headers?, query? }`. Path params are interpolated
into the path; `query` is serialized with `qs`, matching the server's parser, so nested operator
params (`$eq`, `$in`) survive.

```ts
await api.post('/auth/verification/confirm', { code }, { headers: { authorization: `Bearer ${token}` } })

await api.get<typeof optionCombinationRoutes.GetOutput>(
  `/admin/products/${productId}/option-combinations`,
  undefined,
  { query: { scope: 'available', limit: '2' } },
)
```

The server is started up front rather than per request: supertest's ephemeral-server startup
adds enough jitter that concurrent requests stop overlapping, which silently disarms race tests.

### Type the response with the route's output schema

Pass the schema as the generic and `body` is fully typed — a typo in a field name is a compile
error, not a silent `undefined`:

```ts
const response = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${product.id}`)
expect(response.body.product.images).toEqual([...])
```

The verb resolves `T['_zod']['output']` — the **wire** shape. `HttpResult` infers
`['input']`, which is the same schema before `dateToIso` runs, so a timestamp is a `Date` there
and an ISO string here. Do not reuse one for the other.

### Errors are asserted on the response, not caught

`errorHandler` serializes an `AppError` to `{ code, type, message }`, keeping the raw
`ErrorTypes` value and the original message for anything below 500. Assert that — it is the
contract a client actually receives:

```ts
const { status, body } = await api.post(`/admin/products/${product.id}/variants`, { title: 'Small' })

expect(status).toBe(400)
expect(body.type).toBe(ErrorTypes.INVALID_DATA)
expect(body.message).toContain('optionValues')
```

## Workflow Tests

A workflow test wants the container without an HTTP surface, which is the `createTestContainer`
fixture. It bootstraps every module and registers the workflow engine, so `workflow.run(...)`
resolves against the real modules with no extra wiring, and the container is disposed after the
test. `createApi` is the same container with routes and a listening server around it.

```ts
import type { TestContainer } from '@tests/setup/create-container.js'

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

test('...', async ({ service, expect }) => {
  const { cart } = await service.create.checkoutReadyCart(container)

  const order = await completeCartWorkflow.run({ cartId: cart.id })

  expect(await service.read.orders(container)).toHaveLength(1)
})
```

It takes the same `config` and `register` options `createApi` does — they live on
`CreateContainerOptions`, which `CreateApiOptions` extends.

Compensation is asserted on the state it restored, never on the call that restored it — a
`deleteOrders` spy proves the workflow called something, not that the order is gone.

### A bare step

`step.run` wraps one step in a single-step workflow; `step.runAndCompensate` runs it and then
fails the workflow so its compensation fires. The injected failure is swallowed, so there is
nothing to assert about it — assert what the compensation did.

```ts
await step.runAndCompensate(setAuthAppMetadataStep, { authIdentityId, actorType: 'user', actorId: 'usr_abc' })

expect(await service.read.authIdentity(api.container, authIdentityId)).toMatchObject({ appMetadata: null })
```

## The Three Factory Layers

Each has a distinct job. Do not mix them.

### 1. DTO generators — `tests/factories/{module}-dto.ts`
`generateCreateXDTO(overrides?: Partial<CreateXDTO>): CreateXDTO`. Pure, no container, no I/O.

### 2. Service factories — `tests/factories/services/{module}.ts`
Take a container, resolve the service themselves, call a DTO generator, persist. This is what
test files use.

### 3. DB factories — `tests/factories/db/`
Direct Drizzle inserts with `Symbol.asyncDispose`. These belong to the **E2E** suite, which has
no container. Backend integration tests use layer 2 instead — see the `e2e-test` skill.

## DTO Generator Rules

- **Strictly typed** — accepts `Partial<CreateX>`, returns `CreateX`.
- **Every field faked** — no partial subsets. All columns get a realistic value via `@faker-js/faker`.
- **Booleans** → `faker.datatype.boolean()` — never hardcode `true`/`false`.
- **Enums/status** → `faker.helpers.arrayElement([...all values])` — check the Drizzle enum definition first.
- **Numeric columns** → the appropriate `faker.number.*` with realistic ranges.
- **Prefixed IDs** → match the module's prefix (`prod_`, `cus_`, `usr_`, `variant_`, `opt_`, `img_`).
- **FK fields** referencing a NOT NULL column get a placeholder ID
  (`prod_${faker.string.alphanumeric(32)}`). The service factory always overrides them.
- **Unique-indexed columns** need values wide enough not to collide — check the Drizzle
  `uniqueIndex` list. A `title` with a unique index needs a suffix.
- **Compose, don't duplicate** — a generator whose field is another DTO calls that generator
  (`prices: [generateCreatePriceDTO()]`), never a second copy of its defaults.
- Always end with `...overrides`.

### The two legitimate exceptions
Both are about values faker cannot invent, and both must carry a comment saying so:
- **Values that must reference real rows** — a variant's `optionValues` has to name real option
  value ids, so the generator defaults to `{}`.
- **Update DTOs where "absent" is meaningful** — omitting `optionValues` leaves a combination
  alone while any generated value would rewrite it, so the update generator omits it.

### Faked fields change test behaviour — that is the point
Faking a field the test previously got for free from a column default will expose tests that
were silently relying on it. Fix the *test* by declaring what it asserts on:

```ts
// The test asserts renderAs is ['text', 'swatch'] — so it must say so.
const size = await service.create.productOption(api.container, {
  title: `Size-${product.id}`,
  renderAs: 'text',
  values: [{ value: 'S', rank: 0 }, { value: 'M', rank: 1 }],
})
```

Before faking a field, check whether production code reads it (`grep` outside `models/`).
If it drives ordering or filtering, make sure no assertion depends on the order.

## Service Factories — the `cart.ts` Pattern

```ts
export async function addLineItem(container: AwilixContainer, cartId: string, overrides?: Partial<CreateLineItemDTO>) {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)

  return cartService.addLineItem(cartId, generateCreateLineItemDTO(overrides))
}
```

- `async function` declarations, not `const` arrows.
- Container first, then any parent id, then `overrides?: Partial<CreateXDTO>` — **optional and partial**.
- Resolve the service inside the function. Do not thread it in.
- Generate the DTO; never accept a fully-formed one.
- Unwrap array-returning services and throw on empty:
  `if (!shippingMethod) throw new Error('addShippingMethods returned no rows')`.
- Register in the `service` fixture in `test-extend.ts` under `create` / `update` / `read`.

### Return the rows the caller would otherwise read back
If creating an entity produces children the caller needs ids for, return them.
`createProduct` returns `{ product, images }` so no test lists images just to learn their ids —
the same way `stockVariant` returns `{ inventoryItem, inventoryLevel }`.

### Compose, don't inline
A factory that arranges several entities calls the other factories rather than the services:
`createCheckoutReadyCart` builds on `createCart`, `addLineItem`, `stockVariant`,
`createPaymentSessionForCart`.

### Factories with nothing to generate
Targeted mutations (`setProductOptions`) and reads (`listProducts`) still belong in the factory
module — their job is keeping `container.resolve` out of test files. Give them
`overrides?: Partial<X>` where a DTO exists, plain typed params where one does not, and group
them under a `// ---- Reads ----` heading.

### Link repositories
`service.read.linkRepo(container, 'orderCart')` returns a link repository, typed by name. It
covers the two cases a read factory cannot: asserting on a link row, and `vi.spyOn` when a test
needs one link to fail mid-workflow.

```ts
expect(await service.read.linkRepo(api.container, 'orderCart').findByCartId(cartId)).toBeNull()

vi.spyOn(service.read.linkRepo(api.container, 'orderPaymentCollection'), 'create')
  .mockRejectedValueOnce(new Error('payment collection link unavailable'))
```

## What Stays in the Test File

Composite arrangements specific to one describe block stay local, built out of factories, and
take the `service` fixture as a parameter:

```ts
type Services = Fixtures['service']

const createProductWithTwoImages = async (service: Services) => {
  const { product, images } = await service.create.product(api.container, {
    images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
  })
  const [imageA, imageB] = images
  const [linked, unlinked] = await service.create.productVariants(api.container, product.id, [{}, {}])
  if (!imageA || !imageB || !linked || !unlinked) throw new Error('Expected two images and two variants to exist')

  return { product, imageA, imageB, linked, unlinked }
}
```

`noUncheckedIndexedAccess` is on, so destructured array elements need a guard. Use one throw
covering all of them, or `assertDefined` from `@tests/utils/assert-defined.js`.

## Assertions

- **Assertions must be able to fail.** If an expectation would hold no matter what the code
  does, it is not a test. Mutate the implementation and confirm it goes red.
- Read state back through `service.read.*`, never `container.resolve`.
- Prefer order-independent comparisons — `new Map(...)`, `.sort()`, `new Set(...)` — unless
  ordering is the thing under test. Generated `rank` fields are random.
- When a race is under test, assert the invariant (exactly one order, one payment, one
  reservation), not the losers' error shape, which depends on timing.

## Mocking

MSW mocks third-party HTTP (`tests/mocks/`): `resend.ts` covers `api.resend.com/emails`, and
`on-unhandled-request.ts` throws for anything that is not `localhost`/`127.0.0.1`.

`vi.spyOn` on a resolved repo or module service is the tool for forcing a mid-workflow failure:

```ts
vi.spyOn(linkService.repo('orderPaymentCollection'), 'create').mockRejectedValueOnce(
  new Error('payment collection link unavailable'),
)

// Module services register as `asValue(service)`, so the resolved object is the one the
// workflow gets and the spy sticks.
vi.spyOn(api.container.resolve<IPaymentModuleService>(Modules.PAYMENT), 'authorizePaymentSession')
  .mockRejectedValueOnce(new Error('provider unavailable'))
```

**Installing a spy is the only thing `container.resolve` may be used for in a test file.**
Querying or mutating through a resolved service is a `service.read.*` / `service.create.*`
factory that was not written — write it. A `container.resolve` not immediately followed by
`vi.spyOn` is the smell.

Prefer `createApi`'s `register` hook when the goal is swapping a provider for the whole test —
it is the sanctioned seam, and it runs before the server listens.

## Debugging

### Mass failures that look like a regression
Almost always two test processes on one database. `globalSetup` takes an advisory lock for the
run, so a second one now exits immediately naming the collision — but a run started before that
landed, or killed mid-flight, can still leave strays. `pgrep -fl vitest`, kill them, re-run alone.

### A test passes alone and fails in the suite
Check for state that outlives the `beforeEach`. It `TRUNCATE`s every table in `public`, so
anything outside that schema survives the whole run — as does module-scope state in the test
file itself, which persists across every test in that file.

### Timing
The full suite is ~28s: the schema is built once per worker database in `globalSetup`, and each
test resets with a `TRUNCATE` (~25ms) rather than a re-migration (~220ms). What dominates now is
per-file module loading, so a slow file is usually just a test count. See
`docs/research/test-suite-migration-and-parallelism.md`.

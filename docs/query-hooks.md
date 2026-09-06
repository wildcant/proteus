# Query Hook Pattern

Query hooks in `features/{name}/api/` wrap Orval-generated API functions with React Query's
`useQuery`. The counterpart to [mutation hooks](./mutation-hooks.md), and the same file holds both.

The shape turns on one thing: **a query is defined once, as a factory, and every reader — route
loader, suspending hook, non-suspending hook — asks the same factory for it.** A query defined at
the hook is a query no loader can prefetch, so the page waterfalls behind its own component tree.

## Structure

```
features/{name}/
  api/{name}.ts   — query keys, query options, query hooks, and mutation hooks
```

## Hook shape

```ts
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import type { ListThingsParams, ThingListResponse, ThingResponse } from '#/api/generated/model'
import { getThing, listThings } from '#/api/generated/things/things'
import { queryKeysFactory } from '#/lib/query-key-factory'

const thingKeys = queryKeysFactory<'things', ListThingsParams>('things')

type ThingsListQueryOptions = Omit<
  UseQueryOptions<ThingListResponse, Error, ThingListResponse>,
  'queryFn' | 'queryKey'
>

/** Shared query config. Use in route loaders via `ensureQueryData(thingsListQueryOptions())`. */
export const thingsListQueryOptions = (query?: ListThingsParams, options?: ThingsListQueryOptions) =>
  queryOptions({
    queryKey: thingKeys.list(query),
    queryFn: () => listThings(query),
    placeholderData: keepPreviousData,
    ...options,
  })

export const useThings = (query?: ListThingsParams, options?: ThingsListQueryOptions) =>
  useQuery(thingsListQueryOptions(query, options))
```

## Rules

### The factory owns the query

- Every query is an exported `*QueryOptions` factory. `queryKey` and `queryFn` appear there and
  nowhere else — never inline at a `useQuery` call.
- The body is wrapped in `queryOptions({ … })` (or `infiniteQueryOptions` for a paged read), not
  returned as a bare object. The wrapper is what ties the data type to the literal key, which is
  what lets `useSuspenseQuery` hand back non-nullable data and what makes `ensureQueryData` return
  the right shape in a loader.
- Name it for what it returns: `<thing>QueryOptions`, `<thing>ListQueryOptions`. No `get` prefix —
  the call site reads as configuration, not as a fetch.

### Query keys come from `queryKeysFactory`

- `queryKey` is always `keys.all`, `keys.lists()`, `keys.list(params)` or `keys.detail(id)`. An
  array literal is a key no mutation in the file can invalidate by name, which is how a list and
  the detail beneath it come to disagree.
- One factory instance per resource, even when two resources are conceptually one feature. A shared
  namespace gives both the same `lists()` key, so neither can be invalidated without taking the
  other with it — see `shippingOptionKeys` and `paymentProviderKeys` in `features/checkout/api`.
- Pass the list-params type as the second generic (`queryKeysFactory<'things', ListThingsParams>`).
  Omitting it types the key's query slot as `any`.
- Composite scopes go into the params object, not into the key by hand:
  `variantKeys.list({ ...params, productId })`.

### The options parameter

- A factory that callers need to tune takes `options?` **last**, typed
  `Omit<UseQueryOptions<TData, Error, TData>, 'queryFn' | 'queryKey'>` and aliased once per file.
  The two omitted keys are the query's identity — a caller that could change either would be
  defining a different query under the same name.
- `...options` is spread **last** inside `queryOptions({ … })`, so a caller's `enabled` replaces the
  factory's default rather than sitting beneath it.
- Spread it inside the factory, not at the hook. `useQuery({ ...factory(), ...options })` does not
  typecheck: the loose alias widens the key back to `readonly unknown[]` and `enabled`'s function
  form is typed against the literal key it gates.
- The hook then passes options straight through: `useThings(query, options)` →
  `useQuery(thingsListQueryOptions(query, options))`.

### Queries never toast

A mutation's failure is an event the shopper caused and a toast is the right place to say so. A
query's failure is a piece of the page that did not arrive, and the surface that is missing it
renders that itself — an error boundary, a retry row, or a flag the caller reads:
`usePaymentMethods` returns `failed` separately from an empty list, because an empty wallet and an
unreadable one mean opposite things to a shopper.

This is the exact inverse of the mutation rule. Both are enforced.

### Suspending and non-suspending readers

The name is the whole contract: `useSuspense<Thing>` blocks and throws its promise to the nearest
`<Suspense>`; `use<Thing>` renders immediately with `isLoading`. A hook whose name and behaviour
disagree blanks a boundary its caller never opted into, or asks for a boundary that never fills.

Which one a surface wants follows from whether it owns the page:

- **Suspending** — route pages, inside a `<Suspense>` boundary the route provides. Paired with
  `ensureQueryData` in the loader for an SSR route.
- **Non-suspending** — always-mounted UI that does not own the page: the nav cart, a checkout step
  reading a list beside the cart, a grid that re-queries while the shopper is still typing.
  `keepPreviousData` belongs here and only here: a suspending read blanks its boundary on every new
  term, so a search grid would flash empty between keystrokes.

Both twins read one factory, so the two surfaces cannot disagree about what they are showing.

The store runs this as its three-layer pattern (factory → `useSuspense*` → `use*`). The admin has no
suspending hooks at all: its route components call `useSuspenseQuery(productQueryOptions(id))`
directly, which is fine — a route file is outside `features/*/api/` and the rule does not reach it.

**A caveat the rules cannot check.** `useSuspenseQuery` ignores `enabled` — it always fetches. A
factory that carries a gate (`enabled: isRegistered()`) and is read by both twins therefore protects
only the non-suspending one. That holds today for `customerMeQueryOptions` and
`addressesQueryOptions`: their gates exist for `useMe` and `useAddresses` in guest-reachable
checkout and nav, while `useSuspenseMe` and `useSuspenseAddresses` are only mounted under `_authed`
routes where the gate would be true anyway. Correlating a factory's `enabled` with the twin that
consumes it is beyond a single-file pattern match, so it stays a thing to know rather than a rule.

### Lists

- Paginated list factories carry `placeholderData: keepPreviousData`, so the table holds the current
  page while the next one loads instead of blanking.
- Everything a list is paged, sorted or searched by lives in the URL, not in `useState` — see the
  DataTable section of `CLAUDE.md` for the admin, and `productsPageQuery` for the store's version of
  turning URL params into API params in one place.

## Enforcement

Every rule on this page is enforced, one [ast-grep](https://ast-grep.github.io) rule per file in
`ast-grep/rules/frontend/features/api/`, run by the `conventions` job of `npm run verify`. They
match the syntax tree rather than lines, because a hook that names itself one thing and does another
reads as compliant to any line-wise pattern. `ast-grep/README.md` has the rule tree and how to add
one.

| Rule id | The paragraph it enforces |
|---|---|
| `query-hook-inline-query` | `queryKey`/`queryFn` live in a factory, not at the `useQuery` |
| `query-options-not-wrapped` | the factory body is `queryOptions({ … })`, not a bare object |
| `query-options-factory-naming` | it is called `<thing>QueryOptions`, with no `get` prefix |
| `query-key-not-from-factory` | the key comes from a `queryKeysFactory` instance |
| `query-options-loose-type` | `options?` cannot redefine `queryKey`/`queryFn`, and is not an ad-hoc `{ enabled?: boolean }` |
| `query-raises-toast` | a query does not announce its own failure |
| `suspense-hook-name-mismatch` | `useSuspense<Thing>` suspends; `use<Thing>` does not |

Each rule owns a test alongside it in `ast-grep/rule-tests/` holding the code it must flag and the
code it must not. `npm run check:code-shape:test` fails when a rule stops matching its own `invalid`
case — a check that has silently stopped matching prints exactly what a clean codebase prints, and
this is what tells the two apart.

### Exemptions

A rule with a considered exception is suppressed at the line, by id, with the reason written above
it, exactly as on the mutation side:

```ts
// ast-grep-ignore: query-options-loose-type
```

The suppression names one rule and silences only that rule. A misspelt rule id suppresses nothing,
and `npm run check:code-shape` passes `--error=unused-suppression`, so the build fails the day an
exemption outlives the code it was written for. None of these seven has an exemption today.

## What is deliberately not enforced

- **What a hook returns.** The store unwraps to a named domain field (`{ cart: data?.cart ?? null,
  ...rest }`); the admin mostly returns the query result unchanged, and unwraps in the three places
  where a call site reads better for it (`useMe`, `useCustomer`, `useCustomers`). Both are thin
  wrappers over one factory, which is the part that matters. A rule here would enforce a house style
  over a property.
- **`retry` and `staleTime`.** Set once as client defaults (`src/lib/query-client.ts`), and
  overridden per query only with the reason written down — `paymentMethodsQueryOptions` takes
  `retry: 1` because the checkout has a useful answer to a failed wallet read and three backoffs
  spend seven seconds getting to it.

## Relationship with mutation hooks

Mutations invalidate the keys these factories are built from, which is why both live in one file and
share one `queryKeysFactory` instance. See [docs/mutation-hooks.md](./mutation-hooks.md).

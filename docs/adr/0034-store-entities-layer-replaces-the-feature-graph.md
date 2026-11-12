# 34. Code Two Store Features Share Lives in an Entity, Not in an Edge Between Them

**Status:** Accepted — supersedes [ADR-0020](0020-store-feature-graph-is-acyclic.md)

## Context

ADR-0020 made the store's feature graph a declared DAG. It kept the graph acyclic, and it did so by
growing: every time two features needed the same thing, the cheapest fix was one more edge in
`FEATURE_GRAPH`. The graph reached `checkout: ['cart', 'auth', 'address', 'account']`, and most of its
edges were not one feature using another's journey — they were one feature borrowing a noun the other
happened to hold:

- `account → auth` existed for `useLogout` and `useRequestPasswordReset`. Neither is signing in.
- `checkout → auth` existed for `useLogout` alone.
- `checkout → account` exists for the shopper's "me" query and their saved payment methods.
- `CartMismatchBanner` takes `customerId` as a prop because calling `useMe` from `cart` would have
  closed `account → auth → cart → account`.

ADR-0020 already named the answer — "when two features genuinely need the same thing, the thing was
never feature-specific; move it down a layer" — but the only layer below features was shared code,
which is for things that know nothing of the domain. A customer query is neither shared chrome nor one
feature's business, so it stayed where it was and the graph took another edge.

## Decision

**The store gains an entities layer between shared code and features, and code two or more features
use moves into it.**

```
src/{api,components,hooks,lib,...}   shared
src/entities/<entity>/                entities
src/features/<feature>/               features
src/routes/                           routes
```

Imports go only downward. An entity is a domain noun — `customer`, later `cart`, `address`,
`payment-method`, `order` — and holds only the segments `api`, `data`, `model`, `lib` and `ui`, with no
loose files. An entity imports shared code and nothing else of the app's: no other entity, no feature,
no route. Shared code imports no entity. An entity's `api` segment may call the generated client, as a
feature's `api/` may, so a query moves into an entity unchanged.

An entity exists only once two or more features use its code. Code only one feature uses stays in that
feature, which is why sign-in, registration and password update stay in `features/auth` while the
"me" queries, `useLogout` and `useRequestPasswordReset` form the first entity, `customer`.

In place of the graph there is one rule: **features may not import features**. Code a second feature
needs is an entity; a primitive with no domain logic, such as `QuantityStepper`, is shared code in
`src/components/ui/`.

## Enforcement

`@proteus/frontend-structure` exports `entityStructureRules()`, opt-in, returning the four `forbidden`
edge rules (`entities-may-not-import-entities`, `entities-may-not-import-features`,
`entities-may-not-import-routes`, `shared-may-not-import-entities`) and the two `required` placement
rules (`entity-segment-vocabulary`, `no-loose-entity-files`). The store opts in from
`apps/store/structure/.dependency-cruiser.cjs`, which also holds `features-may-not-import-features`. The admin has no entities layer and does not opt in;
its structure check is unchanged.

`apiLayerRules()` counts `src/entities/<entity>/api/` as part of the api layer. In an app without
`src/entities/` that matches nothing, so the widening is shared rather than opt-in.

## Consequences

- The default answer to "these two features need each other" changes from "edit `FEATURE_GRAPH`" to
  "the shared part is an entity". The structure config stops growing an edge per shared need.
- Every entity move is a pure move — no behaviour or visual change rides with it — so review is
  mechanical: an import path changes, nothing else does.
- `no-circular` stays and still guards the module level. With features unable to import features and
  entities unable to import entities, a cycle at the layer level is impossible by construction.
- Routes still compose whatever they need, as ADR-0020 had them do.

## References

- `packages/frontend-structure/index.cjs` — `entityStructureRules()` and `apiLayerRules()`
- `apps/store/structure/.dependency-cruiser.cjs` — the store's opt-in and `features-may-not-import-features`
- `apps/store/src/entities/customer/` — the first entity

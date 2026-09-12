# Architecture Overview

Decisions made during the grilling session. Each major decision has a dedicated ADR in `docs/adr/`. This file serves as a quick-reference map.

---

## ADRs

| # | Decision | Summary |
|---|----------|---------|
| [0001](adr/0001-per-module-container-isolation.md) | Per-module container isolation | Private Awilix container per module; only the service is exposed to the shared container |
| [0002](adr/0002-no-cross-module-transactions.md) | No cross-module transactions | Each module owns its transactional boundary; cross-module consistency via sagas |
| [0003](adr/0003-sql-level-prefixed-ids.md) | SQL-level prefixed IDs | `gen_random_uuid()` + prefix in column default; single source of truth |
| [0004](adr/0004-link-modules-for-cross-module-joins.md) | Link modules for cross-module joins | `relations()` and join tables live in `link-modules/`, not inside modules |
| [0005](adr/0005-central-types-package.md) | Central types package | Public contracts in `core/types/`; prevents circular imports |
| [0006](adr/0006-soft-delete-by-default.md) | Soft-delete by default | Every table has `deleted_at`; BaseRepository auto-filters; hard delete available for purge |
| [0007](adr/0007-zero-dependency-web-standard-router.md) | Zero-dependency Web Standard router | Custom `fetch(Request) → Response` router; runs on any platform; no framework lock-in |
| [0008](adr/0008-operator-based-filter-system.md) | Operator-based filter system | Structured `$eq/$in/$like/$and/$or` filters translated to SQL in BaseRepository |
| [0009](adr/0009-workflow-engine-and-step-pattern.md) | Workflow engine and step pattern | Workflows are a port; handlers declare steps with compensation and the engine executes them |
| [0010](adr/0010-payment-provider-driven-port.md) | Payment provider as a driven port | `IPaymentProvider` behind the payment module; Stripe is one adapter, registered at runtime |
| [0011](adr/0011-module-loaders-and-module-provider.md) | Module loaders and ModuleProvider | Loaders on `ModuleDefinition` register runtime adapters into the module's own container |
| [0012](adr/0012-single-auth-identity-per-email.md) | Single auth identity per email | One identity, many roles; an email is never two accounts |
| [0013](adr/0013-selective-ssr.md) | Selective SSR for the store | `defaultSsr: false`, re-enabled per route where SEO needs it |
| [0014](adr/0014-dual-file-upload-strategy.md) | Dual file upload strategy | Multipart and presigned URLs both stay; each answers a case the other cannot |
| [0015](adr/0015-server-computed-option-projections.md) | Server-computed option projections | The backend answers the questions; clients render the answers |
| [0016](adr/0016-derived-soft-delete-cascade.md) | Derived soft-delete cascade | The cascade is derived from the models barrel, not declared per service |
| [0017](adr/0017-cart-state-is-a-timestamp.md) | Cart state is a timestamp | `cart.status` is removed; state is `completedAt` and `deletedAt` |
| [0018](adr/0018-layered-product-options.md) | Layered product options | The variant pivot points at the product's option value, not at a string |
| [0019](adr/0019-modals-are-url-state.md) | URL state is the default | List, panel and modal state goes in a validated search param |
| [0020](adr/0020-store-feature-graph-is-acyclic.md) | The store's feature graph is acyclic | Features form a declared DAG, and dependency-cruiser enforces it |
| [0021](adr/0021-temporal-adapter-replays-to-the-next-step.md) | The Temporal adapter replays to the next step | One generic driver workflow; the handler is re-entered from the top each step |
| [0022](adr/0022-durable-execution-is-a-runtime-split.md) | Durable execution is a runtime split | The engine is derived from the runtime; workerd gets the in-process one |
| [0023](adr/0023-event-bus-is-one-port-over-three-adapters.md) | The event bus is one port over three adapters | Subscribers are written to the weakest adapter's guarantees |
| [0024](adr/0024-grouped-events-are-replaced-by-final-step-ordering.md) | Final-step ordering replaces grouped events | No staging store; a workflow publishes from its last step |
| [0025](adr/0025-the-package-manager-is-pnpm.md) | The package manager is pnpm | A workspace resolves only what it declares; the catalog and the `versions` gate keep one version of each |
| [0026](adr/0026-core-is-known-framework-runs.md) | `core/` is what is known, `framework/` is what runs | If it would differ between node and workerd it runs; `framework/` imports `core/`, never the reverse |

---

## Additional Conventions (not ADR-worthy)

These are patterns that follow naturally from the ADRs or are easy to change later.

### Module definition API

Declarative `Module()` factory returns a plain config object. Bootstrap reads it.

```typescript
export default Module(Modules.ORDER, {
  service: OrderModuleService,
  repositories: { orderRepository: OrderRepository },
})
```

### One-tier services

Module service talks directly to repositories. No internal per-model service layer.

### Repository pattern

`BaseRepository(table)` factory returns a class with full CRUD, filtering, pagination, and soft-delete. Extend for custom queries.

### Models

Plain Drizzle `pgTable()`. Every table has `id`, `created_at`, `updated_at`, `deleted_at`. Use `.references()` only for intra-module FKs. Cross-module columns are plain `text()`.

### Transaction propagation

Injected `withTransaction` helper. Short-circuits if `context.transaction` already exists, otherwise starts a new transaction.

### Per-module migrations

Each module has its own `drizzle.config.ts` and `migrations/` folder. Link module migrations run after module migrations.

### Modules enum

```typescript
export const Modules = {
  USER: 'user',
  CUSTOMER: 'customer',
  CART: 'cart',
  ORDER: 'order',
  PROMOTION: 'promotion',
  INVENTORY: 'inventory',
} as const
```

---

## Decisions Deferred

- Workflow/saga orchestration (compensation, step rollback)
- Event bus (local vs Redis)
- Provider pattern (payment gateways, shipping, etc.)
- Observability (tracing, metrics)

# Adding a module

Ten steps from nothing to a module the container can resolve. Use `customer` or `inventory` as the
reference implementation.

What a module *is* — the closed file list, the single exposed service, what a table must carry — is
[modules](./modules.md), and it is the shorter read if you are only trying to place a file.

## Structure

Produce this, in this order:

```
src/core/types/<name>/          # 2 — public types
src/modules/<name>/
  models/<entity>.ts            # 4 — Drizzle tables
  repositories/<entity>.ts      # 5 — BaseRepository extensions
  services/<name>-module-service.ts  # 6 — the one exposed service
  migrations/                   # 10 — generated
  __tests__/
  database.config.ts            # 9
  index.ts                      # 7 — Module() definition
```

The full table of what may live in that folder, and what may not, is in [modules](./modules.md).

## Rules

### 1. Register the module key

Add the module to the `Modules` enum in `src/core/utils/modules-definition.ts`:

```ts
export const Modules = {
  // …existing modules
  INVENTORY: 'inventory',
} as const
```

This string is the exact key used for `container.resolve(Modules.INVENTORY)`.

### 2. Define public types in `core/types/`

Create `src/core/types/<name>/` with four files.

**`common.ts`** — read DTOs and filterable props:

```ts
import type { BaseFilterable, OperatorMap } from '../common.js'

export type InventoryItemDTO = {
  id: string
  sku: string | null
  title: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableInventoryItemProps extends BaseFilterable<FilterableInventoryItemProps> {
  id?: string | string[]
  sku?: string | OperatorMap<string>
  title?: string | OperatorMap<string>
}
```

`interface` here rather than `type` because `BaseFilterable` is self-referential; everything else in
the module is a `type`.

**`mutations.ts`** — write DTOs:

```ts
export type CreateInventoryItemDTO = {
  sku: string
  title: string
}

export type UpdateInventoryItemDTO = {
  sku?: string
  title?: string
}
```

**`service.ts`** — the module service interface:

```ts
import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type { FilterableInventoryItemProps, InventoryItemDTO } from './common.js'
import type { CreateInventoryItemDTO, UpdateInventoryItemDTO } from './mutations.js'

export type IInventoryModuleService = {
  retrieveInventoryItem(id: string, config?: FindConfig<InventoryItemDTO>, context?: Context): Promise<InventoryItemDTO>
  listInventoryItems(
    filters?: FilterableInventoryItemProps,
    config?: FindConfig<InventoryItemDTO>,
    context?: Context,
  ): Promise<InventoryItemDTO[]>
  // …
}
```

**`index.ts`** re-exports all three, and `src/core/types/index.ts` gains
`export * from './inventory/index.js'`.

### 3. Create the module folder

The eight folders and four root files in [modules](./modules.md). Start with `models/`,
`repositories/`, `services/`, `__tests__/`, `database.config.ts` and `index.ts`; add `utils/`,
`loaders/`, `providers/`, `provider-declarations.ts` and `sync-providers.ts` only when something
needs them.

### 4. Define models

Each model is a plain Drizzle `pgTable()` in `models/<entity>.ts`:

```ts
import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

export const inventoryItemTable = pgTable(
  'inventory_item',
  {
    id: text().primaryKey().default(sql`CONCAT('iitem_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    sku: text(),
    title: text(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_inventory_item_sku').on(table.sku)],
)

export type InventoryItem = typeof inventoryItemTable.$inferSelect
export type CreateInventoryItem = typeof inventoryItemTable.$inferInsert
```

- Every table spreads `...timestamps` — see [modules](./modules.md#every-table-spreads-timestamps).
- The ID prefix is defined once here via the SQL default, never repeated elsewhere.
- `.references()` only for intra-module foreign keys. A cross-module column (`customerId`) is a plain
  `text()` with no `.references()`.
- Table names carry no prefix by default; prefix by hand on collision (`cart_address`). Columns are
  camelCase in TypeScript and snake_case in Postgres — `casing: 'snake_case'` in the drizzle config
  does the translation, so never write a column name out.
- `pgEnum` for constrained string columns.

Re-export from `models/index.ts`; that barrel is what the cascade graph is built from, so a table
missing from it is a table the walker cannot reach.

### 5. Create repositories

Each repository extends `BaseRepository(<table>)` in `repositories/<entity>.ts`:

```ts
export class InventoryItemRepository extends BaseRepository(inventoryItemTable) {
  // The base already provides: find, findById, findByIdOrFail, findAndCount,
  // create, createMany, update, delete, softDelete, restore.
}
```

That gives you full CRUD, filtering (`$eq`, `$in`, `$like`, `$and`, `$or`, …), pagination (`skip`,
`take`), ordering, field selection and soft-delete filtering for free.

Add custom methods only for queries the base cannot express — joins, aggregations, complex
subqueries. Use `this.getClient(context)` so the query joins the caller's transaction, and
`this.table` to reference columns:

```ts
async findBySku(sku: string, context?: Context) {
  const client = this.getClient(context)
  const rows = await client
    .select()
    .from(this.table)
    .where(and(eq(this.table.sku, sku), isNull(this.table.deletedAt)))
  return rows[0] ?? null
}
```

Re-export from `repositories/index.ts`.

### 6. Create the module service

A class with constructor injection in `services/<name>-module-service.ts`:

```ts
type InjectedDependencies = {
  inventoryItemRepository: InventoryItemRepository
  withTransaction: WithTransaction
}

export class InventoryModuleService implements IInventoryModuleService {
  private inventoryItemRepository: InventoryItemRepository
  private withTransaction: WithTransaction

  constructor({ inventoryItemRepository, withTransaction }: InjectedDependencies) {
    this.inventoryItemRepository = inventoryItemRepository
    this.withTransaction = withTransaction
  }

  async listInventoryItems(filters?: FilterableInventoryItemProps, config?: FindConfig<InventoryItemDTO>, context?: Context) {
    return this.inventoryItemRepository.find(filters, config, context)
  }

  async createInventoryItems(data: CreateInventoryItemDTO[], context?: Context) {
    return this.withTransaction(context, async (ctx) => {
      return this.inventoryItemRepository.createMany(data, ctx)
    })
  }
}
```

- Read methods (`retrieve`, `list`) delegate directly to the repository — no transaction needed.
- Write methods (`create`, `update`, `softDelete`) wrap in `this.withTransaction` for atomicity. An
  outer method that sequences two of its own writes passes `ctx` down as each callee's `context`, and
  the whole sequence commits or rolls back once.
- `InjectedDependencies` keys must exactly match the `repositories` keys in the `Module()` definition,
  plus `withTransaction` and `logger`, which bootstrap registers.
- The service implements the interface from `core/types/`.

**Helpers are private methods, not module-level functions.** A helper the service needs goes on the
class, `private`, under the `── Helpers ──` banner at the bottom, reached through `this.` — not a
free function above the class, and not a new file. Statelessness is not a reason to hoist one out:
`resolveThumbnail` touches no instance state and is still a private method, because the services
already group their helpers in one place and a free function splits one concern across two scopes for
no gain. A module-level function is for logic genuinely shared across several classes or files, and
then it belongs in `src/core/utils/`. When a service grows too large for one class, the split is an
internal collaborator — see [modules](./modules.md#exactly-one-service-crosses-the-boundary).

Re-export from `services/index.ts`.

### 7. Wire the module definition

`index.ts` at the module root:

```ts
import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import * as models from './models/index.js'
import { InventoryItemRepository } from './repositories/inventory-item.js'
import { InventoryModuleService } from './services/inventory-module-service.js'

export default Module(Modules.INVENTORY, {
  service: InventoryModuleService,
  models,
  repositories: {
    inventoryItemRepository: InventoryItemRepository,
  },
})
```

The repository key must match what the service expects in `InjectedDependencies`, and `models` is the
whole barrel — that is what the cascade graph is derived from.

### 8. Register in the bootstrap

Add the module to `src/container.ts`:

```ts
import inventoryModule from './modules/inventory/index.js'

bootstrapModule(container, inventoryModule)
```

After this, `container.resolve(Modules.INVENTORY)` returns the `InventoryModuleService` singleton.

### 9. Create the drizzle config

`database.config.ts` at the module root. Each module owns its own migrations table, so the modules
migrate independently:

```ts
import { env } from '@env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/modules/inventory/models/*.ts',
  out: './src/modules/inventory/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_inventory' },
  dbCredentials: { url: env.DATABASE_URL },
})
```

### 10. Generate and run migrations

```bash
npx drizzle-kit generate --config=src/modules/inventory/database.config.ts --name=create_inventory_tables
npx drizzle-kit migrate --config=src/modules/inventory/database.config.ts
```

`npm run --workspace=backend db:generate` does the same for every module at once, and `db:migrate:dev`
applies them.

**Regenerate, never append.** A module keeps exactly one migration file. When its schema changes, do
not generate an incremental `0001_*` — delete the directory and regenerate it under the same tag:

```bash
rm -rf src/modules/inventory/migrations
npx dotenvx run -f ../../.env.local -- npx drizzle-kit generate \
  --config=src/modules/inventory/database.config.ts --name=create_inventory_tables
```

The `--name` is what keeps the tag stable, so the diff is additions inside the existing `.sql` plus a
`when` timestamp in `meta/_journal.json`. Without it drizzle-kit invents one —
`0000_perpetual_paper_doll.sql` in `pricing` is a leftover that got through, not a precedent.

The project is pre-release with no deployed database to migrate forward, so an append-only history
buys nothing and accumulates churn instead. The test suite migrates from cold, so a rewritten
migration is picked up for free; a local dev database needs `npm run --workspace=backend db:restart`
afterwards, since the migration it already applied has changed underneath it. Revisit this once there
is a real deployment to migrate.

## Enforcement

No rule is held by this document. The two that fail while you are following these steps — step 4's
`...timestamps` and step 3's closed folder list — belong to claims stated in
[modules](./modules.md#enforcement), and that is the table they are joined to.

## What is deliberately not enforced

- **The nine steps themselves.** Nothing checks that a module was registered in `container.ts`, that
  its key is in the `Modules` enum, or that `core/types/index.ts` re-exports its types. Each one fails
  loudly the first time something resolves the module, which is cheaper than a rule that would have to
  read four files at once.
- **Private helpers over module-level functions.** A free function at the top of a service file is
  indistinguishable from any other export; the claim is about where a reader expects to find it, not
  about a shape.
- **One migration file per module.** `0000_*` versus `0001_*` is a filename, and a rule counting them
  would fire during the regeneration it is meant to encourage. The pre-release reasoning above is why
  it is a convention rather than a check.

## Checklist

- [ ] Module key added to `Modules` enum
- [ ] Public types in `core/types/<name>/` — common, mutations, service, index
- [ ] Re-export added to `core/types/index.ts`
- [ ] Model(s) with a prefixed ID and `...timestamps`, re-exported from `models/index.ts`
- [ ] Repository extending `BaseRepository(<table>)`
- [ ] Service implementing the interface from `core/types/`
- [ ] `Module()` definition with `models` and matching repository keys
- [ ] Registered in `container.ts` via `bootstrapModule()`
- [ ] `database.config.ts` configured, with its own migrations table
- [ ] Migration generated with `--name` and run — one `0000_*` file per module, regenerated rather
      than appended to

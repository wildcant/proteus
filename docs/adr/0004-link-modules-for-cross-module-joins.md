# 4. Link Modules for Cross-Module Joins

**Status:** Accepted (revised — added LinkService registry pattern). Amended by [ADR-0038](0038-extensions-are-a-forks-backend-code-beside-proteus.md): an extension module points at a core row by its id, with no link.

## Context

Modules must remain independent — they don't import each other's models. But queries often need to traverse relationships across modules (e.g., "get order with its cart" or "get cart with its customer").

Options:
- **Direct imports:** Module A imports Module B's table for joins. Breaks independence.
- **Query module services:** Module A calls Module B's service to fetch related data. N+1 risk, no SQL-level joins.
- **Link modules:** A separate concern defines cross-module relationships and join tables.

Medusa uses link modules — a flat structure of relation definitions and optional join tables that sit outside any individual module. In Medusa, a `Query` engine (remote joiner) provides a generic graph traversal API that resolves dot-notation paths across module boundaries. We don't build a full Query engine — instead, a `LinkService` acts as a typed repository registry that provides the same cross-module read/write capability through explicit repository methods.

## Decision

### Link Definitions

Cross-module relationships are defined in `link-modules/definitions/`. Two types:

**Writable links** (join table needed — many-to-many or when the relationship itself carries data):
```typescript
export const productVariantInventoryItemTable = pgTable("product_variant_inventory_item", {
  id: text().primaryKey().default(sql`CONCAT('pvitem_', REPLACE(gen_random_uuid()::text, '-', ''))`),
  variantId: text().notNull(),
  inventoryItemId: text().notNull(),
  requiredQuantity: integer().notNull().default(1),
  createdAt: timestamp().defaultNow().notNull(),
  deletedAt: timestamp(),
})
```

**Read-only links** (traversing an existing FK — no join table, just a Drizzle `relations()` definition):
```typescript
export const cartLineItemProductRelations = relations(cartLineItemTable, ({ one }) => ({
  variant: one(productVariantTable, {
    fields: [cartLineItemTable.variantId],
    references: [productVariantTable.id],
  }),
}))
```

`relations()` appears exclusively in link-modules — never inside a module. Cross-module columns are plain `text()` with no `.references()`.

### LinkService — Typed Repository Registry

A single `LinkService` is registered once in the DI container. It holds all link repositories and exposes them through a type-safe `repo(name)` accessor:

```typescript
type LinkRepositoryMap = {
  productVariantInventoryItem: ProductVariantInventoryItemRepository  // writable
  cartProduct: CartProductRepository                                  // readonly
}

class LinkService {
  repo<K extends keyof LinkRepositoryMap>(name: K): LinkRepositoryMap[K]
}
```

**Writable link repositories** extend `BaseRepository`. They inherit generic CRUD (find, create, softDelete, restore) and can add escape-hatch methods for performance-critical cross-module JOINs.

**Readonly link repositories** do not extend `BaseRepository` (no table of their own). They are lightweight classes with only read methods that join across module boundaries via existing FK columns.

### Adding a New Link

1. Write the table definition in `link-modules/definitions/` (writable) or `link-modules/definitions/readonly/` (readonly)
2. Write a repository class in `link-modules/repositories/`
3. Add one line to `LinkRepositoryMap`
4. Register the repository in the `LinkService` constructor

### Rejected Alternatives

**One service per link** (each writable link gets its own service + repository + DI registration via `Module()` + `bootstrapModule()`): Creates ~6 touchpoints per link. Most link services become thin pass-throughs to the repository with no added value. The `Module()` pattern is designed for domain modules with rich business logic, not simple join tables.

**One monolithic link service with all methods**: Becomes a grab bag where `getInventoryAvailability()` sits next to unrelated `getOrderFulfillment()` methods. No domain separation.

## Consequences

- Modules stay fully independent — no cross-module imports in module code
- Cross-module query capability lives in one discoverable place (`linkService.repo(name)`)
- One DI registration for all links, but full type safety at every call site
- Adding a new link is minimal: definition + repository + one type line
- Escape-hatch queries are co-located with their link (on the repository), not scattered across a monolithic service
- Readonly links have a clear access path — not just documentation
- Link module migrations run after module migrations (referenced tables must exist first)
- Adding a new cross-module relationship doesn't touch either module's code
- `LinkRepositoryMap` is a central type that must be maintained — but it's one line per link, type-only

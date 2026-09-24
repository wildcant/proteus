# Product Discovery — Categories, Collections, Tags and Types

**Status:** not started. Drafted from an analysis of Medusa v2 (`medusa-source/packages/modules/product`,
`core-flows`, `medusa/src/api`, `admin/dashboard`) and the current product module. Where Medusa and
Shopify diverge, this follows Medusa. Edge cases are settled by what Medusa's code does — see
**Rules**. Questions Medusa has no answer for are listed under **Open questions**.

## Scope

Four ways to group products, all inside the product module:

- **Category** — what a product is and who it is for, as a tree (`Women › Bracelets`). Drives the
  storefront navigation and category pages. Many per product.
- **Collection** — a hand-picked merchandising group ("Summer 2026"). Drives collection landing
  pages. Many per product (ADR 0032).
- **Tag** — a free keyword ("organic-cotton", "gold"). Drives filtering on product lists. Many per
  product.
- **Product Type** — the one label naming what the product is ("T-shirt", "Sneakers"), as Shopify's
  `productType`. Admin-facing. Snapshotted onto line items.

The words are defined in `CONTEXT.md` (Product grouping); the industry survey behind them is
`docs/research/product-grouping-vocabulary.md`. A storefront mega menu — "Featured", "Shop by
Category", "Shop by Material" columns — is a **Navigation Menu** assembled from these, not a deeper
Category tree: column headings are Store Copy, "Shop by Material" is Tag links, "New Arrivals" is a
sorted list.

Plus the three surfaces that consume them: admin CRUD and product assignment, store read endpoints
and filters on `GET /store/products`, and storefront navigation and landing pages.

Out of scope:

- Translating names — `.scratch/store-translations/` already lists categories, collections, tags and
  types as reference types. Nothing here blocks it.
- Smart collections (rule-based membership). Neither Medusa nor this spec has them.
- Faceted search and a search index. Filters are plain SQL.
- Restoring soft-deleted categories, collections, tags or types from the admin. Medusa exposes
  restore only as workflow compensation, never as an endpoint.
- Bulk assignment from the products list. Medusa assigns in bulk only from the category or
  collection side.
- Handle redirects. Changing a handle breaks the old URL, as in Medusa.
- **Admin control over Computed List rules and over the Navigation Menu** — see
  **Developer-controlled for now**. Computed Lists with rules in code are in scope.
- **Sales-ranked Computed Lists** (Best Sellers, Trending Now) — blocked on sorting by a computed
  property in the database; see **Computed Lists** and `.tasks/next-todos`.

## Why

The storefront is one flat product list. The header rail (`apps/store/src/components/header/nav.tsx`),
the side menu (`side-menu.tsx`) and the footer's Shop column all point only to `/`, each with a comment
waiting for a category taxonomy. The admin create flow has an Organize step holding only
`discountable`. Order and cart line items carry a `productType` column that is always null, because
there is no type to copy from (`apps/backend/src/workflows/cart/utils/prepare-line-item-data.ts`).

## How Medusa does it

| Entity | Medusa table | Product relation | Unique key |
|---|---|---|---|
| Category | `product_category` — `name`, `description`, `handle`, `mpath`, `is_active`, `is_internal`, `rank`, `parent_category_id` | many-to-many via `product_category_product` | `handle` |
| Collection | `product_collection` — `title`, `handle` | `product.collection_id`, `SET NULL` | `handle` |
| Tag | `product_tag` — `value` | many-to-many via `product_tags` | `value` |
| Type | `product_type` — `value` | `product.type_id`, `SET NULL` | `value` |

All four also carry `external_id` and `metadata`. All unique indexes cover only rows that are not
soft-deleted.

**Copied:** the four-entity split and its relation shapes; sibling `rank` with ±1 shifts; handles
generated from the name; store category reads forced to `is_active && !is_internal`; `is_active`
defaulting to false; soft delete leaving `type_id` in place; refusing to delete a
category with children; product assignment from both sides; separate permissions per entity; the
line-item snapshot of type.

**Not copied — one collection per product.** Medusa's `product.collection_id` is a single FK. Here
a product joins Collections through a pivot, as in Shopify (ADR 0032). So the line item carries no
`productCollection` snapshot either.

**Not copied — Medusa defects:**

- **`mpath` materialised paths.** Moving a category to root leaves an empty `mpath` with its
  descendants' paths unrewritten (`repositories/product-category.ts:502-503`). A shop has tens of
  categories, so `parentId` alone is enough: recursive CTEs answer subtree, ancestor and visibility
  questions in SQL. Nothing to keep in sync.
- **Store category filter without descendants.** `GET /store/products?category_id=` matches direct
  members only, so a "Clothing" page shows nothing when every product sits in "Clothing › Shirts".
- **The store visibility filter that never runs.** Medusa's `/store/products` deletes `category_id`
  in the validator before the middleware that would add `is_active`, so products stay reachable
  through an inactive category's id (`store/products/middlewares.ts:82-91`). Here the filter lives in
  the service call the route makes, so it cannot be skipped.
- **Unfiltered relation expansion.** Medusa's store category defaults expand `*parent_category` and
  `*category_children` without the visibility filter, so inactive and internal children leak into
  the response (`store/product-categories/query-config.ts:17-18`). Here every store category read
  goes through one visible-tree builder.
- **A 404 that never fires.** `GET /store/product-categories/:id` tests `!category` on an array and
  answers `200 {}` for a missing id (`store/product-categories/[id]/route.ts:31`). Here it 404s.

**Not copied — project conventions:**

- **Live pivot rows under a soft-deleted tag or category.** Medusa leaves them in place. Here the
  pivots declare `on delete cascade`, so the derived cascade hides them and restores them with their
  owner — same observable behaviour, no stale rows in joins.
- **Workflows and events for single-module CRUD.** Medusa wraps every create/update/delete in a
  workflow and emits `product-category.created` etc., but nothing in its core consumes those events
  except generic search ingestion. Every write here touches only the product module and runs in one
  `withTransaction`, the same as `PATCH /admin/products/:id` today. No events until a subscriber
  needs one.

## Design

### Tables

All in `apps/backend/src/modules/product/models/`, one file per table, each spreading `...timestamps`,
ids prefixed in SQL (ADR 0003). Names follow the existing `product_*` convention.

**`product_category`** — prefix `pcat_`

| Column | Type | Notes |
|---|---|---|
| `name` | text, not null | |
| `description` | text, not null, default `''` | |
| `handle` | text, not null | `liveUniqueIndex` |
| `parentId` | text, nullable | references `product_category.id`, **`on delete restrict`** |
| `rank` | integer, not null, default 0 | order among siblings |
| `isActive` | boolean, not null, default false | shown on the store |
| `isInternal` | boolean, not null, default false | assignable in the admin, never shown on the store |
| `externalId` | text, nullable | |
| `metadata` | jsonb, nullable | |

`liveIndex` on `(parentId, rank)`. `restrict` makes a live child a **guard** in the derived soft-delete
cascade (`docs/soft-delete-cascade.md`), so "cannot delete a category with children" is enforced by
the walker with no service code.

**`product_category_product`** — pivot

`productId` → `product.id` **cascade**, `categoryId` → `product_category.id` **cascade**.
`liveUniqueIndex` on `(productId, categoryId)`, `liveIndex` on `categoryId`. Both cascades mean
soft-deleting either end hides the pivot row. No rank: products on a category page follow the
list's `sort`.

**`product_collection`** — prefix `pcol_`

`title` not null, `handle` not null (`liveUniqueIndex`), `externalId`, `metadata`. A landing-page hero
image goes in `metadata`, as in Medusa.

**`product_collection_product`** — pivot

`productId` → `product.id` cascade, `collectionId` → `product_collection.id` cascade.
`liveUniqueIndex` on `(productId, collectionId)`, `liveIndex` on `collectionId`. Soft-deleting a
Collection hides its memberships; restoring it brings them back.

**`product_tag`** — prefix `ptag_`

`value` not null, `liveUniqueIndex`. `externalId`, `metadata`.

**`product_product_tag`** — pivot

`productId` → `product.id` cascade, `tagId` → `product_tag.id` cascade. `liveUniqueIndex` on
`(productId, tagId)`, `liveIndex` on `tagId`.

**`product_type`** — prefix `ptyp_`

`value` not null, `liveUniqueIndex`. `externalId`, `metadata`.

**`product`** gains `typeId` → `product_type.id`, nullable, `liveIndex`, **`on delete set null`**.
`set null` puts it outside the derived cascade, so soft-deleting a Product Type leaves the id in
place.

**Cart and order line items** (`modules/cart/models/line-item.ts`, `modules/order/models/line-item.ts`)
gain `productTypeId`, nullable text, next to the existing `productType`. Medusa also snapshots
`product_collection` (`core-flows/src/cart/utils/prepare-line-item-data.ts:152-156`); with several
Collections per product there is no single title to copy (ADR 0032).

### Migrations

The product module has one migration, `0000_create_product_tables.sql`, regenerated in place
(`modules.md:65`); the cart and order modules the same. Regenerate with
`pnpm --filter backend run db:generate`, then `pnpm --filter backend run stack:reset`.

### Permissions

The product module declares four more feature groups next to `product.*` in
`modules/product/index.ts`: `product-category.*`, `product-collection.*`, `product-tag.*`,
`product-type.*`, each `read/create/update/delete`. Medusa has one RBAC resource per entity
(`api/admin/product-categories/middlewares.ts:22-111`).

- Category and collection CRUD need the matching feature.
- `POST /admin/product-categories/:id/products` and `POST /admin/collections/:id/products` need
  `product-category.update` / `product-collection.update` — assignment edits the category, as in
  Medusa (`:100-111`).
- Setting `typeId`, `categoryIds`, `collectionIds`, `tagIds` on a product needs `product.update`.

### Service

`ProductModuleService` is 875 lines. Following `ProductOptionService`, the taxonomy lives in private
helpers the module service delegates to — `ProductCategoryService` (the only one with real logic)
and one `ProductTaxonomyService` for collections, tags and types, which are the same CRUD three times.
The module still exposes one service.

Public methods, grouped:

- **Categories:** `listCategories`, `retrieveCategory`, `createCategory`, `updateCategory`,
  `softDeleteCategories`, `listCategoryTree({ visibleOnly })`, `setCategoryProducts(categoryId, { add, remove })`.
- **Collections:** `listAndCountCollections`, `retrieveCollection`, `createCollection`,
  `updateCollection`, `softDeleteCollections`, `setCollectionProducts(collectionId, { add, remove })`.
- **Tags / types:** `listAndCount*`, `retrieve*`, `create*`, `update*`, `softDelete*`.
- **Products:** `CreateProductDTO` and `UpdateProductDTO` gain `typeId`, `categoryIds`,
  `collectionIds`, `tagIds`. Each `*Ids` array replaces the product's set, the same as Medusa's
  `category_ids`.
- **Filters:** `FilterableProductProps` gains `categoryId` (with descendants, see below),
  `collectionId`, `typeId`, `tagId`. Each takes one id or an array.

Category rules:

- **Handle** — `toHandle(name)` when absent, same helper as products. Never regenerated on update.
- **Rank on create** — defaults to the sibling count (append). A given rank is clamped to
  `[0, siblingCount]` and later siblings shift up by one.
- **Move / reorder** — one `updateCategory(id, { parentId, rank })`. Close the gap under the old
  parent (siblings above shift down by one), open one under the new (siblings at or above shift up
  by one), in one transaction. Moving a category under itself or a descendant throws
  `INVALID_ARGUMENT`, checked with a recursive CTE over the moved category's descendants.
- **Soft delete** — the walker refuses while live children exist; then the service closes the rank gap.
- **Descendant expansion** — `categoryId: X` in a product filter resolves to X plus every
  descendant, from one recursive CTE. With `visibleOnly`, a hidden category hides its whole
  subtree, the same as Medusa's store tree.

### Route conventions

Every endpoint follows `standards/rules/backend/api/__docs__/routes.md`:

- **Layout.** One folder per domain — `product-categories/`, `collections/`, `product-tags/`,
  `product-types/` — holding `route.ts` (list + create), `[id]/route.ts` (retrieve, `PATCH`,
  `DELETE`) and one `definitions.ts`. Product assignment is the nested sub-resource
  `[id]/products/route.ts`. Nothing else goes in `src/api/`; helper logic belongs in the service.
- **Contract.** Each handler co-exports `Input` / `Output` and, where it raises, `Throws`
  (`as const`). Schemas live in `packages/http-schemas/src/{admin,store}/<domain>/`. Each domain gets
  an OpenAPI tag in `framework/http/types.ts`, and its `definitions.ts` is imported in `src/routes.ts`.
- **Statuses.** Create answers 201; retrieve, list, `PATCH`, `DELETE` and the `{ add, remove }`
  assignment answer 200. `DELETE` returns the shared `DeleteResponse`.
- **Throws.** `DUPLICATE_ERROR` (handle or value taken), `NOT_FOUND`, `INVALID_ARGUMENT` (a
  category moved under itself or a descendant) and `NOT_ALLOWED` (a category with children deleted)
  are raised in the product module service, not the handler. The routes declare them and suppress
  `route-declares-unthrown-error` with that reason written above the suppression, as the rule's
  exemption says.
- **Auth.** Admin routes keep the `required` default and gate on the permissions below. Store
  category and collection routes are `auth: 'public'`, like store product browsing.
- **Finish.** `pnpm run openapi:generate` regenerates both specs and the Orval clients, then
  `pnpm run verify`.

### Admin API

| Endpoint | Notes |
|---|---|
| `GET/POST /admin/product-categories` | list filters: `q`, `parentId` (`null` = roots), `handle`, `isActive`, `isInternal`, `includeDescendantsTree` |
| `GET/PATCH/DELETE /admin/product-categories/:id` | PATCH carries `parentId` + `rank` for the organize tree |
| `POST /admin/product-categories/:id/products` | `{ add: string[], remove: string[] }` |
| `GET/POST /admin/collections`, `GET/PATCH/DELETE /admin/collections/:id` | |
| `POST /admin/collections/:id/products` | `{ add, remove }` |
| `GET/POST /admin/product-tags`, `GET/PATCH/DELETE /admin/product-tags/:id` | |
| `GET/POST /admin/product-types`, `GET/PATCH/DELETE /admin/product-types/:id` | |
| `GET /admin/products` | gains the four filters |
| `POST /admin/products`, `PATCH /admin/products/:id` | gain `typeId`, `categoryIds`, `collectionIds`, `tagIds` (ids only); responses embed `type`, `categories`, `collections`, `tags` |

### Store API

| Endpoint | Notes |
|---|---|
| `GET /store/product-categories` | visible categories. Filters: `handle`, `parentId`, `q`, `includeDescendantsTree`. `?parentId=null&includeDescendantsTree=true` returns the whole visible tree in one call, which feeds the nav |
| `GET /store/product-categories/:id` | one visible category; 404 when missing, hidden, or under a hidden ancestor |
| `GET /store/collections`, `GET /store/collections/:id` | list filters: `handle`, `q` |
| `GET /store/products` | gains `categoryId`, `collectionId`, `tagId`, `typeId`. `categoryId` expands to visible descendants. Embedded `categories` are visible ones only |
| `GET /store/products/:id` | embeds `type`, visible `categories`, `collections`, `tags` |

**Visible** is one rule for every store read: the category is active, not internal, and every
ancestor is visible too. Medusa checks only the row itself on retrieve but drops hidden branches in
the tree, and strips internal (not inactive) categories on product detail only; here the tree,
retrieve, the product filter and embedded categories all use the same rule.

Lookup by handle is the list endpoint with `?handle=`, as in Medusa
(`www/apps/resources/app/storefront-development/products/categories/retrieve/page.mdx`). An empty
list is the storefront's cue to render its 404.

The four filters merge into the existing `listAndCountProducts({ ...filters, status: 'published',
id: sellableProductIds })` call in `api/store/products/route.ts`, so pricing and stock stay untouched.
No store endpoints for tags and types on their own: the only consumer is a filter, and the tags on
the current result set come from the products.

### Line item snapshot

`prepareLineItemData` sets `productType: product.type?.value ?? null`,
`productTypeId: product.type?.id ?? null`. The cart workflow's product read must include `type`.
`complete-cart.ts` copies both to the order line. Lines stay frozen at add time: changing a
product's type never rewrites a line already in a cart. Lines added before this change keep `null`.

### Storefront

- **Navigation.** The root loader fetches the visible tree once. The header rail lists the
  top-level Categories — Men and Women. Each opens a panel with three columns, every heading Store
  Copy:

  | Column | Kind | Links, for the Men panel |
  |---|---|---|
  | Featured | Computed Lists scoped to the Category | `/categories/mens?sort=newest` (Best Sellers and Trending Now join when unblocked) |
  | Shop by Category | the Category's visible children, by rank | `/categories/mens-tops`, … |
  | Curated Shops | Collections, by handles listed in storefront code | `/collections/essentials`, … |

  The Featured and Curated Shops entries are developer-controlled (below); Shop by Category follows
  the tree the admin arranges. The side menu carries the same three groups per top-level Category,
  nested, as the phone navigation. The footer's Shop column lists the top-level Categories.
- **Category page** — `/categories/$handle`, server-rendered (ADR 0013). Loads the category with
  `?handle=`, 404s on an empty list. Breadcrumb from ancestors, child categories as chips, then the
  existing `product-list` with `categoryId` in the query. Reuses `q`, `sort`, `offset` search params.
  An empty result renders the list's empty state with a link to "Shop all".
- **Collection page** — `/collections/$handle`, server-rendered, same 404 rule. Hero from `title` and
  an optional image in `metadata`, then `product-list` filtered by `collectionId`.
- **Tag filter** — a `tag` search param on list pages, rendered as removable chips. No tag index
  page.
- **Product page** — type and tags shown as plain text. No breadcrumb: which of a product's several
  Categories it would follow is left for later.

Mobile-first: the side menu is the phone navigation, the rail is `lg:` only (already the case).

### Computed Lists

Every grouping this spec serves is one of five: Category, Collection, Tag, Product Type, or a
**Computed List** (`CONTEXT.md`). The first four store membership; a Computed List derives it.

A Computed List is a `sort` value on any product list, so its scope comes from the page: "Women ›
New Arrivals" is `/categories/womens?sort=newest`, a store-wide one `/?sort=newest`. No route or
table of its own.

| Computed List | Rule | Status |
|---|---|---|
| New Arrivals | newest first — `sort=newest`, a stored column | ships; the sort already exists |
| Best Sellers | most units sold, all time | **deferred** |
| Trending Now | most units sold in the last 7 days | **deferred** |

Best Sellers and Trending Now sort by a property no product table stores — units sold, aggregated
from the order module. Doing that without fetching whole tables and ranking in the JS runtime is the
general problem in `.tasks/next-todos` ("Filter, sort and paginate by computed properties in the
database"), so they wait for it. The Featured column links New Arrivals only until then.

### Developer-controlled for now

Two things a merchant will eventually want to control stay in the developer's hands in this spec,
chosen to keep scope from creeping. Both are expected to move to the admin later, each as its own
spec.

- **What a Computed List holds.** Every "Featured" link is a **Computed List** (`CONTEXT.md`): a product list whose membership and order come from a rule,
  such as `/?sort=newest` or `/categories/womens?sort=newest`. None of them is a Collection, so the
  admin cannot pick or pin products in them; the rules live in code. Later: admin-configured rules
  (Shopify's automated collections — "created in the last 30 days", "top 20 by units sold") would
  hand the rule to the admin. They remain Computed Lists, not Collections, so the definitions do not
  move. A merchant who wants a hand-picked list makes a Collection.
- **Where anything is shown.** The Navigation Menu — header rail, side menu, footer, and any
  "Featured" column with its headings — is assembled in storefront code from the Category tree plus
  hard-coded links to Computed Lists, Collection handles and Tag filters. Headings are Store Copy.
  Moving, renaming or removing an entry needs a deploy. Later: a Navigation Menu entity the admin
  edits (Shopify's Online Store › Navigation; Medusa has none), whose items link to a Category,
  Collection, Tag list or URL. The storefront then reads the menu endpoint instead of its constants;
  nothing in this spec's data model changes.

### Admin

- **Sidebar** — `build-sidebar.ts` Products children gain Categories, Collections, Tags, Types next
  to Options, each gated on its own `.read` feature. New icons go in the `SidebarIcon` enum in
  `http-schemas` and the map in `apps/admin/src/components/layout/nav.tsx`.
- **Categories** — list as an indented tree, create/edit form (name, handle, description, status
  active/inactive, visibility public/internal, parent), an **Organize** page with a drag tree (dnd-kit)
  that PATCHes `parentId` + `rank` on drop with optimistic update and rollback, and a products section
  with add/remove.
- **Collections** — DataTable list, create/edit, detail with products section (add via a product
  picker that disables products already in this collection, remove per row and in bulk). Adding
  never removes a product from another Collection.
- **Tags, types** — DataTable list, create/edit, detail with a read-only product list filtered by the
  id. Assignment happens from the product side.
- **Product** — the Organize step of the create flow and a new Organization section on the product
  detail page edit `typeId`, `categoryIds`, `collectionIds`, `tagIds`. Type is a single-select
  combobox; collections and tags are multi-select comboboxes over existing rows; a tag must exist before it can be picked. The category combobox
  loads one level at a time (`parentId` + `includeDescendantsTree`) and flattens `q` search results,
  as Medusa's `CategoryCombobox` does.
- **Products list** — filters for the four.
- **Delete dialogs** name the entity only ("You are about to delete the category Shirts"), no usage
  counts.

## Rules

Edge cases, each settled by what Medusa's code does.

| Case | Rule | Medusa |
|---|---|---|
| Category empty in the shopper's market | Shown anyway. The tree ignores markets and product counts; the page renders the empty state | `store/product-categories/helpers.ts:26-38` |
| Duplicate handle or value | `DUPLICATE_ERROR`; no auto-suffix | `db-error-mapper.ts:26-41` |
| Handle format | No validation beyond non-empty; generated with `toHandle` when absent | `admin/product-categories/validators.ts:53,75` |
| Category and collection share a handle | Allowed — separate tables, separate routes | no cross-check |
| Tag or type value casing and whitespace | Stored as sent; uniqueness is exact and case-sensitive | `models/product-tag.ts:17-24` |
| Restore after the handle was reused | Unique index rejects it with `DUPLICATE_ERROR`; restore is not exposed anyway | `repositories/product-category.ts:332-351` |
| `?tagId=a&tagId=b` | Any of the tags (OR) | `common-validators/products/index.ts:47-50` |
| Several filters together | AND across filters, OR within one | `store/products/middlewares.ts:82-91` |
| Delete a tag or type in use | Allowed; products lose it, line-item snapshots keep the text | `delete-product-types.ts:64` |
| Delete a category or collection with products | Allowed; its pivot rows are hidden, products stay | `repositories/product-category.ts:378-381` |
| Add a product already in collection A to collection B | It is in both. Medusa moves it (one collection per product); ADR 0032 | `product-module-service.ts:2415-2446` |
| Product points at a soft-deleted type | The id stays; reads join live rows only, so the product shows none. Writes check the FK only, so a soft-deleted id is accepted | `validators.ts:305-307` |
| Product in a parent and its child category | Allowed; nothing strips the ancestor | no validation |
| Tree depth | Unlimited | no limit |
| Concurrent reorders | No locks; ±1 shifts, as in Medusa. Drift is healed by the next move in that sibling set | `repositories/product-category.ts:566-712` |
| Unknown id in `categoryIds` / `collectionIds` / `tagIds` / `typeId` | FK violation, mapped to `NOT_FOUND` | `db-error-mapper.ts:66-75` |

## Slices

Each ends with `pnpm run verify` green. Backend tests against real Postgres, one per journey.

1. **Types and tags** — tables, permissions, service, admin endpoints, product create/update/list
   filter, line-item snapshot columns. Smallest end-to-end cut; proves the pivot + soft-delete
   pattern.
2. **Collections** — table, pivot, `collectionIds` on products, admin endpoints incl.
   `{ add, remove }`, store endpoints and filter.
3. **Categories backend** — tree table, pivot, rank/move rules, descendant filter, admin + store
   endpoints.
4. **Admin UI** — sidebar, tags/types/collections pages, category tree + organize, product
   Organization section and create-flow Organize step, product list filters.
5. **Storefront** — nav from the tree with the Men/Women panels (Featured links New Arrivals only),
   `/categories/$handle`, `/collections/$handle`, tag filter, product page type and tags.

Slices 1–3 are independent of each other past the shared service split; 4 and 5 need the
endpoints they render.

## Open questions

Medusa's code has no answer for these.

1. **Seed data.** Medusa's repo seeds none. Proposal over the 14 products in `scripts/seed-dev.ts`,
   awaiting confirmation. Men/Women are top-level Categories, so a unisex product sits under both;
   handles are unique across the tree, hence the prefixes.

   | Category (handle) | Products |
   |---|---|
   | Men (`mens`) › Tops (`mens-tops`) | Men's T-shirt, Workout Shirt |
   | Men › Sweatshirts (`mens-sweatshirts`) | Hoodie, Men's Crewneck |
   | Men › Bottoms (`mens-bottoms`) | Sweatpants, Shorts |
   | Women (`womens`) › Tops (`womens-tops`) | Women's T-shirt, Workout Shirt |
   | Women › Sweatshirts (`womens-sweatshirts`) | Hoodie, Women's Crewneck |
   | Women › Bottoms (`womens-bottoms`) | Leggings, Sweatpants |
   | Men › Shoes (`mens-shoes`) | High Top, White Leather, Gray Leather, Canvas, Gray Runners |
   | Women › Shoes (`womens-shoes`) | High Top, White Leather, Gray Leather, Canvas, Gray Runners |
   | Sale (`sale`), internal | Shorts, Canvas Sneakers |

   - **Product Types:** T-shirt (both T-shirts, Workout Shirt), Hoodie, Crewneck, Sweatpants,
     Shorts, Leggings, Sneakers (4), Running Shoes.
   - **Tags:** `organic-cotton` (both T-shirts), `cotton` (Hoodie, both crewnecks), `leather` (White
     and Gray Leather Sneakers), `canvas`, `nylon` (Shorts, Workout Shirt), `unisex` (Hoodie).
   - **Collections:** Essentials (T-shirts, crewnecks, Hoodie, Sweatpants) and Active (Workout
     Shirt, Shorts, Leggings, Gray Runners) — with Hoodie also in Active, so one product sits in two.
     The four other sneakers sit in none.

No caching is added for the nav tree or the category and collection pages: they are fetched per
request like the rest of the store's reads.

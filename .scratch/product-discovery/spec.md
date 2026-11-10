# Product Discovery — Categories, Collections, Tags and Types

**Status:** not started. Drafted from Medusa v2 source (`packages/modules/product`, `core/core-flows`,
`medusa/src/api`, `admin/dashboard`), a hands-on test of a Shopify store (admin, storefront and the
Search & Discovery filters) and the current codebase. Where Medusa and Shopify diverge, the choice is
named. Edge cases are settled under **Rules**. Nothing here is open.

## Scope

Four ways to group products, all inside the product module:

- **Category** — what a product is and who it is for, as a tree (`Women › Bracelets`). Drives the
  storefront navigation and category pages. Many per product.
- **Collection** — a hand-picked merchandising group ("Summer 2026"). Drives collection pages. Many per
  product (ADR 0032).
- **Tag** — a free keyword ("organic-cotton", "gold"). Drives the tag filter on product lists. Many per
  product.
- **Product Type** — the one label naming what the product is ("T-shirt", "Sneakers"), as Shopify's
  `productType`. Admin-facing. Snapshotted as text onto line items.

The words are defined in `CONTEXT.md` (Product grouping); the industry survey behind them is
`docs/research/product-grouping-vocabulary.md`.

Plus the surfaces that consume them: admin CRUD and product assignment, store reads and filters on
`GET /store/products`, and storefront navigation, category and collection pages, and the tag filter.

**No shop data in storefront code.** The storefront holds no category names, collection handles or tag
values. Navigation comes from the Category tree and filter values from the products in view, so the same
code serves a clothing shop or a hardware shop.

**Every filter and sort runs in SQL.** Each filter below is a `WHERE` clause on the product list query in
the product module. Nothing is fetched whole and then filtered, sorted or paged in the JS runtime. A
filter that cannot be written that way at a reasonable implementation and runtime cost is out of scope
(see `.tasks/next-todos`, "Filter, sort and paginate by computed properties in the database"). Store
sellability is already decided in JS and passed to the list query as an id list; that existing step is
unchanged, and the new filters add nothing to it.

Out of scope:

- Translating names — `.scratch/store-translations/` already lists categories, collections, tags and
  types as reference types. Nothing here blocks it.
- Rule-based Computed Lists that a merchant configures (Shopify's automated collections).
- Faceted search with counts or greyed-out values. Shopify greys out every value that would return
  nothing; in SQL that is one extra grouped query per filter. Later.
- Configurable AND/OR per filter. Fixed: OR within one filter, AND across filters.
- Sales-ranked Computed Lists (Best Sellers, Trending Now) — they sort by units sold, aggregated in the
  order module. Blocked on the `.tasks/next-todos` item above.
- A search index.
- Restoring soft-deleted categories, collections, tags or types from the admin. Medusa exposes restore
  only as workflow compensation, never as an endpoint.
- Bulk assignment from the products list, and filter controls on the admin products list. Each entity's
  detail page lists its products.
- Handle redirects. Changing a handle breaks the old URL, as in Medusa.
- Manual product order inside a collection or category (Shopify's "Featured" sort). Lists follow `sort`.
- Type, tags and a breadcrumb on the product page. Shopify's default theme shows none of them.
- An admin-edited Navigation Menu — its own spec, next (see **Navigation Menu, later**).
- A `productTypeId` snapshot on line items. Medusa keeps one for tax rules; there is no tax module here.

## Why

The storefront is one flat product list. The header rail (`apps/store/src/components/header/nav.tsx`),
the side menu (`side-menu.tsx`) and the footer's Shop column all point only to `/`; the rail and the
side menu carry a comment waiting for a category taxonomy. The admin create flow has an Organize step
holding only `discountable`. Order and cart line items carry a `productType` column that is always null, because
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

**Copied:** the four-entity split and its relation shapes; sibling `rank`; handles generated from the
name; store category reads forced to `is_active && !is_internal`; `is_active` defaulting to false; soft
delete leaving `type_id` in place; refusing to delete a category with children; product assignment from
both sides; the admin category filter matching direct members only; the line-item snapshot of the type's
value.

**Not copied — one collection per product.** Medusa's `product.collection_id` is a single FK, and
assigning a product to a collection overwrites it (`product-module-service.ts`, `updateCollections_`).
Here a product joins Collections through a pivot, as in Shopify (ADR 0032).

**Not copied — Medusa defects:**

- **`mpath` materialised paths.** Moving a category to root sets an empty `mpath` and leaves its
  descendants' paths unrewritten (`repositories/product-category.ts:502-503`). A shop has tens of
  categories, so `parentId` alone is enough: recursive CTEs answer subtree, ancestor and visibility
  questions in SQL.
- **±1 rank shifts.** Medusa shifts a range of siblings by one on create, move and delete
  (`rerankSiblingsAfterCreation`, `rerankSiblingsAfterDeletion`, `rerankAllSiblings`). A shift moves
  ties and gaps with the range, so a duplicate rank never heals, and a move can create one. Here every
  create, move and reorder renumbers the sibling set (**Category rules**).
- **Store category filter without descendants.** `GET /store/products?category_id=` matches direct
  members only, so a "Clothing" page shows nothing when every product sits in "Clothing › Shirts".
- **The store visibility filter that never runs.** Medusa's `/store/products` validator rewrites
  `category_id` before the middleware that would add `is_active` and `is_internal`, so products stay
  reachable through a hidden category (`store/products/middlewares.ts:82-91`). Here the filter lives in
  the service call the route makes, so it cannot be skipped.
- **Unfiltered relation expansion.** Medusa's store category defaults expand `*parent_category` and
  `*category_children` without the visibility filter (`store/product-categories/query-config.ts:17-18`).
  Here the store reads one visible tree.
- **A 404 that never fires.** `GET /store/product-categories/:id` tests `!category` on an array and
  answers `200 {}` for a missing id (`store/product-categories/[id]/route.ts:31`).

**Not copied — project conventions:**

- **Live pivot rows under a soft-deleted tag or category.** Medusa leaves them in place. Here the
  pivots declare `on delete cascade`, so the derived cascade hides them and restores them with their
  owner.
- **Workflows and events for single-module CRUD.** Every write here touches only the product module and
  runs in one `withTransaction`, the same as `PATCH /admin/products/:id` today. No events until a
  subscriber needs one.
- **One permission per entity.** The grouping entities use the product module's existing permissions,
  as Product Options do (**Permissions**).
- **`external_id` and `metadata`.** Nothing reads them.

## How Shopify does it

Tested on a live store with the seed data below:

- **Category** is one per product, picked from Shopify's fixed global taxonomy. It sets the tax rate and
  adds attribute fields (Color, Size, Fabric, Target gender…) that become storefront filters. There is
  no category page. The picker drills down level by level; search returns a flat list showing each
  result's parent ("T-Shirts in Clothing Tops"), because several nodes share a name.
- **Collection** is the only page shoppers browse: image, title, description, filled by hand or by rules.
  The rule "Category is equal to Clothing Tops" matched 0 products with "Include subcategories" off and
  6 with it on — descendants are opt-in, off by default.
- **Hand-picking members** is a dialog with search and checkboxes. Current members come pre-checked;
  unchecking removes them. No row is ever greyed out.
- **Type and tags** are created inline from the product form ("Search or add"). There are no admin pages
  for either. Medusa has pages and no inline create; here both — inline create from the product form,
  and list pages for renaming and deleting.
- **Menus** are built by the merchant and nest up to three levels. Items link to collections, products
  or pages — never to a tag or a category — and a collection link takes an optional tag filter: "Men ›
  Tops" is the Tops collection filtered by `men`, at `/collections/tops/men`.
- **Storefront filters** (the Search & Discovery app) offer Category, Tags, Product type, Vendor,
  Availability and Price. URLs carry values or global taxonomy ids, never database ids
  (`filter.p.tag=cotton`, `filter.p.product_type=Crewneck`). Values are limited to products in the
  current list.
- **The product page** shows no type, tags, category or breadcrumb.

**Named divergence.** Shopify keeps "what a product is" (a global taxonomy) apart from "where shoppers
browse" (collections and menus). Here the merchant's Category tree is both, as in Medusa: one tree to
maintain, and the navigation follows from it.

## Design

### Tables

All in `apps/backend/src/modules/product/models/`, one file per table, each spreading `...timestamps`,
ids prefixed in SQL (ADR 0003). Pivots are named `product_product_<entity>`, like the existing
`product_product_option`. Every pivot has a single prefixed `id` primary key: the soft-delete walker
throws on composite keys (`core/db/cascade-walker.ts:333-344`).

**`product_category`** — prefix `pcat_`

| Column | Type | Notes |
|---|---|---|
| `name` | text, not null | |
| `description` | text, not null, default `''` | shown under the category page heading |
| `handle` | text, not null | `liveUniqueIndex` |
| `parentId` | text, nullable | references `product_category.id`, **`on delete restrict`** |
| `rank` | integer, not null, default 0 | order among siblings |
| `isActive` | boolean, not null, default false | shown on the store |
| `isInternal` | boolean, not null, default false | assignable in the admin, never shown on the store |

`liveIndex` on `(parentId, rank)`. `restrict` makes a live child a **guard** in the derived soft-delete
cascade (`docs/soft-delete-cascade.md`), so the walker refuses to delete a category with children
(`NOT_ALLOWED`) with no service code. It is the codebase's first guard inside its own closure:
`guard-outside-its-closure` warns until `product_category.parent_id` is added to `ALLOWED` in
`apps/backend/scripts/checks/guard-outside-its-closure.ts` with the reason, and the Restrict and Overlap
sections of `docs/soft-delete-cascade.md` must stop saying there are no such cases. The guard check reads
state before anything is hidden, so a parent and its child cannot be deleted in one call: subtrees go
leaf-first.

**`product_product_category`** — prefix `ppcat_`

`productId` → `product.id` **cascade**, `categoryId` → `product_category.id` **cascade**.
`liveUniqueIndex` on `(productId, categoryId)`, `liveIndex` on `categoryId`. Both cascades mean
soft-deleting either end hides the row.

**`product_collection`** — prefix `pcol_`

`title` not null, `handle` not null (`liveUniqueIndex`), `thumbnail` text nullable — a URL from
`POST /admin/uploads`, as `product.thumbnail` is.

**`product_product_collection`** — prefix `ppcol_`

`productId` → `product.id` cascade, `collectionId` → `product_collection.id` cascade.
`liveUniqueIndex` on `(productId, collectionId)`, `liveIndex` on `collectionId`.

**`product_tag`** — prefix `ptag_`

`value` not null, `liveUniqueIndex`.

**`product_product_tag`** — prefix `pptag_`

`productId` → `product.id` cascade, `tagId` → `product_tag.id` cascade. `liveUniqueIndex` on
`(productId, tagId)`, `liveIndex` on `tagId`.

**`product_type`** — prefix `ptyp_`

`value` not null, `liveUniqueIndex`.

**`product`** gains `typeId` → `product_type.id`, nullable, `liveIndex`, **`on delete set null`**.
`set null` puts it outside the derived cascade, so soft-deleting a Product Type leaves the id in place.

Cart and order line items are unchanged: `productType` already exists on both.

### Migrations

The product module has one migration, `0000_create_product_tables.sql`, regenerated in place
(`standards/rules/backend/modules/__docs__/modules.md:65`). `db:generate` passes no name, so on an empty
folder it would write a randomly named file. Instead, from `apps/backend`: remove
`src/modules/product/migrations/`, run
`dotenvx run -f ../../.env.local -- drizzle-kit generate --config=src/modules/product/database.config.ts --name=create_product_tables`,
then `pnpm --filter backend run db:restart`. Each slice regenerates it again.

**Production is wiped, not migrated.** A regenerated `0000` would re-run `CREATE TABLE product` against
the existing database. After each slice is deployed, run `db:restore:staging` against production: it
drops the `drizzle` and `public` schemas, migrates and seeds (it reads the root `.env`, which is
production — `docs/deployment.md`). This destroys production data, which is accepted.

### Permissions

The grouping entities live under the product module's existing `product.read`, `product.create`,
`product.update` and `product.delete`, as Product Options do (`modules/product/index.ts`,
`workflows/admin/utils/build-sidebar.ts`). No new permission keys; the Catalogue Editor role
(`product.*`) covers them. Reordering a category and changing a category's or collection's members need
`product.update`.

### Service

`ProductModuleService` stays the one exposed service. It delegates to two private helpers, built in its
constructor the way `ProductOptionService` is: `ProductCategoryService` (tree, rank, visibility) and
`ProductGroupingService` (collections, tags and types — the same CRUD three times). Every new public
method is added to `IProductModuleService` (`core/types/product/service.ts`), since `Module()` refuses
methods the contract does not name. The new tables go into `models` and `repositories` in
`modules/product/index.ts`; the cascade graph is built from `models`.

Public methods:

- **Categories:** `listCategoryTree({ visibleOnly })`, `retrieveCategory`, `createCategory`,
  `updateCategory`, `softDeleteCategories`, `setCategoryProducts(categoryId, { add, remove })`.
- **Collections:** `listAndCountCollections`, `retrieveCollection`, `createCollection`,
  `updateCollection`, `softDeleteCollections`, `setCollectionProducts(collectionId, { add, remove })`.
- **Tags / types:** `listAndCount*`, `retrieve*`, `create*`, `update*`, `softDelete*`.
- **Products:** `CreateProductDTO` and `UpdateProductDTO` gain `typeId`, `categoryIds`,
  `collectionIds`, `tagIds`. Each `*Ids` array replaces the product's set, using the diff the product
  options already use: soft-delete the dropped pivot rows, keep the rest, create the new ones.
- **Embeds:** `listProductGroupings(productIds)` returns each product's `type`, `categories`,
  `collections` and `tags`, one query per relation over the whole id list. The repository joins no
  relations today (`listProducts` returns flat rows), so every embed and the line-item snapshot go
  through this method.
- **Tag values in view:** `listProductTagValues(filters)` — the distinct tag values on products
  matching `filters` minus the tag filter itself. One `SELECT DISTINCT`.

**Filters.** `FilterableProductProps` gains:

| Key | Caller | SQL |
|---|---|---|
| `typeId` | admin | `type_id = ANY($1)` |
| `tagId` / `tagValue` | admin / store | `EXISTS` on `product_product_tag` joined to `product_tag` |
| `collectionId` / `collectionHandle` | admin / store | `EXISTS` on `product_product_collection` (joined to `product_collection` for the handle) |
| `categoryId` / `categoryHandle` | admin / store | `EXISTS` on `product_product_category` |
| `includeDescendants`, `visibleOnly` | store | widen the category match to a recursive CTE over `product_category` |

Each key takes one value or an array; OR within a key, AND across keys. `buildFilters` silently drops
keys that are not columns (`core/utils/build-filters.ts:58-59`), so these are explicit clauses, ANDed
with everything else — including an `id` filter the caller already set, such as the store's sellable
ids. Never overwrite `id` (`product-option-service.ts:311` does; don't copy it). Every level of a
recursive CTE filters `deleted_at IS NULL` by hand.

The clauses must reach both the page query and its count, but `buildWhere` and `countRows` are private
in `core/utils/base-repository.ts`. `BaseRepository` gains a protected hook, `extraWhere(filters)`,
that `find` and `countRows` both AND in; `ProductRepository` overrides it.

**Category rules:**

- **Handle** — `toHandle(name)` when absent, the same helper as products. Request schemas require at
  least one character. Never regenerated on update.
- **Rank** — every create, move and reorder renumbers the target sibling set, in one transaction: read
  the live siblings ordered by `(rank, id)`, leaving out the row being placed; insert it at
  `min(requested rank, sibling count)` (append when no rank is given); then write `rank = position` for
  the whole set. Duplicates and gaps left by anything else heal on the next write. A deletion, and a
  move out of a set, leave a gap, which changes no order.
- **Move / reorder** — `updateCategory(id, { parentId, rank })`. `parentId` absent keeps the parent,
  `null` moves to root. Moving a category under itself or a descendant throws `INVALID_ARGUMENT`,
  checked with a recursive CTE over the moved category's descendants.
- **Visible** — active, not internal, and every ancestor visible: one recursive CTE from the roots.
  A hidden category hides its whole subtree.

### Route conventions

Every endpoint follows `standards/rules/backend/api/__docs__/routes.md`:

- **Layout.** One folder per domain — `product-categories/`, `collections/`, `product-tags/`,
  `product-types/` — holding `route.ts`, `[id]/route.ts` and one `definitions.ts`. Product assignment
  is the nested sub-resource `[id]/products/route.ts`. Helper logic belongs in the service.
- **Contract.** Each handler co-exports `Input` / `Output` and, where it raises, `Throws` (`as const`).
  Schemas live in `packages/http-schemas/src/{admin,store}/<domain>/` and are exported from
  `admin/index.ts` / `store/index.ts`. Each domain gets an OpenAPI tag in `framework/http/types.ts`, and
  its `definitions.ts` is imported and spread into `adminDefinitions` / `storeDefinitions` in
  `src/routes.ts`.
- **Statuses.** Create answers 201; everything else 200. `DELETE` returns the shared `DeleteResponse`.
- **Throws.** `DUPLICATE_ERROR` (handle or value taken), `NOT_FOUND` (missing row or unknown assigned
  id), `INVALID_ARGUMENT` (category moved under itself or a descendant) and `NOT_ALLOWED` (category with
  children deleted) are raised in the module, not the handler. Routes declare them and suppress
  `route-declares-unthrown-error` with the reason written above the suppression. Unknown assigned ids
  reach two product routes: `POST /admin/products` declares `[...createProductWorkflow.throws,
  ErrorTypes.NOT_FOUND]` (the workflow declares none of its own today), and `PATCH
  /admin/products/:id` gains a `Throws` for `NOT_FOUND`. Both are forwarded in `definitions.ts`.
- **Assignment.** `{ add, remove }` applies `add` then `remove`. Adding a member or removing a
  non-member is a no-op. Responds with the category or collection.
- **Auth.** Admin routes keep the `required` default and gate on the product permissions. Store routes
  are `auth: 'public'`, like store product browsing.
- **Finish.** `pnpm run openapi:generate` regenerates both specs and the Orval clients, then
  `pnpm run verify`.

### Admin API

| Endpoint | Notes |
|---|---|
| `GET /admin/product-categories` | the whole tree, nested `children`, no params — a shop has tens of categories |
| `POST /admin/product-categories` | |
| `GET/PATCH/DELETE /admin/product-categories/:id` | `PATCH` carries `parentId` + `rank` for Organize |
| `POST /admin/product-categories/:id/products` | `{ add: string[], remove: string[] }` |
| `GET/POST /admin/collections`, `GET/PATCH/DELETE /admin/collections/:id` | list takes `q`, `offset`, `limit` |
| `POST /admin/collections/:id/products` | `{ add, remove }` |
| `GET/POST /admin/product-tags`, `GET/PATCH/DELETE /admin/product-tags/:id` | list takes `q` |
| `GET/POST /admin/product-types`, `GET/PATCH/DELETE /admin/product-types/:id` | list takes `q` |
| `GET /admin/products` | gains `categoryId` (direct members only), `collectionId`, `tagId`, `typeId` — the entity detail pages list through it |
| `POST /admin/products`, `PATCH /admin/products/:id` | gain `typeId`, `categoryIds`, `collectionIds`, `tagIds` |
| responses of `POST /admin/products`, `GET` and `PATCH /admin/products/:id` | embed `type`, `categories`, `collections`, `tags` |

### Store API

| Endpoint | Notes |
|---|---|
| `GET /store/product-categories` | the visible tree, nested, no params. The only store category endpoint |
| `GET /store/collections` | `handle` — one or several. Feeds the collection page |
| `GET /store/products` | gains `category` (handle, includes visible descendants), `collection` (handle) and `tag` (value, repeatable). Response unchanged |
| `GET /store/product-tags` | takes `countryCode`, `q`, `category` and `collection`; returns the tag values on the products `/store/products` would list for the same params, minus `tag`. Feeds the tag chips |

**Store parameters are handles and values, never ids.** Ids are generated per database, and a storefront
URL must survive a reset — the same reason Shopify's URLs read `filter.p.tag=cotton`. A tag value is
unique among live tags, as is a handle.

**Visible** is one rule for every store read: the category is active, not internal, and every ancestor
is visible too. A category filter on a hidden category matches nothing.

The new filters merge into the existing `listAndCountProducts({ ...filters, status: 'published', id:
sellableProductIds })` call in `api/store/products/route.ts`, so pricing and stock stay untouched. The
route maps its params explicitly — `category` → `{ categoryHandle, includeDescendants: true,
visibleOnly: true }`, `collection` → `collectionHandle`, `tag` → `tagValue` — because a spread would
pass them as non-column keys, which are dropped. The sellable-id step (`route.ts:47-55`, which needs the
pricing context from `countryCode`) moves into a helper that both store product routes call.

### Line item snapshot

`prepareLineItemData` takes a flat `ProductDTO`, and the add-to-cart workflow reads products with
`listProducts` (`add-to-cart.ts:96`), which joins nothing. So `PrepareLineItemDataInput` gains
`productType: string | null`, filled in the workflow's `prepare-line-items` step from
`listProductGroupings` for the products in the request, and `prepareLineItemData` copies it onto the
line. `complete-cart.ts`
already copies `productType` to the order line (`:377`). No column changes. Lines stay frozen at add
time: changing a product's type never rewrites a line, and re-adding a variant merges into the existing
line, which keeps its type. Lines added before this change keep `null`.

### Storefront

- **Tree.** Fetched in the `_main` route loader — the nav renders only under `_main`
  (`routes/_main/route.tsx`), not under `_auth`, `_checkout` or the root 404. The query factory lives in
  shared `apps/store/src/api/product-categories.ts`, because shared components may not import features.
  Child loaders reuse it through `ensureQueryData`. ADR 0013's statement that layout routes have no
  loaders is updated.
- **Navigation.** The header rail lists the top-level visible Categories (`lg:` only, as today). A
  Category with children opens a panel listing its visible children by rank, plus "Shop all <name>"; a
  Category without children links straight to its page. The side menu, the phone navigation, nests the
  same items. The footer's Shop column lists "Shop all" and the top-level Categories. Category names
  come from data; the nav's only Store Copy is "Shop all" and "Shop all <name>", with `es.po` entries.
- **Category page** — `/categories/$handle` at `routes/_main/categories/$handle.tsx`, server-rendered
  (ADR 0013). Resolves the category, its ancestors (breadcrumb) and its children (chips) from the cached
  tree, with no extra request. Description under the heading. Then the product list with `category` in
  the query. A handle missing from the visible tree renders an in-chrome not-found state modelled on
  the product page's `ProductError` (`features/products/components/product-error.tsx`), with its own
  copy.
- **Collection page** — `/collections/$handle`, server-rendered. Loads `GET /store/collections?handle=`
  and the product list with `collection=<handle>` in parallel. Hero from `title` and `thumbnail`. Same
  not-found state.
- **Tag filter** — a repeatable `tag` search param on every product list. The chips come from
  `GET /store/product-tags` for the same scope; selected chips are removable. OR within the filter.
- **Product list.** `ProductList` and `ProductListHeader` are bound to `getRouteApi('/_main/')` today;
  they take the scope (category or collection), the heading and the empty-state link as props, and the
  search schema moves into the feature. The empty state links to "Shop all"; "Clear search" keeps the
  scope. `q`, `sort` and `offset` work everywhere.
- **Product page** — unchanged.

Mobile-first: the side menu is the phone navigation, the rail is `lg:` only (already the case).

### Computed Lists

A Computed List is a product list ordered by a `sort` value, so its scope comes from the page. New Arrivals is
`sort=newest`, which is already the default order — a "New Arrivals" link would show the same page, so
none is added. Best Sellers and Trending Now sort by units sold, which no product table stores; they wait
for the `.tasks/next-todos` item, and a "Featured" panel column arrives with them.
`features/products/components/search-best-sellers.tsx` keeps its `TODO(product-groups)` until then.

### Navigation Menu, later

What stays in the developer's hands here is the panel's shape and its "Shop all" links. The next spec gives the
merchant a Navigation Menu, as Shopify does: nested items, each linking to a Category, a Collection or a
Computed List with optional tag filters (Shopify's "Filter collection with tags"), or to a URL. The
storefront then reads the menu instead of deriving it from the tree. Nothing in this spec's data model
changes.

### Admin

- **Sidebar** — Categories, Collections, Tags and Types under Products, gated on `product.read`. New
  icons go in three places: the `SidebarIcon` union in `build-sidebar.ts:3-13`, the zod enum in
  `packages/http-schemas/src/admin/user/responses.ts`, and the map in
  `apps/admin/src/components/layout/nav.tsx`. Labels go in `SIDEBAR_LABELS`
  (`components/layout/use-sidebar-label.ts`); `api/admin/users/me/__tests__/sidebar.test.ts` gains the
  children.
- **Category picker** — loads the tree once. Drills down level by level, and search returns a flat list
  showing each result's path ("Tops in Men"), since names repeat across the tree. Used for a category's
  parent and in the product form.
- **Categories** — the list is an indented tree. Create/edit form: name, handle, description, "Active"
  (`isActive`, off by default), "Internal" (`isInternal`), parent. Whether a category is a Visible
  Category also depends on its ancestors, so the form shows no "visible" label. Detail page with a products
  section — direct members only — with add through the product picker and remove per row. **Organize**
  page: a drag tree (`@dnd-kit/*` is already a dependency; port Medusa's sortable tree) that PATCHes
  `parentId` + `rank` on drop, with optimistic update and rollback.
- **Product picker** — a dialog with search and checkboxes, as Shopify's. Current members come
  pre-checked; unchecking removes. "Done" sends the difference as `{ add, remove }`. Nothing is greyed
  out, so the DataTable needs no disabled-row option.
- **Collections** — DataTable list; create/edit (title, handle, thumbnail through `POST
  /admin/uploads`); detail page with a products section using the product picker.
- **Tags, types** — DataTable list, create/edit (rename), delete, and a detail page with a read-only
  product list. Copy the `product-options` route layout and `use-option-products-table`.
- **Product** — an Organization card in the side column of the product detail page (edit drawer, ADR
  0019) and the create flow's Organize step edit `typeId`, `categoryIds`, `collectionIds`, `tagIds`.
  Type is a single-select combobox and Tags a multi-select; both gain a creatable "Add <value>" option,
  which creates the row inline (`SingleComboboxField` cannot create values today). Collections is a
  multi-select over existing rows; Categories uses the category picker. No multi-select form field is
  registered today; one is added.
- **Delete dialogs** name the entity only ("You are about to delete the category Shirts").
- **Copy** — every new string goes through Lingui with an `es.po` entry; `verify` fails otherwise.

## Rules

| Case | Rule |
|---|---|
| Category empty in the shopper's market | Shown anyway. The tree ignores markets and product counts; the page renders the empty state |
| Duplicate handle or value | `DUPLICATE_ERROR`; no auto-suffix |
| Handle format | At least one character; generated with `toHandle` when absent |
| Category and collection share a handle | Allowed — separate tables, separate routes |
| Tag or type value casing and whitespace | Stored as sent; uniqueness is exact and case-sensitive |
| `?tag=a&tag=b` | Any of the tags (OR) |
| Several filters together | AND across filters, OR within one |
| Admin `categoryId` filter | Direct members only, so the category's products section lists what it can remove |
| Store `category` filter | The category plus its visible descendants |
| Delete a tag or type in use | Allowed; products lose it, line-item snapshots keep the text. A soft delete leaves `type_id` in place: `set null` fires only on a hard delete |
| Delete a category or collection with products | Allowed; its pivot rows are hidden, products stay |
| Delete a category with children | `NOT_ALLOWED`; delete leaf-first |
| Add a product already in collection A to collection B | It is in both (ADR 0032) |
| Add a member that is already in, remove one that is not | No-op |
| Product points at a soft-deleted type, tag, collection or category | Writes check the FK only, so the id is accepted; reads join live rows only. The admin offers live rows only |
| Product in a parent and its child category | Allowed |
| Tree depth | Unlimited |
| Concurrent reorders | No lock. The last write wins; the next write in that sibling set renumbers it |
| Unknown id in `categoryIds` / `collectionIds` / `tagIds` / `typeId` | FK violation, mapped to `NOT_FOUND` (`db-error-mapper.ts:106-124`) |

## Slices

Vertical, in order — each slice regenerates the product migration and the generated clients, so they
cannot run in parallel. Each adds its own seed data and its journey tests, and ends with
`pnpm run verify` green.

1. **Categories, append-only** — category table and pivot, tree and visibility, the category filters
   and the `extraWhere` repository hook, admin and store endpoints, `categoryIds` on products. Parent is
   set on create only (`PATCH` takes neither `parentId` nor `rank` yet), and create follows the Rank
   rule. Delete ships here too, so the `restrict` guard, its `ALLOWED` entry, the cascade doc update and
   the `NOT_ALLOWED` test land in this slice. Admin: sidebar, categories list/form/detail, the category
   picker, the product picker, the product Organization card and Organize step (categories only).
   Storefront: tree, navigation, product list refactor and `/categories/$handle`. This is the spec's
   Why.
2. **Organize** — move and reorder (`PATCH` with `parentId` and `rank`), the descendant check, the drag
   tree page.
3. **Collections** — table, pivot, thumbnail, admin pages reusing the product picker,
   `collectionIds`, `GET /store/collections`, the `collection` filter and `/collections/$handle`.
4. **Types and tags** — tables, `typeId`, inline create, admin pages, the `tag` filter, the shared
   sellable-id helper, `GET /store/product-tags` and the chips, and the line-item `productType`
   snapshot.

## Testing

One test per journey. Backend against real Postgres:

- **Category tree** — create and nest; an inactive parent hides its subtree; the store tree, and the
  store `category` filter including descendants; the admin `categoryId` filter matching direct members;
  deleting a category with children is `NOT_ALLOWED`.
- **Organize** — move and reorder renumber the sibling sets; moving under a descendant is
  `INVALID_ARGUMENT`.
- **Collections** — assign from both sides; one product in two collections; soft-deleting a collection
  hides its memberships; the store `collection` filter.
- **Types and tags** — the `tag` filter is OR; tag values in view exclude the tag filter itself;
  deleting a type keeps line snapshots; add-to-cart snapshots `productType` (`add-to-cart.test.ts`).

E2E, written with the slices and run on request: storefront nav → category → child chip → product;
collection page; tag chips. Admin: create a category, assign a product, see it on the store; drag to
reorder.

## Seed data

Over the 14 products in `scripts/seed-dev.ts`. Men/Women are top-level Categories, so a unisex product
sits under both; handles are unique across the tree, hence the prefixes. Every seeded Category is
active.

| Category (handle) | Products |
|---|---|
| Men (`mens`) › Tops (`mens-tops`) | Men's T-shirt, Workout Shirt |
| Men › Sweatshirts (`mens-sweatshirts`) | Hoodie, Men's Crewneck |
| Men › Bottoms (`mens-bottoms`) | Sweatpants, Shorts |
| Men › Shoes (`mens-shoes`) | High Top, White Leather, Gray Leather, Canvas, Gray Runners |
| Women (`womens`) › Tops (`womens-tops`) | Women's T-shirt, Workout Shirt |
| Women › Sweatshirts (`womens-sweatshirts`) | Hoodie, Women's Crewneck |
| Women › Bottoms (`womens-bottoms`) | Leggings, Sweatpants |
| Women › Shoes (`womens-shoes`) | High Top, White Leather, Gray Leather, Canvas, Gray Runners |

- **Product Types:** T-shirt (both T-shirts, Workout Shirt), Hoodie, Crewneck, Sweatpants, Shorts,
  Leggings, Sneakers (4), Running Shoes.
- **Tags:** `organic-cotton` (both T-shirts), `cotton` (Hoodie, both crewnecks), `leather` (White and
  Gray Leather Sneakers), `canvas` (Canvas Sneakers), `nylon` (Shorts, Workout Shirt).
- **Collections:** Essentials (T-shirts, crewnecks, Hoodie, Sweatpants) and Active (Workout Shirt,
  Shorts, Leggings, Gray Runners, Hoodie) — Hoodie sits in both.

No caching is added for the tree or the category and collection pages: they are fetched per request
like the rest of the store's reads.

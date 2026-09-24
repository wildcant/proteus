# Product grouping vocabulary: Category, Collection, Tag, Product Type

Research date: 2026-09-24. Question: what do the major commerce platforms mean by Category, Collection, Tag and Product Type (plus taxonomy, attribute/facet, navigation menu, catalog), and which definitions should proteus adopt?

Local Medusa citations are to `/Users/willo/learn/medusa/medusa-source` at commit `ff05de80`. The paths are relative to that checkout. Web citations were fetched on the research date.

## 1. Shopify

- **Product type**: "The product type that merchants define." ([Product object](https://shopify.dev/docs/api/admin-graphql/latest/objects/Product)). The Help Center says: "A product type, previously referred to as custom product type, is a way to define a custom category". A product has at most one, and product types "aren't required" ([help: product type](https://help.shopify.com/manual/products/details/product-type)). It is a free-text string that the merchant owns.
- **Category**: "The category of a product from Shopify's Standard Product Taxonomy" ([Product object](https://shopify.dev/docs/api/admin-graphql/latest/objects/Product)). A product can have only one category. The category unlocks "category metafields", decides tax rates through Shopify Tax, and supports channels "that require a standardized product type, such as Facebook or Google" ([help: product category](https://help.shopify.com/en/manual/products/details/product-category)). The same page separates the two fields: "Product category is a standard field from Shopify's Standard Product Taxonomy" while "product type is a custom field that is unique to your products". The taxonomy is open source. Its README says it "encompasses categories, attributes, and values" across "25+ essential verticals" ([Shopify/product-taxonomy](https://github.com/Shopify/product-taxonomy)).
- **Tags**: "A comma-separated list of searchable keywords that are associated with the product" ([Product object](https://shopify.dev/docs/api/admin-graphql/latest/objects/Product)). A product can have up to 250 tags. Tags drive collection filtering and automated-collection conditions ([help: tags](https://help.shopify.com/en/manual/products/details/tags)).
- **Collection**: "a group of products that merchants can organize to make their stores easier to browse and help customers find related products" ([Collection object](https://shopify.dev/docs/api/admin-graphql/latest/objects/Collection)). `Product.collections` is "A list of collections that include the product", so one product can belong to many collections ([Product object](https://shopify.dev/docs/api/admin-graphql/latest/objects/Product)).
  - In the legacy model, a collection was either *manual/custom* (products picked by hand) or *smart* ("uses selection conditions to automatically include matching products") ([help: smart collections](https://help.shopify.com/en/manual/products/collections/smart-collections)). Rule conditions can match `TYPE`, `TAG`, `VENDOR`, `PRODUCT_CATEGORY_ID`, price, metafields and other fields ([CollectionRuleColumn](https://shopify.dev/docs/api/admin-graphql/latest/enums/CollectionRuleColumn)). This means type, tag and category all feed collections.
  - API version 2026-07 introduced a new model in which "A collection is a union of sources": manual picks, conditions, sub-collections (one level deep) and app-owned sources ([use the new collections model](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/use-new-collections-model); [help: collections](https://help.shopify.com/en/manual/products/collections)).
- **Navigation menu**: menus "display and organize links to products, collections, webpages, blog posts, and more" and are managed under Content > Menus ([help: menus](https://help.shopify.com/en/manual/online-store/menus-and-links)). A menu supports "up to two levels of nested drop-down menus" ([help: drop-down menus](https://help.shopify.com/en/manual/online-store/menus-and-links/drop-down-menus)). Shopify builds the storefront tree from menus, not from categories. Collections are flat, and menus supply the hierarchy.

## 2. Medusa v2

### Data model

All four entities are defined in `packages/modules/product/src/models/product.ts`:

- `type`: `belongsTo(ProductType).nullable()` (lines 103–107). Each product has zero or one type.
- `tags`: `manyToMany(ProductTag)` through `product_tags` (lines 111–114).
- `collection`: `belongsTo(ProductCollection).nullable()` (lines 133–137). This is a single foreign key.
- `categories`: `manyToMany(ProductCategory)` through `product_category_product` (lines 141–144).

`ProductType` (`models/product-type.ts`) has only `value` (unique), `external_id` and `metadata`. It has no attributes, no behaviour flags and no hierarchy. `ProductTag` has the same shape (`models/product-tag.ts`). `ProductCollection` adds `title` and a unique `handle` (`models/product-collection.ts`). `ProductCategory` is the only tree: it has `parent_category`, `category_children`, `mpath`, `rank`, `is_active`, `is_internal` and `handle` (`models/product-category.ts:8–22`).

The user guide says so directly:

- "A product can be in a single collection." (`www/apps/user-guide/app/products/collections/page.mdx:25`)
- "A product can be in multiple categories." (`www/apps/user-guide/app/products/categories/page.mdx:27`)
- A collection is "a group of products that share a common theme or purpose. For example, a summer collection…" (`collections/page.mdx:23`)
- A category is "a group of products that belong to a similar type or theme. For example, a 'Shoes' category…" (`categories/page.mdx:23`)
- "Product tags allow you to group products in your store by common tags. For example… 'electronics' or 'clothing'" (`settings/product-tags/page.mdx:22`)

### Checking the claim about Medusa's product type

The claim under test: *"Medusa product type = high-level classification for broad product traits (e.g. Physical vs Digital); managed under store settings rather than merchandising trees; use case broad administrative sorting and fulfillment logic."*

| Part of the claim | Verdict | Evidence |
|---|---|---|
| "Physical vs Digital" example | **Supported (the user guide is the source)** | "Product types are useful to group products by a general type, such as "Physical" and "Digital" product types." (`www/apps/user-guide/app/settings/product-types/page.mdx:22`). The create form's example value is also "Digital" (line 36). No other doc pairs "digital" with product type. The digital-products recipe models digital goods as a separate custom `digital_product` module, not as a product type (`www/apps/resources/app/recipes/digital-products/examples/standard/page.mdx:115`). |
| "high-level classification for broad product traits" | **Partly supported** | "Group products by a general type" backs "general". Nothing in the data model enforces "high-level" or "traits": the model is a single free-text `value`. Medusa's own tax doc uses the product type "Shirt" (`www/apps/resources/app/commerce-modules/tax/tax-rates-and-rules/page.mdx:46`), which is a merchandise kind, not a broad trait. |
| "managed under store settings" | **Supported** | Settings sidebar entry `/settings/product-types` (`packages/admin/dashboard/src/components/layout/settings-layout/settings-layout.tsx:82–85`). The user guide says "go to Settings → Product Types" (`product-types/page.mdx:24`). Collections and categories are under the Products nav instead (`main-layout/main-layout.tsx:198–209`). **Caveat:** product tags are also under Settings (`settings-layout.tsx:86–89`), so the placement shows that the entity is a flat lookup list, not that it has a special "trait" meaning. |
| "rather than merchandising trees" | **Supported** | ProductType has no parent or children. Only ProductCategory is a tree (above). |
| "use case: broad administrative sorting" | **Weakly supported** | The docs only say "group products" (line 22). The admin list can be filtered and sorted (line 24). |
| "use case: fulfillment logic" | **Not supported** | Nothing under `packages/modules/fulfillment/src` references the product type. The only `type_id` there is `shipping_option_type_id` (`models/shipping-option.ts:30`). Medusa routes fulfillment by **shipping profile**: "A shipping profile groups products with similar shipping requirements" (`www/apps/user-guide/app/settings/locations-and-shipping/shipping-profiles/page.mdx:22`). The code does consume product type in two places. **Tax overrides** match rules with `reference: "product_type"` (`packages/modules/tax/src/services/tax-module-service.ts:449–462, 786–787`; the user guide mentions overrides "for specific products or product types" in `settings/tax-regions/page.mdx:27`). **Promotion rules** use `items.product.type_id` (`packages/medusa/src/api/admin/promotions/utils/rule-attributes-map.ts:81–82`), and category, collection and tag are available in the same way (lines 66–90). |

**Verdict:** The example and the admin placement are accurate. "Fulfillment logic" is wrong: Medusa uses shipping profiles for that. The actual machine uses of product type are tax-rate overrides and promotion targeting. In the model, Medusa's product type is a single-valued, merchant-defined free-text label. That is Shopify's meaning, not a structural kind and not an attribute schema.

## 3. BigCommerce

- **Categories**: "Categories are a hierarchy of products available on the store, presented in a tree structure". "You can associate products with multiple categories", and no primary category exists ([Catalog overview](https://docs.bigcommerce.com/docs/store-operations/catalog)). `product.categories` is "An array of IDs for the categories to which this product belongs… Does not accept more than 1,000 ID values" ([api-specs `reference/catalog/products_catalog.v3.yml:8152–8155`](https://github.com/bigcommerce/api-specs/blob/dcf48407308710b882374ffafbeefdb0b3598abe/reference/catalog/products_catalog.v3.yml#L8152)).
- **Category trees per channel**: "`channel_id` is required to create a Category Tree. You can assign one `channel_id` to one category tree" ([`category-trees_catalog.v3.yml:391`](https://github.com/bigcommerce/api-specs/blob/dcf48407308710b882374ffafbeefdb0b3598abe/reference/catalog/category-trees_catalog.v3.yml#L391)).
- **Brand**: a single `brand_id` per product (`products_catalog.v3.yml:8162–8167`).
- **Custom fields**: free name/value pairs, "200 maximum custom fields per product" (`products_catalog.v3.yml:8428`).
- **Product `type`**: "The product type. One of: `physical` - a physical stock unit, `digital` - a digital download" (`products_catalog.v3.yml:8066`). This is the only primary source found that makes physical vs digital a *structural* product type.
- **No collections or tags**: the catalog API has no collection or tag resource. The catalog spec folder contains only brands, categories, category-trees, products, modifiers, variant options and variants ([api-specs `reference/catalog`](https://github.com/bigcommerce/api-specs/tree/dcf48407308710b882374ffafbeefdb0b3598abe/reference/catalog)).

## 4. Salesforce B2C Commerce

- **Catalog**: "Catalogs are containers of products… and can be shared between sites". They are "organized into a tree of categories with a single top-level root category". *Product catalogs* hold PIM data, and *site catalogs* "define the storefront's category structure and contain primarily product-to-category assignments" ([dw.catalog.Catalog](https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_Catalog.html)).
- **Category assignments and primary category**: a product has "a collection of category assignments… in the current site catalog" (many) and one "primary category of the product within the current site catalog" ([dw.catalog.Product](https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_Product.html)).
- **Classification category**: "A product has a single classification category… The classification category defines the attribute set of the product" (same page). This is the platform's attribute-schema mechanism, and it is carried by a category rather than by a "type".
- **Product type**: a set of structural flags `bundle`, `item` ("a standard item"), `master`, `option`, `set`, `variant` and `variationGroup` (commerce-sdk-isomorphic 5.6.0 `lib/index.esm.d.ts:35790–35815`, the `ProductType` document).
- There are no collections or tags as first-class objects.

## 5. Adobe Commerce (Magento)

- **Product types**: simple ("a physical item with a single SKU"), configurable, grouped, virtual ("not a tangible product… services, memberships"), bundle, downloadable ("one or more files that are downloaded") and gift card ([Create a product](https://experienceleague.adobe.com/en/docs/commerce-admin/catalog/products/product-create)). These are structural kinds that change behaviour.
- **Attribute set**: "used as a template for the product record… determines the fields that are available during data entry" ([Attribute sets](https://experienceleague.adobe.com/en/docs/commerce-admin/catalog/product-attributes/create/attribute-sets)). This is the attribute schema, and it is separate from the product type.
- **Categories**: "Products can be assigned to zero or more categories". "The category structure of the catalog is reflected by the main menu — or top navigation — of the store" ([Categories](https://experienceleague.adobe.com/en/docs/commerce-admin/catalog/categories/categories)). Categories are also the navigation.
- **Anchor category**: when set to Yes, it "displays products from the sub-categories in the category even if they haven't been explicitly added… and enables the display of the filter by attribute section in the layered navigation" ([Display settings](https://experienceleague.adobe.com/en/docs/commerce-admin/catalog/categories/create/categories-display-settings)).
- **Layered navigation** "makes it easy to find products based on category, price range, or any other available attribute" and is "available only for anchor categories" ([Layered navigation](https://experienceleague.adobe.com/en/docs/commerce-admin/catalog/catalog/navigation/navigation-layered)). In Magento terms, facets come from attributes.

## 6. commercetools

- **ProductType**: "Product Types are used to describe common characteristics, most importantly common custom Attributes, of many concrete Products" ([Product Types](https://docs.commercetools.com/api/projects/productTypes)). The field is required on `ProductDraft`: "The Product Type defining the Attributes for the Product. Cannot be changed later" ([SDK `models/product.ts:399–404`](https://github.com/commercetools/commercetools-sdk-typescript/blob/09727c0f591a40a01d1b0add921da0d1ffda91c0/packages/platform-sdk/src/generated/models/product.ts#L399); also line 242). It is a schema, not a label.
- **Category**: "Categories help organize your Products into various classifications… Products can belong to multiple Categories, and there can be different Category hierarchies for various purposes and Channels" ([Categories](https://docs.commercetools.com/api/projects/categories)). `ProductData.categories: CategoryReference[]`, and `categoryOrderHints` gives "Numerical values to allow ordering of Products within a specified Category" (SDK `product.ts:320–329`).
- **Product Selections**: "Manage individual Store assortments through Product Selections" ([Product Selections](https://docs.commercetools.com/api/projects/product-selections)). This is the nearest counterpart to a collection, but it is scoped to assortments.
- **No product tags**: `ProductData` has `categories`, `searchKeywords` and `attributes` but no `tags` field (SDK `product.ts:311–400`).

## 7. Google Merchant Center

- `google_product_category`: "ensure correct categorization and taxonomy". It takes a Google taxonomy ID or full path and is "Repeated field: No" ([answer 6324436](https://support.google.com/merchants/answer/6324436)).
- `product_type`: "include your own internal product categorization system in your product data". Examples include `Home > Women > Dresses > Maxi Dresses`. It can be submitted "up to 5 times", and it lets merchants "define your own taxonomy to match your store's navigation" ([answer 6324406](https://support.google.com/merchants/answer/6324406)). Google's `product_type` is the merchant's *own category path*. This is the same pairing Shopify uses (standard category vs merchant-defined type).

## 8. Schema.org and GS1

- Schema.org `category`: "A category for the item. Greater signs or slashes can be used to informally indicate a category hierarchy". It is valid on `Product` and `Offer` ([schema.org/category](https://schema.org/category)). Schema.org has no separate product-type or collection property for products.
- GS1 GPC: "The GPC Schema is the whole of the GPC classification system, Segment, Family Class, Brick and Attribute, used by both sides of trading partner relationship a common language for grouping products" ([GS1 support](https://support.gs1.org/support/solutions/articles/43000734164-what-is-the-gpc-schema-)). This is a standard taxonomy in the same role as Shopify's or Google's.

## Synthesis

### Comparison (meaning; cardinality per product)

| Platform | Category | Collection | Tag | Product type |
|---|---|---|---|---|
| Shopify | Standard-taxonomy node; drives tax, attributes, channels; **1** | Curated or rule-based group; **many** | Free keyword; **0–250** | Merchant free-text "custom category"; **0–1** |
| Medusa | Merchant tree for browsing; **many** | Themed group ("summer"); **0–1** (single FK) | Free label; **many** | Merchant free-text label; **0–1** |
| BigCommerce | Merchant tree, one tree per channel; **many** (≤1,000) | none | none (custom fields instead) | `physical` / `digital` enum; **1** |
| SFCC | Site-catalog tree; **many** assignments + **1** primary + **1** classification (schema) | none | none | Structural flags (master, variant, set, bundle…) |
| Magento | Tree that is also the top menu; **0..many**; anchor = rolls up children + facets | none | none | Structural kind (simple, configurable, virtual, downloadable…); attribute set is separate |
| commercetools | Trees per purpose or channel; **many**, ordered by orderHint | Product Selection (assortment) | none | **Attribute schema**, required, immutable |
| Google MC | `google_product_category`: Google taxonomy; **1** | n/a | n/a | Merchant's own category path; **≤5** |

### Three meanings of "product type"

1. **Merchant free-text classification**: Shopify `productType`, Google `product_type`, and Medusa `ProductType`. Medusa's belongs here. The model is a bare unique `value` with no attributes or behaviour (`product-type.ts`). It is single-valued like Shopify's, and Medusa's own examples range from "Digital" to "Shirt".
2. **Structural kind or behaviour**: Magento (simple, configurable, bundle, virtual, downloadable), SFCC (master, variant, set, bundle, item), and BigCommerce (physical, digital). This meaning changes how the product is sold, stocked or delivered.
3. **Attribute schema**: commercetools ProductType. Magento's attribute set and SFCC's classification category fill the same role under different names.

The "Physical vs Digital" example in Medusa's user guide reads like meaning 2. Medusa attaches no behaviour to it, though. Physical vs digital only becomes behaviour in Medusa through shipping profiles or a custom module.

### Recommended glossary definitions

**Category**: A node in a merchant-maintained hierarchy that classifies what a product *is*, and that shoppers browse and filter by. A product can sit in several categories.
_Avoid_: department, taxonomy node (unless you mean an external standard taxonomy), collection.

**Collection**: A curated, flat, named grouping of products for merchandising (a season, campaign, edit or story), with its own landing page. Membership is chosen by hand or by rules, and it does not imply what the product is.
_Avoid_: category, range, line, lookbook, assortment (commercetools uses that word for channel scoping).

**Tag**: A free, flat, many-per-product keyword used for internal organisation, search and rule matching (for example, rule-based collections). Tags carry no hierarchy and no page of their own.
_Avoid_: label, keyword, attribute, facet.

**Product Type**: A single, optional, merchant-defined classification label for a product (for example "Ring", "Gift card"). It is used for administrative grouping and as a match key for tax and promotion rules. It defines neither attributes nor behaviour.
_Avoid_: kind, category, template, attribute set, schema. Use a distinct term such as "attribute set" if proteus ever needs meaning 2 or 3.

Related terms:

- **Taxonomy**: an external standard category tree (Shopify SPT, Google, GS1 GPC).
- **Attribute / facet**: a typed product property. A facet is an attribute exposed as a storefront filter (as in Magento layered navigation).
- **Navigation menu**: a merchant-authored link tree that points at categories, collections and pages (Shopify's model).
- **Catalog**: the whole set of products, or in SFCC a shareable container with its own category tree.

### Should a product belong to many collections?

Shopify says yes: `Product.collections` is a list, and rule-based membership naturally overlaps. Medusa says no: `collection_id` is a single nullable foreign key (`product.ts:133–137`), and the user guide states "A product can be in a single collection". BigCommerce, SFCC and Magento have no collection entity. commercetools Product Selections are shared across stores. Collections exist for merchandising, where one product often appears in "Summer" and "Gifts under $200" at once, so the usage that owns the concept (Shopify) points to **many-to-many**. Medusa's one-collection limit is the outlier and would push many-collection use cases onto tags or categories. This is a named divergence from Medusa to decide explicitly.

### Product Type vs Category

- **Cardinality**: a product has at most one type but can have many categories (Shopify is the exception, with a single standard category).
- **Structure**: a type is a flat lookup value. A category is a tree node with a handle, rank and visibility.
- **Audience**: categories are shopper-facing navigation and browse pages (Medusa `is_active` / `is_internal`, Magento top menu). Types are admin-facing labels and rule keys (Medusa tax and promotion rules).
- **Source of truth**: in Shopify, the category comes from a standard taxonomy and the type is the merchant's own. Google makes the same split between `google_product_category` and `product_type`.

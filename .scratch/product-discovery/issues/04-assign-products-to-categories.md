# 04 — Assign products to categories

**What to build:** A merchant puts products into Categories from either side. On a product, the create
flow's Organize step and a new Organization card on the product detail page set its Categories through
a category picker: the whole tree loads once, the merchant drills down level by level, and search
returns a flat list showing each result's path ("Tops in Men"). On a Category, a products section lists
the products directly in it, and a product picker adds and removes them — a dialog with search and
checkboxes where current members come pre-checked and unchecking removes. Admin product responses show
each product's Categories.

Spec: `.scratch/product-discovery/spec.md` — Tables (`product_product_category`), Service (Products,
Embeds, Filters), Route conventions (Throws, Assignment), Admin API, Admin (Category picker, Product
picker, Categories, Product), Rules.

**Blocked by:** 01 — Repository filter hook; 03 — Category tree in the admin.

**Status:** ready-for-agent

- [ ] The product–category pivot matches the spec: single prefixed id, cascade from both ends, the pair
      unique among live rows.
- [ ] Product create and update accept `categoryIds`, which replace the product's set. An unknown id
      answers `NOT_FOUND`, declared on both product routes.
- [ ] A Category's membership endpoint takes `{ add, remove }`, applied add then remove; adding a member
      or removing a non-member is a no-op.
- [ ] The admin product list filters by Category on direct members only, in SQL through the ticket 01
      hook, ANDed with every other filter.
- [ ] Admin product create, retrieve and update responses embed Categories through one batched read over
      the product ids — no query per product.
- [ ] Soft-deleting a Category hides its memberships; the products stay.
- [ ] Admin: a multi-select form field, the category picker, the product picker, the Organization card
      (edit drawer) and the Organize step. Spanish entries for every string.
- [ ] The dev seed assigns products per the spec's Seed data, unisex products under both Men and Women.
- [ ] Backend journey test: assign from the product and from the Category, list a Category's direct
      members, soft-delete a Category and see its memberships disappear.
- [ ] `pnpm run verify` is green.

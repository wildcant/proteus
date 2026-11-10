# 09 — Product types

**What to build:** A merchant sets a product's Product Type on the product form and Organization card
from a single-select that also offers "Add <value>" to create a new Type on the spot. Types have their
own admin pages: a list with search, rename, delete, and a detail page with a read-only list of their
products. The admin product list filters by Type. When a shopper adds a product to the cart, the cart
line snapshots the Type's value, and the order line keeps it.

Spec: `.scratch/product-discovery/spec.md` — Tables (`product_type`, `product.typeId`), Service, Admin
API, Line item snapshot, Admin › Tags, types / Product, Rules, Seed data.

**Blocked by:** 04 — Assign products to categories (Organization card, batched groupings read);
07 — Collections in the admin (both regenerate the product migration, so they cannot run in parallel).

**Status:** ready-for-agent

- [ ] The type table and the product's type column (`on delete set null`) match the spec.
- [ ] Admin endpoints: list (`q`), create, retrieve, rename, delete. Product create and update accept
      `typeId`; admin product responses embed the Type; the admin product list filters by Type.
- [ ] Deleting a Type in use is allowed: its products show no Type, and line snapshots keep the text.
- [ ] The single-select combobox gains a creatable "Add <value>" option.
- [ ] Adding to the cart sets the line's product type from the Type's value, read through the batched
      groupings read; completing the cart copies it to the order line. Lines stay frozen at add time.
- [ ] Admin: sidebar entry, list, rename, delete, detail page. Spanish entries for every string.
- [ ] The dev seed creates the spec's Types and assigns them.
- [ ] Backend journey tests: Type CRUD and filter, deleting a Type keeps line snapshots, add-to-cart
      snapshots the product type.
- [ ] `pnpm run verify` is green.

# 07 — Collections in the admin

**What to build:** A merchant manages Collections: a list with search, create and edit (title, handle,
and a thumbnail uploaded through the existing upload endpoint), delete, and a detail page whose
products section uses the product picker. On the product form and the Organization card, a
multi-select sets a product's Collections. A product can sit in several Collections; adding it to one
never removes it from another.

Spec: `.scratch/product-discovery/spec.md` — Tables (`product_collection`, `product_product_collection`),
Service, Admin API, Admin › Collections / Product picker / Product, Rules, Seed data.

**Blocked by:** 04 — Assign products to categories (product picker, Organization card, batched
groupings read; both tickets also regenerate the product migration, so they cannot run in parallel).

**Status:** ready-for-agent

- [ ] The collection table and its pivot match the spec.
- [ ] Admin endpoints: list (`q`, `offset`, `limit`), create, retrieve, edit, delete, and the
      `{ add, remove }` membership endpoint.
- [ ] Product create and update accept `collectionIds`; admin product responses embed Collections; the
      admin product list filters by Collection in SQL.
- [ ] Soft-deleting a Collection hides its memberships; the products stay.
- [ ] Admin: sidebar entry, list, create/edit form with the thumbnail upload, detail page with the
      product picker, and the multi-select on the product form and Organization card. Spanish entries
      for every string.
- [ ] The dev seed creates Essentials and Active with the spec's members; Hoodie sits in both.
- [ ] Backend journey test: assign from both sides, one product in two Collections, soft-delete a
      Collection and see its memberships disappear.
- [ ] `pnpm run verify` is green.

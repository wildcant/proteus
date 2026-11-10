# 10 — Tags in the admin

**What to build:** A merchant tags products from a multi-select on the product form and Organization
card that also offers "Add <value>" to create a new Tag on the spot. Tags have their own admin pages: a
list with search, rename, delete, and a detail page with a read-only list of their products. The admin
product list filters by Tag.

Spec: `.scratch/product-discovery/spec.md` — Tables (`product_tag`, `product_product_tag`), Service,
Admin API, Admin › Tags, types / Product, Rules, Seed data.

**Blocked by:** 09 — Product types (creatable combobox; both regenerate the product migration, so they
cannot run in parallel).

**Status:** ready-for-agent

- [ ] The tag table and its pivot match the spec. A value is unique among live Tags, exact and
      case-sensitive.
- [ ] Admin endpoints: list (`q`), create, retrieve, rename, delete. Product create and update accept
      `tagIds`; admin product responses embed Tags; the admin product list filters by Tag in SQL, any of
      the given Tags.
- [ ] The multi-select gains a creatable "Add <value>" option.
- [ ] Deleting a Tag in use is allowed; its products lose it.
- [ ] Admin: sidebar entry, list, rename, delete, detail page. Spanish entries for every string.
- [ ] The dev seed creates the spec's Tags and assigns them.
- [ ] Backend journey test: Tag CRUD, assignment through the product, the filter, deleting a Tag in use.
- [ ] `pnpm run verify` is green.

# 03 — Category tree in the admin

**What to build:** A merchant builds the Category tree in the admin. They create Categories — name,
handle (generated from the name when left blank), description, Active, Internal, and a parent chosen at
creation — edit them, and see every Category as an indented tree. They can delete a Category with no
children; deleting one that still has children is refused. Categories sit in the sidebar under
Products for anyone who can read products. Moving a Category or changing its position comes later
(ticket 06). The dev seed builds the spec's tree.

Spec: `.scratch/product-discovery/spec.md` — Tables (`product_category`), Migrations, Permissions,
Service › Category rules, Route conventions, Admin API, Admin › Sidebar / Categories, Seed data.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The category table matches the spec: self-referencing parent with `on delete restrict`, sibling
      rank, Active and Internal off by default, handle unique among live rows. The product migration is
      regenerated in place under its fixed name.
- [ ] Create places the new Category with the Rank rule: the sibling set is renumbered 0..n-1 and the
      new row is appended when no rank is given.
- [ ] Admin endpoints answer the whole tree (nested, no params), create (201), retrieve, edit and
      delete. They use the existing product permissions and declare their throws: duplicate handle,
      not found, not allowed.
- [ ] Deleting a Category with live children answers `NOT_ALLOWED`. The guard is recorded as intended in
      the guard-outside-its-closure check, with its reason, and the soft-delete cascade doc stops saying
      the codebase has no guard inside its own closure.
- [ ] Admin: sidebar entry with icon and label, tree list, create/edit form, and a delete dialog that
      names the Category. Every string goes through Lingui with a Spanish entry.
- [ ] The dev seed creates Men and Women, each with Tops, Sweatshirts, Bottoms and Shoes, all Active.
- [ ] Backend journey test: build a two-level tree, edit a Category, delete a leaf, refuse to delete a
      parent with children, reject a duplicate handle.
- [ ] OpenAPI and the Orval clients are regenerated; `pnpm run verify` is green.

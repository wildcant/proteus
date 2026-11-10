# 01 — Repository filter hook

**What to build:** Product list queries can carry filters that are not columns of the product table —
the category, collection, tag and type filters later tickets add — and those filters narrow both the
page of rows and its total count. Today a key that is not a column is dropped silently, and the
helpers that build the WHERE clause and count the rows are private to the base repository, so a
subclass cannot add a clause that reaches both. This is a refactor: nothing a user sees changes.

Spec: `.scratch/product-discovery/spec.md` — Service › Filters.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The base repository exposes a protected hook that a subclass overrides to add WHERE clauses, and
      both the paged find and its count apply it.
- [ ] The default hook adds nothing; every existing list behaves exactly as before and the existing
      tests stay green.
- [ ] Hook clauses are ANDed with the filters already built — an `id` filter set by the caller is never
      replaced.
- [ ] No test is added for the hook alone: the first filter that uses it (ticket 04) proves it through a
      journey test.
- [ ] `pnpm run verify` is green.

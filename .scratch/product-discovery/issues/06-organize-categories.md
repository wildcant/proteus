# 06 — Organize categories

**What to build:** A merchant arranges the Category tree on an Organize page by dragging: reordering
siblings, moving a Category under another parent, or moving it to the root. Each drop saves at once,
shows immediately, and rolls back if the save fails. Moving a Category under itself or one of its
descendants is refused.

Spec: `.scratch/product-discovery/spec.md` — Service › Category rules (Rank, Move / reorder), Admin API,
Admin › Categories (Organize), Rules (Concurrent reorders).

**Blocked by:** 03 — Category tree in the admin.

**Status:** ready-for-agent

- [ ] Editing a Category accepts a parent (absent keeps it, null moves to the root) and a rank.
- [ ] Every move and reorder renumbers the target sibling set 0..n-1 by the Rank rule, leaving the moved
      row out while reading the siblings. No lock; a duplicate or gap left by anything else heals on the
      next write in that set.
- [ ] Moving a Category under itself or a descendant answers `INVALID_ARGUMENT`, checked with a recursive
      query.
- [ ] The Organize page has a drag tree that also works from the keyboard, with optimistic update and
      rollback. Spanish entries for every string.
- [ ] Backend journey test: reorder siblings, move across parents, move to the root, refuse a move under
      a descendant, heal a duplicate rank.
- [ ] E2E journey written, not run: drag a Category to a new position.
- [ ] `pnpm run verify` is green.

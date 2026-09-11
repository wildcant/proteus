# 02 — `frontend-conventions` becomes `frontend-structure`

**What to build:** The shared dependency-cruiser package is renamed so its name agrees with its own
code. No rule changes, no behaviour change — both apps must report exactly what they report today.

**Blocked by:** 01, for the definitions the rename is justified by. Mechanically independent of it.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `packages/frontend-conventions/` → `packages/frontend-structure/` via `git mv`, so the history
      follows
- [ ] `packages/frontend-structure/package.json` — `name` becomes `@proteus/frontend-structure`, and
      the `description` keeps saying "structural rules" as it already does
- [ ] No `exports` field is added. `docs/research/structural-rules-authoring.md` §6 records why:
      without one, deep subpath requires keep working, which is what lets a doc generator import the
      vocabulary without pulling in the rule builders
- [ ] The bare specifier is updated in both consumers — `apps/admin/deps-analyzer/.dependency-cruiser.cjs:1`
      and `apps/store/deps-analyzer/.dependency-cruiser.cjs:1`
- [ ] Every prose reference to the old package name is updated: `apps/admin/…cjs` lines 27 and 29,
      `apps/store/…cjs` lines 73 and 85, `apps/backend/deps-analyzer/.dependency-cruiser.cjs:216`,
      `apps/store/src/components/header/header.tsx:18`,
      `apps/admin/src/components/layout/shell.tsx:34`, and the package's own self-reference at
      `index.cjs:61`
- [ ] `AGENTS.md:92` (the packages list) and `AGENTS.md:217` (the Bulletproof React paragraph) name
      the new package
- [ ] `npm install` is run so `package-lock.json` records the rename; the lockfile diff is committed
      and shows only the four `@proteus/frontend-conventions` lines changing
- [ ] `docs/research/structural-rules-authoring.md` is **not** touched. It is a research record of a
      prototype that carried the old name, and rewriting it would make it describe something that
      never ran
- [ ] `.scratch/frontend-conventions/` is **not** renamed — working record, same reason
- [ ] `pnpm --filter store run check:deps` and `--workspace=admin check:deps` both still pass, and
      the rename is proved non-vacuous: add a folder that breaks the feature vocabulary (e.g.
      `apps/store/src/features/cart/helpers/x.ts`), confirm both the rule fires and the diagnostic
      names the rule, then remove it. Say in the PR description that you ran it
- [ ] `pnpm run verify` green

## Notes

The rename is justified without reference to freeing up the word "conventions" — the package's
exports are `featureStructureRules` and `layerDirectionRules`, the research behind it is
`docs/research/structural-rules-authoring.md`, and its own file header says "the layout half of that
standard has never been enforced anywhere". The name is the only thing in its neighbourhood that
says conventions. That is the argument to put in the commit message; freeing the word is a
side-effect, not the reason.

Do **not** follow this with a rename of `deps-analyzer/` to `structure/` — it looks like the obvious
next step and is deliberately deferred. `spec.md` records why: 18 tracked files, four of them ADRs,
to fix a name that is imprecise rather than wrong.

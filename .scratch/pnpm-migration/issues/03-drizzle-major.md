# 03 — Drizzle 0.39 → 0.45, for the SQL injection

**What to build:** `drizzle-orm` moves off 0.39.3 to a version that carries the fix for the
identifier-escaping SQL injection, and `drizzle-kit` moves with it. The backend keeps working.

**Blocked by:** nothing, and it blocks nothing. Deliberately its own track — see *Why this is not in
02 and does not gate 05*.

**Status:** planned.

**Spec:** `.scratch/pnpm-migration/spec.md`, P1b.

---

## Why

`drizzle-orm` 0.39.3 carries a **high-severity advisory: SQL injection via improperly escaped SQL
identifiers**. It is the most serious thing `npm audit` reports on this tree, and it is the only one
in the set that is a genuine security property of the running application rather than of a build
tool. npm's proposed fix is `drizzle-orm@0.45.2`, a semver-major move.

`drizzle-kit` is dragged along: its own advisory chain runs through `@esbuild-kit/esm-loader`, and
npm's "fix" for it is a **downgrade to 0.18.1** — see ticket 02. The real answer is forward, in step
with the ORM.

## Why this is not in 02 and does not gate 05

Ticket 02 is a lockfile refresh. This is a code migration across a major version, and its size is not
yet known. Bundling it would mean the security bumps wait on it.

It does not gate the pnpm migration either, and that is worth stating because the instinct is to
tidy everything first. Ticket 06 changes *where packages resolve from*; this changes *which version
of one package the code is written against*. They touch disjoint things: 05 edits manifests and call
sites and never opens a repository or a model, this one edits repositories and models and never
touches the layout. Whichever lands second rebases cleanly.

The one interaction to know about: whichever lands second has to regenerate the lockfile in that
branch's format. If 05 has landed, this ticket's bump is `pnpm up drizzle-orm@…` and the diff is
`pnpm-lock.yaml`; if it has not, it is npm and `package-lock.json`.

---

## The surface

Measured against `apps/backend/src` on 2026-09-11:

| | Count |
| --- | ---: |
| Files mentioning `drizzle-orm` | 98 |
| `from 'drizzle-orm'` | 89 |
| `from 'drizzle-orm/pg-core'` | 80 |
| `from 'drizzle-orm/postgres-js'` | 5 |
| `database.config.ts` files (drizzle-kit) | 14 |
| Committed `.sql` migrations | 14 |

`packages/testing` also declares `drizzle-orm` and must move in the same commit, or the two copies
diverge — which under pnpm means two installed versions and the type mismatch of spec F9.

Everything sits behind `BaseRepository` and the `models/` barrels, which is the good news: the module
layout means the blast radius is `src/core/db/`, the fourteen `models/` folders and the repositories,
not the services.

---

## The work

1. **Read the changelog before touching anything.** 0.39 → 0.45 crosses six minors. Establish which
   are breaking for: the `pg-core` table builders, the `timestamps` helper in `src/core/db/columns.ts`,
   relational queries (the readonly link modules are Drizzle relations only), the `postgres-js`
   driver, and `drizzle-kit generate`/`migrate` config shape.
2. **Do not regenerate the existing migrations.** `AGENTS.md` is explicit that `migrations/` is
   drizzle-kit output, regenerated in place and never hand-edited — but the fourteen committed `.sql`
   files are history that has already run against real databases. If the new drizzle-kit wants a
   different journal format, migrate the journal, not the statements.
3. Bump `drizzle-orm` and `drizzle-kit` in `apps/backend` and `drizzle-orm` in `packages/testing`.
4. Fix the fallout, module by module.
5. Confirm the advisory is gone rather than assumed: `npm audit --json` before and after.

---

## Acceptance criteria

- [ ] `npm audit` no longer reports the `drizzle-orm` SQL-injection advisory, and the output is quoted
      in the PR
- [ ] `drizzle-kit` is **greater than** 0.31.10 — the version it is on today. A number lower than that
      means `npm audit fix --force` was run and the migration tooling has been rolled back
- [ ] `db:generate` produces no diff against the committed schema — i.e. the new drizzle-kit agrees
      the models and the migrations already match. This is the check that the upgrade did not silently
      change what a table means
- [ ] `stack:reset` completes: the volume is wiped and every migration replays from empty against the
      new drizzle-kit
- [ ] The full backend suite green (`test`, not `test:gate`) — 98 files moved and only the full suite
      covers the modules
- [ ] `npm run --workspace=backend test:temporal` green against a running server
- [ ] `verify` and `verify:full` green
- [ ] `packages/testing` declares the same `drizzle-orm` version as `apps/backend`

# 01 — Drop the second lockfile

**What to build:** `apps/admin/package-lock.json` stops being tracked.

**Blocked by:** nothing. This is the one piece of the spec that depends on no decision.

**Status:** planned.

**Spec:** `.scratch/pnpm-migration/spec.md`, P0 — F4.

---

## Why

There are two lockfiles in the tree:

```
./package-lock.json                 389,662 bytes   2026-09-10
./apps/admin/package-lock.json      131,125 bytes   2025-07-31
```

Both are tracked — `git ls-files | grep package-lock.json` returns both. The admin one describes a
dependency graph from thirteen months ago and nothing reads it: npm resolves workspace installs from
the root lockfile, so it has been inert since the day `apps/admin` joined the workspace list.

It matters now for two reasons. It is a plausible-looking file that a future reader, or an agent,
could take as authoritative. And P3 deletes `package-lock.json` — leaving a second one behind would
mean the repo still contains an npm lockfile after the migration to pnpm, which is exactly the
confusing half-state the migration exists to avoid.

---

## The work

```bash
git rm apps/admin/package-lock.json
```

That is the whole change. `apps/admin/.gitignore` already carries `node_modules`; check whether a
`package-lock.json` line belongs in the root `.gitignore` alongside it, so a stray `npm install`
inside a workspace after P3 does not silently recreate one.

---

## Acceptance criteria

- [ ] `git ls-files | grep package-lock.json` returns only the root `package-lock.json`
- [ ] `npm install` at the root still reports the tree up to date — deleting the file changed no
      resolution, and this is what proves it was inert
- [ ] `npm run verify` green

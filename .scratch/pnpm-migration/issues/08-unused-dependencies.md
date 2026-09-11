# 08 — Every declared dependency is used

**What to build:** knip at the root, scoped to one issue type, as an `unused` job in
`scripts/verify.sh` — plus the ten findings it reports today, each resolved as a decision rather
than a deletion.

**Blocked by:** nothing. 05, 06 and 07 have landed, and every number below was measured on the
post-migration tree — the same tree the gate will run against, not a trial workspace.

**Status:** planned.

**Spec:** `.scratch/pnpm-migration/spec.md`, P6.

**Research:** `docs/research/undeclared-dependencies.md` §6.1 and §11 deferred knip with exactly this
trigger:

> **knip** — can do this *and* the inverse *and* undeclared binaries (§9), which nothing else covers.
> Deferred, not rejected: it is a new tool whose first run in a repo this size is a triage pass across
> several issue types at once. **It is the right next conversation if undeclared binaries or unused
> declarations become a concern.**

This ticket is that deferral coming due. Its §12 recorded the gap — *"knip was never run here. Every
claim about it is from its documentation… Its first-run false-positive volume in this tree is
entirely unmeasured, and that is the number that decides whether it is adoptable."* That number is
now measured, and it is **seven, all of three shapes, all closed by a ten-line config**.

---

## Why

The claim:

> **A package that a workspace declares is referenced by that workspace.**

It is the inverse of 06's, and nothing already in `verify` can make it.

| Gate | Why it cannot see an unused declaration |
| --- | --- |
| pnpm strict layout + `typecheck` | An undeclared *import* fails because the module is genuinely missing. A declaration nothing imports installs perfectly and resolves fine — there is nothing for the layout to catch. |
| `structure` (dependency-cruiser) | Reads source and reports import → import. It never walks a manifest in the unused direction. |
| `lint` (Biome 2.5.4) | Three dependency rules exist: `noUndeclaredDependencies` (the inverse, rejected in the research's §5 over ~1,130 tsconfig-`paths` false positives), `noDuplicateDependencies` (the same name twice in one field of one manifest), `noRestrictedDependencies` (an allowlist). There is no unused rule, and a file-at-a-time linter cannot make a whole-project claim. |
| `versions` (`one-version.mts`) | Scoped to packages that a manifest declares **and** the lockfile resolved twice. An unused declaration resolves to exactly one version, so it passes. |
| pnpm 12.4.1 itself | No such command. `dedupe`, `outdated`, `audit`, `peers`, `why`, `licenses` each answer a different question. |

So this is the one class of dependency debt the repo currently has no way to notice, and it is
already costing something concrete: **`@hono/node-server` is unused and is one of the nine direct
dependencies carrying an advisory in spec F1.** The tree is carrying an advisory for a package it
does not use. Three more findings are packages whose only trace in the source is a commented-out
import — the code went, the manifest entry stayed.

## Why a tool and not a 40-line script

`one-version.mts` is 40 lines with no dependency because its claim is a regex over a lockfile. This
claim needs a real module graph, and the four things a naive script would get wrong here are all
present in this tree:

- **CSS.** `@import "tailwindcss"` is a reference. knip reads it — which is exactly why `tailwindcss`
  is flagged in `packages/ui` and *not* in the two apps, whose `styles.css` imports it.
- **Dynamic registration.** `src/providers/*/` is reached by string, never by import, so its files
  are unreachable from any entry point and their imports count as references only once those files
  are declared entry points. Both `@sendgrid/mail` and `scrypt-kdf` were false positives until then.
- **Binaries inside a nested shell.** `drizzle-kit` is invoked inside `sh -c '…'` in a backend script
  *and* imported by `src/**/database.config.ts`, which nothing else reaches.
- **Commented-out imports** must not count. The three admin devtools packages are only found because
  knip parses rather than greps.

A script that got any of those wrong would be a gate that lies in the expensive direction — red on
something real, so you delete a dependency the build needs. `standards/README.md` owes a recorded
reason for a check that is not a rule; this is it, and it is a different reason from the `versions`
gate's ("no rule engine here reads a lockfile").

---

## The measured first run

knip 6.35.1 via `pnpm dlx`, post-migration tree, 2026-09-11.

Zero config, all four dependency-related issue types: **18 findings in 6.6 s**, of which 7 were
noise. With the config below, scoped to the one issue type this gate claims: **10 findings in 3.2 s,
zero false positives.** Every row was checked against the source by hand.

| Package | Workspace | Field | Why it is real |
| --- | --- | --- | --- |
| `@hono/node-server` | `apps/backend` | dependencies | Zero references anywhere in the tree. Also an F1 advisory. |
| `@tanstack/react-devtools` | `apps/admin` | dependencies | Only trace: a commented-out import, `src/routes/__root.tsx:2` |
| `@tanstack/react-query-devtools` | `apps/admin` | dependencies | Commented out, `__root.tsx:5` |
| `@tanstack/react-router-devtools` | `apps/admin` | dependencies | Commented out, `__root.tsx:7` |
| `@tanstack/router-plugin` | `apps/store` | dependencies | Appears only in its own manifest |
| `@fontsource-variable/geist` | `packages/ui` | dependencies | No CSS `@import` and no TS import in the package |
| `tailwindcss` | `packages/ui` | dependencies | `packages/ui/src/styles.css` imports only `./shadcn.gen.css`. **Judgment call — see below.** |
| `tw-animate-css` | `packages/ui` | dependencies | Same shape; both apps import it in their own `styles.css` |
| `@tailwindcss/typography` | `apps/store` | devDependencies | No `@plugin` directive in any store CSS |
| `scrypt-kdf` | `packages/testing` | devDependencies | Zero references in that package. `apps/backend` declares it separately and does use it. |

The seven that the config removed, so that a future maintainer does not rediscover them as bugs:
`@sendgrid/mail` and `scrypt-kdf`-in-backend (provider entry points), `drizzle-kit` (the drizzle
configs), `@playwright/test` (`scripts/db-diagram/load.mjs`), `cloudflare` ×2 (it is
`cloudflare:workers`, a workerd built-in whose specifier reads as a package name), and the three
system binaries `dropdb` / `createdb` / `dot`. The last five disappear from scoping to
`dependencies`; the first four need the entry patterns.

---

## The work

### 1. knip at the root

A root devDependency at `^6.35.1`. It spans every workspace, like `@biomejs/biome` and
`@ast-grep/cli`, and `verify.sh` runs from the root. **Not a catalog entry** — the catalog is for
packages two or more workspaces declare.

It brings 20 transitive packages (measured: 21 added, knip included). That is the whole price.

This changes the spec's `ls node_modules` acceptance criterion. Amend it rather than working around
it — it already omits four of the six root devDependencies and is stale independently of this ticket.

### 2. `knip.jsonc` at the root

Measured to zero false positives, ten lines:

```jsonc
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "include": ["dependencies", "catalog"],
  "workspaces": {
    "apps/backend": {
      // Three shapes nothing reaches from a default entry point: providers are registered by
      // string, the drizzle configs are invoked by drizzle-kit, and the scripts by package.json.
      "entry": ["src/providers/*/index.ts", "src/**/database.config.ts", "scripts/**/*.{ts,mjs}"]
    }
  }
}
```

**`.jsonc`, not `.json`**, and deliberately: this file is where the judgment calls live. A dependency
that is genuinely needed but unreferenced — a runtime-only package, a build-time plugin — goes in
`ignoreDependencies` **with a comment saying why**, the same discipline as the `accepted` map in
`one-version.mts`, and for the same reason: an exception that cannot be added silently is one
somebody revisits. There are no entries today. Do not add one without a sentence.

### 3. The scope — one issue type, two counting the catalog

knip reports fourteen. Each exclusion has a reason, and they are not all the same reason.

| Issue type | In | Why |
| --- | :-: | --- |
| `dependencies` (covers devDependencies) | ✅ | The claim. |
| `catalog` | ✅ | *"Unable to find a reference to this catalog entry."* The one thing `one-version.mts` structurally cannot see: it iterates packages that manifests declare, so an entry left behind after the last declaration goes has no declaration site and is never visited. Zero today — and **this gate is what will start creating them**, since resolving its findings removes declarations. |
| `catalogReferences` | ❌ | A `catalog:` with no entry fails `pnpm install` outright. A gate behind an install error is not a gate. |
| `unlisted`, `unresolved`, `binaries` | ❌ | Spec §6 gives the undeclared direction to the pnpm layout plus the existing `typecheck`. Two gates making one claim is precisely the redundancy §6 argues against. |
| `files` | ❌ | **58 findings today.** A real backlog, a separate conversation, and the thing that made knip look expensive in the first place. |
| `exports`, `nsExports`, `types`, `nsTypes`, `enumMembers`, `namespaceMembers` | ❌ | Unmeasured and large. Same conversation as `files`. |
| `duplicates` | ❌ | Duplicate **exports** — *"This is exported more than once"* — not duplicate versions. The name looks like the `versions` gate's job and is not; note it, because the next person will read it the same way. |
| `cycles` | ❌ | dependency-cruiser already owns this, per ADR-0020. |

### 4. The gate

```sh
job_unused() { pnpm exec knip --no-progress; }
```

`pnpm exec`, not `pnpm dlx`, per `verify.sh`'s own convention — the pinned workspace binary, not
whatever the registry has today. `--no-progress` because the jobs run in parallel with their output
captured. Add `unused` to `JOBS` and a `label_of` entry: *"Every declared dependency is referenced"*,
next to `versions`' *"One version per declared dependency"*.

+3.2 s onto a run whose gates are already parallel.

### 5. The ten findings

Each one is a decision. Eight are plain removals. Two want a look first:

- **`tailwindcss` in `packages/ui`.** `@tailwindcss/vite` — which `packages/ui/vite.config.ts` does
  use — takes `tailwindcss` as a hard **dependency** pinned at `4.3.3`, not a peer, so the build does
  not need the declaration. Removing it leaves `tailwindcss` declared by `apps/admin` and
  `apps/store`, so the catalog entry stays referenced and nothing splits. Prove it the way the eject
  was proved: build both apps and diff the compiled CSS, per the procedure recorded in the header of
  `packages/ui/src/styles.css`.
- **The three admin devtools packages.** The imports in `__root.tsx` are commented out, not deleted.
  That is a decision someone half-made: either restore the panel or drop the dependencies. Do not
  split the difference by adding an ignore — a commented-out import is not a reason.

### 6. The two documents

- `standards/README.md` — the "tool, not a rule" verdict, and the alternatives rejected below.
- `docs/research/undeclared-dependencies.md` §12 — amend the *"knip was never run here"* paragraph
  with what running it produced. That section is the doc's record of thin evidence; this closes one
  of its three entries.

---

## What is deliberately not used

| | Why not |
| --- | --- |
| Biome `noUndeclaredDependencies` | The inverse question, already rejected in the research's §5: ~1,130 false positives from tsconfig `paths`, no ignore list, no alias option. |
| A hand-written script, as for `versions` | Needs a module graph: CSS `@import`, string-registered providers, binaries in a nested shell, commented-out imports. Four ways to be confidently wrong. |
| depcheck | Archived 2025-06-16; its maintainers recommend knip. |
| syncpack, manypkg | Compare manifests to each other. Neither reads an import statement, so neither can tell used from unused. |
| knip `--fix` | It edits `package.json`. Run it by hand if you like it; the **gate never fixes**, because which of the ten to delete is the question this ticket exists to surface. |
| `--cache` | Unnecessary at 3.2 s, and a cache is a second thing that can be stale. |

---

## Acceptance criteria

- [ ] `knip` is a root devDependency, pinned, and **not** in the catalog
- [ ] `knip.jsonc` is at the root, and every `ignoreDependencies` entry — if any exist — carries a
      comment naming the reason
- [ ] `pnpm exec knip --no-progress` exits 0 in under 5 s, and still does with the network off
- [ ] `unused` is a job in `scripts/verify.sh`'s `JOBS` with a `label_of` entry
- [ ] All ten findings are resolved: removed, or ignored with a written reason. No finding is left
      reported-and-tolerated, because a gate with known-red rows is not a gate
- [ ] `@hono/node-server` is gone, and `npm audit`'s direct-dependency count drops by one as a result
- [ ] After removing `tailwindcss` from `packages/ui`, both apps' compiled CSS is byte-identical to
      before — same diff procedure as the shadcn eject
- [ ] `pnpm verify` green, `pnpm typecheck` clean, and both apps still build
- [ ] **The gate bites.** Add a dependency nothing imports to one manifest, confirm `verify` goes
      red, restore it, confirm green. Say in the PR that you ran it. *(Measured already on
      `packages/utils` with `lodash`: reported at `package.json:14:6`, exit code 1.)*
- [ ] `standards/README.md` records the verdict and the rejected alternatives
- [ ] `docs/research/undeclared-dependencies.md` §12 is amended
- [ ] The spec's `ls node_modules` criterion is amended for the new root devDependency

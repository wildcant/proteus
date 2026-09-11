# 05 — One version of each dependency

**What to build:** a catalog so the nine workspaces ask the same question, two overrides so they get
the same answer, and a gate that fails when they stop doing either.

**Blocked by:** nothing on its own, but it is **interleaved with 06, not sequential to it** — see
*Where this sits inside 05*. Neither ticket can be finished without the other; they are separate
because they are separate claims, not because they are separate branches.

**Status:** planned.

**Spec:** `.scratch/pnpm-migration/spec.md`, P2 — F3, F9.

**Research:** `docs/research/monorepo-version-alignment.md` — 1,026 lines, every behavioural claim run
against a trial workspace. Read §1–§4 before starting. This ticket is its §11 with one correction,
recorded below.

---

## Why

Under npm's hoisted layout, one copy of each package wins and nobody has to think about it. Under
pnpm, **122 package names install at two or more versions**. Almost all are harmless. Two are not,
and the research establishes that the instinctive fix does not work on either.

`@tanstack/form-core` splits into 1.33.2 and 1.33.5 → 21 `TS2322`/`TS2345` errors in `apps/admin`.
`@tanstack/history` splits three ways → one `TS2353` in `packages/ui`, visible only once the first is
fixed. For these type-only libraries the symptom is a compile error. For anything holding module
state — React, a router, a context — the same split is a *runtime* failure, which is the reason this
is a gate and not a one-time cleanup.

### The anatomy, because it determines the fix

Both `apps/admin` and `packages/ui` declare `^1.33.2`. **They already agree.** The split comes from
outside: `@tanstack/react-form@1.33.2` depends on `"@tanstack/form-core": "1.33.2"` — an exact pin —
while our caret resolves to 1.33.5.

This was run, not reasoned: adding a **catalog** entry for `@tanstack/form-core` and converting both
declarations to `catalog:` left **two copies and 21 errors**. A catalog is a macro over the
*specifier*. It makes workspaces ask the same question; it cannot reach TanStack's manifest, and
there was no disagreement for it to remove.

`@tanstack/react-router` pins `@tanstack/history` the same way. It is house style, so assume more.

### So the 122 are three problems

| Class | Count | What it is | Mechanism |
| --- | ---: | --- | --- |
| **A** | 5 | Workspaces declare it and **disagree** | Catalog |
| **B** | 4 | Workspaces **agree**, it splits anyway | Override |
| **C** | 113 | Declared by **nobody**, purely transitive | None needed |

Neither syncpack nor manypkg can see class B: both read manifests, and the failure is in the
lockfile. Both reported **0 rows** for the three packages actually split.

---

## The correction to the research

`docs/research/monorepo-version-alignment.md` §4.3 and §11.4 say: after adding an override, **delete
`pnpm-lock.yaml`** and reinstall. That instruction is stronger than necessary, and following it here
would destroy ticket 06's whole reason for existing — the imported lockfile is what keeps the
migration from becoming a 180-package upgrade.

Measured on the trial workspace, 2026-09-11:

| What was done | form-core | history | Drift vs npm |
| --- | --- | --- | ---: |
| Exact overrides added, incremental `pnpm install` | **1.33.2, 1.33.5** | 1.162.0, 1.162.2, 1.162.3 | 8 |
| Same overrides present **before** `pnpm import`, then `rm -rf node_modules` and reinstall | **1.33.2 only** | **1.162.2 only** | **8** |

So: the stickiness the research found applies to **exact** override values too, not only to ranges —
an incremental install will not dislodge an already-locked resolution either way. But the fix is to
**delete `node_modules`, not the lockfile**, and to have the overrides in `pnpm-workspace.yaml`
*before* `pnpm import` runs, so they are written into the lockfile's `overrides:` header at import
time.

`apps/admin` and `apps/store` both typecheck at **0 errors** in that state, and drift stays at 8.

## The second correction: which version to pin to

The research recommends `overrides: {'@tanstack/form-core': 'catalog:'}` where the catalog says
`^1.33.2` — which resolves to **1.33.5**. But npm's hoisted tree runs on **1.33.2** today; the exact
pin won the hoist. Pinning the override to 1.33.5 is therefore a silent minor upgrade of a form
library on the day of a package-manager migration.

**Pin to what the repo runs today** — `1.33.2` and `1.162.2` — so this ticket changes *how many
copies exist* and nothing else. Bumping them is a separate, reviewable change. Both values were
verified against `node_modules/@tanstack/{form-core,history}/package.json` in the real tree.

---

## Where this sits inside 05

06's ordered steps are 1 workspace.yaml, 2 unblock peers, 3 `workspace:*`, 4 `pnpm import`,
5 declarations. This ticket lands **inside** them:

- The **catalog** replaces 05 step 2. `catalog:` is a legal `peerDependencies` value, and pnpm's own
  error message names it as the fix — so the two fatal `latest` peers and the other ten `latest`
  entries (spec F3) are all resolved by one mechanism rather than by hand-pinning two of them.
- The **overrides** go into `pnpm-workspace.yaml` **before** 05 step 4, per the correction above.
- After 05 step 5 adds the missing declarations, **recompute the catalog** — seven of them
  (`lucide-react`, `dependency-cruiser`, `bignumber.js`, `typescript`, `@types/react`, …) become
  shared packages the moment they are declared in a second workspace.
- The **gate** lands last, once the tree is clean.

---

## The work

### 1. The catalog

~37 entries — every package more than one workspace declares — in `pnpm-workspace.yaml` under
`catalog:`, with every one of those declarations becoming the string `"catalog:"`.

The list in the research's §11.1 was derived from the **trial**, not the real repo, and its §12 says
so. Recompute it: three lines of `JSON.parse` over the ten manifests. **Set each version to what npm
resolves today**, not to the highest declared range, for the same fidelity reason as the overrides.

This is where all twelve `"latest"` entries of spec F3 die.

### 2. The overrides

```yaml
overrides:
  '@tanstack/form-core': 1.33.2
  '@tanstack/history': 1.162.2
```

Exact versions, matching today's tree. In place **before** `pnpm import`.

### 3. The gate

`scripts/checks/one-version.mjs` — the research's §10, measured at **36 ms**, offline, no
dependency. The claim:

> **A package that a workspace declares is installed at one version.**
> Packages nobody declares are out of scope — 113 are duplicated today for reasons that live in other
> people's dependency trees.

It parses `pnpm-lock.yaml`'s `packages:` section and every workspace manifest, and derives entirely
from them — no package list to maintain. It finds 9 violations on the trial as-is.

The genuine cross-major splits with no fix go in an `accepted` map **whose value is the reason**, so
an entry cannot be added silently:

```js
const accepted = {
  zod: 'we are on 4; @modelcontextprotocol/sdk (via shadcn, a packages/ui dependency) peers on 3.',
  '@dotenvx/dotenvx': 'we are on 2; shadcn bundles 1. Different process, never imported together.',
}
```

**Two entries, not three — `express` has a fix, and it is ticket 04.** The research that produced
this ticket recorded `express: 'backend pins 4; @bull-board/express needs 5'` as a permanent
exception. `docs/research/express-5-migration.md` §5.3 then measured the alternative: with
`express@^5.2.1`, this repo's manifests resolve to **exactly one `node_modules/express`**, and four
`qs` copies collapse to one as well.

So if 08 lands first, this ticket is written against a tree where the exception is already unnecessary.
If it lands second, this ticket ships an accepted-forever entry that has to be deleted a week later —
and an accepted-forever exception is exactly the kind of thing nobody revisits. **Prefer 08 first**;
if it slips, add the entry with a `TODO(express-5)` in its reason so it cannot quietly become
permanent.

Re-derive the map from the tree rather than copying it: the count of 9 violations was measured on the
trial workspace before 04 and before 06's new declarations, and §12 of the alignment research says so.

Wire it into `scripts/verify.sh` as its own **`versions`** job rather than folding it into
`structure` — the claim is about resolved versions, not about which file may import which, and
`AGENTS.md` names that file as "the single definition of what 'checked' means here".

**It is a script, not a rule, and `standards/README.md` says a check that is not a rule owes a
recorded reason.** The reason: no rule engine here reads a lockfile. dependency-cruiser, Biome and
ast-grep all read source, and `.dependency-cruiser.cjs` has no vocabulary for "resolved version".
Record that verdict where that README keeps them.

---

## What is deliberately not used

Each already has a recorded reason in the research's §11.2 — carry them into
`standards/README.md` → *Tools considered, and rejected* rather than re-deriving them:

| | Why not |
| --- | --- |
| `resolutionMode` | Would fix `form-core` by luck and change how every range in the repo resolves |
| `dedupePeerDependents` | Already `true`; measured inert here, 122 → 122 |
| `peerDependencyRules` | Suppresses warnings, installs nothing differently — papering over |
| `resolutions` | pnpm merges it into `overrides` anyway; two spellings for one field |
| syncpack / manypkg | Read manifests, never the lockfile. 0 rows for the three packages actually split |
| `pnpm dedupe --check` | A different, weaker claim; needs the network. CI, not `verify` |
| `strictPeerDependencies: true` | **Deferred, not rejected** — right direction, needs its own triage pass |

`manypkg`'s `INVALID_DEV_AND_PEER_DEPENDENCY_RELATIONSHIP` did surface one real finding worth acting
on independently: **`packages/ui` declares six peerDependencies and installs none of them.**

---

## Why the gate is load-bearing, not a nicety

From `docs/research/dependabot.md` §2.3: **Dependabot has no handling for `overrides:` in
`pnpm-workspace.yaml` at all.** It rewrites an `overrides` block in a `package.json`, but the only
pnpm-workspace-aware parsing in `file_parser.rb` is `workspace_catalog_dependencies` — neither it nor
`file_fetcher.rb` mentions `overrides`. So the two pins this ticket adds are **invisible to it**: it
will keep updating the underlying declaration and leave the pin stale and silently in force.

Catalogs *are* supported, though they are the buggiest corner of the pnpm integration — 7 open
issues. The framing that research settles on:

> **catalogs cost you a class of Dependabot bug you will notice; overrides cost you a pin Dependabot
> cannot see at all.**

This does not change the conclusion. An override is still the only mechanism that collapses
`@tanstack/form-core`, and a tool's blindness to it is not a reason to accept two copies. What it
changes is the status of `scripts/checks/one-version.mjs`: **it is the only thing that will notice
when one of these pins goes stale.** Ship the gate in the same PR as the overrides, not later.

---

## Acceptance criteria

- [ ] No `package.json` in the tree contains the string `"latest"` as a version
- [ ] `@tanstack/form-core` and `@tanstack/history` each resolve to exactly one version, and it is
      the version npm resolves today — `ls node_modules/.pnpm | grep -c form-core` returns 1
- [ ] `pnpm typecheck` clean: `apps/admin` 0, `apps/store` 0, `packages/ui` 0
- [ ] Drift against the npm lockfile is still under 10 after the overrides land — this is the check
      that the lockfile was rebuilt the right way (`node_modules` deleted, lockfile kept)
- [ ] `scripts/checks/one-version.mjs` exits 0, runs offline, and takes under 100 ms
- [ ] It is a `versions` job in `scripts/verify.sh`'s `JOBS` list with a `label_of` entry
- [ ] Every entry in `accepted` has a reason as its value, and each reason names the two packages
      that disagree
- [ ] The script's package list is **derived** — adding a dependency to a workspace requires no edit
      to it
- [ ] **The gate bites.** Drop the `@tanstack/form-core` override, `rm -rf node_modules`, reinstall,
      confirm the gate reports the split and exits 1, restore, confirm green. Say in the PR that you
      ran it
- [ ] The "script, not a rule" verdict and the seven rejected tools are recorded in
      `standards/README.md`
- [ ] A note in the script says it targets `lockfileVersion: '9.0'` and that the mutation above must
      be re-run on every pnpm major — its failure mode is finding *nothing*, which does not announce
      itself

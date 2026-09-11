# Keeping One Version of Each Dependency in a pnpm Monorepo

Research findings on what actually prevents a package from being installed at two versions once this
repo moves from npm workspaces to pnpm — and which of the mechanisms people reach for only *looks*
like it does.

**Date:** 2026-09-11
**Verification method:** every behavioural claim below was **run against the trial pnpm workspace** at
`scratchpad/import-trial` (a full copy of this repo, `pnpm install`ed, store at `../pnpm-store`) using
the installed **pnpm 10.27.0**. Defaults were read out of that binary's own
`~/.cache/node/corepack/v1/pnpm/10.27.0/dist/pnpm.cjs`, not from a docs page. Documentation quotations
come from the raw Markdown sources of pnpm's docs site fetched from
`raw.githubusercontent.com/pnpm/pnpm.io/main/…`, so each one is traceable to a file, and the
`versioned_docs/version-10.x/` copies were used in preference to the current ones because this repo is
on pnpm 10 and pnpm is now on 12. `syncpack@15.3.3` and `@manypkg/cli@0.25.1` were installed and run.
Nothing under `/Users/willo/learn/medusa/proteus` was modified except this file.
**One-line answer:** **catalogs do not fix the `@tanstack/form-core` break — `pnpm-workspace.yaml`'s
`overrides` is the only mechanism that does**, because the duplicate is a transitive exact pin against a
direct caret and *both direct declarations already agree*; catalogs are still worth adopting for the
eight *other* mismatches, and a 40-line Node script gives `verify` a gate that goes red on a duplicate
in 36 ms.

---

## Table of Contents

1. [What is actually duplicated, measured](#1-what-is-actually-duplicated-measured)
2. [The anatomy of the `@tanstack/form-core` break](#2-the-anatomy-of-the-tanstackform-core-break)
3. [Catalogs: what they guarantee, and what they do not](#3-catalogs-what-they-guarantee-and-what-they-do-not)
4. [`overrides`: the mechanism that actually collapses a duplicate](#4-overrides-the-mechanism-that-actually-collapses-a-duplicate)
5. [`resolutions`, and how pnpm treats it](#5-resolutions-and-how-pnpm-treats-it)
6. [The near misses: `dedupePeerDependents`, `pnpm dedupe`, `resolutionMode`](#6-the-near-misses-dedupepeerdependents-pnpm-dedupe-resolutionmode)
7. [Peer dependencies, `"latest"`, and the pnpm 10 defaults](#7-peer-dependencies-latest-and-the-pnpm-10-defaults)
8. [syncpack and manypkg: what they see, measured](#8-syncpack-and-manypkg-what-they-see-measured)
9. [Comparison table](#9-comparison-table)
10. [The gate](#10-the-gate)
11. [Recommendation for this repo](#11-recommendation-for-this-repo)
12. [Where the evidence is thin](#12-where-the-evidence-is-thin)

---

## 1. What is actually duplicated, measured

The trial workspace's virtual store holds **1,149 directories covering 998 distinct package names**, of
which **122 names are present at more than one version**. *Measured 2026-09-11 by reading
`node_modules/.pnpm/` directory names, stripping the peer-dependency suffix after the first `_`.*

The number that matters is not 122. It is the split of those 122 by **whether any workspace has an
opinion about the package at all**:

| Class | Count | What it means | Can a catalog help? |
|---|---|---|---|
| **A.** Declared by ≥1 workspace, and the workspaces **disagree** on the range | **5** | `@biomejs/biome`, `@dotenvx/dotenvx`, `@tanstack/react-router`, `@tanstack/router-plugin`, `@types/node` | **Yes** — this is exactly what a catalog is for |
| **B.** Declared, every declaration **already identical**, still two versions | **4** | `@tanstack/form-core`, `@tanstack/history`, `express`, `zod` | **No** — there is nothing for a catalog to align |
| **C.** Declared by **nobody**; purely transitive | **113** | `@babel/parser`, `ansi-regex`, `commander`, `picomatch`, … | **No** — no `package.json` mentions them |

*Measured 2026-09-11 by cross-referencing the virtual-store names against all ten manifests'
`dependencies`, `devDependencies`, `peerDependencies` and `optionalDependencies`.*

So **the brief's "113 packages at more than one version" is precisely class C** — the class no
declaration-level tool can reach. And the one package that breaks the build is in class B, the class a
catalog is structurally unable to fix. That asymmetry is the finding this whole document turns on.

Under npm today there is exactly **one** copy of `@tanstack/form-core`, version **1.33.2**, hoisted to
the root `node_modules`. *Measured 2026-09-11 against the real repo's tree.* npm's hoisted layout picks
a winner; pnpm's isolated layout gives each declaration what it literally asked for.

---

## 2. The anatomy of the `@tanstack/form-core` break

The brief describes this as `packages/ui`'s peer range pulling 1.33.2 and `@tanstack/react-form`
pulling 1.33.5. **It is the other way round**, and the direction is the whole point.

```
$ pnpm why -r --depth 2 @tanstack/form-core          # trial workspace, 2026-09-11

admin …/apps/admin (PRIVATE)
dependencies:
@proteus/ui link:../../packages/ui
├── @tanstack/form-core 1.33.5
└─┬ @tanstack/react-form 1.33.2
  └── @tanstack/form-core 1.33.2
@tanstack/form-core 1.33.5
@tanstack/react-form 1.33.2
└── @tanstack/form-core 1.33.2
```

`@tanstack/react-form@1.33.2`'s own manifest, read from the installed package:

```json
"dependencies": {
  "@tanstack/react-store": "^0.11.0",
  "@tanstack/form-core": "1.33.2"
}
```

**An exact pin, not a range.** Meanwhile `apps/admin` (`dependencies`) and `packages/ui`
(`peerDependencies`) both declare `"@tanstack/form-core": "^1.33.2"`, and `^1.33.2` resolves to the
highest published match — 1.33.5, because `resolutionMode` defaults to `highest` (§6.3). Two
declarations, both honest, both satisfied, two copies.

`packages/ui` demonstrates it on its own: **the same workspace** gets 1.33.5 for its peer and 1.33.2
inside its `@tanstack/react-form`. Note also that `packages/ui` gets a copy *at all* — it never declares
`form-core` as a dependency, only as a peer — because `autoInstallPeers` defaults to `true` (§7). So
the split does not depend on `apps/admin` declaring the package; it would exist even if the admin's
phantom import from `docs/research/undeclared-dependencies.md` were never fixed.

**This is a house style, not an accident, and it will recur.** Every TanStack package pins its
siblings exactly:

```
@tanstack/react-form@1.33.2   → "@tanstack/form-core": "1.33.2"
@tanstack/react-router@1.170.35 → "@tanstack/router-core": "1.171.29", "@tanstack/history": "1.162.3"
@tanstack/router-core@1.171.29  → "@tanstack/history": "1.162.3"
@tanstack/router-core@1.171.15  → "@tanstack/history": "1.162.0"
```

*Read from the installed manifests, 2026-09-11.* So any TanStack package this repo declares directly
with a caret will split against the copy its siblings pin — and this repo declares seven of them. A fix
aimed at `form-core` alone is a fix for one instance of a pattern.

The damage, reproduced:

```
$ cd apps/admin && ./node_modules/.bin/tsc --noEmit
…21 errors: 17 × TS2322, 4 × TS2345
```

with 399 mentions each of `form-core@1.33.2` and `form-core@1.33.5`, and the diagnostic naming the two
virtual-store paths outright:

```
Type 'import(".../.pnpm/@tanstack+form-core@1.33.2/node_modules/@tanstack/form-core/dist/esm/ValidationLogic").ValidationLogicFn | undefined'
  is not assignable to type
     'import(".../.pnpm/@tanstack+form-core@1.33.5/node_modules/@tanstack/form-core/dist/esm/ValidationLogic").ValidationLogicFn | undefined'.
```

*Measured 2026-09-11.* There is a second instance of the identical shape hiding behind it —
`@tanstack/history` at 1.162.0 / 1.162.2 / 1.162.3, which produces one more `TS2353` in
`packages/ui/src/route-modals/route-modal-provider/route-provider.tsx` and only becomes visible once
`form-core` is fixed. Both are the same bug, so a fix that only names `form-core` is a fix for half of
what is there today and none of what arrives next month.

---

## 3. Catalogs: what they guarantee, and what they do not

### 3.1 What the docs claim

> "'*Catalogs*' are a [workspace feature](./workspaces.md) for defining dependency version ranges as
> reusable constants. Constants defined in catalogs can later be referenced in `package.json` files."
> …
> "**Maintain unique versions** — It's usually desirable to have only one version of a dependency in a
> workspace. Catalogs make this easier to maintain. Duplicated dependencies can conflict at runtime and
> cause bugs. Duplicates also increase size when using a bundler."
> — <https://github.com/pnpm/pnpm.io/blob/main/docs/catalogs.md>, *verified 2026-09-11*

Note the exact wording: *make this easier to maintain*. Not *guarantee*. That is an accurate piece of
writing and it is routinely read as a stronger claim than it makes.

Catalogs are usable in four `package.json` fields and one `pnpm-workspace.yaml` field:

> "You may use the `catalog:` protocol in the next fields:
> * `package.json`: `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`
> * `pnpm-workspace.yaml`: `overrides`"
> — same file, *verified 2026-09-11*

The `peerDependencies` and `overrides` rows both turn out to matter here (§7, §4.3).

### 3.2 What a catalog is: a macro over the *specifier*, expanded before resolution

> "This is equivalent to writing a version range (e.g. `^18.3.1`) directly."
> — <https://github.com/pnpm/pnpm.io/blob/main/docs/catalogs.md>, *verified 2026-09-11*

That sentence is the entire semantics. `catalog:` is textual substitution into the manifest, and
resolution happens afterwards, per declaration, exactly as if you had typed the range. It therefore
guarantees **one specifier**. It says nothing whatsoever about **one resolved version**, and it cannot
touch a third-party package's manifest, so a transitive range is out of its reach by construction.

### 3.3 Measured: a catalog does not fix `form-core`

The experiment the brief asked for. A default catalog was added and both declarations converted:

```yaml
# pnpm-workspace.yaml
catalog:
  '@tanstack/form-core': ^1.33.2
  '@tanstack/react-form': ^1.33.2
```
```json
// apps/admin/package.json → "dependencies", packages/ui/package.json → "peerDependencies"
"@tanstack/form-core": "catalog:",
"@tanstack/react-form": "catalog:"
```

```
$ pnpm install
$ ls node_modules/.pnpm | grep form-core
@tanstack+form-core@1.33.2
@tanstack+form-core@1.33.5
$ node -e "console.log(require('./apps/admin/node_modules/@tanstack/form-core/package.json').version)"
1.33.5
$ cd apps/admin && ./node_modules/.bin/tsc --noEmit   # exit 2
21 errors, 17 × TS2322
```

*Measured 2026-09-11.* **Not one thing changed.** Which is exactly what §3.2 predicts: the two
declarations already said `^1.33.2`, so replacing both with a macro that expands to `^1.33.2` is a
no-op. A catalog can only remove a difference that exists between two `package.json` files, and here
there was none.

### 3.4 What the catalog *is* worth here

Applied to all 39 packages that more than one workspace declares, it closed all five class-A splits:

| | declared packages installed at >1 version |
|---|---|
| before | **9** |
| after catalog (39 entries) + `form-core` override | **4** |
| after also overriding `@tanstack/history` | **3** |

and the three survivors are all class-C-shaped cross-major splits with no declared side
(`express` 4 vs 5 from `@bull-board/express`; `zod` 3 vs 4 from `@modelcontextprotocol/sdk` via
`shadcn`; `@dotenvx/dotenvx` 1 vs 2 from `shadcn`). Total names at more than one version fell
**122 → 110**. *Measured 2026-09-11.*

So: adopt catalogs. Just do not believe they are the answer to the question that was asked.

### 3.5 `catalogMode` and `--save-catalog`

> "### catalogMode — Added in: v10.12.1 — Default: **manual** — Type: **manual**, **strict**, **prefer**
> Controls if and how dependencies are added to the default catalog, when running `pnpm add`. …
> - **strict** - only allows dependency versions from the catalog. Adding a dependency outside the
>   catalog's version range will cause an error.
> - **prefer** - prefers catalog versions, but will fall back to direct dependencies if no compatible
>   version is found.
> - **manual** (default) - does not automatically add dependencies to the catalog."
> — <https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings/_catalogMode.mdx>,
> *verified 2026-09-11*

`"catalog-mode": "manual"` confirmed as the default in the installed 10.27.0's `defaultOptions` object.

Measured with `catalogMode: strict` set:

- `pnpm --filter admin add ms@^2.1.3` → writes `ms: ^2.1.3` into the catalog **and** `"ms": "catalog:"`
  into `apps/admin/package.json`. Works as documented.
- `pnpm --filter admin add zod@3.25.76`, with the catalog holding `zod: ^4.4.3` → **crashes**:
  ```
   ERROR  Invalid Version: ^4.4.3
  pnpm: Invalid Version: ^4.4.3
      at new _SemVer (…/pnpm.cjs:38222:17)
      at compare (…/pnpm.cjs:38615:65)
      at Object.eq (…/pnpm.cjs:38699:31)
      at installSome (…/pnpm.cjs:159203:223)
  ```
  It does refuse, which is the intent, but as an unhandled `semver` throw rather than a named
  `ERR_PNPM_*`. *Measured 2026-09-11 on pnpm 10.27.0.* Worth knowing before someone reports it as a
  broken install.

`--save-catalog` and `--save-catalog-name <name>` are `pnpm add` flags, both "Added in: v10.12.1"
(<https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/cli/add.md>, *verified
2026-09-11*), and both are present in 10.27.0's option table. They are ergonomics for populating the
catalog, not enforcement.

`catalogMode` governs `pnpm add` only. Hand-editing a `package.json` bypasses it entirely, so it is a
convenience, **not a gate**.

---

## 4. `overrides`: the mechanism that actually collapses a duplicate

### 4.1 What it is

> "This field allows you to instruct pnpm to override any dependency in the dependency graph. This is
> useful for enforcing all your packages to use a single version of a dependency, backporting a fix,
> replacing a dependency with a fork, or removing an unused dependency.
>
> Note that the overrides field can only be set at the root of the project."
> — <https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md>,
> *verified 2026-09-11*

"any dependency in the dependency graph" is the difference from a catalog, which reaches only manifests
you own. Reading the implementation in the installed 10.27.0 confirms the scope precisely — overrides
are applied by rewriting **every package's manifest as it is read**, ours and the registry's alike:

```js
function overrideDepsOfPkg({ manifest, dir }, versionOverrides, genericVersionOverrides) {
  const { dependencies, optionalDependencies, devDependencies, peerDependencies } = manifest
  const _overrideDeps = overrideDeps.bind(null, { versionOverrides, genericVersionOverrides, dir })
  for (const deps of [dependencies, optionalDependencies, devDependencies]) {
    if (deps) { _overrideDeps(deps, void 0) }
  }
  if (peerDependencies) {
    if (!manifest.dependencies) manifest.dependencies = {}
    _overrideDeps(manifest.dependencies, peerDependencies)
  }
}
```
— `~/.cache/node/corepack/v1/pnpm/10.27.0/dist/pnpm.cjs`, *read 2026-09-11*

Two things fall out of that: an override applies to `devDependencies` and `optionalDependencies` too,
and an override that matches a **peer** dependency installs it as a real `dependencies` entry.

The matching rule in `overrideDeps` is `targetPkg.name === name && isIntersectingRange(targetPkg.bareSpecifier, bareSpecifier)`
— i.e. a bare `'@tanstack/form-core'` key matches every declaration of that name anywhere.

### 4.2 Measured: it works, and the exact-version form works unconditionally

```yaml
# pnpm-workspace.yaml
overrides:
  '@tanstack/form-core': 1.33.5
```

```
$ pnpm install
$ grep -c "^  '@tanstack/form-core@" pnpm-lock.yaml      # one entry, twice (packages: + snapshots:)
$ readlink apps/admin/node_modules/@tanstack/form-core
../../../../node_modules/.pnpm/@tanstack+form-core@1.33.5/node_modules/@tanstack/form-core
$ readlink node_modules/.pnpm/@tanstack+react-form@1.33.2*/node_modules/@tanstack/form-core
../../../@tanstack+form-core@1.33.5/node_modules/@tanstack/form-core
$ cd apps/admin && ./node_modules/.bin/tsc --noEmit
$ echo $?
0
```

*Measured 2026-09-11.* **`@tanstack/react-form`'s exact pin of `1.33.2` was rewritten to 1.33.5.** One
copy, one lockfile entry, 21 TypeScript errors → 0. `'@tanstack/form-core': 1.33.2` works identically,
in the other direction.

### 4.3 The caveat that will bite: a *range* override is not sticky-proof

This one is not in the docs and it is the single most surprising thing this research found.

```yaml
overrides:
  '@tanstack/form-core': ^1.33.2
```

| starting point | `@tanstack/react-form`'s `form-core` after install | copies |
|---|---|---|
| existing `pnpm-lock.yaml` left in place | **1.33.2** | **2** |
| `pnpm-lock.yaml` deleted first | 1.33.5 | 1 |

*Measured 2026-09-11; reproduced twice.* The override *is* recorded — the lockfile header shows
`overrides: {'@tanstack/form-core': ^1.33.2}` — and it *is* applied to react-form's manifest. But the
already-locked `1.33.2` still satisfies `^1.33.2`, so pnpm keeps it. `pnpm update -r @tanstack/form-core`
does **not** dislodge it either; only deleting the lockfile does.

An **exact version** in the override has no such failure mode, because no previous resolution can
satisfy it except the one you named. That is why the recommendation in §11 pins exactly.

### 4.4 The forms of an override, checked

| Form | Verdict here |
|---|---|
| `'pkg': '1.2.3'` | Works, unconditionally. **Use this.** |
| `'pkg': '^1.2.3'` | Works only against a fresh resolution (§4.3). |
| `'pkg': 'catalog:'` | **Works**, and is the tidiest shape — the version lives in the catalog and the override merely enforces it. Measured: lockfile header recorded `'@tanstack/form-core': 1.33.5`, one copy. |
| `'parent@1>pkg': '2'` | Scopes the override to one parent. Documented; not needed here, and not exercised. |
| `'pkg': '-'` | Removes the dependency. Documented; not exercised. |
| `'pkg': '$pkg'` | **Root-only.** `overrides: {'@tanstack/form-core': '$@tanstack/form-core'}` fails: `ERROR  Cannot resolve version $@tanstack/form-core in overrides. The direct dependencies don't have dependency "@tanstack/form-core".` — the root manifest does not declare it, and the `$` reference does not search the workspace packages. *Measured 2026-09-11.* |

### 4.5 How this differs from npm and Yarn

- **npm `overrides`** lives in the root `package.json` and is nested-object-shaped
  (`{"foo": {"bar": "1.0.0"}}`) rather than `parent>child`-shaped.
- **Yarn `resolutions`** is glob-shaped (`"**/foo"`) and, as pnpm's own source note says (§5), is
  understood as replacing a version with an *exact* version rather than with an arbitrary spec.
- **pnpm** puts it in `pnpm-workspace.yaml` (pnpm 10 moved settings out of `package.json`'s `pnpm` key
  and out of `.npmrc`; `manifest.pnpm.overrides` is still read — see §5).

These are near-equivalents, not equivalents, and none of the three is portable to the others verbatim.

---

## 5. `resolutions`, and how pnpm treats it

pnpm **does** read Yarn's `resolutions`, and the comment explaining why it is not called that is in the
shipped binary:

```js
function getOptionsFromRootManifest(manifestDir, manifest) {
  const settings = getOptionsFromPnpmSettings(manifestDir, {
    ...pick([... "overrides", "packageExtensions", "peerDependencyRules", ...], manifest.pnpm ?? {}),
    // We read Yarn's resolutions field for compatibility
    // but we really replace the version specs to any other version spec, not only to exact versions,
    // so we cannot call it resolutions
    overrides: {
      ...manifest.resolutions,
      ...manifest.pnpm?.overrides
    }
  }, manifest)
  return settings
}
```
— `~/.cache/node/corepack/v1/pnpm/10.27.0/dist/pnpm.cjs`, *read 2026-09-11*

Three facts follow, none of which is on a docs page:

1. `resolutions` in the **root** `package.json` is merged into `overrides`, so it works.
2. On a key collision, `pnpm.overrides` **wins** (it is spread second).
3. `resolutions` is listed in the same file's `uselessNonRootManifestFields = ["resolutions"]`, so it is
   ignored in a workspace package's manifest.

**Do not use it.** It is a compatibility shim with the same power and a less obvious spelling, and
having two fields that mean the same thing is exactly the kind of thing a reader has to test to
believe.

---

## 6. The near misses: `dedupePeerDependents`, `pnpm dedupe`, `resolutionMode`

### 6.1 `dedupePeerDependents` — already on, and inert here

The brief asks whether this is the specific fix. It is not, and it is already enabled.

> "### dedupePeerDependents — Default: **true** — Type: **Boolean**
> When this setting is set to `true`, packages with peer dependencies will be deduplicated after peers
> resolution."
> — <https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md>,
> *verified 2026-09-11*; the wording is identical in the current v12 page
> (`docs/settings/peer-dependencies.md`)

Confirmed as `"dedupe-peer-dependents": true` in 10.27.0's `defaultOptions`.

What it deduplicates is **peer-suffixed instances of one version** — `webpack@1.0.0` and
`webpack@1.0.0_esbuild@1.0.0` collapsing into one — which is a different problem from two versions of
one package. The docs' own closing paragraph says so: it cannot dedupe when "`webpack` has `react` in
its peer dependencies and `react` is resolved from two different versions in the context of the two
projects".

Measured, by turning it off:

| | virtual-store directories | names at >1 version |
|---|---|---|
| default (`true`) | 1,149 | 122 |
| `dedupePeerDependents: false` | 1,150 | **122** |

*Measured 2026-09-11, each from a wiped `node_modules/.pnpm` and a fresh install.* One directory. In
this workspace the setting is very nearly a no-op, and `@tanstack/form-core` is at two versions in both
columns. **It is not the fix, and no amount of configuring it becomes the fix.**

### 6.2 `pnpm dedupe --check` — a real gate, for a different claim

> "Perform an install removing older dependencies in the lockfile if a newer version can be used."
> "`--check` — Check if running dedupe would result in changes without installing packages or editing
> the lockfile. Exits with a non-zero status code if changes are possible."
> — <https://github.com/pnpm/pnpm.io/blob/main/docs/cli/dedupe.md>, *verified 2026-09-11*

It behaves as advertised:

```
$ pnpm dedupe --check ; echo "EXIT=$?"
 ERR_PNPM_DEDUPE_CHECK_ISSUES  Dedupe --check found changes to the lockfile
…142 lines of proposed collapses…
Run pnpm dedupe to apply the changes above.
EXIT=1
```

*Measured 2026-09-11.* And the decisive detail: **`@tanstack/form-core` appears zero times in that
output.** `grep -c 'form-core'` → `0`. Dedupe can only move a resolution *up* to a version something
else already uses; `@tanstack/react-form`'s pin is the literal string `1.33.2`, and no amount of
deduping makes an exact pin accept 1.33.5.

It is still worth running. It caught 30-odd genuine collapses in the trial, including `zod@4.4.3` →
`4.6.2` (which removed one of the three `zod` versions) and a `@types/node` sprawl. As a gate it
asserts *"the lockfile is minimal"*, which is a useful and different claim from *"nothing is
duplicated"*. Note that it **performs resolution**, so it needs the registry and takes seconds, not
milliseconds — it belongs in CI or a periodic job, not in a 16-second local `verify`.

### 6.3 `resolutionMode`

> "### resolutionMode — Default: **highest** (was **lowest-direct** from v8.0.0 to v8.6.12) —
> Type: **highest**, **time-based**, **lowest-direct**"
> — <https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md>,
> *verified 2026-09-11*

Confirmed as `"resolution-mode": "highest"` in 10.27.0's `defaultOptions`.

`highest` is why `^1.33.2` became 1.33.5. `lowest-direct` would have made it 1.33.2 and would
*incidentally* have fixed this one case — and that is the reason not to use it. It is a global change
to how every range in the repo resolves, adopted to make one package land on a version by luck. The
next transitive pin lands somewhere else and the trick stops working. It is also an argument for
*never* upgrading, which is not what anyone wants from a dependency policy.

`time-based` is a supply-chain measure ("reduces the chance of subdependency hijacking"), orthogonal to
this question, and per the docs it "works only with npm's full metadata", so it is slower.

**Leave it at `highest`.**

---

## 7. Peer dependencies, `"latest"`, and the pnpm 10 defaults

### 7.1 The defaults, read from the installed binary

Every value below was read out of the `defaultOptions` object in
`~/.cache/node/corepack/v1/pnpm/10.27.0/dist/pnpm.cjs` on 2026-09-11 — not from a docs page, because
pnpm 10 changed several of these and the docs site is now on 12.

| Setting | Default in pnpm 10.27.0 |
|---|---|
| `auto-install-peers` | **`true`** |
| `strict-peer-dependencies` | **`false`** |
| `dedupe-peer-dependents` | **`true`** |
| `resolve-peers-from-workspace-root` | **`true`** |
| `resolution-mode` | **`"highest"`** |
| `catalog-mode` | **`"manual"`** |
| `dedupe-direct-deps` | **`false`** |
| `node-linker` | **`"isolated"`** |
| `link-workspace-packages` | **`false`** |
| `hoist` / `hoist-pattern` / `public-hoist-pattern` | `true` / `["*"]` / `[]` |

`autoInstallPeers: true` is why `packages/ui` has a `form-core` at all. `strictPeerDependencies: false`
is why the peer mismatch was a warning rather than an install failure — turning it on converts a class
of these into install-time errors, at the cost of a triage pass on the whole tree, which is a separate
decision from this one.

`link-workspace-packages: false` is an adjacent migration blocker worth recording here since it was
measured on the way past: this repo declares its internal packages as `"@proteus/ui": "*"`, not
`"workspace:*"`. With `linkWorkspacePackages` defaulting to `false` in pnpm 10, `"*"` is a registry
range, not a link instruction. The trial workspace has already been converted to `workspace:*`; the
real repo has not.

### 7.2 `"latest"` in `peerDependencies` — the verbatim failure

The real repo has **12** dependency entries whose specifier is the literal string `latest`, not the 8
the brief counted:

| Workspace | Field | Package |
|---|---|---|
| `apps/admin` | `dependencies` | `@tanstack/react-devtools`, `@tanstack/react-router` |
| `apps/admin` | `devDependencies` | `@tanstack/devtools-vite`, `@tanstack/router-plugin` |
| `apps/store` | `dependencies` | `@tanstack/react-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-start` |
| `apps/store` | `devDependencies` | `@tanstack/devtools-vite` |
| `packages/testing` | `devDependencies` | `@tanstack/react-router` |
| **`packages/ui`** | **`peerDependencies`** | **`@tanstack/history`, `@tanstack/react-router`** |

*Measured 2026-09-11 against the real repo's manifests.*

Only the last two are fatal. Reintroducing one into the trial and installing:

```
 ERR_PNPM_INVALID_PEER_DEPENDENCY_SPECIFICATION  The peerDependencies field named '@tanstack/react-router' of package '@proteus/ui' has an invalid value: 'latest'

The values in peerDependencies should be either a valid semver range, a `workspace:` spec, or a `catalog:` spec
```

*Measured 2026-09-11, quoted from the running pnpm 10.27.0.* The control confirms the scope: the same
`latest` moved into `dependencies` installs without complaint.

That error message also names the fix. **`catalog:` is an accepted `peerDependencies` value**, which
makes the catalog do double duty here: it replaces the ten harmless `latest`s with a reviewable range
*and* it is the legal spelling for the two fatal ones. Verified — the final trial configuration has
`packages/ui`'s peers as `"@tanstack/react-router": "catalog:"` and installs clean.

The ten non-fatal `latest`s are still worth removing. `latest` means "whatever npm served the day
someone ran `pnpm install` without a lockfile", it is the reason `@tanstack/react-router` is at
1.170.33 *and* 1.170.35 in the trial, and — measured in §8 — it is a specifier syncpack cannot compare,
so it reports `latest → latest` as a mismatch it cannot fix.

### 7.3 `peerDependencyRules`

> "#### peerDependencyRules.ignoreMissing — pnpm will not print warnings about missing peer
> dependencies from this list."
> "#### peerDependencyRules.allowedVersions — Unmet peer dependency warnings will not be printed for
> peer dependencies of the specified range."
> — <https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md>,
> *verified 2026-09-11*

Read the verbs: *will not print warnings*. Both settings suppress **output**. Neither changes what is
installed. `allowedVersions` is how you tell pnpm "this package claims it needs react 16 but 17 is
fine" so the console stops nagging — it does not merge two copies, and under
`strictPeerDependencies: false` (the default) there is nothing to unblock anyway.

They are therefore **noise control, not alignment**, and using them to make a peer warning about
`form-core` go away would be the textbook version of papering over this.

`packageExtensions` is the neighbouring tool for *adding* a missing peer/dependency to a third-party
manifest ("`react-redux` should have `react-dom` in its `peerDependencies` but it has not") — a fix for
an under-declared package, not for a duplicated one.

---

## 8. syncpack and manypkg: what they see, measured

Both were run against the trial workspace. Both are useful. **Neither can see the bug that breaks the
build**, for the same structural reason: they read `package.json` files and never the lockfile.

### 8.1 syncpack 15.3.3

> "Consistent dependency versions in large JavaScript Monorepos."
> "### lint — Ensure that multiple packages requiring the same dependency define the same version, so
> that every package requires eg. `react@17.0.2`, instead of a combination of `react@17.0.2`,
> `react@16.8.3`, and `react@16.14.0`."
> — <https://github.com/JamieMason/syncpack/blob/main/README.md>, *verified 2026-09-11*

```
$ pnpm dlx syncpack@15.3.3 lint ; echo $?
✗ Issues found
1
```

40 flagged rows across 22 dependency groups. And:

```
form-core rows: 0
zod rows:       0
express rows:   0
```

*Measured 2026-09-11.* The three packages whose **installed** versions are actually split are the three
syncpack is silent about, because their declarations agree. It flags exactly the class-A set (§1) plus
noise.

The noise is worth costing before adoption:

- **14 rows of `DependsOnInvalidLocalPackage` / `InvalidLocalVersion`** — every `workspace:*` internal
  dependency, because no workspace here has a `version` field. Every workspace is `private: true` and
  nothing is published, so these are not findings.
- **`latest → latest`** reported as a mismatch for five packages, which it cannot fix.

Both are configurable away, and configuring them away is the adoption cost.

syncpack's genuinely distinctive features, from the same README: *"Auto-migrate all or parts of your
repo to [pnpm catalogs]"* and *"Bump outdated versions in catalogs"* — i.e. it is a good **one-time
tool** for producing the catalog in §11 and a good **ongoing tool** for keeping it current. That is a
different job from gating.

### 8.2 manypkg 0.25.1

> "Manypkg is a linter for `package.json` files in Yarn, npm, Lerna, pnpm, Bun or Rush monorepos."
> — `@manypkg/cli@0.25.1` npm metadata, *verified 2026-09-11*

```
$ pnpm dlx @manypkg/cli@0.25.1 check ; echo $?
…15 errors…
1
```

Two of its checks are worth this repo's attention and are things syncpack does not say:

```
☔️ error @proteus/ui has a peerDependency on @tanstack/form-core but it is not also specified in devDependencies, please add it there.
☔️ error @proteus/ui has a peerDependency on @tanstack/history but it is not also specified in devDependencies, please add it there.
…four more, same shape…
```

That is `INVALID_DEV_AND_PEER_DEPENDENCY_RELATIONSHIP`, and it is pointing at something real:
`packages/ui` declares six peers and installs none of them itself, relying on `autoInstallPeers` to
conjure them. It also uses **"most common range"** as its target rather than syncpack's "highest",
which produces different — and sometimes worse — advice: it proposed downgrading `apps/backend`'s
`vitest@^4.1.10` to `^4.1.5` because four other workspaces say `^4.1.5`.

Like syncpack, **zero rows about `@tanstack/form-core`'s two installed versions.**

---

## 9. Comparison table

Columns are the questions that decide this. "The `form-core` case" means: two versions of one package,
arising from a transitive **exact pin** versus a direct **caret**, where every declaration in the repo
already agrees.

| Mechanism | Fixes the `form-core` case? | Reaches transitive deps? | Reaches third-party manifests? | Gate-able? | Cost |
|---|---|---|---|---|---|
| **`overrides` (exact version)** | **Yes — measured, 21 tsc errors → 0** | **Yes** | **Yes** | Indirectly (§10) | 1 line per package; a pin you must remember to bump |
| `overrides` (range) | Only against a fresh lockfile (§4.3) | Yes | Yes | Indirectly | Same, plus a silent failure mode |
| `overrides: 'catalog:'` | **Yes — measured** | Yes | Yes | Indirectly | Best shape: version lives in one place |
| **`catalog:` alone** | **No — measured, nothing changed** | No | No | Only via `catalogMode: strict` on `pnpm add` | 39 entries; fixes the *other* 5 splits |
| `resolutions` | Yes (it *is* `overrides`, §5) | Yes | Yes | Indirectly | Same power, worse name, root-only |
| `dedupePeerDependents` | **No — on by default, 122 → 122** | n/a | n/a | No | Already on |
| `pnpm dedupe --check` | **No — 0 mentions in its output** | Yes, but only upward | No | **Yes**, exit 1 + `ERR_PNPM_DEDUPE_CHECK_ISSUES` | Needs the registry; seconds |
| `resolutionMode: lowest-direct` | Accidentally, today | Indirectly | No | No | Changes every range in the repo; anti-upgrade |
| `peerDependencyRules` | **No — suppresses warnings only** | No | No | No | Actively hides the symptom |
| `packageExtensions` | No (adds missing deps, not duplicates) | Yes | Yes | No | Right tool, wrong problem |
| `strictPeerDependencies: true` | No, but turns some mismatches into install errors | n/a | n/a | Yes, install fails | A triage pass over the whole tree |
| **syncpack** | **No — 0 rows, measured** | No | No | Yes, exit 1 | New dev dependency; 14 rows of `private:true` noise to configure away |
| **manypkg** | **No — 0 rows, measured** | No | No | Yes, exit 1 | New dev dependency; "most common range" target |
| **`pnpm why -r <pkg>`** | Diagnoses it perfectly (§2) | Yes | Yes | No — it is a reading tool | None |
| **Lockfile gate (§10)** | **Detects it in 36 ms** | Yes | Yes | **Yes** | ~40 lines of Node, no dependency |

The shape of the answer: **`overrides` is the only *fix*; the lockfile gate is the only *detector* that
covers transitive splits; catalogs and syncpack cover the declaration-level mismatches that neither of
those is about.** No single mechanism does all three, and any recommendation that claims one does is
wrong.

---

## 10. The gate

`standards/README.md` says a standard is a convention with a check behind it, so the question is
whether "one version of each dependency" can be checked. It can, and the check has to read the
**lockfile**, because that is the only artefact that knows what was actually resolved. syncpack and
manypkg read manifests (§8) and are therefore blind to exactly the failure that matters.

The claim worth gating, stated so that it derives from the manifests rather than from a list someone
maintains:

> **A package that a workspace declares is installed at one version.**
> If any `package.json` in this repo names a package, `pnpm-lock.yaml` resolves it to exactly one
> version. Packages nobody declares are out of scope — the repo has no opinion about them, and 113 of
> them are duplicated today for reasons that live in other people's dependency trees.

Run against the trial workspace as-is, that finds **9** violations — precisely the class-A + class-B set
of §1, with no tuning and no package names in the config:

```
@biomejs/biome is installed at 2.4.5, 2.5.4
    declared by package.json (devDependencies)
    declared by apps/admin/package.json (devDependencies)
    declared by packages/icons/package.json (devDependencies)
    run: pnpm why -r @biomejs/biome
@tanstack/form-core is installed at 1.33.2, 1.33.5
    declared by apps/admin/package.json (dependencies)
    declared by packages/ui/package.json (peerDependencies)
    run: pnpm why -r @tanstack/form-core
…7 more…

9 declared package(s) installed at more than one version
```

The implementation is one file, pure Node, no dependency, no network — it parses the `packages:` section
of `pnpm-lock.yaml` with a regex and every workspace manifest with `JSON.parse`:

```js
// scripts/checks/one-version.mjs (sketch — the working version lives in the scratchpad)
const lock = readFileSync('pnpm-lock.yaml', 'utf8').split('\n')
const versions = new Map()
let inPackages = false
for (const line of lock) {
  if (/^[a-zA-Z]/.test(line)) inPackages = line.startsWith('packages:')
  if (!inPackages) continue
  const match = /^ {2}'?((?:@[^/]+\/)?[^@'\s]+)@([^'\s]+)'?:$/.exec(line)
  if (!match) continue
  const [, name, version] = match
  if (!versions.has(name)) versions.set(name, new Set())
  versions.get(name).add(version)
}
// …then read every apps/*/package.json and packages/*/package.json, union the four dependency
// fields, and fail for any declared name whose version set has more than one member.
```

**Measured: 36 ms, offline, exit 1 when dirty, exit 0 when clean.**

It needs one concession, and the concession should be visible rather than hidden: three of the nine are
genuine cross-major splits with no fix (§3.4). They go in an `accepted` map **whose value is the
reason**, so an entry without one cannot be added silently:

```js
const accepted = {
  express: 'backend pins 4; @bull-board/express needs 5. Two majors, and only the backend imports express.',
  zod: 'we are on 4; @modelcontextprotocol/sdk (via shadcn, a packages/ui dependency) peers on 3.',
  '@dotenvx/dotenvx': 'we are on 2; shadcn bundles 1. Different process, never imported together.',
}
```

**Proof it bites** (`AGENTS.md`: *"a gate that cannot fail is not a gate"*), performed 2026-09-11 in the
trial workspace:

```
### GREEN (final config)
ok: every declared package resolves to one version
exit=0

### MUTATE: drop the '@tanstack/form-core' override line, rm pnpm-lock.yaml, pnpm install
@tanstack/form-core is installed at 1.33.2, 1.33.5
    declared by apps/admin/package.json (dependencies)
    declared by packages/ui/package.json (peerDependencies)
    run: pnpm why -r @tanstack/form-core

1 declared package(s) installed at more than one version
exit=1

### RESTORE
ok: every declared package resolves to one version
exit=0
```

The mutation was restored.

Two honest notes about it. It is a **script, not a rule**, and `standards/README.md` says a check that
is not a rule owes a recorded reason: *no rule engine in this repo reads a lockfile; dependency-cruiser,
Biome and ast-grep all read source, and `.dependency-cruiser.cjs` has no vocabulary for "resolved
version".* And the regex parse of the lockfile is a **format dependency** — it targets
`lockfileVersion: '9.0'` and would need revisiting if pnpm changes the layout. The alternative,
`pnpm list -r --depth Infinity --json`, is supported API but emits **118 MB** and takes ~1 s here;
*measured 2026-09-11.* The regex is the better trade at this size, and the failure mode of a lockfile
format change is "the gate finds nothing", which is the dangerous direction — so if this is adopted, the
mutation above is the test to re-run whenever pnpm's major version moves.

---

## 11. Recommendation for this repo

Three mechanisms, each doing the job it is actually capable of, plus one gate.

### 11.1 The `pnpm-workspace.yaml`

Versions below are the highest currently declared across the ten manifests, except the six that are
`latest` today — those are pinned to what is installed in the real repo's `node_modules` right now, so
the catalog records the status quo rather than silently upgrading during the migration.

```yaml
packages:
  - apps/backend
  - apps/store
  - apps/admin
  - packages/*

# ---------------------------------------------------------------------------
# One version per package, part 1 of 2: the declarations.
#
# Every package that more than one workspace declares lives here, and every one of those
# declarations is the string `catalog:`. This is the whole of what a catalog does — it is a
# macro over the *specifier*, expanded before resolution, so it guarantees that the nine
# workspaces ask the same question. It does NOT guarantee they get the same answer, and it
# cannot reach a third party's manifest at all. That is what `overrides` below is for.
#
# The six entries marked "was: latest" were the literal string `latest` before the pnpm
# migration. Two of them (@tanstack/history, @tanstack/react-router, in packages/ui's
# peerDependencies) made `pnpm install` fail outright:
#   ERR_PNPM_INVALID_PEER_DEPENDENCY_SPECIFICATION … has an invalid value: 'latest'
# `catalog:` is one of the three values that field accepts, so this fixes them and the other
# ten in one move.
# ---------------------------------------------------------------------------
catalog:
  '@asteasolutions/zod-to-openapi': ^8.5.0
  '@biomejs/biome': 2.5.4
  '@dotenvx/dotenvx': ^2.17.1
  '@faker-js/faker': ^10.5.0
  '@playwright/test': ^1.62.1
  '@tailwindcss/vite': ^4.3.3
  '@tanstack/devtools-vite': ^0.8.5             # was: latest
  '@tanstack/form-core': ^1.33.2
  '@tanstack/history': ^1.162.2                 # was: latest
  '@tanstack/react-devtools': ^0.10.12          # was: latest
  '@tanstack/react-form': ^1.33.2
  '@tanstack/react-query': ^5.101.4
  '@tanstack/react-query-devtools': ^5.101.4
  '@tanstack/react-router': ^1.170.33           # was: latest
  '@tanstack/react-router-devtools': ^1.167.1   # was: latest (in apps/store)
  '@tanstack/react-start': ^1.168.50            # was: latest
  '@tanstack/router-cli': ^1.132.0
  '@tanstack/router-plugin': ^1.132.0
  '@types/node': ^24.10.1
  '@types/qs': ^6.15.1
  '@types/react': ^19.2.0
  '@types/react-dom': ^19.2.0
  '@vitejs/plugin-react': ^6.0.1
  drizzle-orm: ^0.39.0
  orval: ^8.22.0
  postgres: ^3.4.7
  qs: ^6.15.3
  react: ^19.2.0
  react-dom: ^19.2.0
  scrypt-kdf: ^4.0.0
  tailwindcss: ^4.3.3
  tw-animate-css: ^1.4.0
  typescript: ^6.0.3
  vite: ^8.0.0
  vitest: ^4.1.10
  wrangler: ^4.114.0
  zod: ^4.4.3

# ---------------------------------------------------------------------------
# One version per package, part 2 of 2: the resolutions.
#
# An override rewrites the dependency spec in EVERY manifest in the graph, including packages
# we do not own. It is the only mechanism here that can do that, and it is the only thing that
# fixes the two duplicates below — both of which are a third-party EXACT pin sitting against our
# own caret, so there is no disagreement between our manifests for a catalog to remove.
#
#   @tanstack/react-form@1.33.2 depends on "@tanstack/form-core": "1.33.2" — an exact pin.
#   We declare ^1.33.2, which resolves to 1.33.5. Two copies; TypeScript then treats the two
#   copies' types as unrelated and apps/admin fails to compile with 21 errors.
#   @tanstack/react-router does the same to @tanstack/history.
#
# `catalog:` as the value keeps the version in exactly one place, above. Verified: pnpm records
# the expanded version in the lockfile's `overrides:` header and collapses both to one copy.
#
# CAVEAT, measured: if the override VALUE is a range rather than an exact version, adding it to
# an existing lockfile does not re-resolve — the already-locked 1.33.2 still satisfies ^1.33.2,
# and `pnpm update` does not dislodge it either. After adding or widening an override, delete
# pnpm-lock.yaml and reinstall, then check the gate.
# ---------------------------------------------------------------------------
overrides:
  '@tanstack/form-core': 'catalog:'
  '@tanstack/history': 'catalog:'

onlyBuiltDependencies:
  - '@ast-grep/cli'
  - '@swc/core'
  - esbuild
  - msgpackr-extract
  - msw
  - protobufjs
  - workerd
```

Plus, in every `package.json`, each of those 37 packages becomes `"catalog:"`, and each internal
package becomes `"workspace:*"` rather than today's `"*"` (§7.1). `syncpack` has a migration command
for the first half; the second half is a sed.

(37 here, against the 39 measured in §3.4: the catalog above is derived from the **real** repo's
manifests, where five of the shared names are internal workspace packages that belong in
`workspace:*` rather than a catalog, while the trial workspace has already declared seven of the
phantom imports from `undeclared-dependencies.md` — `lucide-react`, `dependency-cruiser`,
`bignumber.js` and friends — which makes them shared too. Recompute the list after those land; the
script that produced it is three lines of `json.load` over the ten manifests.)

Measured effect of exactly this configuration in the trial workspace, *2026-09-11*:

| | before | after |
|---|---|---|
| `apps/admin` `tsc --noEmit` | **21 errors** (17 TS2322, 4 TS2345) | **0** |
| `packages/ui` `tsc --noEmit` | 1 error (TS2353, the `@tanstack/history` split) | **0** |
| declared packages at >1 version | 9 | **3**, all cross-major and unreachable |
| all packages at >1 version | 122 | 110 |

### 11.2 What is deliberately *not* in it

- **`resolutionMode`** — stays at `highest`. Changing it would fix `form-core` by luck and change how
  every range in the repo resolves. (§6.3)
- **`dedupePeerDependents`** — stays at its default `true`. Measured inert here: 122 → 122. (§6.1)
- **`peerDependencyRules`** — not used. It suppresses warnings and installs nothing differently; using
  it on a duplicate is the definition of papering over. (§7.3)
- **`resolutions`** — not used. pnpm merges it into `overrides` anyway; two spellings for one field is
  a trap. (§5)
- **`strictPeerDependencies: true`** — deferred, not rejected. It would turn a class of these into
  install failures, which is the right direction, but it needs a triage pass over the whole tree first
  and that is its own piece of work.

### 11.3 The gate

`scripts/checks/one-version.mjs` as sketched in §10, wired into `scripts/verify.sh`'s `JOBS` list —
which `AGENTS.md` names as "the single definition of what 'checked' means here". It is offline, 36 ms,
and derives from the manifests, so it fits alongside the `structure` gate rather than needing a tool.
Whether it becomes its own job or joins `structure` is a judgement call: the claim is about *versions*,
not about which file may import which, so a separate `versions` job reads more honestly.

`pnpm dedupe --check` is the **second**, weaker gate, and it is a different claim ("the lockfile is
minimal"). It needs the registry and takes seconds, so it belongs in CI, not in local `verify`.

### 11.4 Order of work

1. Convert internal deps from `"*"` to `"workspace:*"` — otherwise nothing installs at all (§7.1).
2. Add the catalog and convert the 37 shared declarations. This alone clears the two fatal
   `peerDependencies: latest` entries and five of the nine splits.
3. Add the two overrides. Delete `pnpm-lock.yaml`, reinstall — do not trust an incremental install here
   (§4.3).
4. Run `tsc` in `apps/admin` and `packages/ui`; expect 0.
5. Add the gate with the three-entry `accepted` map, run the mutation of §10, and say in the PR that
   you ran it.
6. Optional, separately: run `pnpm dedupe` once to bank the ~30 collapses it found, and decide whether
   `syncpack` earns a place as the tool that keeps the catalog current.

### 11.5 Recorded as considered and rejected

For `standards/README.md` → *Tools considered, and rejected*:

- **syncpack** — the best tool in this space for what it does, and what it does is compare
  `package.json` files. Measured against the trial workspace it reported 0 rows for `@tanstack/form-core`,
  `zod` and `express` — the three packages actually installed at more than one version — while reporting
  14 rows of `DependsOnInvalidLocalPackage` that are artefacts of every workspace being `private: true`
  with no `version` field. **Worth revisiting as a one-time migration tool** (it can generate the
  catalog) and as a catalog-freshness checker; not as the gate.
- **manypkg** — same blindness, plus a "most common range" target that proposed *downgrading*
  `apps/backend`'s vitest. Its `INVALID_DEV_AND_PEER_DEPENDENCY_RELATIONSHIP` check is a genuinely
  useful finding about `packages/ui` declaring six peers it installs none of, and that is worth acting
  on independently of adopting the tool.
- **`peerDependencyRules`** — suppresses console output only. Rejected on principle: it makes the
  symptom of this exact bug invisible.
- **`resolutionMode: lowest-direct`** — would fix `@tanstack/form-core` today by coincidence, at the
  cost of resolving every range in the repo to its floor forever.

---

## 12. Where the evidence is thin

**The trial workspace is not the repo.** It has already been edited during the migration: `apps/admin`
declares `@tanstack/form-core` (the real repo does not), `packages/ui`'s peers have had their `latest`s
replaced, and internal deps have been converted to `workspace:*`. The *mechanism* findings hold
regardless — a caret against an exact pin splits either way, and §2 shows `packages/ui` splitting on
its own. But the **counts** in §1 (122 / 5 / 4 / 113) and the recommended catalog's version numbers are
measured against the trial, and the real repo's numbers will differ once it is converted.

**Everything here is pnpm 10.27.0; pnpm is on 12.** `versions.json` on the docs site lists `12.x`,
`11.x`, `10.x`. Version-sensitive claims were taken from `versioned_docs/version-10.x/` and from the
installed binary, but features have moved: `catalogPrune` (v11.22.0) replaced `cleanupUnusedCatalogs`,
`workspace:` ranges became legal inside a catalog (v12.2.0), and `vuejs/core`'s public
`pnpm-workspace.yaml` carries a setting spelled `dedupePeers: true` that does not exist in pnpm 10 —
**the rename was not verified** and no claim here rests on it. Re-check §7.1's default table against
whatever pnpm version the repo actually pins.

**The lockfile-stickiness caveat (§4.3) is measured but not explained.** It reproduced twice, and
`pnpm update -r <pkg>` did not clear it, but the pnpm code path that keeps the old resolution was not
located. The practical instruction — use an exact version, and delete the lockfile after changing an
override — is sound either way, but the mechanism is an observation, not an understanding.

**`packageExtensions`, `strictPeerDependencies: true`, `catalogs:` (plural, named), `--save-catalog`,
and the scoped `parent>child` override form were never run.** They are described from the v10 docs
only, and none of them is load-bearing for the recommendation.

**`pnpm dedupe` itself was never run — only `--check`.** The 30-odd collapses it proposed are its own
claim about itself; whether applying them is safe here is unverified, and one of them (`zod@4.4.3` →
`4.6.2`) is a real resolution change to a package four workspaces import.

**The gate's lockfile regex was validated by agreement with two independent counts** (the virtual-store
directory listing and a manifest cross-reference), not by parsing the YAML properly. It targets
`lockfileVersion: '9.0'`. A format change would most likely make it find *nothing*, which is the
failure direction that does not announce itself — §10 says to re-run the mutation on every pnpm major,
and that instruction is the only thing standing between this gate and silently becoming decorative.

**The public monorepo examples were read, not run.** `TanStack/router`, `vuejs/core` and `nuxt/nuxt`
all ship a `pnpm-workspace.yaml` with a `catalog:` block, and `nuxt/nuxt` pins `@types/node`, `vite`,
`vue`, `rolldown` and `oxc-parser` to **exact versions in `overrides:`** — which is the §11.1 pattern,
arrived at independently. `vitejs/vite` and `withastro/astro` use `overrides` with no catalog;
`sveltejs/svelte` uses neither. That is corroboration of a practice, not evidence of a behaviour.

**No claim here about npm's or Yarn's semantics (§4.5) was executed.** The npm and Yarn comparisons are
from memory of their documented shapes and should be treated as orientation, not as verified fact; the
one npm measurement that *was* made is that the real repo currently has exactly one hoisted
`@tanstack/form-core@1.33.2`.

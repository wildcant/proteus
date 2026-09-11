# Making an Undeclared ("Phantom") Dependency a Build-Time Failure

Research findings on whether an npm-workspaces monorepo can enforce *"if a workspace imports it, that
workspace declares it"* as **one general mechanism** derived from each `package.json` — with no
hand-written rule per package.

**Date:** 2026-09-11
**Verification method:** dependency-cruiser 18.1.0 and Biome 2.5.4 were read from `node_modules/` and
**run against this tree**; every count below is a measured run, not an inference. Tool claims that could
not be run here (knip, depcheck, Nx, pnpm, `npm --install-strategy`) are cited to primary docs or vendor
source and are labelled unverified where that matters.
**One-line answer:** yes — a single dependency-cruiser `forbidden` rule keyed on `npm-no-pkg`, plus
`preserveSymlinks: true`, catches every case including the two workspace-package ones, with zero false
positives, in 2.6 seconds.

> **Amended 2026-09-11, after the pnpm migration. The recommendation in §11 was not built, and should
> not be.** The repo moved to pnpm, whose strict layout makes an undeclared import unresolvable rather
> than detectable, and fails it through `typecheck` — a gate that already exists. The rule would be a
> second, slower way to learn the same thing. The findings below stand as measured; what changed is the
> mechanism that was available, not the arithmetic. Three amendments are marked inline: this one, the
> verification of §7's pnpm claim, and a class of phantom in §8 that no tool surveyed here can see.
> `.scratch/pnpm-migration/spec.md` §6 records the decision.

---

## Table of Contents

1. [The question, and what a passing answer has to look like](#1-the-question-and-what-a-passing-answer-has-to-look-like)
2. [What is actually undeclared today](#2-what-is-actually-undeclared-today)
3. [How dependency-cruiser decides, read from its source](#3-how-dependency-cruiser-decides-read-from-its-source)
4. [What dependency-cruiser catches here, measured](#4-what-dependency-cruiser-catches-here-measured)
5. [Biome already ships this rule — and it does not work here](#5-biome-already-ships-this-rule--and-it-does-not-work-here)
6. [The other candidates](#6-the-other-candidates)
7. [The structural answer: can npm make this impossible?](#7-the-structural-answer-can-npm-make-this-impossible)
8. [Comparison table](#8-comparison-table)
9. [The second half of the problem: undeclared binaries](#9-the-second-half-of-the-problem-undeclared-binaries)
10. [Per-case verdict: declare it, or fix the import?](#10-per-case-verdict-declare-it-or-fix-the-import)
11. [Recommendation for this repo](#11-recommendation-for-this-repo)
12. [Where the evidence is thin](#12-where-the-evidence-is-thin)

---

## 1. The question, and what a passing answer has to look like

The constraint that dominates the answer is that `package.json` is already the source of truth, so the
check must be **derived from each manifest**, not from a list of package names someone maintains. In this
repo's vocabulary ([`standards/README.md` → The words](../../standards/README.md)):

- the **convention** is *a workspace declares every package it imports*;
- it becomes a **standard** the day a check exists;
- the check must be a **rule** — a declarative file — not a script, unless a rule provably cannot express
  it (`standards/README.md` → [When a rule cannot express it](../../standards/README.md));
- the **gate** it joins is `structure`, because the claim is about which file may import which, which is
  the kind that gate already owns ([The four kinds a standard can be about](../../standards/README.md)).

A recommendation that enumerates `lucide-react`, `bignumber.js` and six friends is a failed answer, and so
is one that requires an exemption per workspace.

---

## 2. What is actually undeclared today

The brief named eight. A repo-wide cruise found **eleven** — all confirmed by reading the importing file.

| Package | Declared in | Imported by | Kind |
|---|---|---|---|
| `lucide-react` | `packages/ui` | `apps/admin` (39 sites), `apps/store` (38 sites) | registry |
| `@tanstack/form-core` | `packages/ui` (as a **peer**) | `apps/admin` (5 sites) | registry |
| `class-variance-authority` | `packages/ui` | `apps/store/src/components/payment-row.tsx` | registry |
| `@faker-js/faker` | `apps/backend`, `packages/testing` | `apps/store/tests/e2e/` (3 specs) | registry |
| `bignumber.js` | `apps/backend` | `packages/http-schemas/src/common.ts` | registry |
| `dependency-cruiser` | `apps/backend` | `apps/admin/structure/.dependency-cruiser.cjs` (JSDoc `@type`) | registry |
| `backend` | `apps/store`, `packages/testing` | `apps/admin/tests/e2e/products.spec.ts` — `import … from 'backend/test'` | **workspace** |
| `@proteus/frontend-structure` | **nowhere** | `apps/admin/structure/`, `apps/store/structure/` | **workspace** |
| `ms` | nowhere (transitive of `jsonwebtoken`) | `apps/backend/src/core/auth/utils/{token,generate-jwt-token}.ts` — `import type { StringValue }` | registry |
| `@playwright/test` | `apps/admin`, `apps/store` | `apps/backend/scripts/db-diagram/load.mjs` | registry |
| `vite` | `apps/admin`, `apps/store` | `packages/ui/vite.config.ts` | registry |

Nothing fails today. Every one of these resolves only because npm's default `hoisted` install strategy
puts them in the root `node_modules` on behalf of some *other* workspace.

*Verified 2026-09-11 by `depcruise apps packages` (§4) and by reading each importing file.*

---

## 3. How dependency-cruiser decides, read from its source

The classification lives in one function,
`node_modules/dependency-cruiser/src/extract/resolve/determine-dependency-types.mjs`. Reading it, rather
than the docs, is what settles the workspace-package question.

### 3.1 The decision order

```
couldNotResolve                                  → ["unknown"]
aliases (webpack / tsconfig baseUrl / tsconfig paths /
         package.json "imports" / workspaces)    → ["aliased", "aliased-…"]
core module                                      → + "core"
relative specifier, or aliased-and-not-external  → + "local"
resolved path is inside node_modules             → + determineNodeModuleDependencyTypes(…)
otherwise                                        → + "undetermined"
```

`determineNodeModuleDependencyTypes` is the part that reads the manifest:

```js
const NPM2DEP_TYPE = new Map([
  ["dependencies", "npm"],
  ["devDependencies", "npm-dev"],
  ["optionalDependencies", "npm-optional"],
  ["peerDependencies", "npm-peer"],
])
// …
lReturnValue = lReturnValue.length === 0 ? ["npm-no-pkg"] : lReturnValue
```

So `npm-no-pkg` is produced by *asking the manifest* and getting nothing back. There is no list of package
names anywhere. That is exactly the general mechanism the brief asks for.

The official wording matches the source:

> `npm-no-pkg` — "it's an npm module - but it's nowhere in your package.json"
> `npm-unknown` — "it's an npm module - but there is no (parseable/ valid) package.json in your package"
> `undetermined` — "the dependency fell through all detection holes"
> `unknown` — "it's unknown what kind of dependency type this is - probably because the module could not be resolved"
> — <https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md>, *verified 2026-09-11*

### 3.2 Which manifest — and why `combinedDependencies` must stay off

`src/extract/resolve/get-manifest.mjs`:

> "If `combinedDependencies` is on `false` (the default) dependency-cruiser will search for a
> `package.json` closest up from the source file it investigates."
> — <https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md>, *verified 2026-09-11*

`false` is what makes the check per-workspace-strict. With `true`, `getCombinedManifests` merges every
manifest between the file and the directory the cruise started in — which in a monorepo means the root
manifest's dependencies mask every workspace's omissions. **`combinedDependencies` must be left at its
default.** (Source detail worth knowing: `getCombinedManifests` *throws* if a file sits outside the cruise
base directory, so turning it on in a per-app cruise that follows into `../../packages/` is not merely
wrong, it is unsafe.)

That per-file manifest lookup is observable in this repo without changing anything. The same package,
`@tanstack/form-core`, resolved from the same `node_modules` directory, classifies two different ways
depending only on which manifest is closest to the importing file:

```
packages/ui/src/route-modals/…/route-modal-form.tsx → @tanstack/form-core  ["npm-peer", "import"]
apps/admin/src/features/products/hooks/use-create-product-form.ts
                                                    → @tanstack/form-core  ["npm-no-pkg", "import"]
```

*Measured 2026-09-11.* `packages/ui` declares it as a peer; `apps/admin` declares it nowhere. This is the
mechanism working, demonstrated by the repo itself.

### 3.3 The workspace-package trap, and the one option that defuses it

By default enhanced-resolve follows symlinks (`src/main/resolve-options/normalize.mjs` sets
`symlinks: !preserveSymlinks`, default `preserveSymlinks: false`). So `import … from '@proteus/ui'` in the
admin resolves to the **realpath** `../../packages/ui/src/index.ts`, which does not contain
`node_modules`. `isExternalModule` is therefore false, the specifier is not relative, and there is no
alias — so it falls off the end of the chain:

```
@proteus/ui  →  ["undetermined", "import"]        (declared in apps/admin — and still "undetermined")
```

`undetermined` is produced for *declared and undeclared workspace packages alike*, so a rule keyed on it
cannot tell `@proteus/ui` (declared) from `backend` (not declared). This is the trap the brief predicted,
and it is real.

The fix is the documented top-level option:

> `preserveSymlinks` — "Whether to leave symlinks as is or resolve them to their realpath. This option
> defaults to `false`."
> — <https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md>, *verified 2026-09-11*

With `preserveSymlinks: true`, `@proteus/ui` resolves to `../../node_modules/@proteus/ui/src/index.ts`,
which *is* external, so it goes through the manifest lookup like any registry package — and comes back
`npm` when declared, `npm-no-pkg` when not. **Under `preserveSymlinks: true` the `undetermined` bucket is
empty in this repo: 0 occurrences across 8,869 dependencies.** *Measured 2026-09-11.*

`aliased-workspace` — the type the brief wondered about — never fires here either. `isWorkspaceAliased`
in `module-classifiers.mjs` requires the *nearest* manifest to carry a `workspaces` array, and no
workspace's own `package.json` does; only the root's. It would also not distinguish declared from
undeclared if it did fire.

### 3.4 The upstream rule already exists

`dependency-cruiser --init` generates a `no-non-package-json` rule
(`src/cli/init-config/config-template.mjs`, lines 84–98), verbatim:

```js
{
  name: 'no-non-package-json',
  severity: 'error',
  comment:
    "This module depends on an npm package that isn't in the 'dependencies' section of your package.json. " +
    "That's problematic as the package either (1) won't be available on live (2 - worse) will be " +
    "available on live with an non-guaranteed version. Fix it by adding the package to the dependencies " +
    "in your package.json.",
  from: {},
  to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
},
```

The docs suggest a wider set — `["unknown", "undetermined", "npm-no-pkg", "npm-unknown"]`. **Do not use the
wider set here.** `undetermined` is dead under `preserveSymlinks` and noisy without it, and `unknown`
means *could not resolve*, which in a root-level cruise fires 1,119 times on this repo's TypeScript path
aliases (`@core/*`, `@tests/*`, `@framework/*`, `@server/*`, `@workflows/*`). *Measured 2026-09-11.*

### 3.5 Dev versus production is distinguishable

`npm-dev` is its own type, so "a test file may import a devDependency, a `src/` file may not" is a second,
separate, still-general rule:

```js
{
  name: 'dev-dep-in-production-code',
  from: { path: '^(apps|packages)/[^/]+/src/', pathNot: '__tests__|\\.test\\.|\\.spec\\.' },
  to: { dependencyTypes: ['npm-dev'] },
}
```

Run today this fires **16 times**, all pre-existing and all arguably fine: `drizzle-kit` imported by the
14 `src/modules/*/database.config.ts` files, and `svgson` + `minimist` in
`packages/icons/src/build-icons/`. *Measured 2026-09-11.* Those are build-time files that happen to live
under `src/`, so adopting this rule means either moving them or exempting them — which is why it is
**recommended as a follow-up, not as part of the main change**.

---

## 4. What dependency-cruiser catches here, measured

### 4.1 The configuration

```js
module.exports = {
  forbidden: [
    {
      name: 'no-undeclared-dependency',
      severity: 'error',
      comment: '…',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    preserveSymlinks: true,
    detectJSDocImports: true,
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.d.ts'],
    },
  },
}
```

### 4.2 The result

`depcruise apps packages --config <the above>`, run from the repo root:

```
x 94 dependency violations (94 errors, 0 warnings). 2489 modules, 8869 dependencies cruised.
```

in **2.6 s wall**. Grouped by target, those 94 are exactly the eleven packages of §2 and nothing else —
**zero false positives**. Every one is `npm-no-pkg`; `npm-unknown` and `undetermined` never fire.
*Measured 2026-09-11.*

Four details worth recording, because each was a real trap:

- **`detectJSDocImports: true` is load-bearing for one case.** `apps/admin/structure/.dependency-cruiser.cjs`
  reaches `dependency-cruiser` only through `/** @type {import('dependency-cruiser').IConfiguration} */`.
  Without the option it is invisible; with it, the edge comes back
  `["npm-no-pkg","type-only","import","jsdoc","jsdoc-bracket-import"]`.
- **`exclude` must not name `node_modules`.** `exclude` removes modules from the graph *including as
  dependency targets*, which silently deletes every registry edge and turns the cruise green.
  `doNotFollow` is the correct option — it keeps the edge and declines to walk through it.
  ("If you don't want to see certain modules in your report (or not have them validated), you can exclude
  them" vs. "If you *do* want to see certain modules in your reports, but are not interested in these
  modules' dependencies" — <https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md>,
  *verified 2026-09-11*.)
- **The cruise must cover more than `src/`.** Three of eleven live outside it — `tests/e2e/`,
  `structure/.dependency-cruiser.cjs`, `packages/ui/vite.config.ts`. Today's
  `check:structure` cruises `src/` only, which is why adding the rule to the existing per-app configs
  would miss them.
- **Path aliases resolve to `unknown` in a root-level cruise and are therefore harmless.** No tsconfig is
  loaded, so `@core/types` is `unknown` (not `npm-no-pkg`), which the rule ignores. The cost is that
  `not-to-unresolvable` cannot be paired with it at root; the benefit is one invocation for nine
  workspaces. A per-workspace cruise with `tsConfig: { fileName: 'tsconfig.json' }` resolves the aliases
  properly and leaves only **2** genuine unresolvables (`cloudflare:workers`, twice) — but it needs a
  per-workspace list of entry directories, because `packages/testing` and `packages/frontend-structure`
  have no `src/`. *Both variants measured 2026-09-11.*

### 4.3 Why it must be a second cruise, not a rule added to the existing configs

`preserveSymlinks: true` changes where workspace packages resolve to, and the existing configs have rules
that depend on the current answer — `no-store-schemas-in-admin` targets `packages/http-schemas/src/store/`,
and `no-direct-bignumber-import` exempts `packages/http-schemas/`. Under `preserveSymlinks` those paths
become `node_modules/@proteus/…`, and `doNotFollow: node_modules` then stops the cruise from entering them
at all:

```
apps/admin, existing config, as-is        → 676 modules, 1920 dependencies
apps/admin, existing config + preserveSymlinks → 538 modules, 1540 dependencies
```

*Measured 2026-09-11.* Both report zero violations, which is precisely the danger: the rules would stop
matching without saying so. **A gate that cannot fail is not a gate** — so the phantom rule gets its own
config and its own invocation, and the three existing configs are not touched.

### 4.4 Proving it goes red

Run on an isolated fixture outside the repo — one `package.json`, one file importing `qs`, the repo's
`node_modules` symlinked in:

```
=== GREEN: qs IS in dependencies ===
✔ no dependency violations found (2 modules, 1 dependencies cruised)

=== RED: qs removed from package.json; source file untouched ===
  error no-undeclared-dependency: src/a.ts → node_modules/qs/lib/index.js
x 1 dependency violations (1 errors, 0 warnings). 2 modules, 1 dependencies cruised.
```

*Performed 2026-09-11; the fixture lived in the scratchpad and no repo file was modified.* The mutation is
a one-line manifest edit with no source change, which is the shape the standard is about.

---

## 5. Biome already ships this rule — and it does not work here

The highest-value surprise of this research: **Biome 2.5.4, already pinned in this repo and already
running in the `lint` gate, has `lint/correctness/noUndeclaredDependencies`.**

> "Disallow the use of dependencies that aren't specified in the `package.json`. Indirect dependencies will
> trigger the rule because they aren't declared in the `package.json`. … The rule is meant to catch those
> dependencies that aren't declared inside the closest `package.json`, and isn't meant to detect
> dependencies declared in other manifest files, e.g. the root `package.json` in a monorepo setting."
> — `biome explain noUndeclaredDependencies`, Biome 2.5.4, *verified 2026-09-11*; same text at
> <https://biomejs.dev/linter/rules/no-undeclared-dependencies/>

It is available from Biome 1.6.0, default severity `error`, domain `project`, and it accepts
`devDependencies` / `peerDependencies` / `optionalDependencies` / `bundleDependencies` as booleans **or as
arrays of globs** — so the dev-versus-production split of §3.5 comes free and per-file.

Run against this tree with `biome lint --only=correctness/noUndeclaredDependencies apps packages`:

```
Checked 1628 files. Found 1215 errors.  (2.1 s)
```

Of those 1,215, **85 are the eleven real phantoms** — it finds every one, including both workspace rows,
and including `@proteus/frontend-structure` inside a `.cjs` file. The other **~1,130 are false positives**,
all of one kind: the backend's TypeScript path aliases.

| Specifier | Diagnostics |
|---|---|
| `@core/types` | 326 |
| `@tests/setup` | 164 |
| `@core/utils` | 149 |
| `@server/ports.js` | 107 |
| `@framework/http` | 83 |
| …and 20 more `@core/*`, `@tests/*`, `@workflows/*`, `@framework/*`, `@server/*` | ~300 |

*Measured 2026-09-11.* The rule matches the specifier's package name against the manifest as a **string**;
it never resolves. `@core/types` looks exactly like a scoped package. Biome documents that it ignores
`#`-prefixed subpath imports and `@/`-prefixed aliases, but not tsconfig `paths`, and the rule has **no
ignore list and no alias option** — the four documented options are the dependency-field toggles and
nothing else.

So Biome's rule is unusable here without one of:

- **an override disabling it for `apps/backend`** — which surrenders the backend entirely (it would lose
  `ms` and `@playwright/test`, and every future backend phantom), or
- **migrating the backend from tsconfig `paths` to `#` subpath imports** — a repo-wide refactor of roughly
  1,130 import sites, for a rule dependency-cruiser already expresses.

Biome also **misses the JSDoc case**: it did not flag `import('dependency-cruiser')` inside the `@type`
comment that dependency-cruiser's `detectJSDocImports` catches.

This is the [*"already enforced, somewhere that is not here"*](../../standards/README.md) verdict run in
reverse — the tool is present and the rule exists, and it still is not the answer. Record it so nobody
re-discovers it: **revisit Biome's `noUndeclaredDependencies` if the backend ever moves to `#` subpath
imports, or if Biome gains alias awareness for this rule.**

---

## 6. The other candidates

### 6.1 knip

The strongest alternative, and the only tool that answers the *inverse* question too.

> **Unlisted dependencies** — "Used dependencies not listed in package.json"
> **Unlisted binaries** — "Binaries from dependencies not listed in package.json"
> **Unused dependencies** — "Unable to find a reference to this dependency"
> — <https://knip.dev/reference/issue-types>, *verified 2026-09-11*

It reads npm `workspaces` from the root `package.json`, resolves tsconfig `paths`, and is configurable per
workspace (<https://knip.dev/features/monorepos-and-workspaces>, *verified 2026-09-11*). It is also the
only candidate that catches the **binaries** class of §9.

Against it: it is a new dependency and a new gate; its output is not one rule but a suite of issue types
that all fire at once (unused files, unused exports, unused types), so adoption means a triage pass and
then a config declaring which types are gated; and its own guidance is that surprises are "usually a real
finding or a configuration gap, not a false positive to silence"
(<https://knip.dev/guides/handling-issues>, *verified 2026-09-11*) — a good philosophy, and a large
first-run bill in a repo this size. **Not verified in this tree** — knip is not installed and this
research did not install it.

### 6.2 depcheck

Archived 16 June 2025; the maintainers recommend knip. Its README is explicit that it has no workspace
support: *"if a subfolder has a `package.json` file, it is considered another project and should be
checked with another depcheck command."* — <https://github.com/depcheck/depcheck#readme>, *verified
2026-09-11*. **Closed.**

### 6.3 eslint-plugin-import / `no-extraneous-dependencies`

General in the right way — it "locates the nearest parent `package.json`" — and it has the same glob-based
dev/prod split Biome has. But the `packageDir` option that people reach for in monorepos takes an *array*
of manifest directories and merges them, which re-introduces exactly the hoisting hole this check exists
to close. — <https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-extraneous-dependencies.md>,
*verified 2026-09-11*.

The disqualifying fact is not the rule, it is the toolchain: this repo has no ESLint. Introducing it for
one rule duplicates a tool already in the `structure` gate. The same verdict `standards/README.md` records
for eslint-plugin-project-structure applies verbatim.

### 6.4 manypkg, syncpack, publint

All three read manifests only and never read source, so none can see an import at all.

- **manypkg** — nine checks, all manifest-to-manifest: `EXTERNAL_MISMATCH`, `INTERNAL_MISMATCH`,
  `INVALID_DEV_AND_PEER_DEPENDENCY_RELATIONSHIP`, `ROOT_HAS_PROD_DEPENDENCIES`,
  `MULTIPLE_DEPENDENCY_TYPES`, `INVALID_PACKAGE_NAME`, `UNSORTED_DEPENDENCIES`,
  `INCORRECT_REPOSITORY_FIELD`, `WORKSPACE_REQUIRED`. — <https://github.com/Thinkmill/manypkg#checks>,
  *verified 2026-09-11*.
- **syncpack** — "a command-line tool for consistent dependency versions in large JavaScript Monorepos";
  operates on `package.json` files located through the package manager's workspace configuration.
  — <https://syncpack.dev/>, *verified 2026-09-11*.
- **publint** — "Lint packaging errors. Ensure compatibility across environments." Every workspace here is
  `private: true` and nothing is published, so it has no subject. — <https://github.com/publint/publint#readme>,
  *verified 2026-09-11; the README tagline is the only part verified*.

**All three: closed.** They are useful tools for a different question (version drift across workspaces),
and manypkg's `INVALID_DEV_AND_PEER_DEPENDENCY_RELATIONSHIP` would incidentally have caught the
`@tanstack/form-core` row — but only as a manifest smell in `packages/ui`, not as the admin's undeclared
import.

### 6.5 Nx `@nx/dependency-checks`, Turborepo

Nx has an ESLint rule of this shape, but adopting it means adopting Nx's project graph and ESLint on top
of a repo that uses neither. Turborepo has no equivalent lint rule. **Closed on adoption cost.** *The Nx
rule's exact semantics were not verified — the documentation URLs tried returned 404 on 2026-09-11.*

### 6.6 TypeScript compiler settings

There is none. `tsc` resolves through `node_modules` and has no notion of "which manifest declared this".
`paths`, `types` and `typeRoots` constrain *where* it looks, never *who declared it*. A phantom that is
hoisted type-checks cleanly — which is the whole premise of this document, and is observably true here:
`npm run typecheck` passes with eleven phantoms in the tree.

---

## 7. The structural answer: can npm make this impossible?

Worth answering honestly, because "detected" and "impossible" are different goods.

npm's own definition, read from the installed npm 11.9.0
(`@npmcli/config/lib/definitions/definitions.js`), *verified 2026-09-11*:

```
'install-strategy': default 'hoisted', type: ['hoisted','nested','shallow','linked']
  hoisted (default): Install non-duplicated in top-level, and duplicated as
    necessary within directory structure.
  nested: (formerly --legacy-bundling) install in place, no hoisting.
  shallow (formerly --global-style) only install direct deps at top-level.
  linked: (experimental) install in node_modules/.store, link in place, unhoisted.
```

`linked` is marked **experimental** by npm itself. The neighbouring `install-links` option is explicitly
*"no effect on workspaces."*

> ⚠️ A secondary rendering of the npm docs fetched during this research returned a paragraph recommending
> `--install-strategy=linked` "to catch undeclared (phantom) dependencies before publishing". **That text
> does not exist in npm's source.** It was fabricated by the summarising layer. The verbatim definition
> above is the only authority; treat any phantom-dependency advice attributed to npm's docs as unsourced
> until seen in `definitions.js`.

pnpm is the tool that makes this structurally impossible, and says so:

> "By default, pnpm uses symlinks to add only the direct dependencies of the project into the root of the
> modules directory." … "When installing dependencies with npm or Yarn Classic, all packages are hoisted
> to the root of the modules directory. As a result, source code has access to dependencies that are not
> added as dependencies to the project."
> — <https://pnpm.io/motivation>, *verified 2026-09-11*

**The honest finding:** npm's hoisted layout *is* the root cause, and pnpm's default layout is the only
option here that converts this from *detected* to *impossible*. But three things make that the wrong
recommendation for this repo right now:

1. It is a package-manager migration — lockfile, CI, Docker, the Cloudflare deploys, and every
   `npm run --workspace=…` invocation in `AGENTS.md` and `scripts/`.
2. It does not close the two **workspace-package** rows by itself. `backend` and `@proteus/frontend-structure`
   are linked into the root `node_modules` by the workspace mechanism in every package manager; pnpm links
   only *declared* workspace deps into each package's own `node_modules`, so it would close them — but
   that is a claim about pnpm's linker that **was not verified here**, since installing pnpm was out of
   scope.
   > **Amended 2026-09-11: verified, and it holds.** Both workspace-package rows close under pnpm —
   > `backend` and `@proteus/frontend-structure` are unresolvable from a workspace that does not declare
   > them. Measured by applying the layout and running `tsc --noEmit` per app;
   > `.scratch/pnpm-migration/spec.md` §3 has the per-app error counts.
3. A strict layout makes the failure a *runtime resolution error*, discovered by whoever runs the app
   next. A rule makes it a named gate failure with a file, a line and a fix. Those are different
   ergonomics, and the second is what `scripts/verify.sh` exists to provide.
   > **Amended 2026-09-11: this one did not survive contact.** The failure is not a runtime resolution
   > error found later. It is a `typecheck` failure, in the same `verify` run, naming the file, the line
   > and the module — the ergonomics this point wanted from a rule, from a gate that already existed.

`--install-strategy=nested` or `linked` on npm would get partway there without the migration, but both
change the on-disk layout for every developer and CI job, `linked` is experimental, and **neither was
tested here** — testing them requires a destructive reinstall. Treat them as unverified.

---

## 8. Comparison table

The five questions from the brief, answered per tool. "All 11" means the eleven of §2, including both
workspace-package rows.

> **Amended 2026-09-11: this table is missing a question and a row.** Question 6 below — the `@types/*`
> class — was not in the brief because nothing here could see it. Every tool in this table works from
> import specifiers, and a `@types/*` package is never named in one: TypeScript loads it implicitly from
> `node_modules/@types`. `packages/ui` writes JSX in every component and declares neither `@types/react`
> nor `@types/react-dom`; under the strict layout that is **171 type errors**, and it is invisible to
> dependency-cruiser, Biome and knip alike. The last row is the mechanism that found it.

| Tool | 1. Catches all 11? | 2. General, or per-package config? | 3. Offline, deterministic, fast? | 4. Catches the inverse (declared, unimported)? | 5. New dependency / duplicates a tool we run? | 6. Catches the `@types/*` class? |
|---|---|---|---|---|---|---|
| **dependency-cruiser rule** | **Yes — 11/11, 0 false positives** (measured) | General: reads the nearest `package.json`; zero package names in the config | Yes — 2.6 s, one process, no network | **No** | **None** — already in `devDependencies` and already in the `structure` gate | **No** — never sees an implicit type package |
| **Biome `noUndeclaredDependencies`** | Yes — 11/11, **plus ~1,130 false positives** from tsconfig `paths` (measured) | General | Yes — 2.1 s | No | None — already pinned, already in the `lint` gate | No — same reason |
| **knip** | Very likely, incl. binaries — **not verified here** | General, but needs per-workspace config for entry points | Yes, by design | **Yes** — `dependencies` / `devDependencies` issue types | New dependency; overlaps dependency-cruiser and Biome | No — same reason |
| **depcheck** | No — no workspace support; archived 2025-06-16 | Per-package invocation | n/a | Yes | New dependency, unmaintained | No |
| **eslint-plugin-import** | Likely, but `packageDir` arrays reopen the hole | General by default | Yes | No | New **toolchain** (ESLint in a Biome repo) | No |
| **manypkg / syncpack** | No — never reads source | n/a | Yes | No | New dependency, wrong subject | No |
| **publint** | No — no published packages here | n/a | n/a | No | New dependency, no subject | No |
| **Nx `@nx/dependency-checks`** | Unverified | Needs the Nx project graph | n/a | Partially | Nx **and** ESLint | No |
| **TypeScript settings** | No — no such capability | n/a | n/a | No | n/a | No — `types` narrows what is loaded, it does not check declaration |
| **npm `--install-strategy=nested\|linked`** | Unverified; `linked` is experimental | Structural, not a check | Changes every install | No | Changes the layout for everyone | Unverified |
| **pnpm strict `node_modules`** | Structurally prevents most of it; workspace rows unverified | Structural | Changes every install | No | Package-manager migration | Not by itself — it makes the module missing, `tsc` is what says so |
| **pnpm layout + the existing `typecheck` gate** *(added 2026-09-11)* | **Yes — 11/11 measured, plus both workspace rows, plus the `@types/*` class and the nine binaries of §9** | Structural: no config, no package names anywhere | Yes — it is a gate `verify` already runs | No | Package-manager migration, since done | **Yes — 171 errors in `packages/ui`, which is how the class was found at all** | Not by itself — it makes the module missing, `tsc` is what says so |

Note that **no candidate does both halves**: dependency-cruiser answers question 1 cleanly and question 4
not at all; knip answers both but costs a tool and a triage pass. They are separate decisions, and the
phantom question does not have to wait for the unused-dependency one.

---

## 9. The second half of the problem: undeclared binaries

The eleven of §2 are undeclared **imports**. This repo also has undeclared **binaries** — a workspace's
`scripts` invoking a CLI that only exists because another workspace's `devDependencies` hoisted it:

| Workspace | Script invokes | Provided by | Declared there? |
|---|---|---|---|
| `apps/admin` | `depcruise` | `dependency-cruiser` | No |
| `apps/admin` | `dotenvx` | `@dotenvx/dotenvx` | No |
| `apps/admin` | `wrangler` | `wrangler` | No |
| `apps/store` | `depcruise` | `dependency-cruiser` | No |
| `packages/ui`, `packages/utils`, `packages/http-schemas`, `packages/icons` | `tsc` | `typescript` | No |
| `packages/icons` | `biome` | `@biomejs/biome` | No |

*Measured 2026-09-11 by matching each workspace's `scripts` against its own declared dependencies.*

`npm run --workspace=admin check:structure` works today only because `apps/backend` declares
`dependency-cruiser`. Neither dependency-cruiser nor Biome can see this class — dependency-cruiser caught
`dependency-cruiser` in the admin only by accident, through a JSDoc type import in the config file, and
did not catch it in the store, whose config carries no such annotation. **knip is the only candidate that
covers it** ("Unlisted binaries"). This is a real, separate gap and it should be recorded rather than
quietly folded into the import check.

---

## 10. Per-case verdict: declare it, or fix the import?

The check tells you an import is undeclared; it does not tell you the import was right. Case by case:

| # | Case | Verdict |
|---|---|---|
| 1 | `lucide-react` in `apps/admin` (39) and `apps/store` (38) | **Declare in both — but look at the store first.** `packages/icons` (`@proteus/icons`, generated from `assets/`) already exists and the store already declares it, so the store importing `lucide-react` directly is drift away from a first-party decision that has already been made. The admin does not declare `@proteus/icons` at all. Re-exporting icons through `@proteus/ui` is *not* the fix — it adds an indirection and fights tree-shaking. The question is `@proteus/icons` versus `lucide-react`, and it should be answered once for both apps. |
| 2 | `class-variance-authority` in `apps/store/src/components/payment-row.tsx` | **The import is the smell.** One site, one file, building variants for a component the store owns. `packages/ui` exists precisely to own the variant vocabulary; a single `cva` call in an app is either a component that belongs in `ui`, or a genuine app-local variant — in which case declare it. Decide, then declare or move. |
| 3 | `@tanstack/form-core` in `apps/admin` (5) | **Declare it, and it is not optional.** `packages/ui` declares it as a **peerDependency**, which is the contract *"the consumer supplies this"*. The admin is the consumer and supplies nothing. This is the one row where the current state is a broken peer contract rather than a lucky hoist. |
| 4 | `@faker-js/faker` in `apps/store/tests/e2e/` (3) | **Declare as a `devDependency` of `apps/store`.** Test-only, and `packages/testing` (which the store already declares) declares it too — so the alternative is to re-export the builders from `@proteus/testing`, which is the tidier answer if more specs want them. |
| 5 | `bignumber.js` in `packages/http-schemas/src/common.ts` | **Declare it — deliberately.** The backend's `no-direct-bignumber-import` rule already exempts `packages/http-schemas` in writing ("has no business depending on backend internals at all"), so the import is a decision already taken; the manifest just never caught up. Worth one sentence of thought first: `http-schemas` is consumed by both browsers, so this puts `bignumber.js` in the client bundle. |
| 6 | `dependency-cruiser` in `apps/admin/structure/` | **Declare as a `devDependency` — the JSDoc is the least of it.** The admin *runs* `depcruise` in its own `check:structure` script (§9). Declaring fixes both the type import and the binary. |
| 7 | `backend` (`'backend/test'`) in `apps/admin/tests/e2e/products.spec.ts` | **Declare as a `devDependency` — the import is correct.** It is `deleteProductById` used in a `cleanup.add(…)` for a product the spec created through the UI. `AGENTS.md` says "DB helpers are for setup", and teardown of a row the UI created is exactly that. `apps/store` and `packages/testing` both declare `backend` for the same reason. |
| 8 | `@proteus/frontend-structure` — declared **nowhere** | **Declare as a `devDependency` of `apps/admin` and `apps/store`.** This is the most fragile row in the table: it works only because npm links *every* workspace into the root `node_modules` regardless of who asked. A per-workspace install, or any package manager with a strict layout, breaks `check:structure` in both apps — so the gate that enforces structure is itself held up by a phantom. |
| 9 | `ms` (type-only) in `apps/backend/src/core/auth/utils/` (2) | **The import is wrong.** `import type { StringValue } from 'ms'` reaches into the types of a *transitive* dependency of `jsonwebtoken` to describe `expiresIn`. Declaring `ms` pins a package the backend does not otherwise use; the better fix is to take the type from `jsonwebtoken`'s own `SignOptions['expiresIn']` (already imported one line above) or to name the local alias explicitly. |
| 10 | `@playwright/test` in `apps/backend/scripts/db-diagram/load.mjs` | **Declare as a `devDependency`, or move the script.** It drives `chromium` to render a database diagram. The backend has no other browser dependency; whether that script belongs in the backend at all is the prior question. |
| 11 | `vite` in `packages/ui/vite.config.ts` | **Declare as a `devDependency`.** `packages/ui` currently has *no* `devDependencies` block at all and also runs `tsc` without declaring `typescript` (§9). |

Summary: **eight are "declare it"** (3, 4, 5, 6, 7, 8, 10, 11), **two are "the import is a question first"**
(1, 2), and **one is "the import is wrong"** (9).

---

## 11. Recommendation for this repo

> **Amended 2026-09-11: the rule below was not built, and should not be.** The standard in §11.1 stands
> word for word — it is now enforced by the layout rather than by a cruise. §§11.2–11.5 are kept as the
> design that was arrived at and the evidence that it worked, not as work to do. What changed:
> §7's third point argued a rule beats a strict layout on ergonomics, because a layout turns the mistake
> into a runtime resolution error found by whoever runs the app next. Measured, it does not: under pnpm
> the same mistake fails `typecheck`, in the same `verify` run, with the file, the line and the module
> name — so the rule would be a second, slower way to learn the same thing, and it would need
> `preserveSymlinks: true` and a config of its own to avoid breaking the three cruises that already run.
> The layout also covers the two classes a rule cannot: the undeclared **binaries** of §9, and the
> **`@types/*`** class amended into §8.

### 11.1 The standard

> **A workspace declares every package it imports.**
> If a file under `apps/<app>/` or `packages/<pkg>/` imports a package, that workspace's own
> `package.json` names it. A package that resolves only because npm hoisted it there on another
> workspace's behalf is not a dependency, it is a coincidence.

### 11.2 The rule

One new file, `structure/.dependency-cruiser.cjs` at the **repo root** — the same name the three apps use,
one level up, because the subject is the whole workspace graph and no app owns it:

```js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-undeclared-dependency',
      comment:
        "A workspace declares every package it imports. This one imports a package its own " +
        "package.json does not name — it resolves today only because npm's hoisted install strategy " +
        "put it in the root node_modules on some other workspace's behalf. Nothing about that is " +
        "guaranteed: a version bump in the workspace that does declare it, a per-workspace `npm ci`, a " +
        "Docker build that installs one workspace, or a package-manager change all break it, and none " +
        "of them break it here — they break it on a deploy. The fix is usually to add the package to " +
        "this workspace's package.json. Sometimes it is that the import is reaching somewhere it " +
        "should not: a transitive dependency's types, or a sibling workspace's internals. " +
        "The check derives entirely from the manifests, so there is no list here to maintain.",
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
  ],
  options: {
    // The edge is kept, the walk stops. `exclude` would delete the edge instead and turn this green.
    doNotFollow: { path: 'node_modules' },
    // Load-bearing. Without it a workspace package resolves to its realpath outside node_modules and
    // classifies as `undetermined` whether or not it is declared — which is the same verdict for
    // @proteus/ui (declared) and backend (not), so the rule could not tell them apart. With it, a
    // workspace package goes through the same manifest lookup as a registry one. It is also why this
    // is a second config rather than a rule in each app's: under preserveSymlinks the existing rules
    // that name `packages/http-schemas/...` paths would stop matching, silently.
    preserveSymlinks: true,
    // apps/admin/structure/.dependency-cruiser.cjs reaches dependency-cruiser only through a
    // `/** @type {import('dependency-cruiser')…} */` annotation.
    detectJSDocImports: true,
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.d.ts'],
    },
  },
}
```

No `combinedDependencies` — its default of `false` is what makes the lookup per-workspace, and turning it
on would merge the root manifest in and mask every omission.

### 11.3 The wiring

Root `package.json`:

```json
"check:dependencies": "depcruise apps packages --config structure/.dependency-cruiser.cjs"
```

`scripts/verify.sh`, in `job_structure` — the fourth line, alongside the three per-app cruises:

```bash
job_structure() {
  local code=0
  npm run --workspace=backend check:structure || code=1
  npm run --workspace=admin check:structure || code=1
  npm run --workspace=store check:structure || code=1
  # Every workspace against its own manifest. Separate from the three above because it needs
  # preserveSymlinks, which changes where a workspace package resolves to and would stop their
  # `packages/…` path rules from matching. Covers the six packages/, which no cruise reached before.
  npm run --silent check:dependencies || code=1
  return $code
}
```

and `label_of`:

```bash
structure) echo "Import structure (backend, admin, store, manifests)" ;;
```

Nothing else changes. `structure` is the right gate: this is the *structure* kind of standard — which file
may import which — and `standards/README.md` already routes that kind there.

### 11.4 Order of work

The rule fires 94 times today, so it lands red. Fix first, then gate:

1. Apply §10 rows 3, 4, 5, 6, 7, 8, 10, 11 — eight manifest edits, no source change.
2. Decide rows 1 and 2 (`@proteus/icons` vs `lucide-react`; `cva` in the store), then declare or move.
3. Fix row 9 — take `expiresIn`'s type from `jsonwebtoken`, drop the `ms` import.
4. Add the config, the script and the `job_structure` line.

### 11.5 Proving it bites

Two mutations, both one line, both restore-able:

```bash
# 1. A registry package. Remove "qs" from apps/admin/package.json "dependencies", then:
npm run check:dependencies
#   error no-undeclared-dependency: apps/admin/src/api/fetcher.ts → node_modules/qs/lib/index.js
#   x 1 dependency violations (1 errors, 0 warnings).

# 2. A workspace package — the case preserveSymlinks exists for.
#    Remove "@proteus/ui" from apps/admin/package.json "dependencies", then:
npm run check:dependencies
#   error no-undeclared-dependency: apps/admin/src/components/common/action-menu.tsx
#     → node_modules/@proteus/ui/src/index.ts
#   …and once per admin file that imports it.
```

Restore both and the gate goes green. Mutation 1's exact behaviour was demonstrated on an isolated fixture
(§4.4); mutation 2 is the one that would catch a future regression of `preserveSymlinks`, and it is the
one to run when changing this config. Say in the PR that you ran them.

### 11.6 Recorded as considered and rejected

For `standards/README.md` → [Tools considered, and rejected](../../standards/README.md), in that list's
shape:

- **Biome `lint/correctness/noUndeclaredDependencies`** — already installed and already gated, and it
  finds all eleven. It matches the import specifier against the manifest as a string rather than resolving
  it, so every one of the backend's tsconfig `paths` aliases reads as a scoped package: ~1,130 false
  positives, no ignore list, no alias option. Revisit if the backend moves to `#` subpath imports.
- **eslint-plugin-import `no-extraneous-dependencies`** — correct semantics, but needs ESLint in a Biome
  repo for one rule that dependency-cruiser already expresses, and its monorepo escape hatch
  (`packageDir` as an array) merges manifests and reopens the hole it is meant to close.
- **depcheck** — archived 2025-06-16; no npm-workspaces support by its own README.
- **manypkg, syncpack, publint** — manifest-only; none reads an import statement, so none can see a
  phantom at all.
- **knip** — can do this *and* the inverse *and* undeclared binaries (§9), which nothing else covers.
  Deferred, not rejected: it is a new tool whose first run in a repo this size is a triage pass across
  several issue types at once. It is the right next conversation if undeclared **binaries** or unused
  declarations become a concern. *(2026-09-11: that conversation happened, for the unused half only —
  knip is adopted as `verify`'s `unused` gate, scoped to `dependencies` and `catalog`. The undeclared
  half stays with the pnpm layout and `typecheck`. Measurements in §12.)*

---

## 12. Where the evidence is thin

**~~knip was never run here.~~** *(Closed 2026-09-11.)* It was, for the **unused** direction, and it is
now adopted — knip 6.35.1 as a root devDependency, `knip.jsonc` at the root, and the `unused` gate in
`scripts/verify.sh`. The number this paragraph said would decide adoptability: zero-config across all
four dependency issue types gave **18 findings in 6.6s, 7 of them noise**; scoped to `dependencies` and
`catalog` by a ten-line config, **10 findings in 3.2s with no false positives**, each checked against the
source by hand. The seven it removed are the shapes this document predicted it would need help with —
string-registered providers, the drizzle configs, and `cloudflare:workers`, a workerd built-in whose
specifier reads as a package name. Of the ten real findings, one was `@hono/node-server`, which this
tree carried an advisory for and did not use, and three were a devtools panel whose imports had been
commented out rather than deleted — the case that a grep cannot tell from a live import, and the reason
the check is a tool and not a script. `standards/README.md` carries the verdict and the alternatives
rejected alongside it.

What remains unrun is the **undeclared** direction, which is what the paragraph above was originally
about: knip's `unlisted` and `unlisted binaries` types were measured only incidentally, in the
zero-config pass, and are deliberately out of the gate's scope. The pnpm migration's §6 gives that
direction to the strict install layout plus `typecheck`, so the question this document asked is closed
by a different mechanism than the one it expected. `files` and the export-level types remain genuinely
unmeasured beyond a count — `files` reported 58 — and are a separate conversation.

**The npm and pnpm install-strategy claims are read, not run.** *(Amended 2026-09-11: the pnpm half was
since run — see §7 and §8. The npm `--install-strategy` half remains untested and unused.)* Nothing in §7 was tested, because testing
it means a destructive reinstall of a repo with a working `node_modules`. Specifically unverified: whether
`--install-strategy=nested` or `linked` actually stops a *workspace* from reaching another workspace's
hoisted dependency, and whether pnpm's linker would close the `backend` and `@proteus/frontend-structure`
rows. Both are plausible from the documented layouts and neither is demonstrated.

**One secondary source fabricated a quotation.** A summarised rendering of npm's `npm-install` docs
returned a paragraph recommending `--install-strategy=linked` to catch phantom dependencies. No such text
exists in `@npmcli/config/lib/definitions/definitions.js`. It was caught only because the definition was
then read from the installed npm. Treat every quotation in this document that is *not* attributed to a
file path or a raw `github.com/.../blob/...` URL with that in mind.

**The Nx row is a 404.** Two documentation URLs for `@nx/dependency-checks` returned HTTP 404 on
2026-09-11. The rule is dismissed on adoption cost — Nx's project graph plus ESLint — which is a sound
reason independent of its semantics, but its semantics are genuinely unknown here.

**`publint` was dismissed on its tagline.** Its full rule list was not read. The dismissal rests on a fact
about this repo rather than about the tool: every workspace is `private: true` and nothing is published,
so a publish-time linter has no subject.

**The per-workspace variant is measured but not designed.** §4.2 notes it resolves path aliases properly
and leaves only two genuine unresolvables, which would let `not-to-unresolvable` join the rule. What it
needs is a per-workspace list of entry directories — `packages/testing` and `packages/frontend-structure`
have no `src/` — and that list is hand-maintained, which is the thing this document is arguing against
even though the items are directory names rather than package names. The root-level single invocation was
preferred on that ground alone; if `not-to-unresolvable` turns out to matter, the trade reopens.

**The dev-versus-production rule (§3.5) is measured, not recommended.** It fires 16 times today on files
that are arguably fine — `database.config.ts` under `src/`, the icon build scripts — so adopting it means
first deciding whether a build-time file may live under `src/`. That is a separate standard, and this
document does not settle it.

**Nothing here measures whether the check would have *prevented* any of the eleven.** All eleven were
written by someone whose editor resolved the import and whose `npm run verify` stayed green. That the gate
would have gone red is certain; that the author would then have declared the package rather than found a
way around it is an assumption, and it is the same assumption every gate in `scripts/verify.sh` rests on.

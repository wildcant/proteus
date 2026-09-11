# Dependency hygiene, then pnpm

**Status:** planned.

**Goal:** every workspace declares what it imports, no advisory is open that a version bump closes,
and the package manager makes the first of those structural rather than aspirational. After this,
`node_modules` at the root holds the two root devDependencies and nothing else, and a workspace that
reaches for a package it did not declare fails on the developer's machine rather than on a deploy.

**Scope:** every `package.json` in the tree, the lockfile, `scripts/verify.sh`,
`scripts/verify-full.sh`, `.vscode/tasks.json`, `apps/backend/Dockerfile.worker`,
`apps/backend/docker-compose.yml`, and the prose in `AGENTS.md`, `README.md` and `.claude/skills/`.
Not a code change, with two exceptions called out in P1 and P3.

**Adjacent, deliberately separate:** `docs/research/undeclared-dependencies.md` recommends a
dependency-cruiser `no-undeclared-dependency` rule. **Do not build it.** P3 makes the same class of
mistake impossible rather than detected, and §6 below records why the rule becomes redundant. That
research stays as the record of how the question was answered; its §11 recommendation is superseded.

---

## Why this is worth doing

Two separate reasons that happen to share a work queue.

**The tree has 23 open advisories**, 12 high and 11 moderate, 9 of them on direct dependencies —
including `drizzle-orm` 0.39.3 with a **high-severity SQL injection via improperly escaped SQL
identifiers**. 18 fix inside the declared range. Nobody has run the upgrade.

**Eleven packages are imported by workspaces that do not declare them**, plus nine binaries invoked
by scripts that do not declare them, plus a third class the research doc never found (§3). All of it
resolves today only because npm's hoisted layout puts everything in one root `node_modules`. None of
it is guaranteed by anything.

### What pnpm actually buys, measured

Every number below is from a real install of this tree, not a vendor claim. Method in §1.

| Scenario | npm | pnpm | Winner |
| --- | ---: | ---: | --- |
| Cold — empty cache/store, real downloads | 38.8s | 36.7s | dead heat |
| Warm — `node_modules` deleted, cache/store populated | 16.2s | **10.1s** | pnpm, 1.6× |
| No-op — nothing changed | **1.8s** | 3.5s | npm, 2× |

Install speed is a real but modest win, in one of three cases. **It is not the reason to do this.**
Nothing here changes `verify` (16s) or the backend suite (~96s), both of which are vitest and tsc.

The reason is the strict layout: under pnpm the root `node_modules` contains `.pnpm`, `.bin` and the
two root devDependencies — measured, `ls node_modules` returns 2 package directories. A workspace
can only reach what it declared. That converts an entire class of latent deploy failure into a
local typecheck error, and it is the only mechanism in §8 of the research doc that does so.

---

## 1. How the numbers were produced

Two copies of the tree in a scratch directory, source rsync'd without `node_modules`, `.git`,
`dist` or `.wrangler`. pnpm 10.27.0, npm 11.9.0, node 24.14.0, on darwin 25.5.0.

- Cold pnpm: fresh `--store-dir`. Cold npm: fresh `--cache`.
- Warm: `rm -rf node_modules apps/*/node_modules packages/*/node_modules`, reinstall.
- Disk is **not** reported here. pnpm on APFS uses `clonefile`, so `du` reports logical size and
  overstates real blocks; the comparison could not be made honestly with the tools to hand. The
  nominal figures are npm 1.2G vs pnpm 1.3G plus a global store, and the store's payoff is across
  repos rather than within one. Treat disk as "no worse", not as a win.

Everything in §2–§5 was run, not inferred. Where something was not run, §7 says so.

---

## 2. The audit findings

### F1 — 23 advisories, 18 of which fix in range

`npm audit` on 2026-09-11: 12 high, 11 moderate, 0 critical, 0 low. Nine sit on direct
dependencies: `@cloudflare/vite-plugin`, `@hono/node-server`, `drizzle-kit`, `drizzle-orm`,
`express`, `hono`, `orval`, `qs`, `wrangler`.

The high-severity ones worth naming: `drizzle-orm` SQL injection via improperly escaped identifiers;
`undici` cross-user information disclosure; `sharp` via libheif; `js-yaml` quadratic CPU; `nanoid`
infinite loop on zero size; `brace-expansion` and `browserslist` OOM.

**18 fix within the declared range** — an ordinary bump. **5 claim to need a major**, and all five
are the Drizzle chain.

### F2 — `npm audit fix --force` would downgrade drizzle-kit by thirteen minor versions

The installed `drizzle-kit` is **0.31.10**. npm's proposed fix is **`drizzle-kit@0.18.1`**, because
the advisory is on `@esbuild-kit/esm-loader`, a dependency 0.31 no longer has a clean path away from
in npm's solver's view. Running `--force` would roll the migration tooling back past every schema
this repo has generated.

**Never run `npm audit fix --force` on this tree.** P1 takes the in-range fixes explicitly.

### F3 — twelve dependency entries are pinned to the literal string `"latest"`

| Workspace | Field | Package |
| --- | --- | --- |
| `apps/admin` | dependencies | `@tanstack/react-devtools`, `@tanstack/react-router` |
| `apps/admin` | devDependencies | `@tanstack/devtools-vite`, `@tanstack/router-plugin` |
| `apps/store` | dependencies | `@tanstack/react-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-start` |
| `apps/store` | devDependencies | `@tanstack/devtools-vite` |
| `packages/testing` | devDependencies | `@tanstack/react-router` |
| `packages/ui` | **peerDependencies** | `@tanstack/history`, `@tanstack/react-router` |

`"latest"` means "whatever the registry had when the lockfile was last written". It is why
`@tanstack/react-router` appears four times with no agreed range.

**The two in `peerDependencies` are a hard blocker**: pnpm refuses to install at all.

```
ERR_PNPM_INVALID_PEER_DEPENDENCY_SPECIFICATION  The peerDependencies field named
'@tanstack/history' of package '@proteus/ui' has an invalid value: 'latest'
```

### F4 — `apps/admin/package-lock.json` is committed

A second, stale lockfile — 131KB, last written 2025-07-31 — tracked in git alongside the root one.
npm ignores it for workspace installs. It has no reason to exist under either package manager.

---

## 3. What the strict layout finds — measured

Applying the pnpm layout and running `tsc --noEmit` per app. These are the undeclared imports of
`docs/research/undeclared-dependencies.md` §2, confirmed by a compiler rather than a cruise:

| App | Errors | Undeclared modules |
| --- | ---: | --- |
| backend | 3 | `ms` ×2, `bignumber.js` |
| store | 245 | `lucide-react` ×38, `@faker-js/faker` ×3, `class-variance-authority`, `bignumber.js` |
| admin | 288 | `lucide-react` ×39, `@tanstack/form-core` ×5, `backend/test`, `bignumber.js` |

Both **workspace-package** rows close as well — `backend` and `@proteus/frontend-structure` — because
pnpm links only *declared* workspace dependencies into a workspace's own `node_modules`. The research
doc's §7 listed that as "a claim about pnpm's linker that was not verified here". It holds.

### F5 — a third class of phantom, which nothing in the research doc can catch

Of the store's 245 and the admin's 288, **171 are not the eleven**. They are `TS7026`, `TS2875` and
`TS7016` — *"JSX element implicitly has type 'any'"*, *"requires the module path 'react/jsx-runtime'"* —
and all of them originate in `packages/ui/src/`:

```
171  ../../packages/ui/src/components/ui
 12  ../../packages/ui/src/route-modals
  4  ../../packages/ui/src/hooks
```

`packages/ui` writes JSX in every component and declares **no `@types/react`** and no
`@types/react-dom`. It works today only because the apps hoisted them to the root.

**No tool in the research doc's §8 comparison can find this.** dependency-cruiser, Biome and knip all
work from import specifiers, and a `@types/*` package is never named in one — TypeScript picks it up
implicitly from `node_modules/@types`. A strict layout is the only mechanism that surfaces it. This
belongs in that document's §12 as a class its survey missed.

### F6 — nine binaries invoked by workspaces that do not declare them

Measured by matching each workspace's `scripts` against its own declared dependencies:

| Workspace | Binary | Provided by |
| --- | --- | --- |
| `apps/admin` | `depcruise`, `dotenvx`, `wrangler` | `dependency-cruiser`, `@dotenvx/dotenvx`, `wrangler` |
| `apps/store` | `depcruise` | `dependency-cruiser` |
| `packages/ui`, `packages/utils`, `packages/http-schemas`, `packages/icons` | `tsc` | `typescript` |
| `packages/icons` | `biome` | `@biomejs/biome` |

`npm run --workspace=admin check:structure` works today only because `apps/backend` declares
`dependency-cruiser`. Under pnpm, `node_modules/.bin` is per-workspace: these become
`command not found`.

### F7 — workspace dependencies use `"*"`, which pnpm 10 sends to the registry

Thirteen entries across the tree name a sibling workspace with the range `"*"` — `"@proteus/ui": "*"`,
`"backend": "*"`. pnpm 10 defaults `link-workspace-packages` to **false**, so `"*"` is a registry
range, not a workspace reference.

`backend` **is a real package on the public npm registry.** Left as-is, `pnpm install` would fetch a
stranger's code in place of `apps/backend`. In practice `pnpm import` fails first —

```
@proteus/testing is not in the npm registry, or you have no permission to fetch it.
```

— but the failure mode if a name happens to resolve is silent and bad. Every workspace dependency
becomes `workspace:*`.

### F8 — eight packages run install scripts, which pnpm blocks by default

`@ast-grep/cli`, `@swc/core`, `esbuild`, `msgpackr-extract`, `msw`, `protobufjs`, `workerd`, and
`@scarf/scarf` (telemetry — deliberately left unapproved). pnpm 10 requires each to be listed in
`onlyBuiltDependencies` at the **workspace root**.

`apps/admin/package.json` and `apps/store/package.json` already carry a `pnpm.onlyBuiltDependencies`
block listing `esbuild` and `lightningcss`. Both are dead — pnpm reads that field only at the root,
and says so on every install. Delete them.

### F9 — 122 packages land at more than one version, and the one that breaks the build is not the shape it looks like

Under npm's hoisted layout a single copy wins. Under pnpm, **122** package names install at two or
more versions. Fully investigated in `docs/research/monorepo-version-alignment.md`; the finding that
matters is that they are three different problems, not one:

| Class | Count | What it is | Fixed by |
| --- | ---: | --- | --- |
| **A** | 5 | Workspaces declare it and **disagree** on the range | A catalog |
| **B** | 4 | Workspaces declare it, **agree**, and it splits anyway | An override |
| **C** | 113 | Declared by **nobody** — purely transitive | Nothing, and nothing needs to |

The 113 in my first count were class C — the class no mechanism addresses and none needs to.

**The break is class B, and its anatomy is the inverse of what it looks like.** `@tanstack/form-core`
does not split because our declarations disagree. Both `apps/admin` and `packages/ui` say `^1.33.2`,
which resolves to **1.33.5**. `@tanstack/react-form@1.33.2` depends on `"@tanstack/form-core":
"1.33.2"` — an **exact pin**. A third party's exact pin sitting against our caret is what produces
two copies, and TypeScript then treats them as unrelated types:

```
Type '...form-core@1.33.2/.../ValidationLogic").ValidationLogicFn' is not assignable to
type '...form-core@1.33.5/.../ValidationLogic").ValidationLogicFn'
```

21 errors in `apps/admin`. For a type-only library this is a compile error; for anything holding
module state — React, a router, a context — the same shape is a *runtime* failure.

**A catalog does not fix it.** This was run, not reasoned: a catalog entry for `@tanstack/form-core`
with both declarations converted to `catalog:` left two copies and 21 errors. A catalog is a macro
over the *specifier*; it makes workspaces ask the same question and cannot reach TanStack's manifest.
There was no disagreement for it to remove.

**`overrides` fixes it**, because an override rewrites the spec in every manifest in the graph
including packages we do not own. Measured: 21 errors → 0.

Two further findings from that research, both of which change the work:

- **A *range* override silently fails against an existing lockfile.** `^1.33.2` leaves two copies —
  the locked 1.33.2 still satisfies it — and `pnpm update -r` does not dislodge it. Only an exact
  version works, and the lockfile must be deleted and rebuilt after adding one. Reproduced twice.
- **This is TanStack house style, so there is a second live instance.** `@tanstack/react-router` pins
  `@tanstack/history` exactly too, which is one `TS2353` in `packages/ui` that only becomes visible
  once `form-core` is fixed.

Neither syncpack nor manypkg can see any of this: both read manifests, and the failure is in the
lockfile. Both reported **0 rows** for the three packages actually split.

P2 (ticket 05) is written against this.

---

## 4. Lockfile fidelity — the migration does not have to be an upgrade

This was the largest apparent risk and it turned out to be an artefact of doing the steps in the
wrong order. Measured both ways:

| Order | Packages resolving to a different version than the npm lockfile |
| --- | ---: |
| Fresh `pnpm install`, no import | **180** |
| Pin peers → `workspace:*` → `pnpm import` → *then* add declarations | **8** |

The 8 are all `@tanstack/react-start*` patch bumps. 986 shared packages were compared.

**`pnpm import` preserves the npm lockfile's exact resolutions**, but only if it runs on manifests
whose *specs* have not changed. Both blockers in F3 and F7 must be fixed first — they are edits pnpm
requires to parse the manifests at all, and neither changes a resolution — and every new declaration
must be added *after* the import. Get this order wrong and the migration silently bundles a
180-package upgrade. P3 fixes the order into the ticket.

---

## 5. The call sites

| Kind | Count | Where |
| --- | ---: | --- |
| Executable | ~100 | `scripts/verify.sh` (32), `scripts/verify-full.sh` (11), `.vscode/tasks.json` (10), `apps/backend/docker-compose.yml` (6), `apps/backend/package.json` (5), `apps/backend/Dockerfile.worker` (4), `apps/backend/scripts/reset-stack.sh` (4), root `package.json` (4), `apps/store/package.json` (3), `apps/backend/scripts/prepare-test-database.ts` (2), `apps/admin/package.json` (1), `scripts/sync-secrets.sh` (1) |
| Prose | ~143 | `AGENTS.md`, `README.md`, `docs/`, `.claude/skills/` |

Translations: `npm run --workspace=X` → `pnpm --filter X run`, `npm exec --` → `pnpm exec`,
`npm ci` → `pnpm install --frozen-lockfile`, `npx` → `pnpm dlx` (or `pnpm exec` where the tool is
declared).

**The 6 mentions in `docs/adr/` are left alone.** An ADR records what was decided when it was
decided; rewriting its commands falsifies the record.

**There is no CI to migrate** — the repo has no `.github/`. That is normally the expensive half.

---

## 6. What this does to the phantom-dependency research

`docs/research/undeclared-dependencies.md` §11 recommends a root dependency-cruiser config with a
`no-undeclared-dependency` rule, wired into the `structure` gate. After P3, **do not build it.**

Its §7 argued a rule beats a strict layout on ergonomics: *"A strict layout makes the failure a
runtime resolution error, discovered by whoever runs the app next. A rule makes it a named gate
failure with a file, a line and a fix."* Measured, that is not what happens here. Under pnpm an
undeclared import fails `typecheck` — a gate that already exists, in the same `verify` run, with the
file, the line and the module name (§3). The rule would be a second, slower way to learn the same
thing, and it would need `preserveSymlinks: true` and its own config to avoid breaking the three
existing cruises.

pnpm also covers the two classes the rule cannot: the undeclared **binaries** of F6, which the
research doc's §9 records as a real gap that only knip addresses, and the **`@types/*`** class of F5,
which nothing in its §8 can see.

Amend that document rather than deleting it: it is the record of how the question was answered, and
§5's verdict on Biome's `noUndeclaredDependencies` is still worth having written down.

---

## Phases

### P0 — the second lockfile

Delete `apps/admin/package-lock.json` (F4). Independent of everything else, one line of diff.

### P1 — the security bumps

The 18 in-range advisories, explicitly, never via `npm audit fix --force` (F2). Ends with `verify`
and `verify:full` green on npm, **before** the package manager changes, so that a regression here is
attributable to the bump and not to pnpm.

### P1b — Drizzle, on its own track

`drizzle-orm` 0.39.3 → 0.45.x closes a high-severity SQL injection and is a major bump touching every
repository, model and migration in the backend. Its own ticket. **Blocks nothing** — it is a code
migration, and P3 is a manifest migration; they do not interact. Land it whenever it is ready.

### P2 — version alignment

Settled by `docs/research/monorepo-version-alignment.md`. Three mechanisms, each doing the job it is
actually capable of, plus a gate: a **catalog** for the ~37 packages more than one workspace declares
(which also resolves all twelve `"latest"` specifiers of F3, since `catalog:` is a legal
`peerDependencies` value); **`overrides`** for the two third-party exact pins of F9; and
`scripts/checks/one-version.mjs` — 40 lines, no dependency, no network, **36 ms** — asserting that
*a package a workspace declares is installed at one version*.

That check becomes a new `versions` job in `scripts/verify.sh`. `AGENTS.md` names that file as "the
single definition of what 'checked' means here", and this is a new project-wide check.

Deliberately not used, each with a recorded reason in that research's §11.2: `resolutionMode`,
`dedupePeerDependents`, `peerDependencyRules`, `resolutions`, and `strictPeerDependencies` (deferred,
not rejected). `pnpm dedupe --check` is a second, weaker claim that needs the network — CI, not
`verify`.

### P3 — the migration

In this order, because §4 shows the order is load-bearing:

1. `pnpm-workspace.yaml` with the `packages:` list and `onlyBuiltDependencies` (F8); delete the two
   dead `pnpm` blocks.
2. Pin the two `peerDependencies` off `"latest"` (F3) — the install blocker.
3. Rewrite all thirteen workspace deps to `workspace:*` (F7) — the import blocker.
4. `pnpm import`, then verify fidelity against the npm lockfile before going further.
5. *Now* add the missing declarations: the eleven imports of §3, the nine binaries of F6, and
   `@types/react` + `@types/react-dom` in `packages/ui` (F5).
6. Delete `package-lock.json`, add `pnpm-lock.yaml`.
7. Rewrite the ~100 executable call sites (§5).
8. `Dockerfile.worker`: `npm ci` → `pnpm install --frozen-lockfile`, and it must copy
   `pnpm-workspace.yaml` and `pnpm-lock.yaml` rather than `package-lock.json`.

Two of the eleven are not "declare it" and need a decision, per the research doc's §10: the store's
lone `class-variance-authority` import, and `lucide-react` versus the existing `@proteus/icons`
across both apps. One is an outright bug: `ms` is a type-only reach into a transitive dependency of
`jsonwebtoken`, and the fix is `SignOptions['expiresIn']` from `jsonwebtoken` itself.

### P4 — the prose

`AGENTS.md`, `README.md`, `docs/` outside `adr/`, `.claude/skills/`. `docs/adr/` untouched.

### P5 — alerts, CI, and an audit command

Settled by `docs/research/dependabot.md`. **This repository is public and Dependabot alerts are
disabled** — verified twice — so none of the 23 advisories has ever produced one. Enabling them is
one API call, opens no pull requests, and should happen *today*, ahead of everything else here.

**A Dependabot check cannot be a `verify` gate.** The `dependabot` CLI is a harness for running
update jobs, not a scanner: it needs a 2.1 GB amd64 Docker image, it returns `nil` whether it
proposed forty updates or none — no mutation makes it red — and the one run performed was abandoned
at **15 minutes**, having processed about 2 of 106 dependencies. Against a ten-gate, 16-second
`verify`, it is not a candidate.

What belongs instead is `npm run audit` — `osv-scanner scan source --lockfile pnpm-lock.yaml`, 2.3 s
online, exit 1 on a finding, exit 128 on a path that matches nothing — as a **command, not a gate**.
The research writes the gate function and then argues against adopting it, and the argument holds: it
would be the only check in `verify.sh` that is not a pure function of the working tree, so the same
commit goes green today and red the morning an advisory lands. That breaks `git bisect`.

The repo has **no CI at all**, so a Dependabot pull request would arrive with nothing verifying it.
A `.github/workflows/verify.yml` comes before enabling anything that opens PRs.

One finding feeds back into P2: Dependabot has **no handling for `overrides:` in
`pnpm-workspace.yaml`**, so the two pins P2 adds are invisible to it and will go stale silently. That
makes P2's `versions` gate the only thing that would notice — it ships with the overrides, not after.

---

## The tickets

Numbered in execution order.

| | Phase | Blocked by |
| --- | --- | --- |
| `01-drop-the-second-lockfile` | P0 | — |
| `02-in-range-security-bumps` | P1 | — |
| `03-drizzle-major` | P1b | — (and blocks nothing) |
| `04-express-5` | P1c | — (and blocks nothing; **before 05 and 06**) |
| `05-one-version-of-each-dependency` | P2 | interleaved with 06; **easier after 04** |
| `06-the-migration` | P3 | 01, 02; interleaved with 05 |
| `07-the-prose` | P4 | 06 |
| `08-alerts-ci-and-the-audit-command` | P5 | step 1 blocked by nothing — do it today |

03 and 04 are independent of each other and of everything downstream, so they can run as two
branches at once. 05 and 06 are one branch with two claims.

Three research documents back this: `docs/research/express-5-migration.md` (P1c),
`docs/research/monorepo-version-alignment.md` (P2) and `docs/research/dependabot.md` (P5). All three
were produced by running the thing rather than reading about it, and each overturned an assumption
this spec had made before it landed.

### P1c — Express 5

Ticket 02's remainder. `express` and `qs` are the two advisories no in-range bump can close:
`express@4.22.2` declares `"qs": "~6.15.1"`, which caps below the fixed `qs@6.16.0`. Express 4 is not
EOL — the advisories simply published after its last release.

Measured, not assumed: all **99 route matchers are literal segments and `:name` parameters only**, so
the `path-to-regexp` 8 rewrite that breaks most Express 4 apps is a non-event here — 99/99 resolve
identically on both majors. `src/framework/runtime/express/app.ts` needs **no functional change**. The
whole diff is one manifest line, one `start.ts` edit, and `npm update qs` — which is required, because
the bump alone leaves `qs@6.15.3` at the root satisfying express 5's `^6.14.0`.

The one real change is `app.listen`: Express 5 delivers a bind failure to the callback instead of
throwing, and `start.ts` ignores its callback's arguments — so `EADDRINUSE` would resolve `start()`
with a server that never bound. Neither `typecheck` (the parameter is optional) nor `test:gate`
(`create-api.ts` never calls `app.listen`) can see it.

**It belongs before P2.** P2's `accepted` map lists `express` as a permanent cross-major exception;
after this, the tree resolves to one `node_modules/express` and one `qs`, and the entry is deleted
rather than enshrined.

---

## Acceptance criteria

- [ ] `pnpm install --frozen-lockfile` from a clean checkout succeeds with no `ERR_PNPM_*`
- [ ] `ls node_modules` at the root lists exactly `.bin`, `.pnpm`, `.modules.yaml`,
      `.pnpm-workspace-state-v1.json`, `@ast-grep` and `@biomejs` — nothing else
- [ ] `npm audit` reports 0 advisories that a bump inside the declared range would close
- [ ] `pnpm verify` green, and `pnpm verify:full` green with the test database up
- [ ] `apps/backend/tests` pass against a real Postgres, and the Temporal suites pass against a
      running server — the surfaces §7 could not reach
- [ ] Both Playwright e2e suites pass
- [ ] `docker compose -f apps/backend/docker-compose.yml up --build worker` produces a Worker that
      claims a task from the `proteus` queue
- [ ] No file outside `docs/adr/` still invokes `npm run --workspace`
- [ ] No `package-lock.json` anywhere in the tree
- [ ] **The gate bites**: remove one declared dependency from one workspace's `package.json`, confirm
      `verify` goes red, restore it, and say in the PR that you ran it

---

## 7. What has not been verified

Everything below was outside what a scratch copy could reach, and each is a real risk rather than a
formality.

**The backend test suite has not been run under pnpm.** It needs Postgres. 1,007 modules cruise
clean and every runtime module imports (`@temporalio/worker`, `drizzle-orm`, `awilix`, `hono`,
`stripe`, `bullmq`, `ioredis`, `jsonwebtoken`, `qs`, `winston`, `@proteus/http-schemas/common`,
`@proteus/utils` — all ok), but "resolves" is not "passes".

**The Temporal Worker has not been run.** `@temporalio/core-bridge@1.23.0` is present with its
`aarch64-apple-darwin/index.node` prebuild, so the native addon installed correctly. Nothing
connected to a server.

**Neither Playwright suite has been run**, and `packages/testing` is the workspace with the most
undeclared-binary exposure.

**`Dockerfile.worker` has not been built.** It copies nine manifests plus `package-lock.json` by
name; the pnpm version must copy `pnpm-workspace.yaml` and `pnpm-lock.yaml` instead, and that edit is
untested.

**The Cloudflare deploys have not been exercised.** `apps/admin` deploys to Cloudflare Pages and
`apps/store` and `apps/backend` via `wrangler deploy`. If a build command is configured in the
Cloudflare dashboard rather than in the repo, it says `npm` today and nothing in this tree will tell
you it broke. **Check the dashboard before merging**; it is the one call site grep cannot find.

**Disk was not measured honestly** — see §1.

**What *was* run**: `pnpm install` from cold and warm; `tsc --noEmit` on all three apps before and
after the fixes (0 errors in store and admin after); `vite build` for admin and for the store's
TanStack Start/workerd target, both successful; all three `check:structure` cruises, passing with
module counts identical to npm (admin 676/1920, store 468/1344, backend 1007/4322); `biome` and
`ast-grep` from the root via `pnpm exec`.

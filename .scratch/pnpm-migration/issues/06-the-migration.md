# 06 — npm → pnpm

**What to build:** the repo installs with pnpm, every workspace declares what it imports and what its
scripts invoke, and the root `node_modules` stops being a shared cupboard.

**Blocked by:** 01 (the second lockfile must be gone before this deletes the first) and 02 (so a
regression here is attributable to the layout, not to a version bump).

**Interleaved with 05, not sequential to it.** 05's catalog replaces step 2 below, its overrides must
be in place before step 4, and its catalog has to be recomputed after step 5. Neither ticket can be
finished without the other; they are separate because they are separate claims. Expect one branch.

Not blocked by 03. Drizzle is a code migration; this is a manifest migration.

**Status:** planned.

**Spec:** `.scratch/pnpm-migration/spec.md`, P3 — F3, F5, F6, F7, F8, and §4.

---

## Why the order is the whole ticket

`pnpm import` reproduces the npm lockfile's exact resolutions, but only if it runs against manifests
whose *specs* have not changed. Measured on this tree:

| Order | Packages resolving differently than the npm lockfile |
| --- | ---: |
| Fresh `pnpm install`, no import | **180** |
| Blockers fixed → `pnpm import` → *then* new declarations | **8** |

986 shared packages compared; the 8 are `@tanstack/react-start*` patch bumps.

So the migration either is, or is not, a silent 180-package upgrade, depending entirely on the order
of four steps. **Do not reorder them.** Steps 2 and 3 are edits pnpm requires in order to parse the
manifests at all, and neither changes a resolution — that is why they are allowed before the import.

---

## The work, in order

### 1. `pnpm-workspace.yaml`

```yaml
packages:
  - apps/backend
  - apps/store
  - apps/admin
  - packages/*

onlyBuiltDependencies:
  - '@ast-grep/cli'
  - '@swc/core'
  - esbuild
  - msgpackr-extract
  - msw
  - protobufjs
  - workerd
```

Those seven are every package in the tree with a `preinstall`/`install`/`postinstall` script, which
pnpm 10 blocks by default. `@scarf/scarf` also has one and is **deliberately absent** — it is
telemetry, and leaving it unapproved is the point.

Delete the `"workspaces"` array from the root `package.json`, and delete the dead
`pnpm.onlyBuiltDependencies` blocks from `apps/admin/package.json` and `apps/store/package.json`
(pnpm reads that field only at the workspace root and warns about them on every install).

Whatever ticket 05 concluded goes in this file too.

### 2. Unblock the install: the twelve `latest` entries — **ticket 05 owns this**

`packages/ui`'s `peerDependencies` name `@tanstack/history` and `@tanstack/react-router` as
`"latest"`. pnpm refuses to install at all:

```
ERR_PNPM_INVALID_PEER_DEPENDENCY_SPECIFICATION  The peerDependencies field named
'@tanstack/history' of package '@proteus/ui' has an invalid value: 'latest'
```

Do **not** hand-pin these two. `catalog:` is a legal `peerDependencies` value — pnpm's own error
message names it as the fix — so ticket 05's catalog resolves these two and the other ten in one
mechanism. Hand-pinning would leave ten `"latest"` entries alive and a catalog that has to be
reconciled with them afterwards.

**Ticket 05 also adds `overrides:` to `pnpm-workspace.yaml` before step 4 below.** That ordering is
load-bearing and is measured in 04 — an override added after the import does not dislodge an
already-locked resolution, even at an exact version.

### 3. Unblock the import: `workspace:*`

Thirteen entries name a sibling workspace with the range `"*"`:

| File | Field | Packages |
| --- | --- | --- |
| `apps/backend` | dependencies | `@proteus/http-schemas`, `@proteus/utils` |
| `apps/store` | dependencies | `@proteus/http-schemas`, `@proteus/icons`, `@proteus/ui`, `@proteus/utils`, `backend` |
| `apps/store` | devDependencies | `@proteus/testing` |
| `apps/admin` | dependencies | `@proteus/http-schemas`, `@proteus/ui`, `@proteus/utils` |
| `apps/admin` | devDependencies | `@proteus/testing` |
| `packages/testing` | devDependencies | `backend` |

pnpm 10 defaults `link-workspace-packages` to **false**, so `"*"` is a registry range. `pnpm import`
fails on it —

```
@proteus/testing is not in the npm registry, or you have no permission to fetch it.
```

— which is the lucky case. **`backend` is a real package on the public npm registry**, so a name that
happens to resolve would install a stranger's code in place of `apps/backend`. Every one becomes
`workspace:*`.

### 4. `pnpm import`, then check fidelity before going further

```bash
pnpm import          # reads package-lock.json, writes pnpm-lock.yaml
```

Then verify against the npm tree — spot-check at minimum `bullmq`, `@base-ui/react`, `react`,
`ioredis`, `vite`, `typescript`, `@tanstack/react-router`, `lucide-react`, `drizzle-orm`, `stripe`.
All ten matched exactly in the trial. **If more than a handful drift, stop** — a step ran out of
order and the migration is about to become an upgrade.

The catalog and overrides from ticket 05 must already be in `pnpm-workspace.yaml` at this point, so
`pnpm import` writes the overrides into the lockfile's `overrides:` header. Then:

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

**Delete `node_modules`, never `pnpm-lock.yaml`.** Deleting the lockfile discards the import and puts
the drift back to 180. Deleting `node_modules` is what makes the overrides take effect — measured in
ticket 05, and the one step where doing the intuitive thing costs the whole ticket.

### 5. Now add the missing declarations

Only after the import, so each is resolved against a lockfile that already holds the right version.

**The eleven undeclared imports** — verdicts from `docs/research/undeclared-dependencies.md` §10:

| Package | Goes where |
| --- | --- |
| `@tanstack/form-core` | `apps/admin` dependencies — `packages/ui` declares it as a *peer*, so this is a broken peer contract, not a lucky hoist |
| `@faker-js/faker` | `apps/store` devDependencies |
| `bignumber.js` | `packages/http-schemas` dependencies — note this puts it in the client bundle |
| `dependency-cruiser` | `apps/admin` devDependencies |
| `backend` | `apps/admin` devDependencies, as `workspace:*` |
| `@proteus/frontend-structure` | `apps/admin` **and** `apps/store` devDependencies, as `workspace:*` — declared **nowhere** today, so the gate that enforces structure is itself held up by a phantom |
| `@playwright/test` | `apps/backend` devDependencies, or move `scripts/db-diagram/load.mjs` |
| `vite` | `packages/ui` devDependencies |

**Three need a decision, not a declaration:**

- **`lucide-react`** — 39 sites in admin, 38 in store. `packages/icons` (`@proteus/icons`) already
  exists and the store already declares it; the admin declares it nowhere. The question is
  `@proteus/icons` versus `lucide-react`, answered once for both apps. Re-exporting icons through
  `@proteus/ui` is not the answer — it fights tree-shaking.
- **`class-variance-authority`** — one site, `apps/store/src/components/payment-row.tsx`.
  `packages/ui` owns the variant vocabulary. Either the component belongs in `ui`, or it is a genuine
  app-local variant and the package gets declared.
- **`ms`** — **the import is wrong.** `import type { StringValue } from 'ms'` in
  `src/core/auth/utils/{token,generate-jwt-token}.ts` reaches into the types of a *transitive*
  dependency of `jsonwebtoken` to describe `expiresIn`. Take the type from `jsonwebtoken`'s own
  `SignOptions['expiresIn']`, already imported one line above. Do not declare `ms`.

**The nine undeclared binaries** (spec F6) — a workspace's `scripts` invoking a CLI it does not
declare. Under npm these work because `node_modules/.bin` is shared; under pnpm it is per-workspace
and they become `command not found`:

| Workspace | Add to devDependencies |
| --- | --- |
| `apps/admin` | `dependency-cruiser`, `@dotenvx/dotenvx`, `wrangler` |
| `apps/store` | `dependency-cruiser` |
| `packages/ui`, `packages/utils`, `packages/http-schemas`, `packages/icons` | `typescript` |
| `packages/icons` | `@biomejs/biome` |

**The `@types/*` phantoms** (spec F5) — `packages/ui` writes JSX in every component and declares no
`@types/react` or `@types/react-dom`, which is 171 of the trial's type errors. Add both. Check
`packages/icons` too — it declares `@types/node` but renders React.

**Then hand back to ticket 05 to recompute the catalog.** Seven of the packages declared in this step
— `lucide-react`, `dependency-cruiser`, `bignumber.js`, `typescript`, `@types/react`, `@biomejs/biome`,
`@dotenvx/dotenvx` — become *shared* the moment a second workspace declares them, which is exactly
the class a catalog exists for. A catalog computed before this step is already stale.

### 6. Swap the lockfiles

`git rm package-lock.json`, commit `pnpm-lock.yaml`. Add `package-lock.json` to `.gitignore` so a
stray `npm install` cannot quietly reintroduce one.

### 7. The call sites

~100 executable, listed in spec §5. Translations:

| npm | pnpm |
| --- | --- |
| `npm run --workspace=X <script>` | `pnpm --filter X run <script>` |
| `npm run --workspace=@proteus/utils test` | `pnpm --filter @proteus/utils test` |
| `npm exec -- <tool>` | `pnpm exec <tool>` |
| `npm ci` | `pnpm install --frozen-lockfile` |
| `npx <tool>` | `pnpm dlx <tool>`, or `pnpm exec` where the tool is declared |

Heaviest: `scripts/verify.sh` (32), `scripts/verify-full.sh` (11), `.vscode/tasks.json` (10),
`apps/backend/docker-compose.yml` (6), `apps/backend/package.json` (5).

`scripts/verify.sh` carries a comment explaining why each gate invokes its tool directly rather than
through an `npm run` alias, and a second on `npm exec --` pinning the workspace version rather than
`npx`. Both still hold under `pnpm exec`; update the wording, keep the reasoning.

### 8. `Dockerfile.worker`

It copies nine manifests plus `package-lock.json` by name so the install layer survives source
changes. Under pnpm it must copy `pnpm-workspace.yaml` and `pnpm-lock.yaml` instead, install pnpm
(corepack, or a pinned `npm i -g pnpm@10`), and run `pnpm install --frozen-lockfile`. `CMD` becomes
`pnpm --filter backend run worker`.

The comment in that file explains the image carries its own `node_modules` because
`@temporalio/core-bridge` is a native addon built for the host's platform. That reasoning is
unchanged and the comment stays.

### 9. The one call site grep cannot find

`apps/admin` deploys to **Cloudflare Pages**. If its build command is configured in the Cloudflare
dashboard rather than in this repo, it says `npm` today and nothing in the tree will report that it
broke. **Check the dashboard before merging.** Same for any build command on the `proteus` and
`proteus-backend` Workers.

---

## Acceptance criteria

- [ ] `pnpm install --frozen-lockfile` from a clean checkout succeeds with no `ERR_PNPM_*` and no
      `Ignored build scripts` warning other than `@scarf/scarf`
- [ ] `ls node_modules` at the root lists exactly `.bin`, `.pnpm`, `.modules.yaml`,
      `.pnpm-workspace-state-v1.json`, `@ast-grep`, `@biomejs` — this is the assertion that the
      strict layout is real
- [ ] Fewer than 10 packages resolve differently than the npm lockfile did, and the PR states the
      number and how it was measured
- [ ] `pnpm typecheck` clean across all three apps — 0 errors, not "the same errors as before"
- [ ] `pnpm verify` green; `pnpm verify:full` green with the test database up
- [ ] `pnpm --filter backend test` — the full suite, against a real Postgres
- [ ] `pnpm --filter backend test:temporal` against a running Temporal server
- [ ] Both Playwright e2e suites green
- [ ] `pnpm --filter admin build` and `pnpm --filter store build` both succeed
- [ ] `docker compose -f apps/backend/docker-compose.yml up --build worker` produces a Worker that
      claims a task from the `proteus` queue
- [ ] Every script in every `package.json` has been *run*, not just read — the undeclared-binary
      class (F6) fails at invocation, and only running it proves the declaration landed
- [ ] `git ls-files | grep -c package-lock.json` returns 0
- [ ] No file outside `docs/adr/` invokes `npm run --workspace`
- [ ] **The gate bites.** `AGENTS.md`: *"a gate that cannot fail is not a gate… name the mutation it
      would catch and run that mutation."* Two mutations, both one line, both restored afterwards:
      remove `@proteus/ui` from `apps/admin/package.json` and confirm typecheck goes red; remove
      `dependency-cruiser` from `apps/admin` and confirm `check:structure` reports command not found.
      Say in the PR that both were run

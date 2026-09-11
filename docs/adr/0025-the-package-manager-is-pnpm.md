# 25. The Package Manager Is pnpm, Because a Workspace Must Not Import What It Did Not Declare

**Status:** Accepted

## Context

Twenty packages were reachable from code that never declared them. Eleven were **imports** —
`lucide-react` in 77 files across both frontends, `@tanstack/form-core` in the admin, `bignumber.js`
in `http-schemas`, `@faker-js/faker` in the store, and two whole workspaces: `apps/admin` imported
`backend`, and both frontends ran the `@proteus/frontend-structure` rules, declared nowhere. The
other nine were **binaries**, a workspace's `scripts` invoking a CLI that only existed because
another workspace's `devDependencies` had hoisted it.

All of it resolved, every time, on every machine. Under npm's hoisted layout the root `node_modules`
is a shared cupboard: whoever installs a package puts it where everyone can reach it. Nothing in the
repo guaranteed any of those twenty would be there tomorrow — removing an unrelated dependency from
an unrelated workspace was enough to take one away, and the first report would have been a build or
a deploy, not a gate.

`docs/research/undeclared-dependencies.md` answered how to *detect* this: a dependency-cruiser
`forbidden` rule keyed on `npm-no-pkg` plus `preserveSymlinks: true`, measured at 11/11 with no false
positives in 2.6 seconds. It also found, in its §7, that npm's hoisted layout is the root cause and
that pnpm's layout is the only mechanism available that makes the class *impossible* rather than
*detected* — while recommending the rule anyway, on the ergonomic argument that a strict layout turns
the mistake into a runtime resolution error found by whoever runs the app next, where a rule names the
file and the line.

That argument is what did not survive measurement.

## Decision

**pnpm, with the strict layout, and no `no-undeclared-dependency` rule.**

A workspace resolves only what its own `package.json` declares. An import it did not declare is not a
runtime surprise — it is a `typecheck` failure, in the same `verify` run, naming the file, the line
and the module. That is the ergonomics the rule was wanted for, from a gate that already existed, and
it costs no second cruise, no `preserveSymlinks`, and no config that the three existing cruises have
to be kept away from.

The layout also covers the two classes a rule cannot see:

- **The nine binaries.** `node_modules/.bin` is per-workspace under pnpm, so a script invoking an
  undeclared CLI is `command not found` at the moment it runs. Nothing that reads import specifiers
  can find this; the research doc records it as a gap only knip addresses.
- **The `@types/*` class.** `packages/ui` writes JSX in every component and declared neither
  `@types/react` nor `@types/react-dom` — **171 type errors** once the layout was strict. A
  `@types/*` package is never named in an import specifier: TypeScript loads it implicitly from
  `node_modules/@types`. dependency-cruiser, Biome and knip are all blind to it by construction. It
  was not in the research doc's survey because nothing in that survey could have found it.

Four mechanics come with the decision, each with its own reasoning recorded in
`pnpm-workspace.yaml`:

| Mechanism | What it is for |
| --- | --- |
| `catalog:` | A package two or more manifests declare is written `catalog:` in both; the version lives once, in `pnpm-workspace.yaml`. |
| `overrides:` | The split the catalog cannot reach — a third party's exact pin against our caret. Two entries today, both exact versions, both explained in place. |
| `workspace:*` | A sibling package is a sibling, not a registry range. Under pnpm 10+ `"*"` goes to the registry, and **`backend` is a real package on the public registry**. |
| `scripts/checks/one-version.mts` | The `versions` gate in `verify`: reads `pnpm-lock.yaml` and fails when a declared package resolved to more than one version. The lockfile is the only artefact that knows. |

The pnpm version is pinned by `packageManager: pnpm@12.4.1` in the root `package.json`, which pnpm
enforces itself and corepack honours.

### The migration is not an upgrade

Recorded because it is the part that is easy to get wrong twice. `pnpm import` reproduces the npm
lockfile's exact resolutions, but only against manifests whose specs have not changed yet:

| Order | Packages resolving differently than the npm lockfile |
| --- | ---: |
| Fresh `pnpm install`, no import | **180** |
| Fix the two blockers → `pnpm import` → *then* add declarations | **8** |

986 shared packages compared; the 8 were `@tanstack/react-start*` patch bumps. Deleting
`pnpm-lock.yaml` at any later point discards the import and puts the drift back to 180.

## Alternatives rejected

- **The `no-undeclared-dependency` dependency-cruiser rule** — the research doc's own recommendation,
  and the reason that document now carries an amendment. It is a second, slower way to learn what
  `typecheck` says, and it sees neither the binaries nor the `@types/*` class.
- **Biome's `noUndeclaredDependencies`** — already installed, already gated, finds all eleven, and
  produces ~1,130 false positives here: it matches the specifier against the manifest as a string, so
  every backend tsconfig `paths` alias reads as a scoped package. No ignore list, no alias option.
- **knip** — the only surveyed tool that could cover imports, binaries and the inverse question. Not
  rejected on capability: it is a new tool whose first run in a tree this size is a triage pass, and
  the layout answers two of the three for free. Still the right conversation for *unused*
  declarations, which nothing here answers.
- **npm `--install-strategy=nested` or `linked`** — partway there without a migration, but `linked`
  is marked experimental by npm itself, both change the on-disk layout for every install anyway, and
  neither was ever tested here.
- **Staying on npm and declaring the twenty by hand** — a one-time cleanup against a class that
  regenerates. The twenty were written by people whose editors resolved the import and whose
  `verify` stayed green; nothing would have stopped the twenty-first.

## Performance was not the reason

Stated so nobody reopens this on a benchmark. Measured on this tree — two rsync'd copies, pnpm
10.27.0, npm 11.9.0, node 24.14.0, darwin 25.5.0:

| Scenario | npm | pnpm | Winner |
| --- | ---: | ---: | --- |
| Cold — empty cache/store, real downloads | 38.8s | 36.7s | dead heat |
| Warm — `node_modules` deleted, cache/store populated | 16.2s | **10.1s** | pnpm, 1.6× |
| No-op — nothing changed | **1.8s** | 3.5s | **npm, 2×** |

pnpm wins one case of three, loses the one that happens most often in a day's work, and changes
nothing about `verify` (~16s) or the backend suite (~96s), which are `tsc` and vitest. If install
speed were the question, the answer would have been "stay".

## Consequences

- **Every call site moved.** `npm run --workspace=X` → `pnpm --filter X run`, `npm exec --` →
  `pnpm exec`, `npm ci` → `pnpm install --frozen-lockfile`, `npx` → `pnpm dlx` or `pnpm exec`.
  ~100 executable sites and ~143 in prose.
- **`Dockerfile.worker` copies `pnpm-workspace.yaml` and `pnpm-lock.yaml`** instead of nine manifests
  plus `package-lock.json`.
- **Adding a dependency is now a decision.** Which workspace declares it, and whether a second
  workspace declaring it makes it a catalog entry. The `versions` gate says when that has been
  skipped.
- **Install scripts are opt-in.** `allowBuilds` in `pnpm-workspace.yaml` lists the seven packages
  allowed to run one; `@scarf/scarf` is denied explicitly, because it is telemetry.
- **`minimumReleaseAge` is real and defaults to 1440 minutes.** With `trustLockfile: true` it applies
  to new resolutions rather than to replays of the committed lockfile. A hand-bump on publish day is
  refused; `pnpm_config_minimum_release_age=0 pnpm add …` takes it deliberately.
- **Dependabot cannot see `overrides:`.** Its only pnpm-workspace-aware parsing is for catalogs, so
  it will keep bumping declarations and leave the two override pins stale and silently in force.
  `one-version.mts` is the only thing that will notice.
- **The Cloudflare build commands are outside this repo.** `apps/admin` deploys to Cloudflare Pages;
  if its build command is configured in the dashboard it still says `npm`, and nothing in this tree
  reports it.

## References

- `.scratch/pnpm-migration/spec.md` — the audit, the measurements, and the migration order
- `docs/research/undeclared-dependencies.md` — how the detection question was answered, with the
  three amendments this decision required
- `pnpm-workspace.yaml` — the catalog, the overrides, `trustLockfile` and `allowBuilds`, each with
  its reasoning in place
- `scripts/checks/one-version.mts` — the `versions` gate, and why it reads the lockfile

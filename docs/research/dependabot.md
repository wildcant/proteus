# Dependabot, and What a "No Known-Vulnerable Dependency" Gate Would Actually Be

Research findings on whether Dependabot fits this repo — a nine-workspace npm monorepo migrating to
pnpm 10.27.0 with 23 open advisories — and specifically whether a Dependabot check can become an
eleventh gate in `scripts/verify.sh`.

**Date:** 2026-09-11
**Verification method:** the `dependabot` CLI 1.92.0 (Homebrew) and osv-scanner 2.5.1 were **installed
and run here**; pnpm 10.27.0's `audit` and `dedupe --check` were run against the real pnpm lockfile in
the scratchpad import trial; npm 11.9.0's `audit` was run against this tree. Every timing below is a
measured wall clock, not an inference. Dependabot's own behaviour is cited to `dependabot-core` and
`dependabot/cli` source read from `raw.githubusercontent.com`, and to `github/docs` content files —
the Markdown GitHub publishes from, rather than the rendered page — so every quotation has a file path
behind it. Those files are Liquid templates: quotations from them have
`{% data variables.product.prodname_dependabot %}` and friends expanded to the words they render as,
and `{% octicon "check" %}` rendered as ✓. Nothing else in any quotation is altered. Claims that could
not be run here are labelled unverified.
**One-line answer:** **no** — the `dependabot` CLI is a harness for running Dependabot's *update job*
against Docker images totalling 2.1 GB, it exits 0 whether or not it found anything, and the one run
performed here was abandoned at **15 minutes**, having processed about two of 106 dependencies and
produced no output at all. What belongs in the gate instead is **osv-scanner against the committed
lockfile — 2.3 s online, exit 1 on any finding** — and even that is better run as `npm run audit` plus
a scheduled CI job than as a `verify` gate, for a reason §5.1 gives: it is the only candidate check in
this repo that is not a pure function of the working tree.
**The thing to do today, ahead of all of that:** `gh api -X PUT repos/wildcant/proteus/vulnerability-alerts`.
Dependabot alerts are **disabled** on this repository (measured — §7.0), so the 23 advisories have
never produced one. Alerts open no pull requests and cannot disturb the pnpm migration.

---

## Table of Contents

1. [The question, and what a passing answer has to look like](#1-the-question-and-what-a-passing-answer-has-to-look-like)
2. [Does Dependabot support what this repo is becoming?](#2-does-dependabot-support-what-this-repo-is-becoming)
3. [What the `dependabot` CLI actually is, read and run](#3-what-the-dependabot-cli-actually-is-read-and-run)
4. [Verdict on the gate question](#4-verdict-on-the-gate-question)
5. [What could be a gate: the alternatives, measured](#5-what-could-be-a-gate-the-alternatives-measured)
6. [Comparison table](#6-comparison-table)
7. [The right split: a service on a schedule, a check on a commit](#7-the-right-split-a-service-on-a-schedule-a-check-on-a-commit)
8. [Recommendation for this repo](#8-recommendation-for-this-repo)
9. [Where the evidence is thin](#9-where-the-evidence-is-thin)

---

## 1. The question, and what a passing answer has to look like

Two questions are tangled in the brief and they have different answers, so they are separated here
before anything else.

- **Dependabot** is a hosted GitHub service that opens pull requests on a schedule. It is a *source
  of change*.
- **A gate** is one job in `scripts/verify.sh` that fails a build. It is a *refusal to accept a
  change*.

Those are not the same kind of thing, and the `dependabot` CLI is a third thing again — a local
harness for debugging the service's update jobs.

In this repo's vocabulary ([`standards/README.md` → The words](../../standards/README.md)):

- the **convention** would be *no dependency in the lockfile has a known advisory against it*;
- it becomes a **standard** the day a check exists;
- the check would be a **script**, not a rule — no declarative rule file can express "ask a
  vulnerability database" — so it [owes a recorded reason](../../standards/README.md), which this
  document is;
- the **gate** it would join does not exist. `standards/README.md` lists [four kinds a standard can be
  about](../../standards/README.md) — contents, structure, schema, currency — and this is none of
  them. It is a claim about the *dependency set*, not about our code.

That last point is not pedantry, and §5.1 is where it decides the answer.

A second constraint comes from `scripts/verify.sh`'s own header: ten gates, ~16 s, run in parallel,
and *"After changing a gate, prove it bites: reintroduce the violation, confirm the gate goes red, then
restore it."* Every one of the ten today is offline and deterministic. A candidate that needs Docker,
a 2.1 GB image, a GitHub token, or minutes is not a near miss — it is a different category.

---

## 2. Does Dependabot support what this repo is becoming?

Short answer: **yes for pnpm 10 and pnpm workspaces, with a documented caveat for `catalog:`.** Each
sub-question, with its source.

### 2.1 pnpm and `pnpm-lock.yaml` — supported, and pnpm 10 specifically

There is no `pnpm` ecosystem. pnpm is served by the `npm` ecosystem value, which the docs state
directly:

| Package manager | YAML value | Supported versions | Version updates | Security updates | Private repositories | Private registries | Vendoring |
|---|---|---|:-:|:-:|:-:|:-:|:-:|
| pnpm | `npm` | v7, v8, v9, v10 | ✓ | ✓ | ✓ | ✓ | ✗ |
| npm | `npm` | v7, v8, v9, v10, v11 | ✓ | ✓ | ✓ | ✓ | ✗ |

— the `pnpm` and `npm` rows of the table in
<https://github.com/github/docs/blob/main/data/reusables/dependabot/supported-package-managers.md>,
octicons rendered, *verified 2026-09-11*; published at
[supported-ecosystems-and-repositories](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories).
Note that there is no `pnpm` value for `package-ecosystem` — the row's YAML value is `npm`.

The source is ahead of the docs. `dependabot-core` now lists v11 as well:

```ruby
PNPM_V7 = "7"
PNPM_V8 = "8"
PNPM_V9 = "9"
PNPM_V10 = "10"
PNPM_V11 = "11"

SUPPORTED_VERSIONS = T.let([...].freeze, T::Array[Dependabot::Version])
DEPRECATED_VERSIONS = T.let([].freeze, T::Array[Dependabot::Version])
```
— <https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/lib/dependabot/npm_and_yarn/pnpm_package_manager.rb>,
*verified 2026-09-11*. pnpm 11 support arrived through
[#14794](https://github.com/dependabot/dependabot-core/issues/14794), still open at the time of
writing with 45 comments; the docs table has not caught up. Nothing is deprecated, and
`unsupported?` returns `false` unconditionally in that file.

**Lockfile versions.** Dependabot does not read `packageManager` alone; where it is absent it infers
the pnpm major from the lockfile header:

```ruby
return PNPM_V10 if pnpm_lockfile_version >= 9.0
return PNPM_V8  if pnpm_lockfile_version >= 6.0
return PNPM_V7  if pnpm_lockfile_version >= 5.4
```
— <https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/lib/dependabot/npm_and_yarn/helpers.rb>,
*verified 2026-09-11*. It also refuses anything below 7:

```ruby
def raise_if_unsupported!(name, version)
  return unless name == PNPMPackageManager::NAME
  return unless Version.new(version) < Version.new("7")
  raise ToolVersionNotSupported.new(PNPMPackageManager::NAME.upcase, version, "7.*, 8.*, 9.*, 10.*")
end
```
— `npm_and_yarn/lib/dependabot/npm_and_yarn/package_manager.rb`, *verified 2026-09-11*.

The lockfile pnpm 10.27.0 writes for this tree begins `lockfileVersion: '9.0'` — *measured against
the scratchpad import trial, 2026-09-11* — which lands on the `PNPM_V10` branch. **This repo's target
is squarely supported.**

### 2.2 pnpm workspaces — one `directory: "/"` entry covers all nine

Dependabot reads `pnpm-workspace.yaml` itself and fetches every matching workspace manifest. This is
not inferred from docs; it is the fetcher:

```ruby
def fetch_pnpm_workspace_package_jsons
  return [] unless parsed_pnpm_workspace_yaml["packages"]

  workspace_paths(parsed_pnpm_workspace_yaml["packages"]).filter_map do |workspace|
    fetch_package_json_if_present(workspace)
  end
end
```
— <https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/lib/dependabot/npm_and_yarn/file_fetcher.rb>,
*verified 2026-09-11*. `workspace_paths` expands `*` globs against the repository listing
(`find_directories` / `matching_paths` in the same file), so `packages/*` resolves to the six real
packages without being enumerated.

So **`packages/*` in `pnpm-workspace.yaml` does not need a `directories:` entry per workspace.** One
block with `directory: "/"` is correct, and is what §7.1 writes. `directories` exists for the
different case of several *independent* projects in one repo:

> * Use `directory` to define a single directory of manifests.
> * Use `directories` to define a list of multiple directories of manifests.
> …
> If you need to use more than one block in the configuration file to define updates for a single
> target branch of an ecosystem, you must ensure that all values are unique and there is no overlap
> in directories defined.
> — <https://github.com/github/docs/blob/main/content/code-security/reference/supply-chain-security/dependabot-options-reference.md>,
> *verified 2026-09-11*

Splitting this repo into nine `directories` entries would be actively wrong: nine blocks would each
pull the one shared root `pnpm-lock.yaml` and overlap, which the paragraph above forbids.

### 2.3 `catalog:` — supported since February 2025, and the buggiest corner of the ecosystem

**It is supported.** [#10202 "Add support for pnpm catalogs"](https://github.com/dependabot/dependabot-core/issues/10202)
was closed `completed` on 2025-02-04 by
[#11418](https://github.com/dependabot/dependabot-core/pull/11418), and the feature flag was removed
the same day by [#11477 "Remove `:enable_pnpm_workspace_catalog` feature flag"](https://github.com/dependabot/dependabot-core/pull/11477)
— *"PNPM catalog will be rolled out for all users"*. There is a dedicated `PnpmWorkspaceUpdater` that
rewrites `pnpm-workspace.yaml`.

The mechanism, read from source, is a two-step swap:

```ruby
# manifest_dependencies
manifest.each_dependency do |name, requirement, type|
  # Skip dependencies using Yarn workspace cross-references as requirements
  next if requirement.start_with?("workspace:", "catalog:")
```

```ruby
# workspace_catalog_dependencies
workspace_config["catalog"]&.each do |name, version|
  dep = build_dependency(file: T.must(pnpm_workspace_yml), type: "dependencies", name: name, requirement: version)
  dependency_set << dep if dep
end

workspace_config["catalogs"]&.each do |_, group_depenencies|
  group_depenencies.each do |name, version|
    …
```
— <https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/lib/dependabot/npm_and_yarn/file_parser.rb>,
*verified 2026-09-11*. A `"zod": "catalog:"` entry in a `package.json` contributes nothing; the
dependency is re-created from the `catalog:` / `catalogs:` maps in `pnpm-workspace.yaml`, carrying the
catalog's range as its requirement. Both the default catalog and named catalogs are read.

**What breaks, precisely.** Not "skips the dep". The open issues describe three distinct failures, and
one of them fails the whole job:

| Issue | State | What happens |
|---|---|---|
| [#15515](https://github.com/dependabot/dependabot-core/issues/15515) | open, 2026-07-07 | A catalogued package that *also* appears transitively at an older version gets that older version as the PR's "from". Title reads `Bump my-package from 1.0.1 to 3.0.0` when the catalog held `2.1.3`. |
| [#16049](https://github.com/dependabot/dependabot-core/pull/16049) | **open PR, unmerged**, 2026-08-27 | The fix for #15515, and the source of the sharpest statement of the failure: *"if the catalogued version is already current, `FileUpdater::NoChangeError` — because neither `pnpm-workspace.yaml` nor the lockfile has anything left to change. The dependency is then silently never updated, and the job is marked failed."* |
| [#12445](https://github.com/dependabot/dependabot-core/issues/12445) | open, 2025-06-12 | With a default `catalog:` **and** a named `catalogs:` block, the wrong one is rewritten — the reporter's diff shows `catalog.@types/node` downgraded from `^22.15.21` to `^20.19.0` while the `vscode` catalog entry that should have moved was left alone. |
| [#12244](https://github.com/dependabot/dependabot-core/issues/12244) | open, 2025-05-12 | Dependabot rewrites the lockfile's `specifier` as well as the `version`, desynchronising it from `pnpm-workspace.yaml#/catalog` — *"which then causes `pnpm dedupe --check` to fail"*. |
| [#13347](https://github.com/dependabot/dependabot-core/issues/13347) | open, 2025-10-21 | Catalog entry bumped *backwards*, PR title inconsistent with the diff. |
| [#14824](https://github.com/dependabot/dependabot-core/issues/14824) | open, 2026-04-26 | Every catalog dependency is classified `dependency-type: production`, so a `groups` rule split by `development`/`production` puts devDependencies in the production group. |
| [#14339](https://github.com/dependabot/dependabot-core/issues/14339) | open, 2026-03-03 | A catalog-using repo gets a `pnpm-lock.yaml` that `pnpm install --frozen-lockfile` then rejects in CI. |
| [#15959](https://github.com/dependabot/dependabot-core/issues/15959) | open, 2026-08-19 | Repeated root-level version resolution exhausts the **55-minute job limit** on a pnpm workspace with a catalog. Reproduction repo linked in the issue. |

*All states verified via the GitHub API on 2026-09-11.*

The #12445 class is explicable straight from the updater, which is why it is worth naming rather than
just linking. `PnpmWorkspaceUpdater` does a whole-file regex substitution with **no awareness of which
YAML block a match sits in**:

```ruby
def build_replacement_pattern(dependency_name:, version:)
  /(["']?)#{dependency_name}\1:\s*(["']?)#{Regexp.escape(version)}\2/
end
…
content.gsub(pattern, replacement)
```
— <https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/lib/dependabot/npm_and_yarn/file_updater/pnpm_workspace_updater.rb>,
*verified 2026-09-11*. `catalog:` and every entry under `catalogs:` are the same flat text to that
`gsub`. A repo with one catalog and no duplicate resolutions never sees it; a repo with two catalogs
holding the same package at different ranges is the reported bug.

**Bearing on the catalogs-versus-overrides decision** (the sibling document's question, not this
one): Dependabot is a real argument *against* catalogs, but a weaker one than it first looks, and it
cuts both ways.

- **Overrides are handled — but only in `package.json`.** `package_json_updater.rb` rewrites
  `%w(resolutions overrides)` sections and has an `update_overrides_for_subdependency` path
  (<https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/lib/dependabot/npm_and_yarn/file_updater/package_json_updater.rb>,
  *verified 2026-09-11*). An `overrides:` block in **`pnpm-workspace.yaml`** — where pnpm 10 wants
  them, and where the scratchpad trial already puts them — gets no handling at all: the only
  pnpm-workspace-aware parsing in `file_parser.rb` is `workspace_catalog_dependencies`, and neither
  it nor `file_fetcher.rb` mentions `overrides`. So a pin held there is not a dependency Dependabot
  will maintain; it will keep updating the *underlying* declaration and leave the pin stale and
  silently in force. That is not "safer", it is a different failure — an invisible one rather than a
  loud one.
- The catalog bugs are all *observable*: a wrong PR title, a wrong diff, or a failed job. The
  `pnpm dedupe --check` desync of #12244 is exactly the kind of thing a CI gate catches.
- Every catalog issue above is open and none is closed as `wontfix`; #16049 is a ready fix awaiting
  review.

The honest framing for that decision: **catalogs cost you a class of Dependabot bug you will notice;
overrides cost you a pin Dependabot cannot see at all.** Neither is disqualifying, and this document
takes no position on which to adopt.

### 2.4 `workspace:*` — never sent to the registry, twice over

The spec's F7 worries that `"backend": "*"` would fetch a stranger's package from the public registry.
Under Dependabot that worry is closed twice:

1. `manifest_dependencies` skips the requirement outright — `next if requirement.start_with?("workspace:", "catalog:")`.
2. Independently of the protocol, `build_dependency` drops anything whose name matches a workspace
   package:
   ```ruby
   return if workspace_package_names.include?(name)
   …
   def workspace_package_names
     @workspace_package_names ||= T.let(
       package_files.filter_map { |f| Dependabot::Package::NpmPackageJson.from_file(f).name },
       …
   ```
   — both in `file_parser.rb`, *verified 2026-09-11*.

So `@proteus/ui`, `@proteus/testing`, `backend` and the rest need **no `ignore` entry** in
`dependabot.yml`. Writing one would be noise.

---

## 3. What the `dependabot` CLI actually is, read and run

### 3.1 What it is, in its own words

> The `dependabot` CLI is a tool for running Dependabot update jobs.
> — <https://github.com/dependabot/cli/blob/main/README.md>, *verified 2026-09-11*

> Run the `update` subcommand to run a Dependabot update job for the provided ecosystem and repo.
> This does not create PRs, but outputs data that could be used to create PRs.
> — same file

It is **not a vulnerability scanner**. It is a harness that reproduces, locally, the job the hosted
service runs — for debugging ecosystem behaviour and for self-hosting. The `dependabot/example-cli-usage`
repo the brief found says the same:

> This repo serves as an example of how to use Dependabot CLI for updates. It is intended as a
> starting point for advanced users to run a self-hosted version of Dependabot within their own
> projects.
> — <https://github.com/dependabot/example-cli-usage/blob/main/README.md>, *verified 2026-09-11*

Note what that example actually does: it runs the CLI in **one** GitHub Actions job with a read-only
token, uploads the output as an artifact, and opens the PRs from a **second** job — *"Dependabot CLI
should only run with read-only tokens as some ecosystems may execute arbitrary code."* That is a
self-hosting pipeline, not a check.

### 3.2 What it requires — measured here

Installed with `brew install dependabot`; `dependabot version 1.92.0`. Also available via
`go install github.com/dependabot/cli/cmd/dependabot@latest` or a release binary (README, above).

> ## Requirements
> * [Docker]
> — <https://github.com/dependabot/cli/blob/main/README.md>

After one `dependabot update` run against this repo's trial pnpm workspace:

```
ghcr.io/dependabot/dependabot-updater-npm:latest   2.1GB
ghcr.io/dependabot/proxy:latest                    32MB
```
*Measured 2026-09-11 with `docker images`.* The updater image is **linux/amd64**; on this arm64 Mac
every process inside it runs under `qemu-x86_64` — visible in `docker exec … ps aux`, and a real
multiplier on the timings below that would not apply on an x86 runner.

A token is optional for public repositories and required for private ones
(`LOCAL_GITHUB_ACCESS_TOKEN`, README). Network is not optional at all: the architecture is
*updater → proxy → registry*, and the proxy's log during the run here is a stream of
`GET https://registry.npmjs.org:443/…`.

### 3.3 How long it takes — measured here

One run, `dependabot update -f job.yaml --local <trial-workspace>`, `package-manager: npm_and_yarn`,
against the nine-workspace pnpm tree (1,342 packages in the lockfile, 106 distinct declared
dependencies):

| Elapsed | State inside the updater container |
|---|---|
| 0:00 | `docker pull` of both images |
| ~1:00 | `bin/run fetch_files && bin/run update_files` starts |
| 4:00 | `pnpm install --lockfile-only --config.minimumReleaseAge=4320 --config.minimumReleaseAgeStrict=false --config.trustLockfile=true` — one full workspace resolution |
| 5:20 | `pnpm update @asteasolutions/zod-to-openapi@9.1.0 --lockfile-only` — **dependency 1 of 106** |
| 6:45 | second `pnpm update` for the *same* dependency, `--no-save -r` |
| 11:00 | **a second full `pnpm install --lockfile-only`** at the workspace root |
| 15:07 | `pnpm -v` — starting the next dependency's cycle. Run abandoned here. |

*Measured 2026-09-11.* At the point it was stopped: **15 minutes 13 seconds, 5,666 requests through
the proxy to `registry.npmjs.org`, roughly two of 106 dependencies processed, and no output produced.**

The shape is a version-resolution probe plus a file-update resolution per dependency — **and a repeat
of the whole root resolution between them**, which is exactly the mechanism upstream describes in
[#15959, *"Repeated root-level VersionResolver checks exhaust the 55-minute job limit"*](https://github.com/dependabot/dependabot-core/issues/15959),
filed against a pnpm workspace with a catalog. This run is that issue, observed on this repo's own
tree.

Two details worth keeping. `minimumReleaseAge=4320` is 3 days — the documented default cooldown
(§7.1), applied by the updater without being asked for. And `--config.trustLockfile=true` is how the
updater avoids a full install.

### 3.4 What it outputs, and its exit code

The output is a table of *proposed pull requests*:

```
+----------------------------------------------------+
|        Changes to Dependabot Pull Requests         |
+---------+------------------------------------------+
| created | rsc.io/quote/v3 ( from 3.0.0 to 3.1.0 )  |
| created | rsc.io/sampler ( from 1.3.0 to 1.99.99 ) |
+---------+------------------------------------------+
```
— <https://github.com/dependabot/cli/blob/main/README.md>, *verified 2026-09-11*

With `-o`, the same thing as a YAML smoke-test file. **There is no verdict in it.** And the exit code
carries none either — this is the whole of the error handling in the `update` command:

```go
if err := infra.Run(infra.RunParams{…}); err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        log.Fatalf("update timed out after %s", flags.timeout)
    }
    log.Fatalf("updater failure: %v", err)
}

return nil
```
— <https://github.com/dependabot/cli/blob/main/cmd/dependabot/internal/cmd/update.go>, *verified
2026-09-11*. It fails non-zero when the *updater* fails. It returns `nil` — exit 0 — whether it
proposed forty updates or none.

`dependabot test -f smoke-test.yaml` *does* have a pass/fail contract, but the thing it asserts is
"Dependabot produced the expected diff", with the expectation recorded in a file. That is a regression
test **for Dependabot**, which is what it is for: the `dependabot/smoke-tests` repo. It says nothing
about whether our dependencies are safe.

---

## 4. Verdict on the gate question

**No.** Not marginally, and not fixable by tuning.

| `scripts/verify.sh` expects | `dependabot update` delivers |
|---|---|
| ~16 s, all ten gates in parallel | abandoned at 15 min, ~2 of 106 dependencies done (§3.3) |
| Offline | updater → proxy → `registry.npmjs.org`, by design |
| Deterministic — same tree, same verdict | a new upstream release changes the answer with no commit |
| No credentials | `LOCAL_GITHUB_ACCESS_TOKEN` for a private repo; a `job.yaml` naming a repo and provider |
| A tool on `PATH` | Docker daemon + a 2.1 GB image, amd64-only |
| **Exit non-zero on a violation** | **exit 0 regardless** (§3.4) |

The last row alone ends it. `verify.sh`'s header says *"After changing a gate, prove it bites."* A
`dependabot update` gate cannot bite: there is no mutation to this repository that makes it exit
non-zero. In this repo's own words, **a gate that cannot fail is not a gate**.

That is not a criticism of the CLI. It is doing its job — reproducing an update job for debugging —
and the brief's question conflated it with `dependabot alerts`, which is a different feature that has
no CLI at all.

---

## 5. What could be a gate: the alternatives, measured

### 5.1 First, the awkward finding: this check is not a function of the tree

Every one of the ten gates in `scripts/verify.sh` today is a pure function of the working tree.
`typecheck`, `lint`, `standards`, `structure`, `generated`, `openapi`, `schemas`, `test`, `store`,
`packages` — give them the same files and they give the same verdict, today and in a year.

A vulnerability check is not. It is a function of the tree **and of the advisory database on the day
it runs**. A green `verify` on Monday and a red one on Tuesday with no commit in between is a normal,
correct outcome for it, and an alarming one for every other gate. That has three consequences:

1. **`git bisect` stops meaning what it means.** A gate that can go red without a commit makes an
   old commit fail a check it passed at the time.
2. **It is not a "standard" in this repo's sense.** `standards/README.md` defines a standard as *"a
   claim about our code"*, and the four kinds it enumerates are all claims about files. "No advisory
   is open against anything in the lockfile" is a claim about the world.
3. **A fix is often not available.** The repo's own case proves it: `drizzle-orm` 0.39.3's
   high-severity SQL injection needs a major upgrade that `.scratch/pnpm-migration/spec.md` scopes as
   its own ticket (P1b). A gate that is red for weeks while a legitimate migration proceeds gets
   `|| true`'d, and then it is worse than nothing.

**So the recommendation below is a standalone command plus a scheduled CI job, not an eleventh gate.**
§8.3 writes the `job_*` function anyway, exactly as the brief asks, because the decision is the
user's — but this is the reason it is offered second.

### 5.2 `osv-scanner` — the best of the local options

Google's scanner, v2.5.1 via Homebrew (`osv-scalibr 0.5.2`). It reads `pnpm-lock.yaml` natively.

**Measured, 2026-09-11:**

| Run | Wall | Exit |
|---|---:|---:|
| Online, `pnpm-lock.yaml` (1,342 packages), cold | 8.39 s | 1 |
| Online, same, warm — three runs | 2.18 / 2.31 / 2.50 s | 1 |
| Online, this repo's real `package-lock.json` (1,155 packages) | 2.27 s | 1 |
| `--offline`, cached database — three runs | 13.58 / 11.72 / 11.99 s | 1 |
| `--download-offline-databases` (populates the cache) | 17.71 s | 1 |
| Clean single-package lockfile | 0.01 s | **0** |
| Lockfile resolving to zero packages | 0.01 s | **128** |

**The offline mode is slower than the online mode**, which is the most counter-intuitive result here
and the one that decides how to use it. The npm database is a single
`~/Library/Caches/osv-scalibr/npm/all.zip` of **205 MB** that gets read and decompressed on every run;
the online path is one API call. Offline is for air-gapped CI, not for speed.

The exit-code contract is documented and matches what was observed:

> | Exit Code | Reason |
> | `0` | Packages were found when scanning, but does not match any known vulnerabilities or findings. |
> | `1` | Packages were found when scanning, and there are vulnerabilities or findings. |
> | `1-126` | Reserved for vulnerability result related errors. |
> | `127` | General Error. |
> | `128` | No packages found (likely caused by the scanning format not picking up any files to scan). |
> | `129-255` | Reserved for non result related errors. |
> — <https://github.com/google/osv-scanner/blob/main/docs/output.md>, *verified 2026-09-11*

Exit 128 on "no packages found" is a genuinely good property for a gate: point it at a path that no
longer exists and it goes **red**, not green. That is the failure mode `verify.sh`'s header warns
about — *"A check that has silently stopped matching prints exactly what a clean tree prints"* — closed
by the tool itself.

What it found on the pnpm lockfile: **15 packages affected by 36 vulnerabilities (0 critical, 19 high,
16 medium, 1 low)**, identical counts from the npm lockfile. Named highs include
`drizzle-orm 0.39.3 → 0.45.2`, `brace-expansion`, `browserslist`, `fast-uri`, `js-yaml`.

**Its one real weakness for a gate:** no severity threshold. There is no `--audit-level`. The JSON
does carry it — `database_specific.severity` is `LOW`/`MODERATE`/`HIGH`/`CRITICAL`, and
`groups[].max_severity` is the CVSS score — *verified by inspecting `--format json` output here* — so
"fail only on high" is a `jq` away, at the cost of turning a clean exit code into a pipeline.

### 5.3 `pnpm audit` — fast, but it fails the offline test twice

pnpm 10.27.0 against the trial workspace. **Measured, 2026-09-11:**

| Run | Wall | Exit |
|---|---:|---:|
| `pnpm audit --audit-level=high` | 2.17 s | 1 |
| `pnpm audit --prod --audit-level=high` — three runs | 2.06 / 1.59 / 3.75 s | 1 |
| `pnpm audit --audit-level=critical` (none present) | ~2 s | **0** |
| `pnpm audit --audit-level=high --registry=http://127.0.0.1:1/` | **70.30 s** | **1** |
| same, `+ --ignore-registry-errors` | ~70 s | **0** |

`--audit-level` does filter both the report and the exit code — with `critical` the output collapses
to two summary lines and the command succeeds. The contract is clean, and the flag set is good
(`--prod`, `--dev`, `--ignore <CVE>`, `--ignore-unfixable`, `--json`).

**But the last two rows are disqualifying for a `verify` gate.** Pointed at an unreachable registry —
the stand-in for "no network", since `pnpm audit` has no `--offline` — it retries on a 10-second then
one-minute backoff and then **exits 1 with a stack trace, indistinguishable from a real finding**. The
escape hatch makes it worse, not better:

> `--ignore-registry-errors`  Use exit code 0 if the registry responds with an error. Useful when
> audit checks are used in CI. A build should fail because the registry has issues.
> — `pnpm audit --help`, pnpm 10.27.0, *verified 2026-09-11*

That is a gate that silently passes whenever it cannot reach the registry. Either way, `npm run
verify` on a train is 70 seconds slower and lying.

The tool is right; the placement is wrong. `pnpm audit` belongs behind an explicit
`npm run audit`, where the developer knows a network call is happening.

(`pnpm audit signatures` and the `audit.ignore` setting are pnpm **11** features —
<https://github.com/pnpm/pnpm.io/blob/main/docs/cli/audit.md>, *verified 2026-09-11* — and are not
available on the 10.27.0 this repo is migrating to. On 10.x the ignore mechanism is `--ignore <CVE>`
on the command line.)

### 5.4 `npm audit` — the incumbent, and the number in the spec

Run against this tree as it stands. **Measured, 2026-09-11:** `npm audit --audit-level=high` → **5.39 s,
exit 1**. `--audit-level=critical` → exit 0. `--json` → 26,627 bytes, with `isDirect` per entry.

The 23 advisories in `.scratch/pnpm-migration/spec.md` reproduce exactly: `{"moderate": 11, "high": 12,
"total": 23}`, 9 of them `isDirect` — `@cloudflare/vite-plugin`, `@hono/node-server`, `drizzle-kit`,
`drizzle-orm`, `express`, `hono`, `orval`, `qs`, `wrangler`.

Worth knowing, because it changes how the two numbers read: **npm audit and osv-scanner are not
counting the same thing.** npm's 23 is 23 *packages* in the tree, including parents attributed the
vulnerability of a child — `express`, `wrangler`, `orval` and `drizzle-kit` are on that list because
of something below them. OSV's 36 is 36 *advisory-package pairs* across 15 genuinely vulnerable
packages; `fast-uri` alone accounts for six. Neither is wrong. Do not compare them directly, and do
not read "9 direct dependencies" as "9 packages we must upgrade".

`npm audit` is also the tool with the [documented booby trap](../../.scratch/pnpm-migration/spec.md)
this repo already found: `npm audit fix --force` proposes `drizzle-kit@0.18.1` against an installed
0.31.10.

### 5.5 `pnpm dedupe --check` — a different question, and destructive

Included because the brief lists it. It answers *"does the lockfile contain avoidable duplicate
versions"*, not *"is anything vulnerable"* — the sibling document's subject, not this one's.

Measured here anyway, and the result is a warning worth recording: **`pnpm dedupe --check` deletes
`node_modules` and reinstalls.** Without a TTY it refuses outright
(`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`); with `CI=true` it proceeds, prints
`Recreating …/node_modules`, hits the registry for 23.19 s, and leaves the directory **empty** when it
aborts on a finding. *Measured 2026-09-11 — it emptied the scratchpad trial's `node_modules`, which
had to be reinstalled.* It also found a real issue: `apps/admin zod 4.4.3 → 4.6.2`.

Whatever else it is, it is not a `verify` gate. A check that destroys the tree it checks cannot run
alongside nine others in parallel.

### 5.6 The rest

- **`audit-ci`** (IBM) — *"intended to be consumed by your favourite continuous integration tool to
  halt execution if `npm audit`, `yarn audit`, or `pnpm audit` finds vulnerabilities at or above the
  specified threshold while ignoring allowlisted advisories"* —
  <https://github.com/IBM/audit-ci/blob/main/README.md>, *verified 2026-09-11*. It **wraps**
  `pnpm audit`, so it inherits every network property of §5.3. Its one addition over `--ignore <CVE>`
  is a checked-in `audit-ci.jsonc` allowlist with expiry. Worth reaching for only if the allowlist
  becomes the bottleneck. Not run here.
- **`better-npm-audit`** — same category, npm-only, and made largely redundant by npm's own
  `--audit-level`. Not evaluated further.
- **`trivy fs`** — supports `pnpm-lock.yaml` natively: *"Trivy supports four types of Node.js package
  managers: `npm`, `Yarn`, `pnpm` and `Bun`"*, with transitive dependencies ✓ and dev dependencies
  *excluded* by default (`--include-dev-deps` to include) —
  <https://github.com/aquasecurity/trivy/blob/main/docs/guide/coverage/language/nodejs.md>, *verified
  2026-09-11*. It has `--severity` and `--exit-code`, which osv-scanner lacks. Against it: it is a
  container-first tool with its own multi-hundred-MB database, and the Node.js path is one corner of
  it. **Not installed or run here.**
- **`grype`** — *"Supports language-specific packages (Ruby, Java, JavaScript, Python, …)"* —
  <https://github.com/anchore/grype/blob/main/README.md>, *verified 2026-09-11*. The README does not
  name pnpm; Grype's JavaScript cataloguers work through Syft. **Unverified for `pnpm-lock.yaml`, and
  not run here.** Same objection as Trivy: image-scanning ergonomics for a lockfile question.
- **`socket`** — a commercial supply-chain product whose value proposition is *behavioural* analysis
  (install scripts, network access, obfuscation) rather than the CVE lookup this section is about. It
  needs an account and an API token, which puts it outside "offline, deterministic, no credentials"
  before its quality is even in question. Not evaluated.

---

## 6. Comparison table

"Offline" means *runs with the network unplugged and still gives the right answer.*

| Candidate | Answers "is anything vulnerable?" | Offline | Wall clock, this tree | Exit-code contract | Extra machinery | Verdict as a `verify` gate |
|---|---|---|---|---|---|---|
| **`dependabot update` (CLI)** | **No** — it proposes updates | No | **>15 min, abandoned unfinished** | **Always 0** | Docker + 2.1 GB amd64 image + token | **Disqualified — cannot fail** |
| **`dependabot test` (CLI)** | No — asserts Dependabot's own diff | No | not measured | 0/1 against a recorded expectation | same | Disqualified — wrong subject |
| **`osv-scanner --offline`** | Yes | **Yes** | **12 s** | 0 / 1 / 128, documented | 205 MB cache each dev must download and refresh | **Viable**, if it must be a gate |
| **`osv-scanner` (online)** | Yes | No | **2.3 s** | same | none beyond the binary | Best standalone command |
| **`pnpm audit --audit-level=high`** | Yes | **No — and lies** | 2.2 s online, **70 s then a false red** offline | 0/1 by severity; 0 on registry error with `--ignore-registry-errors` | none — built in | Rejected: false red offline, false green with the escape hatch |
| **`npm audit --audit-level=high`** | Yes | No | 5.4 s | 0/1 by severity | none | Superseded by pnpm after the migration |
| **`audit-ci`** | Yes (wraps the above) | No | not run | 0/1 by threshold, with an allowlist file | a devDependency | Inherits `pnpm audit`'s offline problem |
| **`trivy fs`** | Yes (docs) | Yes, with a cached DB | **not run** | `--exit-code` + `--severity` | its own DB | Plausible; unmeasured |
| **`grype`** | pnpm support **unverified** | Yes, with a cached DB | **not run** | `--fail-on` | its own DB | Unverified |
| **`socket`** | Different question (behavioural) | No | n/a | n/a | account + API token | Out of scope |
| **`pnpm dedupe --check`** | **No** — duplicate versions | No | 23 s | 0/1 | **deletes `node_modules`** | Disqualified — destructive |

---

## 7. The right split: a service on a schedule, a check on a commit

### 7.0 One correction to the brief first

The brief describes `wildcant/proteus` as *"appears to be a personal/private repo"*. It is **public**:

```json
{"private": false, "visibility": "public", "default_branch": "main", "allow_auto_merge": true,
 "security_and_analysis": {"dependabot_security_updates": {"status": "disabled"}, …}}
```
— `gh api repos/wildcant/proteus`, *verified 2026-09-11*.

That matters for §7.2: everything Dependabot offers is free on a public repository, and nothing has to
be purchased or enabled at an organisation level.

**And nothing is on.** Both halves are off today, which is worth stating plainly because it is easy to
assume alerts arrive by default:

```
GET /repos/wildcant/proteus/vulnerability-alerts        → HTTP 404
GET /repos/wildcant/proteus/dependabot/alerts           → HTTP 403
                                 "Dependabot alerts are disabled for this repository."
repos/wildcant/proteus .security_and_analysis
  .dependabot_security_updates.status                   → "disabled"
```
*Measured 2026-09-11.* Per the REST description, `GET …/vulnerability-alerts` answers **204 when
enabled and 404 when not**
(<https://github.com/github/rest-api-description/blob/main/descriptions/api.github.com/api.github.com.json>,
*verified 2026-09-11*). So the 23 advisories in this tree have never generated an alert, and §7.2 is
**two** toggles rather than one.

It also raises a separate matter this document is not the place to settle, but which should not go
unsaid: `.env.keys` and `.env.keys.production` are present in the working tree of a public repository.
Both are gitignored — `git check-ignore -v` names `.gitignore:2` and `.gitignore:3`, *checked
2026-09-11* — so this is a note, not a finding.

It also raises a separate matter this document is not the place to settle, but which should not go
unsaid: `.env.keys` and `.env.keys.production` are present in the working tree of a public repository.
They are gitignored (*checked 2026-09-11*), so this is a note, not a finding.

### 7.1 `.github/dependabot.yml`

Written for the **post-migration** pnpm workspace. It is valid before the migration too — the `npm`
ecosystem covers both lockfiles — but the grouping assumes the dependency families this repo actually
has (measured: 165 manifest entries, 106 distinct packages, across nine workspaces).

```yaml
# Dependabot version updates. https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference
#
# One `npm` block covers all nine workspaces. Dependabot reads pnpm-workspace.yaml itself and
# expands the `packages:` globs to fetch every workspace manifest — see
# npm_and_yarn/lib/dependabot/npm_and_yarn/file_fetcher.rb, `fetch_pnpm_workspace_package_jsons`.
# Nine `directories` entries would be wrong, not merely verbose: they would each claim the one
# shared root lockfile, and the options reference forbids overlapping directories in one ecosystem.
#
# No `ignore` entries. Every candidate considered would also suppress a *security* update, which
# respects `ignore` — including the drizzle-orm SQL injection, whose major bump is on its own
# track (.scratch/pnpm-migration/spec.md, P1b). Drizzle gets a group instead, so the major lands
# as one reviewable PR rather than two.
#
# The workspace packages (@proteus/*, backend) need no entry either: file_parser.rb skips any
# requirement starting `workspace:`, and independently drops any dependency whose name matches a
# workspace manifest's `name`.
version: 2

updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      # No `timezone`; the default is UTC. Set one if a local morning matters.
      time: "06:00"
    # Default is 5. Grouping below collapses ~106 packages into ~14 streams, so a limit that
    # cannot express a full week's worth is the thing that hides updates.
    open-pull-requests-limit: 10
    # Default is `auto`, which guesses app-versus-library per manifest. Every workspace here is
    # `private: true` and none is published, so state the app answer once rather than letting the
    # heuristic differ between apps/ and packages/.
    versioning-strategy: "increase"
    labels:
      - "dependencies"
    commit-message:
      prefix: "chore"
      prefix-development: "chore"
      include: "scope"
    groups:
      # Order matters: "If a dependency matches more than one rule, it's included in the first
      # group that it matches." Families first, catch-alls last.

      # React and its types move together or the app does not compile. packages/ui declares no
      # @types/react of its own today; after the migration it will (spec F5), and this is what
      # keeps the three in step.
      react:
        patterns: ["react", "react-dom", "@types/react", "@types/react-dom"]
      # 15 declared packages across admin, store, ui and testing — the single largest family, and
      # the one where a partial bump breaks the router/start/form type graph.
      tanstack:
        patterns: ["@tanstack/*"]
      # 6 packages; the Worker and the workflow SDK are version-locked to each other.
      temporal:
        patterns: ["@temporalio/*"]
      # Kept together so the 0.39 -> 0.45 major arrives as one PR touching orm and kit at once.
      drizzle:
        patterns: ["drizzle-orm", "drizzle-kit"]
      # The store and admin both deploy through these; wrangler and the vite plugin track the
      # workerd runtime.
      cloudflare:
        patterns: ["@cloudflare/*", "wrangler", "workerd"]
      tailwind:
        patterns: ["tailwindcss", "@tailwindcss/*", "tailwind-merge", "tw-animate-css"]
      vite:
        patterns: ["vite", "vitest", "@vitejs/*", "@vitest/*", "vitest-browser-react"]
      playwright:
        patterns: ["@playwright/test", "playwright-persona"]
      stripe:
        patterns: ["stripe", "@stripe/*"]
      aws-sdk:
        patterns: ["@aws-sdk/*"]
      dnd-kit:
        patterns: ["@dnd-kit/*"]
      # Types that are not react's. Almost always a patch nobody needs to read.
      types:
        patterns: ["@types/*"]
      # The catch-alls. Majors are deliberately excluded from both, so a major always arrives as
      # its own PR with its own changelog to read.
      production-minor-and-patch:
        dependency-type: "production"
        update-types: ["minor", "patch"]
      development-minor-and-patch:
        dependency-type: "development"
        update-types: ["minor", "patch"]

  # Only meaningful once .github/workflows exists (see 7.3).
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    labels:
      - "dependencies"
    groups:
      actions:
        patterns: ["*"]

  # apps/backend/Dockerfile.worker
  - package-ecosystem: "docker"
    directory: "/apps/backend"
    schedule:
      interval: "monthly"
    labels:
      - "dependencies"

  # apps/backend/docker-compose.yml and docker-compose.test.yml — postgres, temporal, redis.
  - package-ecosystem: "docker-compose"
    directory: "/apps/backend"
    schedule:
      interval: "monthly"
    labels:
      - "dependencies"
```

Every option above, cited to
<https://github.com/github/docs/blob/main/content/code-security/reference/supply-chain-security/dependabot-options-reference.md>
(*verified 2026-09-11*):

| Option | The sentence that justifies the value chosen |
|---|---|
| `directory` | *"Use `directory` to define a single directory of manifests."* Required; `/` is the workspace root. |
| `schedule.interval` | *"Use `weekly` to run once a week, by default on Monday."* `daily` on a repo with no CI is a queue nobody drains. |
| `schedule.day` / `time` | *"By default, Dependabot randomly assigns a time to apply all the updates."* Pinning makes the arrival predictable. |
| `open-pull-requests-limit` | *"If five pull requests with version updates are open, no further pull requests are raised."* Default 5; and *"Security update pull requests are not subject to this limit and do not count toward it."* |
| `versioning-strategy` | *"For apps, always increase the minimum version requirement to match the new version. The `increase` strategy."* Default is `auto`, which tries to guess app-versus-library. |
| `groups` | *"All updates for dependencies that match a rule are combined in a single pull request. If a dependency matches more than one rule, it's included in the first group that it matches."* |
| `groups.*.dependency-type` | *"Supported by: `bundler`, `composer`, `mix`, `maven`, `npm`, and `pip`."* — but see the caveat below. |
| `groups.*.update-types` | *"By default, a group will include updates for all semantic versions."* Restricting to `minor`/`patch` is what keeps majors individually reviewable. |
| `ignore` | Deliberately unused — it carries the security-updates icon, so an ignore suppresses security PRs too. |
| `cooldown` | Deliberately unused — *"Apply a default cooldown period of 3 days to version updates, even when `cooldown` is not configured."* The run in §3.3 was observed passing `minimumReleaseAge=4320` (3 days) without being asked. |

**One caveat on the two catch-all groups, specific to catalogs.** If this repo adopts `catalog:`, be
aware of [#14824](https://github.com/dependabot/dependabot-core/issues/14824): every catalogued
dependency is classified `dependency-type: production`, so a devDependency held in a catalog lands in
the `production-minor-and-patch` group. It is a cosmetic misfiling, not a correctness problem, but it
makes the production/development split less useful than it looks. If that becomes irritating, replace
the two catch-alls with a single `all-minor-and-patch` group and drop `dependency-type`.

### 7.2 Alerts and security updates — a different feature, and the higher-value one

`dependabot.yml` configures **version updates**. Dependabot **alerts** and **security updates** are
separate, and on this repo they are the better first move: they are the thing that would have
surfaced the `drizzle-orm` SQL injection in February rather than in a research document in September.

> There is no interaction between the settings specified in the `dependabot.yml` file and Dependabot
> security alerts, other than the fact that alerts will be closed when related pull requests generated
> by Dependabot for security updates are merged.
> — <https://github.com/github/docs/blob/main/content/code-security/concepts/supply-chain-security/dependabot-security-updates.md>,
> *verified 2026-09-11*

> The Dependabot security updates feature is available for repositories where you have enabled the
> dependency graph and Dependabot alerts. You will see a Dependabot alert for every vulnerable
> dependency identified in your full dependency graph. However, security updates are triggered only
> for dependencies that are specified in a manifest or lock file.
> — same file

> Dependabot security updates is available for the following repositories: … All repositories on
> GitHub.
> — <https://github.com/github/docs/blob/main/data/reusables/dependabot/gated-features/dependabot-security-updates.md>,
> *verified 2026-09-11*

**What it needs here: two toggles, in order.** Both are off today (§7.0), and the second is only
available once the first is on — *"available for repositories where you have enabled the dependency
graph and Dependabot alerts"*, above. In *Settings → Advanced Security*, or:

```bash
# 1. Alerts. Enabling this also generates the dependency graph — "When enabled, GitHub immediately
#    generates the dependency graph and creates alerts for any vulnerable dependencies it
#    identifies." Expect ~23 alerts within minutes, and no pull requests.
gh api -X PUT repos/wildcant/proteus/vulnerability-alerts

# 2. Security updates — the half that opens PRs. Only after (1), and only after the CI of 7.3.
gh api -X PUT repos/wildcant/proteus/automated-security-fixes
```

Both endpoints are the documented ones — `PUT /repos/{owner}/{repo}/vulnerability-alerts` *"Enable
vulnerability alerts"* and `PUT /repos/{owner}/{repo}/automated-security-fixes` *"Enable Dependabot
security updates"*
(<https://github.com/github/rest-api-description/blob/main/descriptions/api.github.com/api.github.com.json>,
*verified 2026-09-11*), and the alerts quotation is from
<https://github.com/github/docs/blob/main/content/code-security/concepts/supply-chain-security/dependabot-alerts.md>,
*verified 2026-09-11*.

**Step 1 is worth doing today, before anything else in this document.** It opens no pull requests, so
it cannot interfere with the pnpm migration, and it is the difference between 23 advisories that
somebody has to remember to look for and 23 alerts that arrive.

Enable **grouped security updates** at the same time, or 23 advisories arrive as 23 pull requests:

> To further reduce the number of pull requests you may be seeing, you can enable grouped security
> updates to group sets of dependencies together (per package ecosystem). Dependabot then raises a
> single pull request to update as many vulnerable dependencies as possible in the group to secure
> versions at the same time.
> — the security-updates concept file, above

One npm-specific fact worth knowing before reading the resulting PRs:

> For npm, Dependabot will raise a pull request to update an explicitly defined dependency to a secure
> version, even if it means updating the parent dependency or dependencies, or even removing a
> sub-dependency that is no longer needed by the parent.
> — same file

That is why an npm-ecosystem security PR can touch a manifest you did not expect.

**Order of operations matters.** Turning security updates on *before* the pnpm migration means
Dependabot rewrites `package-lock.json` while `.scratch/pnpm-migration/spec.md` §4 is depending on
that lockfile's exact resolutions — its measured fidelity result (8 drifted packages versus 180) rests
on importing an unchanged one. **Enable security updates after P3 lands, or accept re-running the
import.**

### 7.3 There is no CI — and that changes the recommendation

The repo has no `.github/` at all (*verified 2026-09-11*). A Dependabot PR would land with nothing
verifying it. Dependabot cannot tell whether a bump compiles; that is what a workflow is for.

So: **do not enable version updates until a workflow exists.** Enabling security updates first is
still defensible — an advisory is worth knowing about even if the fix needs a manual `verify` — but
version updates without CI is just a weekly chore that converts into a weekly `npm run verify` by
hand, and the weekly chore loses.

The minimum workflow is `verify` itself. Two prerequisites it has today, both real:

- **`job_test` needs Postgres.** `apps/backend/docker-compose.test.yml` is the definition (port 5433,
  `postgres`/`postgres`, `proteus_test`), and an `ubuntu-latest` runner can bring it up directly —
  simpler than a `services:` block, and it stays in step with the local setup because it *is* the
  local setup.
- **`job_test` needs the dotenvx private key.** `test:gate` is `dotenvx run -f ../../.env.test --
  vitest run …`, and `.env.test` is encrypted. `DOTENV_PRIVATE_KEY_TEST` has to be a repository
  secret before this workflow can be green.

`scripts/verify.sh` already handles the rest: it reads the `CI` environment variable at line 149 and
switches to report-only formatting without any extra wiring.

```yaml
# .github/workflows/verify.yml
#
# The one thing that makes a Dependabot pull request meaningful: it runs the same gate a developer
# runs. scripts/verify.sh is the single definition of what "checked" means here, so this workflow
# adds no checks of its own — if something should be verified, it belongs in that file's JOBS list.
name: verify

on:
  push:
    branches: [main]
  pull_request:

# Dependabot pull requests get a read-only token by default; verify needs nothing more.
permissions:
  contents: read

concurrency:
  group: verify-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      # The same compose file `db:test:up` uses locally, so the two cannot drift.
      - name: Start the test database
        run: docker compose -f apps/backend/docker-compose.test.yml up -d --wait

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # job_store renders components in a real Chromium via Vitest Browser Mode.
      - run: pnpm exec playwright install --with-deps chromium

      # --ci is implied by the CI env var Actions sets, and is passed explicitly so the intent is
      # legible: fail on unformatted files rather than rewriting them.
      - run: pnpm verify -- --ci
        env:
          DOTENV_PRIVATE_KEY_TEST: ${{ secrets.DOTENV_PRIVATE_KEY_TEST }}
```

**This workflow has not been run.** See §9.

If auto-merging patch updates is wanted later, the repo already has `allow_auto_merge: true`, and the
mechanics are in
<https://github.com/github/docs/blob/main/content/code-security/tutorials/secure-your-dependencies/automate-dependabot-with-actions.md>
— including the caveat that *"Your secrets are available in Dependabot secrets rather than as Actions
secrets"*, which is a live issue here because of `DOTENV_PRIVATE_KEY_TEST`. **A Dependabot-triggered
run will not see an Actions secret of that name; it must also be added under Dependabot secrets.**

---

## 8. Recommendation for this repo

### 8.1 In order

1. **Enable Dependabot alerts — today.** `gh api -X PUT repos/wildcant/proteus/vulnerability-alerts`
   (§7.2). They are **off**, which is the single most surprising measured fact in this document: the
   23 advisories have never generated an alert. Alerts open no pull requests, so this cannot disturb
   the pnpm migration, and it is the highest value per unit of work here by a wide margin.
2. **Add `.github/workflows/verify.yml`** (§7.3) before anything opens a pull request. Two
   prerequisites: `DOTENV_PRIVATE_KEY_TEST` as a repository secret *and* as a Dependabot secret.
3. **Enable Dependabot security updates, grouped, after P3 lands.**
   `gh api -X PUT repos/wildcant/proteus/automated-security-fixes` (§7.2). After P3 because it
   rewrites the lockfile the migration's import fidelity depends on; after (2) because the PRs it
   opens are otherwise unverified.
4. **Add `.github/dependabot.yml`** (§7.1) once (2) and (3) are settled. Version updates are the
   lowest-urgency half and the noisiest.
5. **Add `npm run audit` as a standalone command** (§8.2) — not a gate.
6. **Do not put Dependabot in `verify`.** §4.

### 8.2 The command, not the gate

Root `package.json`:

```json
"audit": "osv-scanner scan source --lockfile pnpm-lock.yaml"
```

Before P3 lands, that is `--lockfile package-lock.json` — both were run here and both reported the
same 15 packages and 36 vulnerabilities, so the command can be added now and the flag changed with the
rest of the migration's call sites (spec §5).

`osv-scanner` over `pnpm audit` for three measured reasons: it is faster (2.3 s vs 2.2 s online is a
tie, but 12 s offline vs a 70-second false red is not), its offline mode exists at all, and its exit
128 on "no packages found" means a stale path goes red instead of green. Against it: no severity
threshold, and a 205 MB cache if offline is ever wanted. `pnpm audit --prod --audit-level=high`
remains the right second opinion, and is one command away.

It is a `devDependencies`-free addition — osv-scanner is a Go binary, installed with
`brew install osv-scanner`, not an npm package — which is either a feature (no supply-chain surface
added by the supply-chain scanner) or a friction point for a new checkout. Say which in the README
line that introduces it.

### 8.3 If it must be a gate anyway

The brief asks for the wording, so here it is, matching `scripts/verify.sh`'s existing style — a
comment that states the claim and the trade, `npm exec`-free because the binary is not an npm package,
and the job added to both `JOBS` and `label_of`:

```bash
JOBS="typecheck lint standards structure generated openapi test schemas store packages advisories"
```

```bash
# Known advisories against anything in the committed lockfile. Unlike every other gate here, this
# one is not a pure function of the tree: the same commit goes green today and red the morning an
# advisory is published. That is the right answer to the question and the wrong shape for a gate —
# `git bisect` now has a check that an old commit can fail without having changed. It runs --offline
# against the database cached at ~/Library/Caches/osv-scalibr, so `verify` stays runnable without a
# network, at the cost that the verdict is only as current as the last
# `osv-scanner scan source --download-offline-databases`. That refresh is the thing that goes stale,
# and nothing here notices. Measured: 12s offline, 2.3s online, on 1342 lockfile packages.
# Exit 0 clean, 1 on a finding, 128 when the lockfile path matches nothing — so a renamed lockfile
# fails the gate rather than passing it.
job_advisories() { osv-scanner scan source --offline --lockfile pnpm-lock.yaml; }
```

```bash
    advisories) echo "Known advisories in the lockfile" ;;
```

**Proving it bites**, in the shape `verify.sh`'s header asks for — and this one is easy, because the
gate is red today:

```bash
# RED, as the tree stands:
osv-scanner scan source --offline --lockfile pnpm-lock.yaml
#   Total 15 packages affected by 36 known vulnerabilities (0 Critical, 19 High, 16 Medium, 1 Low)
#   exit 1
#   — measured 2026-09-11

# GREEN, on a fixture with one safe package (no repo file touched):
osv-scanner scan source --lockfile /tmp/clean/pnpm-lock.yaml
#   No issues found
#   exit 0
#   — measured 2026-09-11
```

Both halves were run here. What was **not** run is the version where the lockfile is clean and an
advisory then appears — which is the mutation that matters most for this particular gate and is not
available on demand.

Adopting it means the 23 advisories must be closed first, exactly as
`.scratch/pnpm-migration/spec.md` P1 already sequences, and it means accepting that
`drizzle-orm` keeps the gate red until P1b lands. **That is the real cost, and it is the reason §8.1
puts this fourth and optional.** An `|| true` on a gate is worse than no gate.

### 8.4 Recorded as considered and rejected

For `standards/README.md` → [Tools considered, and rejected](../../standards/README.md), in that
list's shape:

- **`dependabot` CLI as a `verify` gate** — it is a harness for running Dependabot *update jobs*, not
  a scanner. It needs Docker and a 2.1 GB amd64 image, it was still on dependency 1 of 106 after 7
  minutes on this tree, and `cmd/dependabot/internal/cmd/update.go` returns `nil` whether it proposed
  forty updates or none. There is no mutation to this repository that makes it exit non-zero.
- **`pnpm audit` as a `verify` gate** — right tool, wrong placement. With no network it retries for
  70 seconds and exits 1 with a stack trace indistinguishable from a real finding; with
  `--ignore-registry-errors` it exits 0 and the gate silently stops checking. Keep it as
  `npm run audit`'s second opinion.
- **`pnpm dedupe --check`** — answers a different question (duplicate versions), and deletes
  `node_modules` to answer it. Measured: 23 s, and it emptied the directory it was pointed at.
- **`trivy fs` / `grype`** — both plausible; both carry their own vulnerability database and
  container-scanning ergonomics for a lockfile question osv-scanner answers in one binary. Neither was
  run here, and grype's `pnpm-lock.yaml` support is unverified.
- **`socket`** — behavioural supply-chain analysis, a genuinely different and complementary question.
  Needs an account and an API token, which rules it out of a gate before quality is discussed.
- **A vulnerability gate at all** — deferred rather than rejected, and §5.1 is why: it would be the
  only gate in `scripts/verify.sh` that is not a pure function of the working tree. Revisit if
  `npm run audit` turns out to be a command nobody runs.

---

## 9. Where the evidence is thin

**The `dependabot update` run never finished.** It was stopped after 15 minutes 13 seconds, at which
point it had made 5,666 registry requests and processed about two of 106 dependencies. So 15 minutes
is a floor, not a measurement of the job, and the claim that it would exceed a 16-second gate budget —
while not in serious doubt — is an extrapolation from a trajectory. Nothing here says whether it would
have produced a sensible set of proposed updates in the end, only that it would not have done so
quickly. The 55-minute upstream job limit
([#15959](https://github.com/dependabot/dependabot-core/issues/15959)) is the number to watch if
anyone repeats this.

**That run was under qemu emulation.** The updater image is linux/amd64 and this is an arm64 Mac;
`docker exec … ps aux` shows every process prefixed `/usr/bin/qemu-x86_64`. On an x86 runner it would
be materially faster — unquantified here, plausibly several times. The *architecture* of the finding
(two `pnpm update --lockfile-only` resolutions per dependency, no exit-code verdict) is unaffected;
the wall clock is not trustworthy as an absolute.

**No Dependabot pull request has been observed against this repository.** Everything in §2 is read
from `dependabot-core` and from other people's bug reports. In particular, whether *this* tree's
combination — nine workspaces, a shared root lockfile, `catalog:` if adopted, 113 packages resolving
at more than one version (spec F9) — trips [#15515](https://github.com/dependabot/dependabot-core/issues/15515)
is **unknown**. It is the one issue whose preconditions this repo visibly meets, and the only way to
find out is to turn it on.

**`grype` and `trivy` were not installed or run.** Both rows in §6 are from documentation. Trivy's
pnpm support is explicitly documented and can be trusted at the level of "it parses the file"; grype's
is inferred from "JavaScript" in a README and should not be trusted at all.

**`audit-ci`, `better-npm-audit` and `socket` were not run.** The `audit-ci` verdict rests on a
structural fact from its README — it shells out to `pnpm audit` — rather than on a measurement.

**`pnpm audit` was tested offline by proxy, not offline.** The stand-in was
`--registry=http://127.0.0.1:1/`, which produces `ECONNREFUSED`. A real disconnected network might
produce DNS failure or a hang with different timing. The 70.30 s figure and the exit codes are
measured; their generality to "on a plane" is an assumption.

**The osv-scanner offline database was measured once.** 205 MB, 17.71 s to download, ~12 s per scan.
How fast it grows, and how stale it is allowed to get before the verdict is wrong, are both unmeasured
— and staleness is precisely the failure mode §8.3's comment warns about without being able to detect.

**The CI workflow in §7.3 has not been run.** It is written from `scripts/verify.sh`,
`apps/backend/docker-compose.test.yml` and `apps/backend/package.json`, and there is no `.github/` to
test it against. The two things most likely to be wrong: whether `pnpm exec playwright install
--with-deps chromium` satisfies `job_store` on `ubuntu-latest`, and whether `DOTENV_PRIVATE_KEY_TEST`
is the right variable name for `.env.test` (the file declares `DOTENV_PUBLIC_KEY_TEST`, and the
private counterpart was not read).

**The `dependabot.yml` in §7.1 has not been validated by GitHub.** Every option is cited to the
options reference, but the file has never been parsed by the service, which is the only thing that
validates it. `package-ecosystem: docker-compose` in particular was taken from the supported-package-managers
table and not exercised against `apps/backend/docker-compose.yml`.

**The action versions in §7.3 are latest-release numbers, not tested pins.** `actions/checkout@v7`,
`actions/setup-node@v7` and `pnpm/action-setup@v6` are the current `releases/latest` tags as of
2026-09-11 (`gh api repos/<owner>/<repo>/releases/latest`, returning v7.0.1, v7.0.0 and v6.1.0). No
workflow using them has run. Pin them to the full SHA if that matters here; a `github-actions`
Dependabot block is in §7.1 to keep them current once one exists.

**The grouping in §7.1 was designed from a measurement, but not exercised.** The families come from
reading all ten manifests — 165 entries, 106 distinct packages, *measured 2026-09-11* — so the
patterns match real packages. What is unknown is how many pull requests a week they actually produce,
which is the number the design is trying to control. Note also that `@aws-sdk/*`, named in the brief
as a large family, is **two** direct entries (`client-s3`, `s3-request-presigner`); its size in this
repo is transitive, and Dependabot groups by declared name.

**A side effect worth recording.** Running `pnpm dedupe --check` in the scratchpad import trial
emptied that workspace's `node_modules`; it was reinstalled. Nothing under
`/Users/willo/learn/medusa/proteus` was modified by this research except this file — `npm audit` and
`osv-scanner` are both read-only, and `npm audit fix` was never run.

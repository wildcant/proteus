# 08 — Dependabot alerts, a CI workflow, and an audit command

**What to build:** the repository starts telling us when a dependency has a known vulnerability;
something verifies a pull request before it is merged; and `npm run audit` answers the question on
demand. Dependabot does **not** become a `verify` gate.

**Blocked by:** step 1 is blocked by **nothing and should be done today**. The rest sequences around
06 — see *In order*.

**Status:** planned.

**Spec:** `.scratch/pnpm-migration/spec.md`, P5.

**Research:** `docs/research/dependabot.md` — the `dependabot` CLI and osv-scanner were installed and
run, not read about. Read §4 for the gate verdict and §7 for the file contents.

---

## Why, starting with the part that is not about pnpm at all

**This repository is public, and Dependabot alerts are disabled.** Verified twice — by the research
agent and independently:

```
$ gh api repos/wildcant/proteus --jq '{private,visibility}'
{"private":false,"visibility":"public"}

$ gh api repos/wildcant/proteus/vulnerability-alerts
{"message":"Vulnerability alerts are disabled.", "status":"404"}

$ gh api repos/wildcant/proteus/dependabot/alerts
{"message":"Dependabot alerts are disabled for this repository.", "status":"403"}
```

So the 23 advisories of ticket 02 — including the `drizzle-orm` SQL injection — have never produced
an alert, and would not have produced one however long they sat there. Nothing in the repo is
watching, on a repository anyone can read.

Enabling alerts is one API call, opens no pull requests, and cannot disturb anything else in this
spec. It is the highest value per unit of work in the whole feature.

## And the answer to the gate question: no

The `dependabot` CLI is a **harness for running Dependabot's update job locally**, not a scanner.
Three independent disqualifiers, each measured:

- **It cannot fail.** `cmd/dependabot/internal/cmd/update.go` returns `nil` — exit 0 — whether it
  proposed forty updates or none. It exits non-zero only when the updater itself crashes. There is no
  mutation to this repository that makes it go red. `AGENTS.md`: *"a gate that cannot fail is not a
  gate."*
- **Docker, and 2.1 GB.** `ghcr.io/dependabot/dependabot-updater-npm` is 2.1 GB and linux/amd64 — qemu
  on an Apple Silicon machine.
- **Speed.** Run against the trial pnpm workspace and **abandoned at 15 minutes 13 seconds**, having
  made 5,666 registry requests and processed roughly **2 of 106 dependencies**, with no output. It
  re-runs a full root `pnpm install --lockfile-only` between dependencies — the mechanism of open
  upstream issue dependabot-core#15959, observed here rather than inferred.

`verify` is ten gates in ~16 seconds. This is not a candidate.

---

## In order

### 1. Enable alerts — today, before anything else in this spec

```bash
gh api -X PUT repos/wildcant/proteus/vulnerability-alerts
```

Opens no PRs. Independent of the migration. Do it first.

### 2. `.github/workflows/verify.yml` — before anything opens a pull request

The repo has **no CI at all**. A Dependabot PR landing today would have nothing verifying it, which
is worse than no Dependabot: it manufactures a steady stream of changes nobody checks.

Contents in the research's §7.3. Two prerequisites: `DOTENV_PRIVATE_KEY_TEST` as a repository secret
**and separately as a Dependabot secret** — Dependabot-triggered runs do not see repository secrets.

Sequence this after 06 so the workflow is written in pnpm from the start rather than migrated twice.

### 3. Dependabot security updates, grouped — after 06 lands

```bash
gh api -X PUT repos/wildcant/proteus/automated-security-fixes
```

**After 06**, because security updates rewrite the lockfile, and 05's import fidelity (drift of 8,
not 180) depends on that lockfile being exactly what `pnpm import` produced. A security PR landing
mid-migration would make the drift number meaningless.

### 4. `.github/dependabot.yml` — last, and it is the noisy half

Contents in the research's §7.1. Two findings that shape it:

- **One `directory: "/"` covers all nine workspaces.** `file_fetcher.rb#fetch_pnpm_workspace_package_jsons`
  reads `pnpm-workspace.yaml` and expands the globs itself. Nine `directories` entries would be
  *wrong* — overlapping claims on one lockfile.
- **`workspace:*` is skipped twice over** (`file_parser.rb:239` and `workspace_package_names`), so no
  `ignore` entries are needed for the internal packages.

Group aggressively. This tree has `@tanstack/*` (~15), `@aws-sdk/*` (~15), `@temporalio/*` (7),
`@types/*` and `@biomejs/*`; ungrouped, it is dozens of PRs a week against a repo with one
maintainer.

### 5. `npm run audit` — a command, not a gate

```json
"audit": "osv-scanner scan source --lockfile pnpm-lock.yaml"
```

`--lockfile package-lock.json` until 05 lands; both were run and both reported the same 15 packages
and 36 vulnerabilities, so it can be added now and the flag changed with 05's other call sites.

Measured: **2.3 s online, 12 s offline. Exit 0 clean, 1 on a finding, 128 when the lockfile path
matches nothing** — so a renamed lockfile goes red rather than silently green, which is the failure
direction that matters.

Chosen over `pnpm audit`, which is disqualified for automation: offline it retries for **70.30 s**
then exits 1 with a stack trace **indistinguishable from a real finding**, and
`--ignore-registry-errors` makes it exit 0 while silently not checking. Keep it as a second opinion,
one command away.

osv-scanner is a Go binary (`brew install osv-scanner`), not an npm package — no supply-chain surface
added by the supply-chain scanner, at the cost of a non-npm prerequisite. Say which it is in the
README line that introduces it.

---

## Why the audit is not a gate either

The research writes the `job_advisories` function (§8.3) and then argues against adopting it, and the
argument is worth keeping rather than re-deriving:

> it is the only candidate check in this repo that is **not a pure function of the working tree** —
> the same commit goes green today and red the morning an advisory is published.

That breaks `git bisect`: an old commit can start failing without having changed. It also means
`verify` goes red on `drizzle-orm` until ticket 03 lands, and an `|| true` on a gate is worse than no
gate.

**Deferred, not rejected.** Revisit if `npm run audit` turns out to be a command nobody runs.

---

## One finding that belongs to ticket 05

**`overrides:` in `pnpm-workspace.yaml` gets no handling from Dependabot at all.**
`package_json_updater.rb` rewrites `overrides` in a `package.json`, but the only pnpm-workspace-aware
parsing in `file_parser.rb` is `workspace_catalog_dependencies` — neither it nor `file_fetcher.rb`
mentions `overrides`. So the two pins ticket 05 adds are invisible: Dependabot will keep updating the
underlying declaration and leave the pin stale and silently in force.

Catalogs *are* supported (dependabot-core#11418, flag removed by #11477) but are the buggiest corner —
7 open issues, and `FileUpdater::NoChangeError` fails the whole job (#16049, fix awaiting review).

The honest framing, which the research states and takes no position on:

> **catalogs cost you a class of Dependabot bug you will notice; overrides cost you a pin Dependabot
> cannot see at all.**

This does not change ticket 05's conclusion — an override is still the only mechanism that collapses
`@tanstack/form-core`, and Dependabot's blindness to it is not a reason to accept two copies. But it
does mean **the `versions` gate of ticket 05 is what catches a stale pin**, and that is now load-
bearing rather than a nicety. Record it in ticket 05's rationale.

---

## Acceptance criteria

- [ ] `gh api repos/wildcant/proteus/vulnerability-alerts` returns 204, not 404
- [ ] `.github/workflows/verify.yml` exists, runs `pnpm verify` on pull requests, and has been seen
      to **fail** on a deliberately broken branch — a CI workflow that has only ever passed is a gate
      that has not been tested
- [ ] `DOTENV_PRIVATE_KEY_TEST` is set as a repository secret **and** as a Dependabot secret, and a
      Dependabot-triggered run has been observed to pass
- [ ] `.github/dependabot.yml` groups `@tanstack/*`, `@aws-sdk/*`, `@temporalio/*` and `@types/*`, and
      has `open-pull-requests-limit` set deliberately
- [ ] It uses a single `directory: "/"`, not nine
- [ ] One week after enabling version updates, count the PRs opened. If it is more than a handful,
      the groups are wrong — fix them rather than muting the feature
- [ ] `npm run audit` exists and is documented in `README.md` with the `brew install osv-scanner`
      prerequisite
- [ ] `AGENTS.md`'s Commands section mentions it — otherwise no agent will ever run it
- [ ] The four rejected tools are recorded in `standards/README.md` → *Tools considered, and
      rejected*: the `dependabot` CLI as a gate, `pnpm audit` as a gate, `pnpm dedupe --check`,
      and a vulnerability gate at all (deferred, with §5.1's reason)

---

## Housekeeping from the research run

The agent installed things on this machine. Clean up or keep, deliberately:

- `ghcr.io/dependabot/dependabot-updater-npm` and `ghcr.io/dependabot/proxy` — **2.1 GB** of Docker
  images. `docker rmi` them unless the CLI is wanted again.
- `osv-scanner` and `dependabot` via Homebrew; osv-scanner's **205 MB** offline database at
  `~/Library/Caches/osv-scalibr`. Keep osv-scanner if step 5 is adopted.
- `docker network prune -f` removed an idle `op3n-fulfilment-shopify-plugin_default` network. It is
  recreated on the next `compose up`; no running container was touched.

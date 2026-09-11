# Frontend structural conventions — enforcement, and where the rules are stated

**Status:** in-progress. Enforcement has shipped; the instruction-file half has not.

**Phase:** 2 of 2. Phase 1 — the dependency-cruiser rules and the moves that make both apps pass —
is live on this branch: `packages/frontend-conventions/index.cjs` is tracked and both
`apps/{store,admin}/deps-analyzer/.dependency-cruiser.cjs` require it. The commits that authored it,
`09ae5e8` and `783bdf4`, sit on `feature/checkout-payment` and are **not** ancestors of `main`, so
`git log` will not show them — read the package, not the SHAs. This spec covers what is left.

Reference material behind the decisions here — read before changing any of them:

- `docs/research/agent-structural-conventions.md` — the survey. §3.1 is the dependency-cruiser
  technique; §3.6 is Steiger's refusal to build the same rule.
- `docs/research/structural-rules-authoring.md` — prior art, FSD's failure taxonomy, and the
  shared-config prototype that was actually run (§6.5).
- `docs/research/agents-md-standard.md` — the AGENTS.md governance answer, the tool support matrix,
  and the authoring patterns extracted from `openai/codex`'s own AGENTS.md history.
- `docs/research/agent-memory-and-write-time-determinism.md` — §1–§6 written; **§7–§9 are `_PENDING_`
  stubs** (lines 316, 322, 328), including its own "where the evidence is thin" section. The agent hit
  a session limit.
- `docs/adr/0020-store-feature-graph-is-acyclic.md`, `docs/adr/0010-payment-provider-driven-port.md`.

---

## Problem Statement

An agent building a PR created `apps/store/src/features/account/payment-methods/` — a folder outside
Bulletproof React's feature vocabulary — where `features/account/utils/` was intended. Three causes,
of which **one is now fixed and two are not**:

1. **~~Nothing enforced it.~~** Fixed in Phase 1. Both apps now fail `check:deps` on an
   unsanctioned folder, a loose feature-root file, or a layer violation.
2. **~~The codebase outvoted the docs.~~** Fixed alongside it: five deviating locations in the store
   and five loose files in the admin are gone, so precedent and rule now agree.
3. **The standard is still stated where agents do not read it.** Bulletproof React is named eight
   times in `README.md` and nowhere in the root `AGENTS.md`. This is what remains.

The third one is worth stating precisely, because the obvious fix is the wrong size. `AGENTS.md` is
20KB — 13.7KB when this spec was written, then ~47% larger in two commits (`d0eb8b94`'s subscriber
guide, `876f9d0e`'s route-helper placement) — and loads in full on every session, including sessions
that never touch a frontend file. Adding the vocabulary to it makes the always-on payload larger to
solve a problem that only exists inside `apps/*/src/features/`. The growth rate is itself the
argument: nothing about the file's shape resists this.

---

## What the evidence says, and what it forbids

Two findings constrain the design and are easy to get backwards.

**Decomposition buys cost, not compliance.** Two studies measured null: context-file richness
(arXiv:2607.27250, 288 runs — *"Context strategy does not measurably move correctness on either
agent"*) and rule-file layout tuning (arXiv:2605.10039, 1,650 sessions — *"None of the four structural
variables produces a detectable contrast"*). Do not expect the work in this spec to change agent
behaviour. The behaviour change came from Phase 1. This phase makes the always-on context smaller and
puts the vocabulary somewhere a planner will actually see it.

**Path-scoped rules have a planner-shaped hole.** Confirmed against
`code.claude.com/docs/en/memory.md` and `sub-agents.md`: a rule with `paths:` enters context only when
Claude reads a matching file. Subagents inherit every `CLAUDE.md` scope but **not** path-scoped rules
they never trigger. A planning subagent that greps specs and writes a plan never opens
`apps/store/src/features/**`, so it never loads a rule scoped there — and then produces a plan the
implementing agent follows. **Anything needed at plan time must be unscoped.**

The corollary: the folder vocabulary is a planning-time decision and goes in the always-on file. Its
rationale, examples and edge cases are implementation-time and can be lazy.

## Mechanics, confirmed against first-party docs

Load-bearing, and all verified — do not re-derive:

- **`.claude/rules/` is real and first-class.** A rule file with no `paths:` frontmatter loads at
  launch; one with `paths:` globs loads on demand when Claude reads a matching file. Brace expansion
  works (`src/**/*.{ts,tsx}`). Max 1,000 expanded patterns per rule, 4 MiB budget. **The directory
  supports symlinks specifically for sharing rules across projects.**
- **Nested `CLAUDE.md` is lazy** — *"Instead of loading them at launch, they are included when Claude
  reads files in those subdirectories."*
- **`@path` imports are eager**, expanded at session start, 4-hop limit. So importing a large file
  into `CLAUDE.md` makes the always-on payload *bigger*, not smaller.
- **`CLAUDE.md` files are concatenated, not overridden.** Precedence is positional: closest to cwd is
  read last.
- **Claude Code does not read `AGENTS.md` natively.** `/init` will read one to generate a `CLAUDE.md`,
  but at runtime it is `CLAUDE.md` only. A symlink is the supported bridge.
- **Codex reads `AGENTS.md` root→cwd and never below cwd, and has no glob mechanism at all.** This is
  why the shared standard must live in the *root* file, and why path-scoped detail is Claude-only.
- **Skills can be path-triggered but on file I/O, not intent** — unusable for "about to write here".

`apps/store/AGENTS.md` and `apps/admin/AGENTS.md` already exist and are **100% `@tanstack/intent`
generated** inside `<!-- intent-skills:start/end -->` markers, with nothing outside them. Nothing in
this spec writes to either. If that ever changes, run the generator once first and confirm it
preserves outside content — **unverified**.

---

## Ticket 1 — Add the feature vocabulary to the existing root `AGENTS.md`

**Reduced.** `.scratch/agent-context/spec.md` Ticket 1 owns the migration and has run: root
`AGENTS.md` exists, `CLAUDE.md` is a symlink to it (mode 120000), and the content moved across
unchanged. **Do not create the file and do not re-create the symlink.** What is left here is the
content decision — adding the seven-folder feature vocabulary, and deciding what of today's
`AGENTS.md` a planner actually needs versus what Ticket 2 should lazy-load.

Target ~50 lines for the planner-critical core. `AGENTS.md` has grown since that target was set, so
Ticket 2 now inherits noticeably more than it did — the subscriber guide alone is ~45 lines:

- the monorepo layout (which workspace is what)
- **the seven-folder feature vocabulary, phrased as a prohibition**
- `pnpm run verify` as the gate
- where ADRs, `docs/specs/` and `.scratch/` live
- the global prohibitions: no `snake_case`, no `any`, no non-null assertions
- the "a convention that can be checked is checked, and the check is a rule file rather than a
  script" paragraph added in `783bdf4` — **carry this verbatim**, it is planning-time guidance

Everything else in today's `AGENTS.md` moves to Ticket 2.

**Authoring voice**, from the patterns in `openai/codex`'s own AGENTS.md history (75 commits, 5 → 322
lines) — removals were the richest signal:

- Blanket bans get **deleted, not qualified**. A rule needing an exception list should not be there.
- **"if applicable" is the tell** for a rule that will not be followed. They rewrote *"ensure the
  documentation in docs/ is up to date if applicable"* into a sharp prohibition with one named
  exception.
- A strong rule **names the file, names the alternative, and explains why the wrong answer is
  tempting**.
- Prefer prohibitions to positive directives. In a >5,000-run study every individually *harmful* rule
  was a positive directive, with "follow code style" as the worked example.

Note `CLAUDE.md` is symlinked, so this is POSIX-only; a Windows checkout needs `core.symlinks`.
That symlink already exists — see the reduction above.

## Ticket 2 — Decompose the rest into `.claude/rules/`

`.claude/rules/` does not exist yet, and nothing in the repo currently uses `paths:` frontmatter.

| file | `paths:` | source |
|---|---|---|
| `commands.md` | *(unscoped)* | `AGENTS.md` § Commands |
| `backend-architecture.md` | `apps/backend/**` | § Backend Architecture |
| `admin-app.md` | `apps/admin/**` | § Admin App Architecture |
| `store-app.md` | `apps/store/**` | **authored, not moved** |
| `frontend-structure.md` | `apps/{store,admin}/src/features/**` | Ticket 4 |
| `testing.md` | ⚠ see below | § Testing |
| `code-style.md` | ⚠ see below | § Code Style |

`store-app.md` has no source in `AGENTS.md` — the store is documented only in passing there. Draw it
from `README.md` §"Store — Bulletproof React", `apps/store/README.md`, and ADRs 0013 (selective SSR),
0017 (cart state is a timestamp), 0019 (modals are URL state) and 0020 (feature graph).

Two rows of that table contradict §"Path-scoped rules have a planner-shaped hole". The four-test-levels
table and *"never fake a response from our own backend in an e2e test"* are **plan-time** decisions: a
planner choosing a level never opens a `.test.ts`, so a rule scoped there never loads — which is the
exact failure this spec exists to fix, reintroduced one section later. Level selection stays unscoped;
the fixture and factory mechanics can be lazy. `code-style.md` at `**/*.{ts,tsx}` is not a meaningful
narrowing either, so scoping it buys almost nothing against the same risk. See Open decision 1.

`.claude/rules/` also becomes a *third* home for conventions, alongside `standards/rules/**/__docs__/`
and each app's `deps-analyzer/`. The boundary is one sentence and belongs in `AGENTS.md` before this
ticket starts: **`.claude/rules/` holds conventions that cannot be checked; a convention with a check
stays documented beside its check.** Without it, `admin-app.md` and the ast-grep docs drift into each
other — and Ticket 1 is carrying the "a convention that can be checked is checked" paragraph verbatim,
so the spec would be contradicting itself in two files.

The vocabulary must appear in **both** `AGENTS.md` (planner-critical) and `frontend-structure.md`
(detail). That duplication is deliberate and is what Ticket 4 keeps honest.

## Ticket 3 — ADR 0025: frontend layers are one-way

0023 and 0024 went to the event bus in `d0eb8b94`, which *is* on this branch; 0025 is the next free
number.

`shared → features → app`, now enforced in both apps. State the rule, why cross-feature composition
lands in `routes/`, and cite `CartMismatchBanner` as the worked example: it needs cart *and* account,
but `cart: []` in `FEATURE_GRAPH` and `cart → account` would close the cycle
`account → auth → cart → account` that ADR 0020 forbids — so it lives with the feature owning the
remedy and takes `customerId` from the route.

Also worth a sentence in ADR 0020 noting the app layer is the escape hatch for cross-feature UI.

## Ticket 4 — Generate `frontend-structure.md` from the vocabulary

`FEATURE_FOLDERS` lives in `packages/frontend-conventions/index.cjs`. Ticket 2 restates it in prose.
Nothing stops those diverging.

Render `.claude/rules/frontend-structure.md` from `FEATURE_FOLDERS`, with a `--check` mode that fails
on drift, wired into `job_conventions` in `scripts/verify.sh`. `check:workflow-registry` is the
precedent — it generates and `--check`s the same way.

**Constraint from `783bdf4`:** that commit removed root `tsx`, `typescript`, `@types/node` and
`scripts/tsconfig.json`, and added the principle *"Reach for a script only after showing a rule cannot
express it."* So this must be a dependency-free `node scripts/*.cjs --check` — no `tsx`, no
`typescript`.

**The cited precedent does not support that constraint.** `check:workflow-registry` is
`tsx scripts/generate-workflow-registry.ts --check` in the **backend** workspace, which declares `tsx`
itself. It demonstrates the generate-and-`--check` *shape*, not that a root-level dependency-free
`.cjs` is the house style — if anything it demonstrates the opposite: the workspace that needs a tool
declares it.

**And it guards the wrong half of the duplication.** The pair that can drift unnoticed is
`AGENTS.md` ↔ `frontend-structure.md`. Generating only the latter from `FEATURE_FOLDERS` leaves the
hand-written restatement in `AGENTS.md` — the one a planner actually reads — free to rot. If this
ticket survives, the check worth having is that the vocabulary appears verbatim in `AGENTS.md`: ~10
lines, not a generator.

The alternative is to drop the generated file and let `packages/frontend-conventions` be the
vocabulary's only machine-readable statement, accepting that `AGENTS.md` restates it by hand — with
that verbatim-string check as the guard.

## Ticket 5 — Close the directory-typo hole

**Do this one first.** Until it lands, every other rule's enforcement is unverified, and it is the
cheapest ticket here.

Every rule regex is anchored on `^src/features/`, so a typo in the directory name makes all of them
vacuous — `src/feautres/…` passes everything. Steiger built `typo-in-layer-name` for exactly this.

The hole is wider than `features/`. `APP_PATH` is anchored on `^src/routes/`, and the shared-layer
path is built from `SHARED_FOLDERS` the same way, so `src/rotues/` is equally silent.

~30 lines of `fs` in `job_conventions`: assert each anchored directory exists in both apps, and that
`src/` holds no near-miss sibling of any of them.

**`packages/frontend-conventions` has no tests at all** — unlike `standards/rules/`, where
`check:standards:test` runs each rule's `valid`/`invalid` cases *because* "a rule that stops matching
prints exactly what a clean codebase prints." That is this ticket's own argument, already made and
already tooled elsewhere in the repo. The negative test under Verification below is that test, written
out by hand; automate it instead.

---

## Open decisions

**1. Where do `testing.md` and `code-style.md` get scoped?** The Ticket 2 table scopes both, which
contradicts the planner-shaped hole this spec rests on. Recommendation: split `testing.md` — level
selection and *"never fake our own backend"* unscoped in `AGENTS.md`, fixtures and factories
path-scoped — and leave `code-style.md` unscoped, since `**/*.{ts,tsx}` narrows nothing worth the
risk.

**2. Ticket 4's shape** — dependency-free `.cjs` generator, or drop it and guard the vocabulary with a
verbatim-string check against `AGENTS.md`? Recommendation: the latter. It is ~10 lines and it guards
the copy that actually reaches a planner.

**3. Finish `agent-memory-and-write-time-determinism.md`?** §7 (context economics), §8
(recommendation) and §9 (thin evidence) are `_PENDING_`. §9 in particular is the section that should
be read before citing any number from §4 — and this spec cites §4 throughout.

### Resolved

**~~`useComponentExportOnlyModules` — drop it globally?~~** Already done, in `09ae5e8`: the rule went
`warn` → `off` at the root and the `packages/ui/**` override was deleted with it. There is no
per-file override list left to grow, so the tax this decision weighed no longer exists. (The commit
message's account of a `payment-row` override is not what the diff did — no such override appears in
`biome.json` at any commit on either branch.)

---

## Verification

Ticket 1–3 are documentation and have no automated check beyond the gate staying green:

```bash
pnpm run verify
```

For Ticket 4, if it survives Open decision 2 as a generator:

```bash
node scripts/generate-frontend-rules.cjs --check     # green on a clean tree
# add a segment to FEATURE_FOLDERS without regenerating -> must fail
```

For Ticket 5, the rules must still bite after any refactor of the regexes. This is the check to
automate rather than run by hand, one case per anchored path:

```bash
mkdir -p apps/admin/src/features/orders/scratch && echo 'export const x = 1' > apps/admin/src/features/orders/scratch/x.ts
pnpm --filter admin run check:deps    # must fail: feature-folder-vocabulary
rm -rf apps/admin/src/features/orders/scratch
```

And the symlink actually resolves for the agent:

```bash
readlink CLAUDE.md                       # -> AGENTS.md
git ls-files -s CLAUDE.md                # mode 120000
```

## Risks

- **Restructuring `CLAUDE.md` while someone is editing it.** Two of the last three commits on this
  branch touched it (`d0eb8b94`, `876f9d0e`), and `783bdf4` touched it on the other — it is under
  active edit, not dormant. Check no session is mid-edit before converting it to a symlink, and
  expect to rebase the split.
- **The decomposition is measured to do nothing for compliance.** If it is judged not worth the churn,
  the honest minimum is Tickets 5 and 1 — close the vacuity hole, put the vocabulary in the always-on
  file, and stop. Ticket 2 is the churn this risk is about; Tickets 5 and 1 are not.
- **`apps/*/AGENTS.md` are generator-owned.** Do not write to them without first proving the
  `@tanstack/intent` generator preserves content outside its markers.

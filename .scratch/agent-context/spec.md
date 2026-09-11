# Agent context without machine-local memory

**Status:** planned.

**Goal:** every durable thing an agent needs to build a feature correctly lives in the repository or
in a deliberately personal, gitignored file — never in `~/.claude/projects/…/memory/`. Auto memory is
turned off, and the 34 notes it accumulated are either promoted, rewritten as rules, or deleted.

**Not in scope, deliberately:** closing the planner gap. `docs/research/agent-memory-and-write-time-determinism.md`
§6.2 establishes that Claude Code's built-in Explore and Plan subagents load **no project rules at
all** — *"There is no frontmatter field or per-agent setting to change which agents skip them."*
Making `to-spec` / `to-tickets` carry constraints into `.scratch/<feature>/spec.md` is the fix, and it
is a separate pass. This spec moves knowledge into the repo; it does not change who reads it.

---

## Why this is worth doing

Auto memory is machine-local by design — *"Files are not shared across machines or cloud
environments."* It is invisible to CI, to a cloud session, and to anyone else who clones the repo.
Three further facts, all measured against the current tree:

1. **It rots.** 6 of the 34 notes carry a dead path or an inverted fact after roughly three weeks
   (~18%). Nothing tells you; a stale note reads exactly like a fresh one.
2. **It is near its cap.** `MEMORY.md` is 120 lines against a 200-line load limit, and ~55 of those
   lines are prose duplicating `CLAUDE.md` and the ADRs rather than links to topic files.
3. **Subagents never saw it anyway.** *"The main conversation's auto memory isn't loaded into
   subagents."* Everything moved into the `CLAUDE.md` hierarchy is read by **more** agents than it
   was before, not fewer.
4. **It costs 4.1k tokens of every session.** From `/context`: `MEMORY.md` 4.1k, `CLAUDE.md` 7.4k,
   11.5k under **Memory files** combined. That is the budget this plan is spending, and the 4.1k half
   is the half no teammate and no CI run can see.

The corpus itself is good — nearly every note carries the incident, a **Why**, and a **How to apply**.
This is a relocation, not a cleanup.

---

## The audit

34 topic files, classified. Full detail per file is in the session that produced this spec; the
classification is the part that drives the work.

### Tier 1 — already covered by a repo artifact; delete (5)

| memory | what already covers it |
|---|---|
| `api-folder-holds-only-four-file-kinds` | the `api-holds-only-four-file-kinds` dep-cruiser rule + `apps/backend/src/api/README.md`. The note itself says *"this is now enforced, so you do not have to remember it"* |
| `backend-test-skill` | a pointer to `.claude/skills/backend-test/`, which is tracked and surfaced in the skill listing |
| `stripe-sdk-is-faked-at-the-module-boundary` | **stale** — `tests/mocks/stripe.ts` is gone (now `mocks/vitest/stripe.mock.ts`, `mocks/stripe-factories.ts`, `mocks/msw/handlers/`). Superseded by `f1e42f35` and the CLAUDE.md testing section |
| `exemptions-are-named-and-expire` | `standards/README.md` + `--error=unused-suppression` in `verify.sh` |
| `command-bar-is-hand-written` | nothing yet — but it belongs as a header comment in `packages/ui/src/components/ui/command-bar.tsx`, not as a memory. Promote in place, then delete |

### Tier 2 — real knowledge, nowhere in the repo; promote (17)

| target | memories | note |
|---|---|---|
| `standards/README.md` | `conventions-go-in-a-declarative-dsl` | see Ticket 3 — the rejected-tools list is the highest-value orphan in the whole directory |
| `scripts/verify.sh` header | `verify-is-the-only-check-aggregator`, `verify-gate-runs-api-tests-only` | both **stale**: "five suites" → nine; "the three `scripts/check-*.sh`" → one |
| `docs/backend-test-infrastructure.md` | `backend-tests-share-one-database` | **stale**: cites `docs/research/test-suite-migration-and-parallelism.md`, which does not exist |
| `docs/error-handling.md` | `error-codes-live-in-their-domain` | the doc says only *"Optional domain-specific code"* today |
| `docs/adding-a-module.md` | `regenerate-migrations-in-place`, `prefer-private-methods-over-module-helpers` | |
| `docs/product-options.md` | `variant-option-values-are-ids` | shipped as a visible bug once; the gate cannot catch it |
| `packages/http-schemas/README.md` | `http-schemas-constraints` | no `node:` imports, no regex flags |
| `apps/backend/src/core/event-bus/readme.md` | `workerd-dev-runs-real-queues` | |
| `.claude/skills/backend-test/` | `container-resolve-only-for-spies`, `fake-a-module-provider-via-providers-override`, `backend-test-imports` | |
| `.claude/skills/e2e-test/` | `one-e2e-spec-per-feature` | |
| **new rules** (Ticket 4) | `workflow-steps-stay-serial`, `field-suffix-is-reserved` | both are checkable; the repo's own doctrine says they should be checked |
| **ADR** (Ticket 5) | `url-state-is-the-default` | ADR 0019 covers modals only; the rule is broader |

`backend-test-imports` needs **rewriting, not copying**. It warns *"about 40 test files still do
`import { describe, expect } from 'vitest'` and only 4 use `test.describe` — do not infer the
convention from file counts."* Today it is **105 files on `test.describe` versus 49 on vitest
imports**. The precedent has flipped to agree with the rule, so the warning is obsolete and the
remaining sentence is just "use `test.describe`". Keep the mechanical-sweep note.

### Tier 3 — personal working style; goes to `AGENTS.local.md` (9)

`let-rapid-feedback-converge`, `surface-divergence-before-building`, `tickets-cannot-authorize-commits`,
`scratch-issue-files-are-specs`, `check-shopify-medusa-before-inventing-guards`,
`assertions-must-be-able-to-fail`, `store-work-checks-are-biome-and-typecheck`,
`no-external-brand-names-in-code`, `store-redesign-is-mobile-first`.

These stay personal and untracked. Two of them are machine-dependent in their own right and that is
fine here: `check-shopify-medusa-before-inventing-guards` names
`/Users/willo/learn/medusa/medusa-source/`, and `store-work-checks-are-biome-and-typecheck` encodes a
preference about which gate to run, not a project rule.

Judgement call to make while writing: `assertions-must-be-able-to-fail` is arguably a project
convention rather than a personal one — "prove a gate bites before calling it done" applies to anyone.
If it reads that way on the day, it goes to `AGENTS.md` instead and drops out of this tier.

---

## Ticket 1 — Root `AGENTS.md`, with `CLAUDE.md` as a symlink

Runs first: every later ticket that writes a project-wide instruction needs to know which file it is
writing to.

`git mv CLAUDE.md AGENTS.md`, then `ln -s AGENTS.md CLAUDE.md`. Git stores the link as mode 120000 —
the shape `apache/airflow` ships. Content does not change in this ticket; only the filename and the
bridge.

**Why the symlink and not the `@AGENTS.md` import.** Both are documented bridges. The import form
exists so you can add Claude-only content *below* the import — and after Ticket 6 there is no such
content: shared instructions live in `AGENTS.md`, personal ones in `AGENTS.local.md`. A symlink keeps
one file with one history instead of two that can disagree. Reach for the import only if a
Claude-specific section genuinely appears.

**What this buys.** Codex reads `AGENTS.md` root→cwd and has no glob mechanism at all, so the root
file is the only place a shared standard reaches it. Claude Code reads `CLAUDE.md` and never
`AGENTS.md` natively — `/context` confirms it: the only entries under **Memory files** today are
`CLAUDE.md` and auto memory's `MEMORY.md`.

**What it does not buy, and do not assume otherwise.** `apps/store/AGENTS.md` (97 lines) and
`apps/admin/AGENTS.md` (64 lines) are **100% `@tanstack/intent` generated**, entirely inside
`<!-- intent-skills:start/end -->` markers with nothing outside them. Claude has never loaded either
one and this ticket does not change that — Claude lazy-loads nested `CLAUDE.md`, not nested
`AGENTS.md`. **Write nothing to those two files.** If the per-app intent guidance should reach Claude,
that is a separate, optional change: `ln -s AGENTS.md apps/store/CLAUDE.md` in each app, which makes
them lazy-load when Claude reads files there. Verify first that the generator tolerates a sibling
symlink — **unverified**.

**Collision to resolve.** `.scratch/frontend-conventions/spec.md` Ticket 1 also proposes creating root
`AGENTS.md`. Two specs cannot both create one file. **This ticket owns the migration**; that one
reduces to "add the seven-folder feature vocabulary to the existing `AGENTS.md`". Whichever runs
second must not re-create the file. Update that spec's Ticket 1 when this lands.

Windows note: a symlinked `CLAUDE.md` needs `core.symlinks`, Administrator, or Developer Mode. A
Windows checkout should use the `@AGENTS.md` import instead.

## Ticket 2 — Promote Tier 2 into the artifact that owns each topic

Seventeen notes, targets in the table above. Three rules for the rewrite:

- **Drop the incident, keep the constraint.** BMAD's framing, and it is right: *"Write 'API responses
  must include pagination metadata' not 'Per PRD section 3.2.1, pagination is required.'"* A memory
  reads *"willo removed exactly that from `batchImageVariantsWorkflow` on 2026-08-21"*; a doc reads
  "workflow steps run serially, because compensation unwinds a sequential history."
- **Fix the stale facts on the way through** — the seven listed above. Do not copy a dead path forward.
- **Prohibitions over directives.** From `docs/research/agent-structural-conventions.md`: in a
  >5,000-run study every individually harmful rule was a positive directive.

Each promoted note is deleted from the memory directory as it lands, so the remaining count is the
progress bar.

## Ticket 3 — `standards/README.md` gains a "Tools considered" section

The single most expensive orphan. `conventions-go-in-a-declarative-dsl` records three tools evaluated
and rejected **with the specific reason each failed**:

- **semgrep** — object fields match unordered, so ordering rules are inexpressible.
- **ArchUnitTS** — custom rules are `(file: FileInfo) => boolean` over raw file text, so you keep
  writing the AST code and lose line numbers.
- **Biome GritQL plugins** — diagnostics are labelled only `plugin`, and suppression is the coarse
  `// biome-ignore lint:` which silences every rule on the line.

Re-deriving that costs a session. It exists nowhere in the repo.

Frame the section as the user put it: **when the available tools are not enough, list the options you
evaluated and why each failed** — so the next person proposing a hand-written walker has to clear the
same bar, and so a tool that improves can be reconsidered against a recorded reason. This is the
companion to the existing *"Reach for a script only after showing a rule cannot express it."*

## Ticket 4 — Compile two conventions into rules

Both are checkable, and `conventions-go-in-a-declarative-dsl` is the reason to check rather than
document them.

- **`workflow-steps-stay-serial`** → ast-grep rule under `standards/rules/backend/workflows/`:
  flag `Promise.all` whose argument array contains a `ctx.step(...)` call. Pairs with the existing
  `workflow-util-is-not-pure` and `workflow-*-error` rules.
- **`field-suffix-is-reserved`** → ast-grep rule under `standards/rules/frontend/components/`:
  a component named `*Field` that is not registered in `fieldComponents` in
  `apps/store/src/lib/form-hook.ts`. If the cross-file lookup proves inexpressible, this becomes a
  doc in `__docs__/` instead — and Ticket 3's new section is where that gets recorded.

Each rule ships with its `valid`/`invalid` test, per `standards/README.md`.

## Ticket 5 — Widen ADR 0019, or write its successor

`url-state-is-the-default` is broader than `0019-modals-are-url-state`: *"anytime state can live in
the url it should"* — pagination, sort, filters, selected tab, expanded row. It also carries two
implementation details worth keeping:

- `.optional().catch(undefined)`, never a zod `.default()`, so the default stays **absent** from the
  URL and existing `toHaveURL` assertions keep passing.
- A route `loader` that hardcodes the value will SSR a different page than the link points at, so the
  param belongs in `loaderDeps` too.

Widening 0019 is preferable to a new ADR — it is the same decision, stated at the right altitude.

## Ticket 6 — Tier 3 → `AGENTS.local.md`, bridged by a `CLAUDE.local.md` symlink

Write the nine working-style notes into a root **`AGENTS.local.md`**, then
`ln -s AGENTS.local.md CLAUDE.local.md`. Add **both** to `.gitignore`.

This is Ticket 1's pattern applied to the personal half, and it leaves the repo with one consistent
story: every instruction file is `AGENTS`-named, and every `CLAUDE`-named file beside it is a symlink
kept only until the other vendor catches up.

| source of truth | tracked? | Claude reads it via |
|---|---|---|
| `AGENTS.md` | yes | `CLAUDE.md` symlink (Ticket 1) |
| `AGENTS.local.md` | **no** — gitignored | `CLAUDE.local.md` symlink |

**Name it `AGENTS.local.md` even though nothing reads that name yet.** `openai/codex#26957` asks for
exactly this file and proposes the stack `~/.codex → ./.agents/ → AGENTS.md → AGENTS.local.md →
AGENTS.override.md`. It is **an open feature request with no maintainer response**, and it cites
`CLAUDE.local.md` as its precedent — so Codex does **not** read `AGENTS.local.md` today. Naming the
file this way costs nothing now and means the day the issue ships, Codex picks it up with no move and
no rename. The symlink is what makes it work in the meantime, not a bet on the issue landing.

Mechanics for the Claude side, confirmed against `code.claude.com/docs/en/memory`:

- *"For private per-project preferences that shouldn't be checked into version control, create a
  `CLAUDE.local.md` at the project root. It loads alongside `CLAUDE.md` and is treated the same way."*
- It loads **at launch**, concatenated after `CLAUDE.md` at the same directory level — *"your personal
  notes are the last thing Claude reads at that level."*
- Every subagent except built-in Explore and Plan loads the CLAUDE.md hierarchy, so this reaches more
  agents than auto memory did.

**One thing to prove, not assume.** The docs document a project-level symlink for `CLAUDE.md` (it is
the sanctioned `AGENTS.md` bridge) but say nothing about `CLAUDE.local.md`. It is an ordinary file
read, so a symlink should be transparent — but confirm with `/context` before deleting anything from
the memory directory. If it does not resolve, the fallback is a one-line `CLAUDE.local.md` containing
`@AGENTS.local.md`, which is a documented import and achieves the same thing.

Keep the voice second-person and imperative — this file replaces instructions, not notes. Target well
under 200 lines; the nine notes are ~11KB as written and should compress hard once the incident
narratives go.

**If worktrees come back:** a gitignored `AGENTS.local.md` exists only in the worktree where it was
created. The documented fix is to keep the content in `~/.claude/` and import it — `@~/.claude/proteus-local.md`
— which prompts an external-import approval once. Not needed today: `git worktree list` shows one tree.

## Ticket 7 — Turn auto memory off, project-scoped

Create `.claude/settings.json` (it does not exist yet; only `settings.local.json` does) and commit it:

```json
{
  "autoMemoryEnabled": false
}
```

Project scope rather than user scope, and **tracked** rather than `settings.local.json`, so the
setting arrives with the clone and the decision is visible in review. `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`
and the `/memory` toggle are the other two routes; neither travels with the repo.

**Order matters:** this is second to last on purpose. Once it is off, `MEMORY.md` no longer loads at
session start, and the index is the map for Tickets 2–6.

Measured payoff, from `/context`: `MEMORY.md` currently costs **4.1k tokens** of every session's
startup context. `CLAUDE.md` costs 7.4k. Turning auto memory off reclaims the 4.1k outright, and
none of the promoted content re-spends it — Tier 2 lands in docs and rules that load on demand or not
at all, and Tier 3's `AGENTS.local.md` replaces a surface that was already loading.

Archive before deleting — the directory is the only copy:

```bash
tar czf ~/proteus-memory-archive-$(date +%Y%m%d).tgz -C ~/.claude/projects/-Users-willo-learn-medusa-proteus memory
```

## Ticket 8 — Can `apps/backend/scripts/checks/` become ast-grep rules?

An analysis ticket, not an implementation one. `check:schema` runs `tsx scripts/checks/run.ts` over
~525 lines across eight files:

| file | lines | first read |
|---|---|---|
| `models.ts` | 93 | |
| `soft-delete-index-predicate.ts` | 85 | **runtime** — index predicates exist only once drizzle builds the table |
| `guard-outside-its-closure.ts` | 79 | |
| `cascade-relationship-index.ts` | — | **runtime** — cascade relationships likewise |
| `metadata.ts` | 44 | |
| `standard-timestamps.ts` | 45 | plausibly static |
| `destroy-only-children.ts` | 43 | |
| `model-barrel-reachable.ts` | 32 | plausibly static |
| `run.ts` / `types.ts` | 104 | harness |

`verify.sh` already states the constraint for two of them: *"cascade relationships and index
predicates only exist once drizzle has built the table, so this one imports the models."* That is a
genuine reason a rule DSL cannot express them, and it is exactly the bar Ticket 3's section asks for.

**Deliverable:** a per-file verdict — *expressible as an ast-grep rule* / *genuinely runtime, and why*
— with the runtime ones' reasons written into `standards/README.md` beside the tools section, so the
next person does not re-litigate it. Convert the expressible ones; leave `run.ts` holding only what
needs drizzle.

Out of scope for this ticket: `replay-purity.ts` (392 lines, parses workflow handlers) and
`check-generic-errors.sh`. Same question, different pass.

---

## Verification

```bash
# 1. The bridge resolves, and git stored a link rather than a copy
readlink CLAUDE.md            # -> AGENTS.md
git ls-files -s CLAUDE.md     # mode 120000
git ls-files -s AGENTS.md     # mode 100644, history preserved by git mv

# 2. Nothing left behind
ls ~/.claude/projects/-Users-willo-learn-medusa-proteus/memory/     # only the archive tarball's source, pre-delete

# 3. The replacement loads
readlink CLAUDE.local.md      # -> AGENTS.local.md
/context                      # CLAUDE.md and CLAUDE.local.md both appear under "Memory files",
                              # resolving through their symlinks; MEMORY.md is gone, total drops ~4.1k
/memory                       # auto memory shows as off

# 4. Nothing promoted points at a dead path
npm run verify

# 5. The new rules bite (per assertions-must-be-able-to-fail, which is itself being promoted)
#    Add a Promise.all around two ctx.step calls -> check:standards must fail
#    Name a component *Field without registering it -> check:standards must fail
```

Neither `AGENTS.local.md` nor `CLAUDE.local.md` may appear in `git status`.

## Risks

- **Two specs both want to create root `AGENTS.md`.** `.scratch/frontend-conventions/spec.md`
  Ticket 1 proposes the same file. Ticket 1 here owns the migration; that one must be reduced to
  "add the vocabulary to the existing file" before either runs.
- **`CLAUDE.md` is under active edit.** Three of the last commits touched it. A `git mv` while a
  session is mid-edit loses work — check before converting, and expect to rebase.
- **The symlink is POSIX-only.** A Windows checkout needs `core.symlinks`, Administrator, or
  Developer Mode; otherwise use the `@AGENTS.md` import form instead.
- **`/init` writes `CLAUDE.md`.** Through the symlink that means it writes `AGENTS.md`, which is
  what you want — but run it knowing that, and never on a tree with uncommitted instruction edits.
- **The archive is the only copy.** Take it before the first deletion, not after the last.
- **`AGENTS.local.md` reads as a shipped convention but is not one yet.** Nothing consumes that
  filename today — only the `CLAUDE.local.md` symlink makes it load. If the symlink is ever lost
  (a fresh clone, a new worktree), the file goes silently unread rather than erroring. The
  `/context` check is the only thing that catches it.
- **`AGENTS.local.md` is invisible to review.** That is the point, but it means a rule that
  *should* have been a project convention can hide there indefinitely. Re-read it whenever a
  teammate joins, and promote anything that turns out not to be personal.
- **Promotion is measured not to change compliance.** `docs/research/agent-memory-and-write-time-determinism.md`
  §4 — both the context-file-richness study and the rule-layout study found null. The justification
  here is machine independence and rot control, not better agent behaviour. Do not expect a
  behavioural win; the behavioural wins are Tickets 4 and 7, which turn prose into checks.
- **Auto memory off means corrections stop being captured anywhere.** The mechanism that produced
  all 34 of these notes is being removed. Nothing in this spec replaces it, and that is a real cost:
  the next correction has to be written down deliberately or it is lost. Worth revisiting once the
  promotion has settled.

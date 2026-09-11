# AGENTS.md: budget, drift and routing

**Status:** planned.

**Goal:** the root instruction file costs less per session, says nothing a gate already enforces,
carries no pointer that does not resolve, and routes an agent to the one document its task needs.
Every rule that must always hold stays in the root file; nothing else does.

**Scope:** `AGENTS.md`, the two app-level `AGENTS.md` files, and a new `.claude/rules/` layer. Not a
rewrite — the file is good, and most of what follows is subtraction.

**Adjacent, deliberately separate:** `.scratch/agent-context/spec.md` moves 34 machine-local memories
*into* the repo. That work adds to the artefacts this spec is trimming, so the two interact: every
memory promoted to prose in `AGENTS.md` spends the budget P1 reclaims. Land P0 and P1 first, or
promote into the `.claude/rules/` layer P1 creates rather than into the root file.

---

## Why this is worth doing

`AGENTS.md` is 372 lines / 26,283 bytes, loaded in full at the start of every session by every agent,
for every task. `/context` measured it at 7.4k tokens when it was 312 lines. Section shares:

| Section | Bytes | Share |
| --- | ---: | ---: |
| Backend Architecture | 7,969 | 30% |
| Testing | 5,100 | 19% |
| Commands | 4,874 | 19% |
| Frontend Apps | 3,066 | 12% |
| Code Style | 2,312 | 9% |
| Documentation | 1,770 | 7% |
| Project Structure | 940 | 4% |

A storefront CSS change pays for the subscriber idempotency contract, the Temporal transport split
and the e2e factory disposal rules. None of that is wrong; it is untargeted.

The file is otherwise strong, and the strength should be preserved explicitly rather than
accidentally: commands first with real flags and timings, closed folder vocabularies, and rules that
name the file, name the alternative and explain why (`ProductOptionService`, the `so_...` race in
checkout, the thirteen wallet specs that made stubbing look necessary). That is the top tier of what
an instruction file can do. The problems below are budget, drift and routing — not content.

---

## The audit

Every finding here was checked against the tree, not inferred.

### F1 — `apps/admin/AGENTS.md` and `apps/store/AGENTS.md` are not our instructions

Both files are 100% generated TanStack Intent manifests: `<!-- intent-skills:start -->` on line 1,
`<!-- intent-skills:end -->` on the last line (64 and 97 respectively), nothing outside the markers.
The content is TanStack Devtools marketplace publishing, plugin panel lifecycles and Next.js
migration steps.

Consequences, per the tool matrix in `docs/research/agents-md-standard.md` §3:

- **Claude Code never loads them.** It reads nested `CLAUDE.md`, not nested `AGENTS.md`. Inert for us.
- **Codex, Cursor, Copilot and Amp do load them**, as the per-directory project instructions for
  `apps/store/**` — devtools trivia presented as this repo's rules for the storefront.
- They occupy the exact filename per-app rules would want.

Highest severity of the set, and the cheapest to fix.

### F2 — one dead pointer

`AGENTS.md:337` cites `docs/refactoring/replace_nested_conditional_with_guard_clauses.txt`. The
directory holds `extract-function.md` and `guard-clauses.md`; that path does not exist.

Every other repo-relative path in the file resolves — all 21 checked. So the cost is not the missing
document, it is that one dead link makes the other twenty unreliable, and nothing reports it.

### F3 — two conflicting module layouts, ten lines apart

`AGENTS.md:101–107` lists six entries (`models/`, `repositories/`, `services/`, `__tests__/`,
`index.ts`, `database.config.ts`). `AGENTS.md:112–116` then states the list is **closed** at eight
folders and four root files, adding `migrations/`, `utils/`, `loaders/`, `providers/`,
`provider-declarations.ts`, `sync-providers.ts`.

An agent reading top-down builds from the first list. The dependency-cruiser rule
`module-holds-only-known-file-kinds` (`apps/backend/deps-analyzer/.dependency-cruiser.cjs:260`)
catches the divergence only if it produces a *disallowed* folder — a module missing `migrations/`
fails nothing.

### F4 — Code Style restates what Biome auto-fixes

Probed empirically: a scratch file containing `interface`, `any` and `!` under `apps/store/src/`
trips three rules on the spot.

```
lint/suspicious/noExplicitAny
lint/style/noNonNullAssertion             FIXABLE
lint/style/useConsistentTypeDefinitions   FIXABLE
```

So these bullets cost tokens every session and prevent nothing the gate would not:

| Bullet | Enforced by |
| --- | --- |
| Biome formatter settings (spaces, 120, single quotes, no semicolons, trailing commas) | `biome.json` `formatter` + `javascript.formatter`, auto-applied |
| Never `snake_case`; camel/Pascal/CONSTANT_CASE | `style/useNamingConvention` |
| Never `any` | `suspicious/noExplicitAny` |
| Never `!` | `style/noNonNullAssertion` (fixable) |
| `type` over `interface` — **stated twice**, lines 334 and 341 | `style/useConsistentTypeDefinitions`, `apps/admin/**` + `apps/store/**` override |

Line 334 also says "(enforced in store app)". The override covers **admin and store**. Backend is
not covered, which the duplicate bullet at line 341 obscures rather than clarifies.

These six are **not** machine-enforceable and earn their place unchanged: no abbreviations, guard
clauses, why-not-what comments, `.catch((e) => this.logger.error(e))`, `Promise.all` over
await-in-loop (confirmed: no lint rule fires on it), canonical Tailwind classes.

### F5 — no "ask first" tier

Every boundary in the file is *always* or *never*. There is no listed middle tier, and it is the tier
where a wrong guess is most expensive: migrations and schema changes, adding a dependency, editing
`verify.sh`'s `JOBS`, changing a generated-file contract, anything that should have been an ADR.

The nearest thing that exists is "surface a divergence before building the alternative" in
`AGENTS.local.md` — a personal working preference, invisible to any other contributor's agent.

### F6 — no git workflow

The last twelve commits use four subject styles: `[proteus] …`, `chore: …`,
`refactor(cart, order): …`, `[ILLO-47] …`. Nothing documents which is wanted, so an agent asked to
commit has no rule to follow and will pick one.

"Never commit unprompted" also lives only in `AGENTS.local.md`, which is gitignored. It is a repo
norm wearing a personal file's clothes.

### F7 — no task→document routing

The Documentation section lists what exists and where, which is not the same as saying which one to
read *before* starting a given task. That table is the precondition for P1 and P2: trimming the root
file is only safe if what remains tells an agent where the detail went.

---

## Phases

### P0 — correctness

No judgement calls, no behaviour change, ~30 minutes.

1. Fix `AGENTS.md:337` → `docs/refactoring/guard-clauses.md`.
2. Merge F3's two module layouts into one list of eight folders and four root files, keeping the
   one-line gloss each already carries.
3. Delete the duplicate `type`/`interface` bullet (line 341 keeps the rationale, line 334 goes), and
   correct "enforced in store app" → "admin and store; the backend is not covered".
4. ~~**Add a link check to `scripts/verify.sh`.**~~ **Built, then deliberately removed.** The
   prototype worked (93 paths across 13 documents, mutation-tested red through the gate) but is the
   wrong shape until the `__docs__` standard lands, and the real target is a superset of it — the
   rule-id ↔ Enforcement-table join, `note:` path resolution, index completeness. Parked in
   `.tasks/next-todos` with everything the prototype learned.

   This is repo doctrine applied to its own instructions: a convention that can be checked is
   checked. It is also the class of drift the memory audit measured at ~18% over three weeks, and
   `.scratch/agent-context/spec.md` is about to move that corpus into files this job would cover.

   Acceptance: introduce a bogus path into `AGENTS.md`, confirm the job goes red, restore it, confirm
   green. A gate that cannot fail is not a gate.

   Open question: a script, or expressible as a rule? Doctrine says reach for a script only after
   showing a rule cannot express it. ast-grep matches code shape, not Markdown link targets, and
   dependency-cruiser sees the import graph, not prose — so a script looks right here, but the
   argument should be written down in the commit rather than assumed.

### P1 — the documentation standard  *(decided; partly landed)*

**Settled.** `ast-grep/` is now `standards/`, the scripts are `check:standards` / `check:standards:test`,
and the coined term "code-shape" is gone. `standards/README.md` gained **"Where a document goes"** —
the decision table, the three tie-breakers, the one-claim-one-place rule, and the front-door table
naming the four standards that live elsewhere. `AGENTS.md` §Documentation now points at it instead
of restating it.

**The criteria, in one line:** `__docs__/` holds *what you must do*, one file per use case; a code
directory's `README.md` holds *how the machine works*, and has none when there is nothing mechanical
to say; ADRs hold *why*; `CONTEXT.md` holds vocabulary; `docs/` holds only what spans areas and is
owned by none.

**No signpost files.** A directory whose prose is all use case keeps no `README.md`. A pointer file
would be a second place to keep in step, and the rule's `note:` already names the document at the
moment it is needed.

5. ~~**Collapse Code Style to what no linter catches.**~~ **Considered and rejected — the bullets
   stay.** The original argument was that they cost tokens every session and prevent nothing the
   gate would not catch. The second half is wrong: the gate catches a violation *after* the work,
   and the fix cycle — write, run `verify`, read the diagnostic, edit, re-run — costs more than the
   ~1.2 KB the instruction costs. Prevention is the cheaper side of that trade.

   It is cheaper still for the ones that are not auto-fixable. `noExplicitAny` is not `FIXABLE`:
   clearing it means finding the right type, which is the expensive part. `useNamingConvention` is
   `warn` in `biome.json`, so a local `pnpm run check` does not even fail on it — only the gate's
   `--error-on-warnings` does. And the `type`-over-`interface` bullet covers ground the rule does
   not: the override is `apps/admin/**` and `apps/store/**`, so on the backend it is convention only.

   One bullet is genuinely free — the formatter settings (spaces, 120, single quotes, no semicolons,
   trailing commas). `biome format --write` runs first in `verify` and rewrites the file before any
   gate reads it, so writing semicolons costs nothing to get wrong. Not worth a diff on its own.

   **Recorded so it is not re-litigated.** The F4 finding below stands as measurement — those bullets
   *are* machine-enforced — but the conclusion drawn from it does not.

6. **Migrate the backend half into `__docs__/`.** All 20 frontend rules already sit in a
   `## Enforcement` table; all 13 backend rules sit in none. This closes that gap.

   | Target | Documents | Rules | Source, and what stays behind |
   |---|---|---|---|
   | `standards/rules/backend/api/__docs__/` | `routes.md`, `route-helpers.md` | 7 | all eight sections of `src/api/README.md` are use case — **that README is deleted** |
   | `standards/rules/backend/workflows/__docs__/` | `workflows.md` | 4 | `src/workflows/README.md`; §Three Building Blocks may be mechanism |
   | `standards/rules/backend/modules/__docs__/` | `modules.md` | 1 | `src/modules/README.md`, and `docs/adding-a-module.md` folds in — it explains how to build something that lives in one area, which `docs/` may no longer do |
   | `standards/rules/backend/subscribers/__docs__/` *(new)* | `events.md`, `subscribers.md` | 0 | `core/event-bus/readme.md` §Adding an event, §Idempotent, §Publishing resolves on acceptance, §Registry, §Testing. Its mechanism half — Architecture, Dispatch identity, Choosing an adapter, node transport, workerd — **stays** as the README |

   **`src/api` is two documents, not three.** Four of its seven rules are about `route.ts` ↔
   `definitions.ts` agreement, which looked like a third contract. It is not: you write both files in
   one sitting, so it is one thing you set out to build. The scatter test in `standards/README.md`
   agrees — all seven rules live in one directory, so nothing signals an unsliced document. Revisit
   if the definitions contract grows rules of its own.

7. **Then the `.claude/rules/` layer** — ticket `issues/03-claude-rules-pointer-layer.md`, which
   carries the measured per-section figures and one open decision.

   **Superseded detail, kept for the argument:** One file per migrated area, `paths:` scoped to it, carrying
   **no convention of its own** — a pointer to the `__docs__/` document and nothing else, so there is
   nothing in it that can drift. This is what turns the migration into the always-on budget cut:
   `AGENTS.md` keeps the rules that must always hold, and the per-area detail loads on path match.

   The constraint from `docs/research/agents-md-standard.md` §3 still binds: `paths:` scoping is
   Claude-Code-only and Codex never reads below cwd, so a rule may move out of `AGENTS.md` only if it
   is inert unless you are already in that folder.

### P2 — unblock the nested filenames

7b. Reconfigure TanStack Intent to generate somewhere other than `AGENTS.md` — or, if it cannot be
   redirected, keep its markers and author real content above them. Then put genuinely app-local
   knowledge in each: selective SSR and ADR-0013 for the store, the DataTable system and
   route-driven modals for the admin. Trim root's Frontend Apps to the cross-cutting half.

   Same caveat as P1 and for a different reason: Codex at root never sees `apps/store/AGENTS.md`, so
   these files are an enhancement for some tools and invisible to others. Nothing load-bearing moves
   here either.

   Check first whether the intent block is regenerated on install or on demand — if a postinstall
   step rewrites the file, hand-authored content above the markers may not survive, and the redirect
   is the only option.

### P3 — the gaps

8. An **Ask first** section listing F5's five cases.
9. A **git workflow** section: the commit subject convention we actually want, and the
   never-commit-unprompted norm promoted out of `AGENTS.local.md`.
10. A **task → read this first** table at the top of the file. Six to eight rows, task on the left,
    one path on the right. This is what makes P1 and P2 subtraction rather than loss.

### P4 — measure it

11. Build a small eval before P1 lands, and run it against both versions of the file.

    The corpus already exists: the 34 memory notes audited in `.scratch/agent-context/spec.md` mostly
    carry the incident that produced them. Six to eight of those incidents become prompts — the task
    as it was originally given, without the hint. Score each run on whether the agent hit the same
    trap.

    Without this, P1 is a plausible-sounding token cut with no evidence it has not deleted something
    load-bearing, which is the exact failure mode of the advice that prompted this spec:
    2,500 files observed, zero outcomes measured.

---

## Suggested order

P0 → P4's baseline → P1 → P2 → P3.

P0 is free and independent. P4 before P1 because P1 is the only phase that can lose information. P3
is additive and can land at any point, but it adds bytes, so it reads better after the subtraction
than before it.

---

## Backend-as-library is removed

**Not part of the phases above — a code change, surfaced by them, and the next task.** Landing it
first removes three of the references P2 and P3 would otherwise carry forward. Ticket
`issues/05-remove-backend-as-library.md`, where every line number below is re-verified against the
current tree — two of them have already drifted.

**What is deprecated:** the *frontend* backend-as-library path — the store calling route handlers
directly from TanStack Start server functions instead of over HTTP. **Not** the shared test package's
import of `backend`, which stays exactly as it is.

### It has no live consumer

Nothing imports `backend/api`. Verified by grep across `apps/` and `packages/`: zero hits for
`apiCall`, `usersApi`, `customersApi`, `userByIdApi` or `customerByIdApi` outside the files that
define them. `docs/specs/e2e-testing-infrastructure.md:142` already records the pattern as
deprecated. Its four exports are all `/admin/...` routes, which a storefront would not have called
anyway.

### Delete

| What | Note |
|---|---|
| `apps/backend/src/server/api-caller.ts` (94 ln) | the whole file — it has no test |
| `apps/backend/src/api/index.ts` | the four `withMiddleware(...)` wrappers and `export { apiCall }` |
| `"./api": "./src/api/index.ts"` in `apps/backend/package.json` | the export entry |
| `AGENTS.md:149` | the `src/server/api-caller.ts` bullet under §Server & Routing |
| `AGENTS.md:180` | *"The store additionally calls the backend as a library from server functions"* |
| `docs/middleware-and-openapi.md:363` | the whole `## Backend-as-library` section |
| `docs/middleware-overhaul-plan.md:312` | the `src/api/index.ts (backend-as-library)` line |
| `standards/rules/backend/api/__docs__/routes.md:44` | *"`src/api/index.ts` is exempt as the backend-as-library composition root"* |

**And the exemption it bought.** `api-holds-only-four-file-kinds` in
`apps/backend/structure/.dependency-cruiser.cjs:255` carries `(?!index\.ts$)` in its path regex, and
`:251` carries the sentence of its comment explaining why. Both go, which **tightens** the rule — `src/api/` becomes
four kinds of file with no carve-out at all. Prove it: after removing the lookahead, add
`src/api/index.ts` back and confirm the `structure` gate goes red, then delete it again.

### Keep — this is the half that is easy to take too far

| What | Why |
|---|---|
| `"backend": "*"` in `apps/store/package.json` and `packages/testing/package.json` | the `backend/test*` subpaths are live |
| exports `./test`, `./test/database-url`, `./test/fake-gateway` | five live consumers: `packages/testing/db/client.ts`, `packages/testing/fixtures/{test-extend,global-setup,e2e-config}.ts`, `apps/store/tests/e2e/{auth,checkout-async-payment}.spec.ts`, `apps/admin/tests/e2e/products.spec.ts` |
| `applyMiddleware` (`src/framework/http/apply-middleware.ts`) | `src/routes.ts:116` is the HTTP path's own use of it |
| `dbProvider.withConnection` | used by the Hono app, the Cloudflare Queues adapter and both DB providers |
| `src/framework/runtime/container.workerd.ts` | the workerd runtime still exists; only the library *entry* into it goes |

### Two things to check while in there

- **`.tasks/workerd-compatible-di.md` is `Status: ready-for-agent`, and its entire problem statement
  is this pattern** — *"The backend-as-library pattern (used by TanStack Start on Cloudflare Workers)
  fails at runtime…"*. Either it already landed (the tree has `workers-provider.ts` and a per-request
  connection) or it is obsolete. Resolve it rather than leaving a ready task pointed at deleted code.
- **`apps/admin` declares no dependency on `backend`**, yet `apps/admin/tests/e2e/products.spec.ts`
  imports from `backend/test`. It resolves through workspace hoisting today. Adjacent, not in scope,
  but worth a line somewhere.

---

## Decisions still open

- **The commit subject convention (P3.9).** Four styles are in use. Someone has to pick, and it is
  not a decision an agent should make by frequency count.
- **Whether the intent manifest can be redirected (P2).** Determines whether P2 is a config change
  or a file-layout change.
- **How far P1.6 goes.** Three files is the conservative cut. The Testing section (5.1 KB) is the
  next candidate — e2e factory discipline is arguably inert outside `tests/` — but the "never fake
  our own API" rule is a judgement call an agent makes while writing the *test plan*, often before
  touching a file under `tests/`, so the path match would miss exactly when it matters. Left out on
  purpose; revisit with P4 data rather than by argument.

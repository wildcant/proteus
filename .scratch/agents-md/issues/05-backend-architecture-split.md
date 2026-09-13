# 05 — Backend Architecture splits along the planner/writer line

**What to build:** `## Backend Architecture` stops being a reference manual in the root file. What a
*planning* agent needs — the decisions made before any file is open — stays, compressed, with
pointers. Everything a writer needs moves to the `__docs__/` or `README.md` that already holds it,
reached through a `.claude/rules/` pointer. Three claims that are already written down twice are
deleted from the root rather than moved.

**Blocked by:** nothing. 01 and 03 landed, 04 is in flight. Every receiving document in the table
below already exists — this ticket creates no new `__docs__/` directory and no new rule directory.

**Status:** ready-for-agent

**Spec:** `.scratch/agents-md/spec.md`, the gap the phases never covered.

---

## Why

`## Backend Architecture` is **7,627 bytes — 32% of `AGENTS.md`**, the largest block in the file and
the only major section P1 never touched. P1.6 migrated the backend's *guides* into `__docs__/` and
P1.7 added the pointer layer, but the root file kept its own summary of the same material. So the
migration's central rule is now broken in the root file itself:

> one claim, one place — `standards/README.md`

Three duplications, verified line by line:

| Root file | Already stated in | Verdict |
|---|---|---|
| `### Module System` folder list, 1,007 B — twelve entries with a gloss each | `modules.md:9–26` §Structure, same twelve entries, same glosses, as a tree | delete from root |
| "Only `services/` and `index.ts` are universal… `file` is the one today", 322 B | `modules.md:27–29`, near-verbatim | delete from root |
| `ProductOptionService` + cascade-graph-per-module, 523 B | `modules.md:53–56`, same two claims | **the second half stays** — see below |
| "Two edges point upward and are declared composition roots", 254 B | `framework/README.md` §"Three composition roots, one bootstrap" — which counts *three*, so the root file is both duplicated and wrong | delete from root |

`AGENTS.md:170` already ends the folder list with *"Full table:
`standards/rules/backend/modules/__docs__/modules.md`"*. The pointer is there; the thing it points at
was copied above it anyway.

## The line this ticket draws

A claim stays in the root file if an agent needs it **before opening a file** — while choosing where
something goes, or whether to add a module at all. It moves if it is needed **while writing one**,
because a `.claude/rules/` `paths:` match fires then and `AGENTS.md` is not the cheapest place to
keep it.

This is the same constraint P1.7 recorded from `docs/research/agents-md-standard.md` §3 — `paths:`
scoping is Claude-Code-only, and Codex never reads below cwd — so **a claim may only leave the root
file if it is inert unless you are already in that folder**. Apply it per claim, not per subsection.
It is what keeps `### Cross-Module Patterns` almost entirely in the root: choosing between a link
module, a workflow and a subscriber happens while there is nothing open at all.

## What moves, measured

Whole section: 7,627 B. Every figure below is the block including its own heading and trailing blank
line, measured against the current file — re-measure before starting, because 04 is in flight.

### `### core/ and framework/` — 2,244 B → ~700 B

| Block | Bytes | Where it goes |
|---|---:|---|
| The `known` / `runs` one-test blockquote | 315 | **stays.** The placement decision itself; made before a file exists |
| The one-way dependency + the layer rule + ADR-0026/0027 | 361 | **stays.** Constrains a design, not a line of code |
| The three-row folder table | 720 | `apps/backend/src/core/README.md` and `framework/README.md` — split, each side into its own file. Mechanism, and lookup while writing |
| "A port lives in `core/` so that…" | 292 | `apps/backend/src/core/README.md`, which already has §"What a port costs at runtime" and is where this belongs |
| "Two edges point upward…" | 254 | **deleted.** `framework/README.md` already says it, and says *three* |

### `### Module System` — 2,230 B → ~750 B

| Block | Bytes | Where it goes |
|---|---:|---|
| "the list is closed — eight folders and four root files" + the rule name | 227 | **stays**, one sentence. That the list is closed is planner-facing; *what is on it* is not |
| The twelve-entry folder list | 1,007 | **deleted** — `modules.md` §Structure |
| "Only `services/` and `index.ts` are universal…" | 322 | **deleted** — `modules.md:27` |
| "Modules: auth, cart, customer…" | 131 | **stays.** A planner needs to know whether the module already exists |
| `ProductOptionService` — a module too large for one service splits internally | ~260 | **deleted** — `modules.md:53` |
| "Splitting into two *modules* is usually not the alternative, because the cascade graph…" | ~263 | **stays.** This is the one genuinely planner-facing sentence in the subsection: it decides *add a module or extend one*, and it decides it before anything is open. Keep it even though `modules.md:55` repeats it — the duplication is deliberate here, and say so in a comment-free way by keeping the root copy one sentence and letting `modules.md` carry the reasoning |

### `### Two-Container Bootstrap` — 360 B → ~180 B

"Modules cannot access each other's internals; only the service is exposed" **stays** — it is the
premise that makes link modules and workflows necessary, so a planner who loses it designs a
cross-module read that cannot be written. The `ContainerRegistrationKeys` list (`GET_DB`,
`DB_PROVIDER`, `LOGGER`, `LINK`, `EVENT_BUS`) is lookup → `modules.md`, or `core/README.md` if it
fits §"What a port costs at runtime" better. Judgement call; take it and note which you took.

### `### Cross-Module Patterns` — 883 B → ~600 B

**Mostly stays.** The three-way choice is the most planner-facing content in the whole section.
Compress each bullet to the choice and its consequence, and let the existing pointer carry the rest:

- Link module — a cross-module join table; `LinkService.repo(…)`. The writeable/readonly distinction
  is a writing-time detail → wherever link modules are documented. **Check first:** there is no
  `standards/rules/backend/link-modules/`, so if nothing holds it, keep it in the root rather than
  inventing a directory for two sentences. Say which you found.
- Workflow — cross-module orchestration with compensation; replay-pure. Keep the pointer.
- Subscriber — off the critical path, idempotent, published from a workflow's final step. Keep the
  pointer to `subscribers/__docs__/` and ADR-0023/0024.

### `### Server & Routing` — 1,009 B → ~250 B

Six bullets, five of them lookup while writing a route. `.claude/rules/backend-api.md` already fires
on `apps/backend/src/api/**` and `routes.md` §Structure already holds the `route.ts` ↔
`definitions.ts` shape, `throws`, and the webhook carve-out.

**Stays:** one sentence that adding an endpoint means a `route.ts` and a `definitions.ts` written
together, pointing at `backend/api/__docs__/`. **Moves:** `src/routes.ts`, `framework/http/ports.ts`
and `framework/runtime/{hono,express}/app.ts` → `framework/README.md`, which already has §"A request,
end to end" and is the right place for the three files that make one. `qs` nested operators → the
same README or `routes.md`; it is already true of both frontends, so check `routes.md` first.

### `### Key Conventions` — 876 B → 0

All six are write-time. None changes a plan.

| Bullet | Where |
|---|---|
| `getDb` is a factory; `getClient(context?)` | `modules.md` — repositories live in modules |
| `createWithTransaction` / `this.withTransaction(context, …)` | `modules.md` |
| The date pipeline, `dateToIso`, `z.input` not `z.infer` | **check `http-schemas` first** — this claim spans the backend and the package, and may already live there. If it does not, it is the one candidate for staying, because a DTO shape is decided while planning an endpoint |
| Soft-delete by default, `deletedAt`, BaseRepository auto-filters | `docs/soft-delete-cascade.md` already exists — verify, then point or move |
| SQL-level prefixed IDs | `modules.md` |
| `DbProvider`: node singleton pool vs workerd per-request | `core/README.md` §"What `db/` does when a repository runs" |

**Net: roughly 7,627 → ~2,500 B, about 5,100 B out — 21% of the file.** Two-thirds of it is deletion
of text that exists elsewhere, not relocation.

## The pointer layer gains two files

`.claude/rules/` has no pointer for the two largest bodies of backend code:

```
.claude/rules/backend-modules.md
  paths: apps/backend/src/modules/**
  → standards/rules/backend/modules/__docs__/README.md

.claude/rules/backend-core-framework.md
  paths: apps/backend/src/core/**, apps/backend/src/framework/**
  → apps/backend/src/core/README.md, apps/backend/src/framework/README.md, ADR-0026, ADR-0027
```

Same shape as the existing seven: what the area is, and the document to read. **No convention of its
own**, so there is nothing in them that can drift.

The second one points at READMEs rather than a `__docs__/`, which is correct and worth noticing —
`core/` and `framework/` have no use-case documents because you do not set out to "write a
`framework/` file"; you set out to write a route or a workflow and discover where a piece of it
lives. That is mechanism, and mechanism lives in the code directory's README.

## Acceptance

- [ ] `## Backend Architecture` is under 2,800 bytes, and every claim removed from it is present in
      exactly one of the receiving documents named above — checked by opening each one, not assumed
- [ ] The three duplicated blocks are **deleted**, not moved: nothing new appears in `modules.md` or
      `framework/README.md` for them
- [ ] The `core`/`framework` one-test blockquote, the one-way dependency rule, the closed-list
      sentence, the module list, the cascade-graph sentence, the container isolation premise and the
      three-way cross-module choice all survive in the root file
- [ ] Two new `.claude/rules/` files, each pointing and nothing more
- [ ] `pnpm run verify` green — `standards/README.md`'s own claims about where documents live must
      still hold, and `check:standards` covers the rule files the docs' `## Enforcement` tables name
- [ ] Every path named in the rewritten section resolves. There is still no gate for this; check by
      hand and say so in the reply

## Notes

**Do not create a new `standards/rules/backend/<area>/` for orphaned prose.** Two candidates will
tempt you — link modules and the persistence conventions. A rule directory with a `__docs__/` and no
rules in it is a directory that exists to hold a paragraph. If the prose has no home, the honest
outcomes are *keep it in the root* or *put it in the nearest code README*, and either is better than
a directory named after a document.

**The `modules.md` duplication that stays is a decision, not an oversight.** The cascade-graph
sentence is the only claim in this ticket deliberately kept in two places, because it is read at two
different moments — once while deciding whether to add a module, once while writing one. Every other
duplication is deleted. If a future doc-link/structure gate flags it, this paragraph is the recorded
reason.

# 03 — The `.claude/rules/` pointer layer

**What to build:** a `.claude/rules/*.md` file per documented area, `paths:`-scoped to that area,
carrying **no convention of its own** — what the area is, and the `__docs__/` document to read before
writing that kind of file. Nothing else, so there is nothing in it that can drift. Then the matching
`AGENTS.md` sections are cut down to nothing, because the pointer has replaced them.

**Blocked by:** 01, for the backend documents these point at. The three frontend rule files can be
written before 01 lands — their `__docs__/` already exist.

**Status:** needs-a-decision-first — see *The constraint that shapes this* below. Everything after it
is ready.

**Spec:** `.scratch/agents-md/spec.md`, P1 item 7. This is the phase that turns the migration into
the always-on token cut.

---

## Why

`AGENTS.md` is **383 lines / 27,298 bytes**, loaded in full at the start of every session, for every
task. `/context` reports it at 9.8k tokens. A storefront CSS change pays for the subscriber
idempotency contract and the Temporal transport split; a backend migration pays for the admin
DataTable system.

`paths:` is the only mechanism that fixes that, and it is exact about when it fires:

> "Rules can be scoped to specific files using YAML frontmatter with the `paths` field. These
> conditional rules only apply when Claude is working with files matching the specified patterns. …
> Rules without a `paths` field are loaded unconditionally and apply to all files. **Path-scoped
> rules trigger when Claude reads files matching the pattern, not on every tool use.**"
> — via `docs/research/agents-md-standard.md` §4

---

## The constraint that shapes this

**Read `docs/research/agent-memory-and-write-time-determinism.md` §6.2 before writing a line.** It
looked at this exact mechanism for the store's folder vocabulary and concluded the opposite of what
this ticket proposes:

> "**That is precisely the shape with the documented gap.** It would not be in context for a planner,
> would not survive compaction unless a matching file were re-read, and would be skipped outright by
> the Explore and Plan subagents. If that rule is written, it should be written **without** `paths:`
> frontmatter."

Three separate holes, all verified against vendor docs:

1. **Planners see no rules at all.** *"The built-in Explore and Plan agents skip this… There is no
   frontmatter field or per-agent setting to change which agents skip them."* A plan can therefore
   specify something that breaks a contract it never read.
2. **Compaction drops a scoped rule** unless a matching file is read again afterwards.
3. **Codex has no glob mechanism whatsoever** (§4's table: *"mechanism does not exist"*), and never
   reads below cwd. Anything that leaves `AGENTS.md` is invisible to it.

That does **not** sink the ticket, but it sharpens its test. The spec says a rule may move if it is
"inert unless you are already in that folder". The accurate test is stricter:

> **Can this be violated by a decision taken *before* any matching file is read?**
> If yes, it stays in `AGENTS.md`, unscoped. If no, it may be a scoped pointer.

A pointer that says *"read `routes.md` before adding a route"* passes: the route gets written in the
main conversation, after a file in `src/api/` has been read. A rule that says *"a feature folder may
hold only these seven names"* fails: it is violated by a plan, which is the failure that started
`.scratch/frontend-conventions/` in the first place.

**Closing the planner gap is out of scope** and stays that way — `.scratch/agent-context/spec.md`
records the fix as making `to-spec` / `to-tickets` carry constraints into the spec file, as its own
pass.

---

## What moves, and what it is worth

Measured against `AGENTS.md` at 383 lines / 27,298 bytes.

### Clearly inert until you are in the folder — move these

| Section | Bytes | Rule file | `paths:` |
|---|---:|---|---|
| `### Adding a Subscriber` | 2,561 | `backend-subscribers.md` | `apps/backend/src/subscribers/**`, `apps/backend/src/core/event-bus/**` |
| `### Where a Route Helper Goes` | 1,180 | `backend-api.md` | `apps/backend/src/api/**` |
| `### API Layer` | 706 | `frontend-feature-api.md` | `apps/{admin,store}/src/features/*/api/**` |
| `### Admin DataTable System` | 484 | `admin-data-table.md` | `apps/admin/src/components/data-table/**` |
| `### Route-Driven Modals` | 221 | `admin-route-modals.md` | `apps/admin/src/**` |
| `### Form Hooks` | 323 | `frontend-form-hooks.md` | `apps/{admin,store}/src/features/*/hooks/**` |

**≈ 5,475 bytes, about 2.0k tokens off every session.**

### Judgement calls — decide each against the test above and record the reason

| Section | Bytes | The question |
|---|---:|---|
| `### Module System` | 1,993 | The closed folder list is violated by a *plan* that invents a folder. But `module-holds-only-known-file-kinds` fails the gate, so the damage is bounded. Leaning **stays** |
| `### Key Conventions` | 856 | `getDb` as a factory, `withTransaction`, date handling, soft-delete. Applies to any backend file, so `apps/backend/**` — broad, but it still buys a storefront session the whole thing |
| `### The four test levels` | 3,002 | **Leaning stays.** "Never fake our own API in an e2e test" is decided while designing the test, often before any file under `tests/` is opened. This is the clearest case of the §6.2 hole |
| `### Test data comes from factories` | 2,027 | Same shape, weaker: `await using`, factory lookup and `.first()` are decided while typing, not while planning. Leaning **moves**, scoped to `apps/*/tests/**`, `apps/backend/tests/**` |

If everything in both tables moved it would be ~11.5 KB, roughly 4k tokens. The conservative set is
~5.5 KB. **Do not chase the larger number** — a rule that should not have moved costs a contract, and
the tokens are cheaper than that.

### Never moves

`## Commands`, `## Project Structure`, `## Code Style`, `## Documentation`, and the `AGENTS.md`
statements that must hold everywhere. Codex reads only this file.

---

## The shape of a rule file

Five lines of body, and no more. The whole point is that nothing in it can drift from the document.

```markdown
---
paths:
  - "apps/backend/src/api/**"
---

# API routes

Route files, their definitions and their middlewares live here. Before adding or changing a route,
read `standards/rules/backend/api/__docs__/README.md` and the document it routes you to.
```

**No claims, no summaries, no "the three non-negotiables".** A summary is a second copy of the
contract and will be the stale one. If a reader needs the contract, the file names where it is.

---

## Acceptance criteria

- [ ] `.claude/rules/` exists, tracked in git — `.claude/` is committed apart from
      `settings.local.json`, so these are shared with the team rather than machine-local
- [ ] One file per area, each with `paths:` as a YAML list of quoted globs. Brace expansion is
      supported and budgeted at 1,000 expanded patterns / 4 MiB per rule
- [ ] **No rule file states a convention.** Grep your own output: if a line could be violated by
      code, it belongs in the `__docs__` document, not here
- [ ] Every `__docs__` path named in a rule file resolves, and points at the directory's `README.md`
      index or a named document — not at a file that ticket 01 deleted
- [ ] The matching `AGENTS.md` section is **deleted**, not shortened to a pointer. Two pointers to
      one document is the duplication this layer exists to remove
- [ ] Each judgement call in the second table above is decided, and the reason recorded in the PR
      against the "violated by a decision taken before a matching file is read" test
- [ ] **Each rule is proved to load, and proved not to load.** Open a file inside its `paths:` and
      confirm `/context` lists the rule; start a session that touches only unrelated files and
      confirm it does not. A scoped rule that never fires is a contract that silently left the repo
- [ ] `AGENTS.md`'s new size is recorded in the PR alongside the `/context` token figure before and
      after, so the claim this phase makes is measured rather than asserted
- [ ] `npm run verify` green — nothing here touches code, so a failure means something else moved

---

## Notes

**This layer is Claude-Code-only, and that is a stated cost rather than an oversight.** Codex, Cursor
and Copilot see none of it; Codex could not even if it wanted to. The mitigation is the test above:
anything that must hold for every tool never leaves `AGENTS.md`. Say this in the PR so the next
person does not discover it as a surprise.

**Prefer one rule per area over one rule per document.** `backend-api.md` points at the api
`__docs__/README.md`, which routes to `routes.md` or `route-helpers.md`. That index already exists
to do the routing, and duplicating it in frontmatter is a second map to keep in step.

**Do not use this layer to smuggle content out of a document.** If a `__docs__` document is too long,
the answer is that it holds more than one use case — split it there, per `standards/README.md`.

**Watch the glob breadth.** `apps/backend/**` for `### Key Conventions` is defensible because it
still excludes every storefront session. `**` is not a scope and is the same thing as leaving the
text in `AGENTS.md`, minus the visibility.

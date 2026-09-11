# 01 — The backend's use-case docs move into `__docs__/`

**What to build:** the four backend guides that live beside the code are split along the line
`standards/README.md` draws. Their use-case halves become `__docs__/` documents under
`standards/rules/backend/`, one file per use case, each with an `## Enforcement` table naming the
rules that hold it. What is left of each guide is mechanism, and three of the four have none, so
those files are deleted.

**Blocked by:** nothing. The vocabulary (`847249ab`) and its application (`52b32f24`) have landed,
and `standards/README.md` already carries both the decision table and the document layout this
ticket follows.

**Status:** ready-for-agent

**Spec:** `.scratch/agents-md/spec.md`, P1 item 6.

---

## Why

All 20 frontend rules sit in a `## Enforcement` table in a `__docs__/` document. **All 13 backend
rules sit in none.** The frontend half already is the standard; the backend half was never migrated,
and `standards/README.md` says so in the paragraph that ends "*The backend half has not been migrated
yet*". This closes that, and it is the precondition for the `.claude/rules/` pointer layer (spec
item 7) that turns the migration into the always-on token cut.

## Read first, in this order

1. `standards/README.md` — **"Where a document goes"** for the criteria, **"Where the prose goes"**
   for the `__docs__/` rules, and **"How a doc is laid out"** for the section order. Do not restate
   any of it in a new document; everything general about rules lives in that README by design.
2. `standards/rules/frontend/features/hooks/__docs__/form-hooks.md` — the reference document.
   192 lines, and the section order it uses is the order to copy.
3. `standards/rules/frontend/features/hooks/__docs__/README.md` — the reference index. 12 lines:
   lead, table, one closing line about how the documents relate. Nothing else, and **no use case is
   ever explained in an index**.
4. The four sources, listed below.

Existing `__docs__` documents run **95–192 lines**; indexes run **12–20**. A document coming out
much longer than 192 is a signal it holds more than one use case.

---

## The four targets

### `standards/rules/backend/api/__docs__/` — 8 rules

Source: `apps/backend/src/api/README.md` (343 lines). Every one of its eight sections is use case,
so **the file is deleted**, with no signpost left behind.

| Source section | ln | Goes to |
|---|---:|---|
| File Structure | 13 | `routes.md` §Structure |
| What May Live Here | 18 | `routes.md` §Structure — the closed four-file-kind vocabulary |
| Where a Route Helper Goes | 140 | **`route-helpers.md`** — the whole document |
| Route Handler Pattern | 87 | `routes.md` §Shape + §Rules |
| Response Type Rules | 6 | `routes.md` §Rules |
| Status Codes | 8 | `routes.md` §Rules |
| Definition File | 51 | `routes.md` §Rules |
| Checklist for Adding a New Endpoint | 8 | `routes.md`, at the end |

**Two documents, not three.** Four of the rules are about `route.ts` ↔ `definitions.ts` agreement,
which reads like a third contract. It is not: you write both files in one sitting, so it is one
thing someone sets out to build. The scatter test in `standards/README.md` agrees — the rules all
live in one directory, so nothing signals an unsliced document.

### `standards/rules/backend/workflows/__docs__/` — 4 rules

Source: `apps/backend/src/workflows/README.md` (114 lines) → `workflows.md`.

§Directory Layout → §Structure. §Three Building Blocks → §Shape. §When to Use What and §Key Rules →
§Rules. Judge §Three Building Blocks against the imperative test as you go: if a paragraph can only
be written as a description of how the engine runs a step, it is mechanism and the README survives
holding it. If nothing is left, delete the file.

### `standards/rules/backend/modules/__docs__/` — 1 rule

Sources: `apps/backend/src/modules/README.md` (99 lines) **and** `docs/adding-a-module.md`
(396 lines, ten numbered steps plus a checklist).

`docs/adding-a-module.md` must move: it explains how to build something that lives in one area,
which the criteria no longer allow `docs/` to do. `src/modules/README.md` §Adding One is already a
three-line pointer at it, so the two are one document that was split across two directories.

### `standards/rules/backend/subscribers/__docs__/` — 0 rules, new directory

Source: `apps/backend/src/core/event-bus/readme.md` (313 lines). **This is the one source that keeps
a substantial README**, and the split is the point of the ticket in miniature.

| Source section | ln | Verdict |
|---|---:|---|
| Quick start | 31 | use case → `events.md` or `subscribers.md`, whichever it is teaching |
| Architecture | 27 | **mechanism — stays** |
| Adding an event | 15 | use case → `events.md` |
| Dispatch identity | 16 | **mechanism — stays**, but the "be idempotent against `dispatchId`" instruction goes |
| Subscribers must be idempotent | 10 | use case → `subscribers.md` |
| Publishing resolves on acceptance, not on completion | 22 | split: the guarantee stays, "throwing is how you ask for a retry" goes |
| Choosing an adapter | 21 | **mechanism — stays** |
| The node transport | 33 | **mechanism — stays** |
| On workerd | 47 | **mechanism — stays** |
| The generated registry | 14 | use case → `subscribers.md` (regenerate and commit) |
| Testing | 38 | use case → `subscribers.md` |
| Subscribers, and what each one is for | 14 | → `subscribers.md` §Examples |
| Decisions | 4 | stays — it is a pointer to ADR-0023 / ADR-0024 |

`events.md` and `subscribers.md` are two use cases because they are two sittings: you add an event
because a subscriber wants it, but adding one to an existing event is the common case and never
touches `events.ts`.

A `__docs__/` with no rules is allowed — `standards/README.md` says a directory appears when its
first rule *or its first document* does, and `data-hooks.md` is the precedent. But zero is a fact
about today, not a resting place: ticket **02** turns the checkable claims here into rules, including
two this directory should own (`SubscriberConfig` carrying its event type argument, and `config`
setting `name`). Write `## Enforcement` as one line saying nothing checks this **yet**, and put every
unchecked claim in `## What is deliberately not enforced` with its reason — that section is 02's
input, so the more precise it is here the less 02 has to rediscover.

---

## Rule → document

Every one of the 13 lands in exactly one `## Enforcement` table. The rule's `note:` is updated in
the same edit to end with the repo-relative path of that document — **never the index**.

| Rule | Document | Note points at today |
|---|---|---|
| `route-declares-helper-function` | `api/__docs__/route-helpers.md` | `apps/backend/src/api/README.md` |
| `route-chains-mutations-on-one-service` | `api/__docs__/route-helpers.md` | `apps/backend/src/api/README.md` |
| `delete-route-returns-shared-response` | `api/__docs__/routes.md` | `apps/backend/src/api/README.md` |
| `route-declares-unread-context-query` | `api/__docs__/routes.md` | — none |
| `route-omits-context-query` | `api/__docs__/routes.md` | `docs/middleware-and-openapi.md` |
| `route-declares-unthrown-error` | `api/__docs__/routes.md` | — none |
| `route-throws-undeclared-error` | `api/__docs__/routes.md` | `docs/middleware-and-openapi.md` |
| `route-omits-workflow-errors` | `api/__docs__/routes.md` | — none |
| `workflow-declares-unthrown-error` | `workflows/__docs__/workflows.md` | — none |
| `workflow-throws-undeclared-error` | `workflows/__docs__/workflows.md` | — none |
| `workflow-parallelises-steps` | `workflows/__docs__/workflows.md` | `apps/backend/src/workflows/README.md` |
| `workflow-util-is-not-pure` | `workflows/__docs__/workflows.md` | `apps/backend/src/workflows/README.md` |
| `model-without-standard-timestamps` | `modules/__docs__/modules.md` | `docs/soft-delete-cascade.md` |

Two of these need care.

**`route-omits-workflow-errors` does not live in `backend/api/`.** It sits one level up at
`standards/rules/backend/` on purpose — `standards/README.md`'s tree says the error contract spans
routes and workflows, so the rule belongs to neither directory. Its `files:` glob is
`**/src/api/**/route.ts`, so its claim is about a route file: put it in `routes.md`'s Enforcement
table and have `workflows.md` §Relationship with routes link across. Do **not** move the rule file
to make the directories line up; the existing comment explains why it is where it is.

**`model-without-standard-timestamps` currently points into `docs/soft-delete-cascade.md`**, which
spans modules *and* `apps/backend/scripts/checks/`, so it stays in `docs/`. Point the note at
`modules.md`, put the Enforcement row there, and cross-link to `soft-delete-cascade.md` for the
cascade machinery. Whether that guide should fold too is **out of scope** — say so in the PR rather
than deciding it here.

---

## The one open call

**Is `backend/modules/__docs__/` one document or two?** `src/modules/README.md` (99 ln) plus
`docs/adding-a-module.md` (396 ln) is roughly 450 lines against a 192-line house maximum.

- *One* — "adding a module" is a single thing someone sets out to build, and the layout is what they
  must produce. Honest to the rule, but the result is more than twice the length of any existing
  document.
- *Two* — `modules.md` for what a module is and the closed layout, `adding-a-module.md` for the ten
  wiring steps. Two files, and a reader adding their first module needs both.

**Recommended: two**, on the grounds that the ten steps are read once per module while the layout is
read every time anyone opens the folder — different moments, different readers, which is the same
test that split form hooks from form components. Read both sources before committing to it, and
record the call and its reason in the PR either way.

---

## Every live pointer that has to move

Deleting a file that something names is the failure mode here. These are all of them outside
`.scratch/` and `docs/research/`, which keep their old text.

| File | Line | Points at |
|---|---:|---|
| `AGENTS.md` | 122 | `apps/backend/src/modules/README.md` |
| `AGENTS.md` | 162 | `apps/backend/src/api/README.md` |
| `AGENTS.md` | 194 | `apps/backend/src/core/event-bus/readme.md` |
| `AGENTS.md` | 370 | `docs/adding-a-module.md`, in the cross-cutting list |
| `AGENTS.md` | 372–373 | the "have not been split yet" sentence — delete it, it is what this ticket resolves |
| `standards/README.md` | ~156 | the `backend/` rows of the tree diagram, and the paragraph below it |
| `apps/backend/README.md` | 58 | `src/core/event-bus/readme.md` |
| `apps/backend/src/api/store/carts/[id]/shipping-options/route.ts` | 25 | *"Several reads, even across modules" in `src/api/README.md`* → `route-helpers.md` |
| `docs/adr/0023` | 205 | `event-bus/readme.md` — survives, that README is not deleted |
| `docs/adr/0024` | 67 | `src/core/event-bus/readme.md` — check which half the claim landed in |
| `standards/rules/backend/workflows/workflow-parallelises-steps.yml` | 5 | in the `note:`, covered by the rule table above |

`AGENTS.md` §Backend Architecture also restates much of what these documents will hold — **leave it
alone in this ticket.** Trimming it is spec item 7, and doing both at once makes the diff impossible
to review.

---

## Acceptance criteria

- [ ] Four `__docs__/` directories exist under `standards/rules/backend/`, each with a `README.md`
      index that is lead, table, and at most a line or two on how the documents relate. No use case
      is explained in an index, "not even a small one, not even the only one in the directory"
- [ ] Each document follows the section order in `standards/README.md` → "How a doc is laid out",
      omitting sections that would be empty and reordering none
- [ ] Each document's `## Enforcement` opens with the two-column table and nothing else, and the
      claim in the right-hand column is the paragraph above it — not a paraphrase of the rule
- [ ] All **13** backend rules appear in exactly one Enforcement table. `for f in $(find
      standards/rules/backend -name '*.yml'); do …` over the ids, grepped against the `__docs__`
      tree, returns no misses
- [ ] Every backend rule's `note:` ends with the repo-relative path of its document. Four have no
      document path at all today and gain one; none points at a `README.md`
- [ ] `## What is deliberately not enforced` is filled in, not omitted. The route-helper placement
      rules, the idempotency requirement and the "publish from the final step" ordering are all
      claims no rule checks — `form-components.md` is the model for how to write them
- [ ] `apps/backend/src/api/README.md` is deleted. `src/modules/README.md` and
      `src/workflows/README.md` are deleted unless a mechanism half genuinely survives, and the PR
      says which and why
- [ ] `apps/backend/src/core/event-bus/readme.md` keeps its mechanism half and nothing else — no
      "adding an event" section, no checklist, no file-shape list
- [ ] `docs/adding-a-module.md` no longer exists in `docs/`
- [ ] Every pointer in the table above resolves. `grep -rn` for each deleted filename across
      `AGENTS.md`, `apps/`, `docs/` and `standards/` returns nothing
- [ ] **The rules still bite.** Break one claim per new document and confirm the `standards` gate
      goes red, then restore: drop `...timestamps` from a model; declare a `throws` nothing raises;
      wrap two `ctx.step` calls in `Promise.all`; declare a helper function in a `route.ts`. Say in
      the PR that you ran them
- [ ] `npm run verify` green

---

## Notes

**This is a move, not a rewrite.** The prose in these four guides is good and was argued over. Split
it, re-order it into the house sections, and cut only what is duplicated between the halves. A
paragraph you cannot place is a signal about the split, not licence to delete it.

**One claim, one place.** Where a use-case document needs mechanism to make sense it links to the
surviving README section; it never restates it. Two copies are two things to keep in step and the
second is always the stale one.

**Do not leave signpost files.** A directory whose prose is entirely use case keeps no `README.md`.
This was decided explicitly: a pointer file is a second place to keep in step, and a rule's `note:`
already names the document at the moment it is needed.

**Do not write rules in this ticket — produce the list instead.** Several claims in these guides are
checkable and unchecked, and ticket **02** exists to close them: the survey there found nine to
thirteen new rules, every one with zero violations in the tree today. Your job here is the input to
it. As you move each claim, decide whether a rule could express it, and write the answer into
`## What is deliberately not enforced` with the reason — *"no rule checks this"* on its own is not a
verdict. Anything 02's table does not already list, add to it.

Mixing the two is what makes this a separate ticket, not the size: a doc move is reviewed by reading
prose, a new rule is reviewed by running it red. One diff cannot be both.

**Nothing checks any of this yet.** There is no gate for index completeness, Enforcement-table
coverage or `note:` path resolution — that is parked in `.tasks/next-todos` under
DOC-LINK / DOC-STRUCTURE GATE, with the findings from a removed prototype. So the acceptance
criteria above have to be checked by hand this time.

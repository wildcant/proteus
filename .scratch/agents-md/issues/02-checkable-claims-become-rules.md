# 02 — Every claim that can be a rule becomes one

**What to build:** the claims in the four backend guides that no check enforces are worked through
one at a time. The ones a rule can express get a rule and a rule test. The ones it cannot get a
recorded verdict in `## What is deliberately not enforced`, naming what was tried.

**Blocked by:** 01. The documents have to exist before their `## Enforcement` tables can gain rows,
and 01's per-claim verdict list is this ticket's input.

**Status:** done — four rules landed, three candidates closed without one. See *Outcome* below.

**Spec:** `.scratch/agents-md/spec.md`, P1 — the "a convention that can be checked is checked" half.

---

## Why

`standards/README.md` already says it: *"A convention that can be checked is checked, and the check
is a rule file. Reach for a script only after showing a rule cannot express it."* The backend guides
have been written for a year against thirteen rules. The gap is not that the claims are
unenforceable — it is that nobody has gone through them.

**The survey below found nine to thirteen new rules, and every one of them is preventive: zero
violations in the tree today.** That is the whole case for doing this now. The cost is writing the
rule and its test, not a cleanup, and each one closes a hole that is currently open.

---

## The survey

Counted against `apps/backend/src` on 2026-09-11. "Sites" is how many places the claim applies
today; "violations" is how many break it.

### Write these

| # | Claim | Source | Sites | Violations | How |
|---|---|---|---:|---:|---|
| A | **`as const` on `<Method>Throws` and `<Method>Middlewares`** | `api/README.md`: *"Without it TypeScript widens a mixed list … and silently discards what each middleware adds"* | 73 | 0 | Match the declarator whose initialiser is an array and whose name matches `Throws\|Middlewares`, with `not:` an `as const` assertion |
| B | **A webhook route answers with `WebhookReceivedResponse`** | `api/README.md` §Response Type Rules | 1 | 0 | Copy `delete-route-returns-shared-response` verbatim: `files: **/src/api/hooks/**/route.ts`, pattern `export const PostOutput = $OUT`, constraint `not: regex ^WebhookReceivedResponse$` |
| C | **A method export has a matching `<Method>Output`** | `api/README.md`: *"Each handler co-exports its `Input` and `Output` constants so the definition file can reference them"* | ~90 | 0 | File-level: pattern `export const GET = $$$`, `not: inside: kind: program … has: export const GetOutput = $$$`. `route-declares-unthrown-error` already uses this shape |
| D | **A `GET`/`PATCH`/`DELETE` handler answers 200** | `api/README.md` §Status Codes | ~90 | 0 | `return { status: $S, …}` inside the method export, constrained to `^200$`. **`POST` is excluded** — create is 201 and update is 200, and no AST distinguishes them |
| E | **A subscriber's `SubscriberConfig` carries its event type argument** | `event-bus/readme.md` + `AGENTS.md`: *"leave it off and the event union widens to every event, so the handler stops type-checking instead of failing to compile"* | 3 | 0 | `export const config: SubscriberConfig = $$$` — the bare type reference is the match |
| F | **A subscriber's `config` sets `name`** | *"required, and the dedup key — not derived from the filename"* | 3 | 0 | The object literal with `not: has: name` |
| G | **A `TODO` names its topic** | `workflows/README.md`: *"the repo's convention is a parenthesised topic (`TODO(locking)`, `TODO(pricing)`), not a bare TODO"* | repo-wide | **count it first** | Comment nodes are in the tree, so this is matchable — but confirm ast-grep binds them on this grammar before committing to it, and count the existing bare TODOs, because this is the one candidate that may carry debt |

C is four near-identical rules unless you find a way to bind `GET` → `Get` in one pattern; ast-grep
metavariables do not case-transform, so assume four and say so in the PR. D is three for the same
reason.

### Do not write these, and record why

| Claim | Verdict |
|---|---|
| **Never `HttpResult<any>`** (`api/README.md`) | **Already enforced.** Biome's `suspicious/noExplicitAny` is on through `preset: recommended` and fails the `lint` gate. A second rule would be a second place to keep in step |
| **Tests live in `__tests__/`** | **Already enforced** by `module-tests-live-in-a-tests-folder` in `structure/.dependency-cruiser.cjs` |
| **A third-party provider lives in `src/providers/`** | **Already enforced** indirectly — `modules/README.md` says `no-module-internals` catches it the moment it reaches for a repository. Confirm that is true rather than repeating the claim |
| **Publish from a workflow's final step** | **Not expressible as a rule.** "Final" is an ordering fact across sibling statements; a rule matches one node with constraints on its neighbourhood and cannot ask whether this `ctx.step` is the last one in the function. Only one call site exists today (`complete-cart.ts:582`). Worth a line in the "genuinely runtime" table if someone later writes it as a script |
| **Every subscriber is idempotent** | **Not expressible by anything.** It is a property of what the handler does with `event.dispatchId`, not of its shape. This is the single most load-bearing unchecked claim in the repo — say so plainly in `subscribers.md` |
| **Compensation reverses the action** | **Not expressible.** Same reason: a claim about what the code means, not what it looks like |
| **A database transaction beats compensation wherever it reaches** | **Not expressible.** It is a design judgement about where a mutation belongs. `route-chains-mutations-on-one-service` already catches the one shape of it that is syntactic |

---

## Acceptance criteria

- [ ] Each rule in the "write these" table exists at `standards/rules/backend/<area>/<id>.yml`, named
      for its id, with a test at `standards/rule-tests/<same path>/<id>-test.yml` holding the code it
      must flag and the code it must not
- [ ] Each rule's `note:` ends with the repo-relative path of the `__docs__` document that explains
      it — never an index — and that document's `## Enforcement` table gains the row
- [ ] `pnpm run check:standards:test` passes, and the rule count it reports has gone up by the number
      of rules added
- [ ] **Every new rule is proved able to fail.** For each: introduce the violation, confirm the
      `standards` gate goes red, restore. A rule that never matched its target prints exactly what a
      clean tree prints. List them in the PR
- [ ] Any rule that turns out to carry debt (G is the likely one) is landed with the debt fixed, or
      not landed at all. Do not ship a rule with an `ignores:` glob covering the existing violations
- [ ] Every "do not write" verdict above appears in a `## What is deliberately not enforced` section
      of the relevant document, in the shape `form-components.md` uses — the claim, then why no rule
      checks it
- [ ] Any candidate you evaluate and reject for a reason **not** in the table above is added to
      `standards/README.md` → "when a rule cannot express it", so the next person has to clear the
      same bar
- [ ] `pnpm run verify` green

---

## Notes

**The bar is "show it cannot be expressed", not "it would be awkward".** That is the repo's standing
demand and the reason `standards/README.md` keeps a rejected-tools list. If a rule is possible but
ugly, write it ugly and say so in the note.

**Preventive rules are the point.** Zero violations today is not an argument against a rule — it is
what makes the rule cheap. Every one of A–F is a hole that is open right now and costs nothing to
close; the next person to write a route or a subscriber is who it catches.

**Do not widen a rule to catch more.** `files:` globs stay as narrow as the claim. A rule for webhook
routes says `src/api/hooks/**`, not `src/api/**` with an exemption list.

**One rule per file, one claim per rule.** If a candidate needs two patterns to express, it is two
rules — `route-throws-undeclared-error` and `route-declares-unthrown-error` are the same claim in two
directions and are deliberately two files.

**Suppressions.** A considered exception is `// ast-grep-ignore: <id>` with the reason written above
it, and `--error=unused-suppression` fails the build the day it outlives the code. A JSX match cannot
carry one — not relevant to this ticket, every rule here is backend TypeScript.

---

## Outcome

**Four rules landed** and each was mutation-tested red then restored: `route-list-without-as-const`,
`route-method-without-output`, `route-returns-non-200-status`, `webhook-route-returns-shared-response`.
All 37 rules in the repo now appear in exactly one `## Enforcement` table, and all 37 own a test.

**Three candidates closed without a rule**, and the verdicts are recorded in `standards/README.md`
rather than here, because that is where the question gets re-asked.

| Candidate | Verdict |
|---|---|
| E — `SubscriberConfig` carries its event type argument | **Already enforced.** `TEvent` has no default, so omitting it is `TS2314` on the `typecheck` gate. Verified: *"Generic type 'SubscriberConfig' requires 1 type argument(s)"*. Pinned against regression by a `@ts-expect-error` in `src/core/event-bus/__tests__/subscriber-contract.test.ts`, which fails the build the day that line stops erroring |
| F — a subscriber's `config` sets `name` | **Already enforced.** `name` is required, so omitting it is `TS2741` on the `typecheck` gate. Verified: *"Property 'name' is missing … but required in type `SubscriberConfig<'bus.probe'>`"* |
| G — a `TODO` names its topic | **Not worth a rule.** A bare `TODO` is a note to a human, not a claim about what the code does; the cost of policing it exceeds what a parenthesised topic buys |

`standards/rules/backend/subscribers/` therefore holds no rules on purpose, and
`subscribers/__docs__/` says so. That is the "already enforced, somewhere that is not here" verdict
doing its job — a rule under `standards/rules/` for either E or F would be a second place to keep in
step with the type it duplicates.

**One gap left open.** E is pinned by a `@ts-expect-error`; **F is not.** Nothing in
`subscriber-contract.test.ts` covers a `config` written without `name`, so if the field were ever
made optional or given a default, the typecheck gate would simply stop erroring and no test would
notice. The fix is three lines in the file that already holds E's pin, following the same pattern.

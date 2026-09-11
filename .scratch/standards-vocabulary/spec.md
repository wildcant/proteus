# The words for the checking infrastructure

**Status:** ready. Four tickets, plus one recorded deferral. No behaviour change anywhere — every
check that runs today runs afterwards, under a different name.

Six words currently point at one concept — *a claim about our code that the build enforces*:
`standards/`, `packages/frontend-conventions`, `job_conventions`, `apps/backend/scripts/checks/`,
`deps-analyzer/`, and `rules/` (which means two different things in two places). The tell is
`scripts/verify.sh`'s own label for the job:

```
conventions) echo "Env usage, error, schema & standards conventions" ;;
```

An enumeration is what you write when no noun covers the bucket.

---

## The definitions

The distinction that was never written down, and that settles everything else:

> A **convention** is a practice this repo follows that nothing enforces yet.
> A **standard** is a convention with a check behind it.

`standards/README.md` already contains the thought — *"A convention that can be checked is
checked"* — it just never takes it as a definition. Once it does:

- `standards/` is named for what things **become** there. `data-hooks.md`, which has no rules
  behind it, stops reading as an anomaly in that folder and becomes the point of it — the README
  already argues that "a convention is worth writing down before it has hardened into something
  checkable".
- "Convention" recovers its plain English sense: customary, agreed, unenforced. Which is exactly
  what a checked rule is not.
- The superset word sits on the superset. A standard is the *claim*; a check is the *mechanism*.
  So a standard enforced by drizzle metadata belongs in the same gate as one enforced by ast-grep,
  and `job_conventions` → `job_standards` is the right direction rather than its reverse.

Five terms, to live in `standards/README.md`:

| Term | Means |
|---|---|
| **Convention** | A practice nothing enforces yet. Prose in a `__docs__/`. |
| **Standard** | A convention with a check behind it. The claim, not the mechanism. |
| **Check** | The executable that enforces one standard. |
| **Rule** | A check expressed declaratively as a file. A check that is *not* a rule is a script, and owes a recorded reason why a rule could not express it. |
| **Gate** | One job in `scripts/verify.sh`, grouping the checks that share a subject. |

Not in `CONTEXT.md`. That file is the e-commerce glossary — Product Option, Variant Title, Market.
Checking infrastructure is not domain language.

## The four kinds a standard can be about

| Kind | The claim | Where it lives | Gate |
|---|---|---|---|
| Contents | what a file holds | `standards/rules/`, plus the env/error/datetime/purity scripts | `standards` |
| Structure | which file may import which | `packages/frontend-structure`, each app's dependency-cruiser config | `structure` |
| Schema | facts that exist only once drizzle has built the table | `apps/backend/scripts/checks/` | `standards` |
| Currency | whether a committed generated file is stale | the two registry generators, run with `--check` | `generated` |

Contents and schema share a gate because a failure in either means the same thing to you: *the code
does not meet a standard*. Currency does not — it means *a generated file was not regenerated* —
and that is the finding that motivates ticket 03.

## What is being renamed

| From | To | Why | Ticket |
|---|---|---|---|
| — | five definitions in `standards/README.md` | nothing states the distinction | 01 |
| `@proteus/frontend-conventions` | `@proteus/frontend-structure` | its exports are `featureStructureRules` and `layerDirectionRules`, its research doc is `structural-rules-authoring.md`, and its own header calls it "the layout half of that standard". Five things around it say structure; the name is the one holdout | 02 |
| `job_conventions` | `job_standards` | the superset word on the superset | 03 |
| `job_deps` | `job_structure` | names the claim, not the tool | 03 |
| (two registry checks) | `job_generated` | they are not conventions at all | 03 |
| `apps/*/deps-analyzer/` | `apps/*/structure/` | nothing in it analyses anything — it holds a config declaring which import is allowed. Names the local end of the structural rules after the same word as the shared end | 04 |

Ticket 01 first. It is free — no file moves — and it is the rationale the rest cite. 04 needs 02
landed, so that `structure` already means something before a directory is named for it.

---

## Deferred, with the reason

**`apps/backend/scripts/checks/` → `scripts/schema-checks/`** is defensible and deferred.

The principle that separates it from the four above, and which is the thing to reuse next time:

> **Rename what misleads. Leave what merely underspecifies.**

`frontend-conventions` named the wrong half of a pair it was explicitly the counterpart to — a
reader was actively misled. `scripts/checks` is imprecise but not wrong: nobody reads it and
concludes something false. It is a directory called `checks/` in a repo where fourteen scripts are
named `check:*`, and its own `run.ts` header already supplies the distinguishing word — these are
*schema* checks, the ones that need drizzle to have built the table. The npm script says
`check:schema`; the folder is the part that does not.

Against that: 11 refs, including ADR 0016, two source comments, and two rows in
`standards/README.md`'s own verdict table. And a fifth runtime check that is not about the schema
would want the generic folder back.

Revisit if it moves for an independent reason. Deferring is recorded here so the next architecture
review does not re-propose it as though it were new.

**`deps-analyzer/` was deferred here and then promoted to ticket 04.** The hesitation was the four
ADRs that name the path; the decision that resolved it was to update them, paths only, leaving the
reasoning and the `**Status:**` lines untouched. Consistency with `frontend-structure` was judged
worth the mechanical edit. Recorded so the reversal is visible rather than looking like drift.

## Found along the way, and out of scope

`AGENTS.md`'s code-generation block is wrong twice:

```
# Code generation — all three are committed, and `verify` fails when they have drifted
pnpm run openapi:generate                         # OpenAPI spec → Orval clients (admin + store)
pnpm --filter backend run workflows:generate   # src/workflows → temporal/registry.gen.ts
pnpm --filter backend run subscribers:generate # src/subscribers → registry.gen.ts
pnpm --filter admin run generate-routes        # TanStack Router route tree
```

It lists **four** generators, says "all three", and only **two** are gated —
`check:workflow-registry` and `check:subscriber-registry`. There is no drift check for the Orval
clients and none for `routeTree.gen.ts`; `job_openapi` runs Spectral against the committed spec,
which is a different claim entirely.

Ticket 03 corrects the sentence, because naming the gate `generated` makes the claim it advertises
checkable at a glance. It does **not** add the two missing checks — that is real work with its own
design questions (a drift check needs the generator to be deterministic and runnable offline in the
gate) and belongs in its own spec.

## Not in scope

- Renaming `standards/` to `conventions/`. Considered and rejected: under the definitions above its
  contents are standards, and the unchecked prose beside them is what the folder exists to convert.
  97 occurrences across ~45 files to buy a nuance.
- Any change to what is checked, or to any rule's behaviour.
- `.scratch/frontend-conventions/` and `docs/research/*`. Working and research records — they
  describe what was true when they were written.

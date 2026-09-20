# Standards

Counterpart to dependency rules in each app `structure/.dependency-cruiser.cjs`.
Those say which file import which; these say what file *contents* must look like. Both
declarative — these run in `standards` gate of `pnpm run verify`, those in `structure` — and
neither is script.

```bash
pnpm run check:standards        # scan the repo
pnpm run check:standards:test   # run the rules' own tests
```

## The words

Repo had many names for one idea — claim about our code that build enforce — and no
one word cover it. Tell: `scripts/verify.sh` label job by listing the
bucket: *"Env usage, error, schema & standards conventions"* is what you write when no noun fit.
That gate now `standards`. Five words replace the list, defined here because this file
already front door to all. Not in `CONTEXT.md`, which is e-commerce glossary
and take domain language only.

Pair that do work is transition, not two labels: **convention harden into
standard the day someone write the check.** Nothing stay convention on purpose — convention
that can be checked is checked. Why prose with no rule behind it, `data-hooks.md`, belong
in folder called `standards/`: folder named for what things become there, and convention
worth writing down before it harden into something checkable.

**Convention**:
Practice this repo follow that nothing enforce yet — doc in `__docs__/`, paragraph in
`README.md`, or habit everyone have that nobody wrote down.
_Avoid_: standard, guideline, best practice

**Standard**:
Convention with check behind it. The claim about code, never the mechanism that test it —
so standard enforced by drizzle metadata and one enforced by ast-grep are same kind of thing,
and word sit above both.
_Avoid_: convention, rule, lint rule

**Check**:
Executable that enforce one standard. Check is mechanism, so it is thing that can be
slow, flaky, or impossible to write.
_Avoid_: standard, test, gate

**Rule**:
Check written declaratively as file, not as code — `.yml` under `standards/rules/`,
or dependency-cruiser rule in app config. Every other check is script — meaning check
written as code, not every executable under `scripts/`: `verify.sh` is script and enforce no
standard of its own, it run the gates.
_Avoid_: check (where distinction is the point), lint rule

**Gate**:
One job in `scripts/verify.sh`, grouping checks that share subject. Failing one name what is
wrong with code; it not name which tool noticed.
_Avoid_: check, suite, stage

Script therefore is check that could not be written as rule, and that is where standing
demand for recorded reason come from: it is the distinction, not separate policy. Reasons
live in [when a rule cannot express it](#when-a-rule-cannot-express-it).

### The six kinds a standard can be about

| Kind | The claim | Where it lives | Gate |
|---|---|---|---|
| Contents | what a file holds | `standards/rules/` | `standards` |
| Structure | which file may import which | `packages/frontend-structure`, each app's `structure/.dependency-cruiser.cjs` | `structure` |
| Schema | facts that exist only once drizzle has built the table | `apps/backend/scripts/checks/` | `standards` |
| Currency | whether a committed generated file is stale | the two registry generators, run with `--check` | `generated` |
| Resolution | what the lockfile resolved a declared package to | `scripts/checks/one-version.mts` | `versions` |
| Usage | whether a declared package is referenced by the workspace that declares it | `knip.jsonc` | `unused` |

Contents and schema share gate because failure in either mean one thing to reader: *the
code not meet standard*. Currency have its own, because failure there mean something
else — *generated file not regenerated*, which is generator to re-run, not code to
fix. Resolution have its own for same reason: nothing in source wrong, dependency
resolved twice, and fix is line in `pnpm-workspace.yaml`. Usage is neighbour of last two
and still third gate, because its fix is line *removed* from `package.json` and question
it ask is inverse of resolution — not what declaration resolved to, but whether anything
wanted it. Which tool enforce what, including two kinds this table leave to Biome and
Spectral, is [below](#which-standards-live-here-and-which-do-not).

## Where a document goes

First question, one answer per kind of prose. Ask in order.

**What did the reader arrive wanting?**

| They ask | It goes in |
|---|---|
| "How do I add one?" · "Where does this go?" · "What must this file contain?" | `standards/rules/<area>/__docs__/<use-case>.md` |
| "What happens when this runs?" · "Why does it behave that way at runtime?" | the `README.md` of the code directory it describes |
| "Why is it this way, and what did we reject?" | `docs/adr/` |
| "What does this word mean here?" — a domain word: cart, colourway, market | `CONTEXT.md` |
| "What does this word mean here?" — how we build and check: convention, standard, gate | [The words](#the-words), above |
| Something true across several areas and owned by none | `docs/<topic>.md` |
| Not finished yet | `.scratch/<feature>/` |

**If could be two**, three tie-breakers, in order:

1. **Imperative test.** Sentence that can be written as instruction to person typing —
   *"Publish from a workflow's final step"* — is use case. One that can only be written as
   description — *"the node transport is a Worker polling two queues"* — is mechanism.
2. **File-shape test.** Could rule ever check it, whether or not one do today? Claim about
   what *file* must look like is use case. Claim about what happen at *runtime* is mechanism.
3. **Ownership test.** One code area → that area `__docs__/`. No single owner → `docs/`. And
   corollary that keep `docs/` from growing second copy of everything: **`docs/` may not
   explain how to build something that live in one area.**

**Still undecided? `__docs__/`.** Misfiled instruction there still read at moment someone
writing that kind of code. Misfiled instruction in `README.md` read by nobody.

**One claim, one place.** Where use-case doc need mechanism to make sense it link to
`README.md` section; never restate it, same in reverse. Two copies of claim are
two things to keep in step, and second one always the stale one.

**What code directory `README.md` may not hold:** "adding one" section, checklist, or
file-shape or folder-vocabulary list. All three are use cases. Directory whose prose is entirely
use case therefore have **no `README.md` at all** — that is expected outcome, not gap, and it is
why `src/api/` not keep one. Nothing left behind as signpost: pointer file is second
place to keep in step, and rule `note:` already name the document at moment it is needed.

### What may be scoped, and what may not

Everything above decide *which file* claim go in. This decide whether claim may be put
somewhere that load **conditionally** — `.claude/rules/` file with `paths:`, nested
`CLAUDE.md`, or `__docs__/` doc reached from either. One line separate the two:

> **Scope "how to build X once you're building X." Never scope "which X to build."**

Path-scoped rule load when matching file is read, so it arrive *after* decision that file
under that path is what you write. DataTable column contract safe to scope: you
already inside `apps/admin/src/components/data-table/` when you need it, and path match fire at
that moment. Store route SSR side not: `defaultSsr: false` mean you pick which side route is
on **before file exist**, so nothing can path-match on it. Same for closed feature-folder
vocabulary — plan invent `src/features/{name}/reducers/` without reading single file under it.

Test is one question: **can this be violated by decision taken before any matching file is
read?** If yes, it belong in root `AGENTS.md`, unscoped.

Two things this is not. Not claim that scoping make rule more likely to be followed —
`docs/research/agent-memory-and-write-time-determinism.md` §4.1 rate just-in-time rules
context-budget mechanism and *"never an enforcement one"*, with no measurement of scoped-versus-
unscoped compliance anywhere. And not defeatable by configuration: §6.2 quote vendor docs
saying built-in Explore and Plan agents load no project rules at all, and that *"there is no
frontmatter field or per-agent setting to change which agents skip them."* So scoping buy bytes, and
rule that survive planner is one that was never scoped.

### Which standards live here, and which do not

`standards/` is front door, not whole house. What it not hold, it name:

| Standard | Lives in | Enforced by |
|---|---|---|
| What a file's contents must look like | `standards/rules/` | ast-grep — `check:standards` |
| Which file may import which | each app's `structure/.dependency-cruiser.cjs` | dependency-cruiser — `check:structure` |
| Formatting, naming, and the language rules | `biome.json` | Biome — `pnpm run check` |
| API design | `apps/backend/openapi/ruleset.yaml` | Spectral — `check:openapi` |
| Facts that exist only once drizzle has built the table | `apps/backend/scripts/checks/` | `check:schema` — and see [when a rule cannot express it](#when-a-rule-cannot-express-it) |
| One version of each declared dependency | `pnpm-workspace.yaml`'s `catalog:` and `overrides:` | `scripts/checks/one-version.mts` — and see [checks that read what no rule engine reads](#checks-that-read-what-no-rule-engine-reads) |
| That every declared dependency is referenced | `knip.jsonc` | knip — and see [checks that read what no rule engine reads](#checks-that-read-what-no-rule-engine-reads) |

First and third-from-last run in `standards` gate of `pnpm run verify`; import rules
run in `structure`, Biome in `lint`, Spectral in `openapi`, version check in `versions`, and
knip in `unused`.

## Where a rule goes

Tree mirror the code it govern, so rule have obvious home before anyone ask.
`frontend/` is shape both SPAs share — [bulletproof-react's project
structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md),
which `apps/store` and `apps/admin` both follow — minus `src/` segment, which is same for
every rule and so never tell two apart.

```
standards/
  rules/
    frontend/
      features/
        api/          query and mutation hooks
          __docs__/     README.md → query-hooks.md, mutation-hooks.md
        hooks/        form and data hooks
          __docs__/     README.md → form-hooks.md, data-hooks.md
        components/   feature-specific UI
      components/     shared UI
        __docs__/     README.md → form-components.md
      lib/            fetcher, form-hook, query keys
    backend/
      modules/        models, repositories, services
        __docs__/     README.md → modules.md, adding-a-module.md
      api/            route files
        __docs__/     README.md → routes.md, route-helpers.md
      workflows/      steps and compensation, and the replay-purity rules
        __docs__/     README.md → workflows.md
                      the error contract spans routes and workflows, so
                      `route-omits-workflow-errors` sits at `backend/` rather than
                      inside either one — as does `constructs-a-generic-error`,
                      which spans every directory under `src/`
      subscribers/    no rules yet — the documents arrived first
        __docs__/     README.md → events.md, subscribers.md
    http-schemas/     the shared Zod schemas
        __docs__/     README.md → schemas.md, datetimes.md
                      `packages/http-schemas` has no README of its own: its prose was
                      use case end to end, so it moved here and left no signpost
    env-read-outside-env-module{,-in-jsx}.yml
                      at the root, because the claim spans all three apps and belongs
                      to none of them. docs/configuration.md holds the prose
  utils/
    <same tree>/<util-id>.yml
                      sub-rules two or more rules share, referenced with `matches:`.
                      A util has no `severity` and reports nothing on its own
  rule-tests/
    <same tree>/<rule-id>-test.yml
    __snapshots__/    flat — ast-grep keys these by rule id, not by path
```

Rule declare exactly one `language:`, and ast-grep treat `typescript` and `tsx` as different
ones — `typescript` rule never open `.tsx` file, whatever its `files:` glob say. Claim that
hold in both is therefore two rule files, why `env-read-outside-env-module` have
`-in-jsx` twin. Only split rule for this when `.tsx` sites actually possible: backend have
no `.tsx` at all.

Directory appear when its first rule *or its first document* do — area documented
before it is checked get its `__docs__/` now and its rules when they harden. Rules spanning both
frontends live under
`frontend/`; rule for only one app say so in its own `files:` glob.

## Where the prose goes

Each rule directory carry `__docs__/` holding docs for use cases it govern — the
first row of table above, in layout rest of this section describe. Convention and check that
enforce it go stale together or not at all, and two directories apart is how they come apart: rule
get added and guide never hear about it. `__docs__/` rather than loose `.md` beside the
rules, same reason `rule-tests/` have `__snapshots__/`: one glance separate prose from
rules, and it sort to top.

**One use case, one file.** Every kind of thing this directory govern get its own document, named
for it. Two use cases never share file, and no use case ever explained in index — not even
small one, not even only one in directory. If you about to add section to `README.md`
describing how to build something, that section is new document.

This hold whether or not any rule enforce the use case yet. `data-hooks.md` have no rules behind it;
it is document because it is distinct thing someone build, which is only test that matter.
When it harden, rule land beside document already describing it — the
[transition](#the-words) is what this folder named for.

`README.md` reserved for index, and every `__docs__/` have one. Only file in there not
named for use case, and only one not about rules: it say what kind of code live in
this directory, then **route** — table naming each document beside it and job you would be
doing when you want that document. Lead, table, and at most line or two on how documents relate.
Nothing else.

Write those routing descriptions for someone who know what they try to build and not yet what
it is called here. "Reading data from the API" and "turning user input into a write" send reader to
right page; summary of rules on that page do not, because you cannot recognise contract
you not read yet. Leave rule ids, rule counts and rule detail to documents. Index is
map, and map that repeat territory is second thing to keep in step — same
reason use case cannot be documented in it.

Every rule `note:` end with repo-relative path to document that explain it, never to index.

Use case is thing someone set out to build, not same as feature. Form work used
to be single document under `docs/` covering both hook and button it render — two jobs,
done at different moments, governed by rules in two directories. Now two documents, each in
`__docs__/` beside its own rules, cross-linked where argument cross over. **Document whose
rules live in two directories has not been sliced yet**, and that is most reliable signal you
have: rules follow code, so if yours scattered, so is thing you describe.

Backend half migrated last, and `subscribers/` is what transition look like from
other end: no rules and four of documents it would need, because use case is thing
someone set out to build whether or not anything check it yet. Three of four source guides had
no mechanism left once their use cases lifted out and were deleted; `src/framework/event-bus/README.md`
kept its half — adapters, two transports, what each guarantee — and two documents beside
`subscribers/` link into it rather than restating any of it.

## How a doc is laid out

This is shape of document, not of index — index described above and have none of these
sections. Same sections in same order, so reader who read one know where to look in next.
Omit section that would be empty; don't reorder or rename ones you keep.

| Section | Holds |
|---|---|
| `# <Subject>` | a plural noun phrase — `Form hooks`, not `Form Hook Pattern` |
| *(lead)* | what this file covers, and links to the sibling docs the argument crosses into |
| `## Structure` | where these files sit on disk |
| `## Shape` | the canonical snippet, before any prose about it |
| `## Rules` | one `###` per claim, each written as a claim rather than as a rule id |
| `## Enforcement` | the table below, then `### Exemptions` when there are any. A document with no rules yet says so here in a line |
| `## What is deliberately not enforced` | the claims no rule checks, each with why not — bullets, or a `###` where one needs more than a paragraph |
| `## Examples` | a table of real files, when the shapes vary enough to be worth indexing |
| `## Relationship with <sibling>` | how this contract meets the next one |

`## Enforcement` open with two-column table and nothing else — rule id, and claim above
that it enforce:

```markdown
| Rule id | The paragraph it enforces |
|---|---|
| `form-hook-submit-unguarded` | that `await` sits inside a `try` |
```

That table is join between two halves of this directory, and thing to update first
when rule added or renamed. Everything general about rules — that they run in `standards`
gate of `pnpm run verify`, that each own test in `rule-tests/`, how suppression work — belong
here in this README and not repeated per doc, which is how two `features/api/` docs drifted
into two slightly different accounts of same mechanics.

Claims no rule check are not left out. Reason shape worth having usually not itself
shape, and convention with no rule behind it is exactly one that need writing down. Say
plainly it is unchecked and why — `form-components.md` do it for "fields have to render their
errors", which rule cannot tell from control that take prop and drop it.

## Writing one

One rule per file, named for its id, and every rule own test holding code it must flag and
code it must not:

```
standards/rules/frontend/features/api/mutation-hook-missing-on-error.yml
standards/rule-tests/frontend/features/api/mutation-hook-missing-on-error-test.yml
```

`check:standards:test` fail when rule stop matching its own `invalid` case. That is point
of test: check that silently stopped matching print exactly what clean codebase
print, and this is what tell the two apart.

Rules match syntax tree, not lines, because hook that name itself one thing and do
another read as compliant to any line-wise pattern.

Rule ids global — folder for humans, `files:` glob is what tool enforce. Keep
the two saying same thing; directory is not filter.

## Exempting a site

Suppress by id, with reason written above it:

```ts
// The failed row renders its own retryable message, so a toast would be the same news told twice.
// ast-grep-ignore: mutation-hook-missing-error-toast
onError: (...args) => {
  onError?.(...args)
},
```

Suppression name one rule and silence only that rule — same handler still fail every
other rule. Misspelt id suppress nothing. And `check:standards` pass
`--error=unused-suppression`, so build fail the day exemption outlive the code it was
written for.

**JSX match cannot carry one.** ast-grep read suppression off matched node preceding
sibling, and between `{/* … */}` and element below it tree-sitter put `jsx_text` node
holding newline. Gluing comment to element work until formatter split line
back apart, which it do. So considered exception to JSX rule go in that rule `ignores`
instead, with reason written above it — see `submit-button-not-from-form-hook`. It exempt
whole file, not one line, and `--error=unused-suppression` cannot tell you when it go
stale, so keep glob as narrow as one file it is for.

## When a rule cannot express it

Sometimes answer is tooling will not reach, sometimes it is something else
already reach. Either is real verdict, and it worth exactly as much as work behind it — so
**write down which options you evaluated and why each failed**. Two things then become possible
that not possible from bare "we had to script it": next person proposing hand-written
walker must clear same bar, and tool that improve can be reconsidered against recorded
reason instead of vague memory.

Bar is "show it cannot be expressed", not "it would be awkward". Rule that is possible but ugly
get written ugly, with reason in its `note:`. Sections below are verdicts that cleared it.

### Tools considered, and rejected

ast-grep chosen over three alternatives. None of these general verdict on tool; each is
specific thing that made it unusable for rules this directory hold.

- **semgrep** — object fields match unordered. Several rules here about *order*:
  `mutation-hook-spread-not-first` is whole claim that `...options` come before overrides
  it must not shadow. Pattern language that cannot see difference between two orderings
  cannot express rule at all.
- **ArchUnitTS** — custom rule is `(file: FileInfo) => boolean` over file raw text. So you
  end up writing AST traversal anyway, inside someone else harness, and you lose line
  numbers diagnostic need. That is hand-written walker with extra steps.
- **Biome GritQL plugins** — every diagnostic labelled `plugin`, so failure not say which
  rule failed, and only suppression is `// biome-ignore lint:`, which silence *every* rule on
  the line. Both halves of [exempting a site](#exempting-a-site) — naming rule, and
  `--error=unused-suppression` noticing when exemption go stale — depend on thing Biome
  not offer.

### Already enforced, somewhere that is not here

Other verdict that close candidate, and cheaper one to get wrong: claim is checked,
just not by rule under `standards/rules/`. Writing one anyway buy nothing and cost second place
to keep in step — so record it, with gate that actually hold it, and move on.

| Claim | Held by |
|---|---|
| A route never answers `HttpResult<any>` | Biome's `suspicious/noExplicitAny`, through `preset: recommended` — the `lint` gate |
| A `SubscriberConfig` carries its event type argument | `TEvent` has no default, so omitting it is `TS2314` — the `typecheck` gate, pinned by a `@ts-expect-error` in `subscriber-contract.test.ts` |
| A subscriber's `config` sets `name` | `name` is a required field, so omitting it is `TS2741` — the `typecheck` gate |
| A subscriber imports no transport vocabulary | `subscribers-name-no-transport`, a dependency-cruiser rule — the `structure` gate |
| A module's tests live in `__tests__/` | `module-tests-live-in-a-tests-folder`, likewise |
| A third-party provider lives outside every module | `layer-graph-providers` — `providers` may import `core` and nothing else under `src/`, so a provider reaching for a repository fails the moment it is written |
| A workflow handler does not read `process.env` between steps | `env-read-outside-env-module`, which holds it across all of `src/` rather than only the handler. A workflow-specific rule for it would be the same claim twice |

Test for this verdict same as for one below: name gate, and be able to say what
introducing violation print. "Typecheck probably catches it" is not verdict.

### Checks that are genuinely runtime

`apps/backend/scripts/checks/` is one place convention check still code, and `run.ts`
header say why: whether relationship cascade, which column index lead with, whether
predicate exclude soft-deleted rows, and what one deletion reach are facts that exist only once
drizzle built the table. Rule file read source; these questions about object the
source produce.

Verdict per check, so question not re-litigated:

| Check | Verdict |
|---|---|
| `soft-delete-index-predicate` | **Runtime.** An index predicate is a `SQL` object the drizzle builder assembles and `PgDialect` renders; there is no predicate in the source to read. Its one textual sub-claim — no hand-written `sql` fragment naming the soft-delete column — is expressible, but splitting one rule across two mechanisms would leave it with no single home. |
| `cascade-relationship-index` | **Runtime.** `references(() => other.id, { onDelete: 'cascade' })` resolves through a thunk, and the check is a *join*: this table's foreign-key column against the leading column of an index declared in a separate argument. A rule matches one node with constraints on its neighbourhood; it cannot bind a value in one subtree and test it in an unrelated one. |
| `destroy-only-children` | **Runtime.** The question is about the *parent* — whether the table on the other end of the foreign key is soft-deletable — which is in another file. |
| `guard-outside-its-closure` | **Runtime.** Transitive reachability over the whole module's cascade graph. Not a property of any file. |
| `model-reaches-cascade-graph` | **Cross-file, and a rule file cannot see two files at once.** A dependency-cruiser reachability rule from `index.ts` would catch the common case — a model file the module definition never imports. It would *not* catch a table imported for a repository and then left out of the `models` object, which is precisely the case the cascade graph silently loses. Converting would trade the rule for a weaker one, so it stays. |
| `models.ts`, `metadata.ts`, `run.ts`, `types.ts` | Harness, not rules. |

### Checks that read what no rule engine reads

`scripts/checks/one-version.mts` assert that package a workspace declare is installed at one
version. It is script, and reason not that rule would be awkward — it is that **no rule
engine here read lockfile**. ast-grep, Biome and dependency-cruiser all work from source, and
`.dependency-cruiser.cjs` have no vocabulary for "resolved version": its `to` clauses name modules and
paths, never version module resolved to.

Lockfile also only artefact that can answer the question. Break that produced this
check was `@tanstack/form-core` installing at both 1.33.2 and 1.33.5, which made TypeScript treat the
two copies types as unrelated — 21 errors in `apps/admin`. Manifests were *not* wrong:
`apps/admin` and `packages/ui` both declared `^1.33.2` and agreed. `@tanstack/react-form` pinned
`form-core` exactly, and third party pin against our caret is what split it. Any check that
compare manifests is blind to that by construction, which is what next section measure.

`knip.jsonc` assert inverse — that package a workspace *declare* is referenced by that
workspace — and it is one check here that is third-party tool rather than our own code. Reason
again not awkwardness. It is that **claim need real module graph**, and all four of
things hand-written check would get wrong are present in this tree: `@import "tailwindcss"` in
stylesheet is reference, so `packages/ui` flagged and two apps not; `src/providers/*`
registered by string and imported by nothing, so its files only reachable once declared entry
points; `drizzle-kit` invoked inside nested `sh -c` *and* imported by `database.config.ts`
files nothing else reach; and commented-out import must not count, which is difference
between parsing and grepping. Three of ten findings its first run produced were exactly that
last case. Check that got any wrong would be gate that lie in expensive
direction — red on something real, so you delete dependency build need.

Its first run against this tree, zero-config across all four dependency issue types, reported 18
findings in 6.6s, of which 7 were noise; scoped to `dependencies` and `catalog`, 10 findings in
3.2s and no false positives, each checked against source by hand. `catalog` in scope for
reason `one-version.mts` cannot cover: that script iterate packages manifests declare, so
catalog entry left behind after its last declaration go have no declaration site and never
visited — and this gate is what create them, since resolving its findings remove declarations.
Everything else knip report deliberately out, including `files` (58 findings, real backlog and
separate conversation) and `duplicates`, which is duplicate *exports* rather than duplicate
versions and so read like `versions` gate job without being it.

`knip.jsonc` is `.jsonc` because it is where judgment calls live: package genuinely
needed but unreferenced go in `ignoreDependencies` **with comment saying why**, same
discipline as `one-version.mts` `accepted` map, same reason — exception that cannot
be added silently is one somebody revisit. None today.

### Dependency-usage tools considered, and rejected

| | Why not |
|---|---|
| **Biome `noUndeclaredDependencies`** | Answers the inverse question, and was rejected on measurement in `docs/research/undeclared-dependencies.md` §5: ~1,130 false positives from `tsconfig` `paths`, with no ignore list and no alias option. |
| **A hand-written script, as for `versions`** | The four ways to be confidently wrong, above. `one-version.mts` is 40 lines with no dependency because its claim is a regex over a lockfile; this one is not that shape. |
| **depcheck** | Archived 2025-06-16. Its maintainers recommend knip. |
| **syncpack, manypkg** | Compare manifests to each other. Neither reads an import statement, so neither can tell used from unused — the same blindness that disqualified them for `versions`, from the other side. |
| **knip `--fix`** | It edits `package.json`. Fine to run by hand; the **gate never fixes**, because *which* declaration to delete is the question the gate exists to surface — three of the first ten were a commented-out devtools panel, and the answer was to restore it, not to delete anything. |
| **`--cache`** | Unnecessary at ~3s, and a cache is a second thing that can be stale. |
| **knip's other issue types** | `unlisted`, `unresolved` and `binaries` restate what the strict pnpm layout plus `typecheck` already make impossible; `catalogReferences` sits behind an outright `pnpm install` failure, and a gate behind an install error is not a gate; `cycles` belongs to dependency-cruiser per ADR-0020. |

### Version-alignment tools considered, and rejected

Each run against this tree before rejected; evidence in
`docs/research/monorepo-version-alignment.md`.

| | Why not |
|---|---|
| **syncpack** | The best tool in this space, and what it does is compare `package.json` files. Reported **0 rows** for the three packages actually installed at two versions, while reporting 14 rows of `DependsOnInvalidLocalPackage` that are artefacts of every workspace being `private: true` with no `version`. Still worth revisiting as a one-time catalog *generator*, and as a catalog-freshness checker. Not as the gate. |
| **manypkg** | Same blindness, plus a "most common range" target that proposed *downgrading* `apps/backend`'s vitest. Its `INVALID_DEV_AND_PEER_DEPENDENCY_RELATIONSHIP` check did surface one real finding — `packages/ui` declared six peerDependencies and installed none of them — which was worth acting on without adopting the tool. |
| **`pnpm dedupe --check`** | A real gate for a *different*, weaker claim: that the lockfile is minimal. It needs the registry and takes seconds, so it cannot sit in a 16-second offline `verify`. CI, if anywhere. |
| **`resolutionMode: lowest-direct`** | Would have collapsed `form-core` today by coincidence, at the cost of resolving every range in the repo to its floor forever. |
| **`dedupePeerDependents`** | Already at its default `true`. Measured inert here — 122 duplicated names before and after. |
| **`peerDependencyRules`** | Suppresses the warning and installs nothing differently. Rejected on principle: it makes the symptom of this exact bug invisible. |
| **`resolutions`** | pnpm merges it into `overrides` anyway. Two spellings for one field is a trap, not a feature. |
| **`strictPeerDependencies: true`** | **Deferred, not rejected.** It would turn a class of these into install failures, which is the right direction, but it needs a triage pass over the whole tree first and that is its own piece of work. |
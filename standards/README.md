# Standards

The counterpart to the dependency rules in each app's `structure/.dependency-cruiser.cjs`.
Those say which file may import which; these say what a file's *contents* must look like. Both are
declarative — these run in the `standards` gate of `pnpm run verify`, those in `structure` — and
neither is a script.

```bash
pnpm run check:standards        # scan the repo
pnpm run check:standards:test   # run the rules' own tests
```

## The words

This repo had several names for one idea — a claim about our code that the build enforces — and no
single word that covered it. The tell was that `scripts/verify.sh` labelled a job by enumerating the
bucket: *"Env usage, error, schema & standards conventions"* is what you write when no noun fits.
That gate is now `standards`. Five words replace the enumeration, defined here because this file is
already the front door to all of them. They are not in `CONTEXT.md`, which is the e-commerce glossary
and takes domain language only.

The pair that does the work is a transition rather than two labels: **a convention hardens into a
standard the day someone writes the check.** Nothing stays a convention on purpose — a convention
that can be checked is checked. Which is why prose with no rule behind it, `data-hooks.md`, belongs
in a folder called `standards/`: the folder is named for what things become there, and a convention
is worth writing down before it has hardened into something checkable.

**Convention**:
A practice this repo follows that nothing enforces yet — a document in a `__docs__/`, a paragraph in
a `README.md`, or a habit everyone has that nobody has written down.
_Avoid_: standard, guideline, best practice

**Standard**:
A convention with a check behind it. The claim about the code, never the mechanism that tests it —
so a standard enforced by drizzle metadata and one enforced by ast-grep are the same kind of thing,
and the word sits above both.
_Avoid_: convention, rule, lint rule

**Check**:
The executable that enforces one standard. A check is a mechanism, so it is the thing that can be
slow, flaky, or impossible to write.
_Avoid_: standard, test, gate

**Rule**:
A check expressed declaratively as a file rather than as code — a `.yml` under `standards/rules/`,
or a dependency-cruiser rule in an app's config. Every other check is a script — meaning a check
written as code, not every executable under `scripts/`: `verify.sh` is a script and enforces no
standard of its own, it runs the gates.
_Avoid_: check (where the distinction is the point), lint rule

**Gate**:
One job in `scripts/verify.sh`, grouping the checks that share a subject. Failing one names what is
wrong with the code; it does not name which tool noticed.
_Avoid_: check, suite, stage

A script is therefore a check that could not be written as a rule, and that is where the standing
demand for a recorded reason comes from: it is the distinction, not a separate policy. The reasons
live in [when a rule cannot express it](#when-a-rule-cannot-express-it).

### The six kinds a standard can be about

| Kind | The claim | Where it lives | Gate |
|---|---|---|---|
| Contents | what a file holds | `standards/rules/`, plus the env, error, datetime and replay-purity scripts | `standards` |
| Structure | which file may import which | `packages/frontend-structure`, each app's `structure/.dependency-cruiser.cjs` | `structure` |
| Schema | facts that exist only once drizzle has built the table | `apps/backend/scripts/checks/` | `standards` |
| Currency | whether a committed generated file is stale | the two registry generators, run with `--check` | `generated` |
| Resolution | what the lockfile resolved a declared package to | `scripts/checks/one-version.mts` | `versions` |
| Usage | whether a declared package is referenced by the workspace that declares it | `knip.jsonc` | `unused` |

Contents and schema share a gate because a failure in either means one thing to the reader: *the
code does not meet a standard*. Currency has its own, because a failure there means something
else — *a generated file was not regenerated*, which is a generator to re-run rather than code to
fix. Resolution has its own for the same reason: nothing in the source is wrong, a dependency
resolved twice, and the fix is a line in `pnpm-workspace.yaml`. Usage is the last two's neighbour
and still a third gate, because its fix is a line *removed* from a `package.json` and the question
it asks is the inverse of resolution's — not what a declaration resolved to, but whether anything
wanted it. Which tool enforces what, including the two kinds this table leaves to Biome and
Spectral, is [below](#which-standards-live-here-and-which-do-not).

## Where a document goes

This is the first question, and it has one answer per kind of prose. Ask them in order.

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

**If it could be two of those**, three tie-breakers, in order:

1. **The imperative test.** A sentence that can be written as an instruction to the person typing —
   *"Publish from a workflow's final step"* — is a use case. One that can only be written as a
   description — *"the node transport is a Worker polling two queues"* — is mechanism.
2. **The file-shape test.** Could a rule ever check it, whether or not one does today? A claim about
   what a *file* must look like is a use case. A claim about what happens at *runtime* is mechanism.
3. **The ownership test.** One code area → that area's `__docs__/`. No single owner → `docs/`. And
   the corollary that keeps `docs/` from growing a second copy of everything: **`docs/` may not
   explain how to build something that lives in one area.**

**Still undecided? `__docs__/`.** A misfiled instruction there is still read at the moment someone
is writing that kind of code. A misfiled instruction in a `README.md` is read by nobody.

**One claim, one place.** Where a use-case document needs mechanism to make sense it links to the
`README.md` section; it never restates it, and the same holds in reverse. Two copies of a claim are
two things to keep in step, and the second one is always the stale one.

**What a code directory's `README.md` may not hold:** an "adding one" section, a checklist, or a
file-shape or folder-vocabulary list. All three are use cases. A directory whose prose is entirely
use case therefore has **no `README.md` at all** — that is the expected outcome, not a gap, and it is
why `src/api/` does not keep one. Nothing is left behind as a signpost: a pointer file is a second
place to keep in step, and the rule's `note:` already names the document at the moment it is needed.

### What may be scoped, and what may not

Everything above decides *which file* a claim goes in. This decides whether the claim may be put
somewhere that loads **conditionally** — a `.claude/rules/` file with `paths:`, a nested
`CLAUDE.md`, or a `__docs__/` document reached from either. One line separates the two:

> **Scope "how to build X once you're building X." Never scope "which X to build."**

A path-scoped rule loads when a matching file is read, so it arrives *after* the decision that a file
under that path is what you are writing. The DataTable column contract is safe to scope: you are
already inside `apps/admin/src/components/data-table/` when you need it, and the path match fires at
that moment. A store route's SSR side is not: `defaultSsr: false` means you pick which side a route is
on **before the file exists**, so nothing can path-match on it. Same for the closed feature-folder
vocabulary — a plan invents `src/features/{name}/reducers/` without reading a single file under it.

The test is one question: **can this be violated by a decision taken before any matching file is
read?** If yes, it belongs in root `AGENTS.md`, unscoped.

Two things this is not. It is not a claim that scoping makes a rule more likely to be followed —
`docs/research/agent-memory-and-write-time-determinism.md` §4.1 rates just-in-time rules a
context-budget mechanism and *"never an enforcement one"*, with no measurement of scoped-versus-
unscoped compliance anywhere. And it is not defeatable by configuration: §6.2 quotes the vendor docs
saying the built-in Explore and Plan agents load no project rules at all, and that *"there is no
frontmatter field or per-agent setting to change which agents skip them."* So scoping buys bytes, and
the rule that survives a planner is the one that was never scoped.

### Which standards live here, and which do not

`standards/` is the front door, not the whole house. What it does not hold, it names:

| Standard | Lives in | Enforced by |
|---|---|---|
| What a file's contents must look like | `standards/rules/` | ast-grep — `check:standards` |
| Which file may import which | each app's `structure/.dependency-cruiser.cjs` | dependency-cruiser — `check:structure` |
| Formatting, naming, and the language rules | `biome.json` | Biome — `pnpm run check` |
| API design | `apps/backend/openapi/ruleset.yaml` | Spectral — `check:openapi` |
| Facts that exist only once drizzle has built the table | `apps/backend/scripts/checks/` | `check:schema` — and see [when a rule cannot express it](#when-a-rule-cannot-express-it) |
| One version of each declared dependency | `pnpm-workspace.yaml`'s `catalog:` and `overrides:` | `scripts/checks/one-version.mts` — and see [checks that read what no rule engine reads](#checks-that-read-what-no-rule-engine-reads) |
| That every declared dependency is referenced | `knip.jsonc` | knip — and see [checks that read what no rule engine reads](#checks-that-read-what-no-rule-engine-reads) |

The first and the third-from-last run in the `standards` gate of `pnpm run verify`; the import rules
run in `structure`, Biome in `lint`, Spectral in `openapi`, the version check in `versions`, and
knip in `unused`.

## Where a rule goes

The tree mirrors the code it governs, so a rule has an obvious home before anyone has to ask.
`frontend/` is the shape both SPAs share — [bulletproof-react's project
structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md),
which `apps/store` and `apps/admin` both follow — minus the `src/` segment, which is the same for
every rule and so never tells two of them apart.

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
      workflows/      steps and compensation
        __docs__/     README.md → workflows.md
                      the error contract spans routes and workflows, so
                      `route-omits-workflow-errors` sits at `backend/` rather than
                      inside either one
      subscribers/    no rules yet — the documents arrived first
        __docs__/     README.md → events.md, subscribers.md
  rule-tests/
    <same tree>/<rule-id>-test.yml
    __snapshots__/    flat — ast-grep keys these by rule id, not by path
```

A directory appears when its first rule *or its first document* does — an area that is documented
before it is checked gets its `__docs__/` now and its rules when they harden. Rules that span both
frontends live under
`frontend/`; a rule for only one app says so in its own `files:` glob.

## Where the prose goes

Each rule directory carries a `__docs__/` holding the documents for the use cases it governs — the
first row of the table above, in the layout the rest of this section describes. A convention and the check that
enforces it go stale together or not at all, and two directories apart is how they come apart: a rule
gets added and the guide never hears about it. `__docs__/` rather than a loose `.md` beside the
rules, for the same reason `rule-tests/` has `__snapshots__/`: one glance separates the prose from
the rules, and it sorts to the top.

**One use case, one file.** Every kind of thing this directory governs gets its own document, named
for it. Two use cases never share a file, and no use case is ever explained in the index — not even a
small one, not even the only one in the directory. If you are about to add a section to a `README.md`
describing how to build something, that section is a new document.

This holds whether or not any rule enforces the use case yet. `data-hooks.md` has no rules behind it;
it is a document because it is a distinct thing someone builds, which is the only test that matters.
When it hardens, the rule lands beside the document already describing it — the
[transition](#the-words) is what this folder is named for.

`README.md` is reserved for the index, and every `__docs__/` has one. It is the only file in there not
named for a use case, and the only one that is not about rules: it says what kind of code lives in
this directory, then **routes** — a table naming each document beside it and the job you would be
doing when you want that document. Lead, table, and at most a line or two on how the documents relate.
Nothing else.

Write those routing descriptions for someone who knows what they are trying to build and not yet what
it is called here. "Reading data from the API" and "turning user input into a write" send a reader to
the right page; a summary of the rules on that page does not, because you cannot recognise a contract
you have not read yet. Leave rule ids, rule counts and rule detail to the documents. The index is a
map, and a map that repeats the territory is a second thing to keep in step — which is the same
reason a use case cannot be documented in it.

Every rule's `note:` ends with the repo-relative path to the document that explains it, never to the
index.

A use case is a thing someone sets out to build, which is not the same as a feature. Form work used
to be a single document under `docs/` covering both the hook and the button it renders — two jobs,
done at different moments, governed by rules in two directories. It is now two documents, each in
the `__docs__/` beside its own rules, cross-linked where the argument crosses over. **A document whose
rules live in two directories has not been sliced yet**, and that is the most reliable signal you
have: rules follow the code, so if yours are scattered, so is the thing you are describing.

The backend half was migrated last, and `subscribers/` is what the transition looks like from the
other end: it has no rules and four of the documents it would need, because a use case is a thing
someone sets out to build whether or not anything checks it yet. Three of the four source guides had
no mechanism left once their use cases were lifted out and were deleted; `src/framework/event-bus/README.md`
kept its half — the adapters, the two transports, what each guarantees — and the two documents beside
`subscribers/` link into it rather than restating any of it.

## How a doc is laid out

This is the shape of a document, not of an index — an index is described above and has none of these
sections. The same sections in the same order, so a reader who has read one knows where to look in the next.
Omit a section that would be empty; don't reorder or rename the ones you keep.

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

`## Enforcement` opens with a two-column table and nothing else — the rule id, and the claim above
that it enforces:

```markdown
| Rule id | The paragraph it enforces |
|---|---|
| `form-hook-submit-unguarded` | that `await` sits inside a `try` |
```

That table is the join between the two halves of this directory, and it is the thing to update first
when a rule is added or renamed. Everything general about rules — that they run in the `standards`
gate of `pnpm run verify`, that each owns a test in `rule-tests/`, how a suppression works — belongs
here in this README and not repeated per doc, which is how the two `features/api/` docs had drifted
into two slightly different accounts of the same mechanics.

Claims that no rule checks are not left out. The reason a shape is worth having is usually not itself
a shape, and a convention with no rule behind it is exactly the one that needs writing down. Say
plainly that it is unchecked and why — `form-components.md` does it for "fields have to render their
errors", which a rule cannot tell from a control that takes the prop and drops it.

## Writing one

One rule per file, named for its id, and every rule owns a test holding the code it must flag and
the code it must not:

```
standards/rules/frontend/features/api/mutation-hook-missing-on-error.yml
standards/rule-tests/frontend/features/api/mutation-hook-missing-on-error-test.yml
```

`check:standards:test` fails when a rule stops matching its own `invalid` case. That is the point
of the test: a check that has silently stopped matching prints exactly what a clean codebase
prints, and this is what tells the two apart.

Rules match the syntax tree rather than lines, because a hook that names itself one thing and does
another reads as compliant to any line-wise pattern.

Rule ids are global — the folder is for humans, the `files:` glob is what the tool enforces. Keep
the two saying the same thing; the directory is not a filter.

## Exempting a site

Suppress by id, with the reason written above it:

```ts
// The failed row renders its own retryable message, so a toast would be the same news told twice.
// ast-grep-ignore: mutation-hook-missing-error-toast
onError: (...args) => {
  onError?.(...args)
},
```

The suppression names one rule and silences only that rule — the same handler still fails every
other rule. A misspelt id suppresses nothing. And `check:standards` passes
`--error=unused-suppression`, so the build fails the day an exemption outlives the code it was
written for.

**A JSX match cannot carry one.** ast-grep reads the suppression off the matched node's preceding
sibling, and between a `{/* … */}` and the element below it tree-sitter puts a `jsx_text` node
holding the newline. Gluing the comment to the element works until the formatter splits the line
back apart, which it does. So a considered exception to a JSX rule goes in that rule's `ignores`
instead, with the reason written above it — see `submit-button-not-from-form-hook`. It exempts a
whole file rather than one line, and `--error=unused-suppression` cannot tell you when it goes
stale, so keep the glob as narrow as the one file it is for.

## When a rule cannot express it

Sometimes the answer is that the tooling will not reach, and sometimes it is that something else
already reaches. Either is a real verdict, and it is worth exactly as much as the work behind it — so
**write down which options you evaluated and why each one failed**. Two things then become possible
that are not possible from a bare "we had to script it": the next person proposing a hand-written
walker has to clear the same bar, and a tool that improves can be reconsidered against a recorded
reason instead of a vague memory.

The bar is "show it cannot be expressed", not "it would be awkward". A rule that is possible but ugly
gets written ugly, with the reason in its `note:`. The sections below are the verdicts that have
cleared it.

### Tools considered, and rejected

ast-grep was chosen over three alternatives. None of these is a general verdict on the tool; each is
the specific thing that made it unusable for the rules this directory holds.

- **semgrep** — object fields match unordered. Several rules here are about *order*:
  `mutation-hook-spread-not-first` is the whole claim that `...options` comes before the overrides
  it must not shadow. A pattern language that cannot see the difference between the two orderings
  cannot express the rule at all.
- **ArchUnitTS** — a custom rule is `(file: FileInfo) => boolean` over the file's raw text. So you
  end up writing the AST traversal anyway, inside someone else's harness, and you lose the line
  numbers a diagnostic needs. That is the hand-written walker with extra steps.
- **Biome GritQL plugins** — every diagnostic is labelled `plugin`, so a failure does not say which
  rule failed, and the only suppression is `// biome-ignore lint:`, which silences *every* rule on
  the line. Both halves of [exempting a site](#exempting-a-site) — naming the rule, and
  `--error=unused-suppression` noticing when the exemption goes stale — depend on the thing Biome
  does not offer.

### Already enforced, somewhere that is not here

The other verdict that closes a candidate, and the cheaper one to get wrong: the claim is checked,
just not by a rule under `standards/rules/`. Writing one anyway buys nothing and costs a second place
to keep in step — so record it, with the gate that actually holds it, and move on.

| Claim | Held by |
|---|---|
| A route never answers `HttpResult<any>` | Biome's `suspicious/noExplicitAny`, through `preset: recommended` — the `lint` gate |
| A `SubscriberConfig` carries its event type argument | `TEvent` has no default, so omitting it is `TS2314` — the `typecheck` gate, pinned by a `@ts-expect-error` in `subscriber-contract.test.ts` |
| A subscriber's `config` sets `name` | `name` is a required field, so omitting it is `TS2741` — the `typecheck` gate |
| A subscriber imports no transport vocabulary | `subscribers-name-no-transport`, a dependency-cruiser rule — the `structure` gate |
| A module's tests live in `__tests__/` | `module-tests-live-in-a-tests-folder`, likewise |
| A third-party provider lives outside every module | `layer-graph-providers` — `providers` may import `core` and nothing else under `src/`, so a provider reaching for a repository fails the moment it is written |

The test for this verdict is the same as for the one below: name the gate, and be able to say what
introducing the violation prints. "Typecheck probably catches it" is not a verdict.

### Checks that are genuinely runtime

`apps/backend/scripts/checks/` is the one place a convention check is still code, and `run.ts`'s
header says why: whether a relationship cascades, which column an index leads with, whether a
predicate excludes soft-deleted rows, and what one deletion reaches are facts that exist only once
drizzle has built the table. A rule file reads source; these questions are about the object the
source produces.

The verdict per check, so the question is not re-litigated:

| Check | Verdict |
|---|---|
| `soft-delete-index-predicate` | **Runtime.** An index predicate is a `SQL` object the drizzle builder assembles and `PgDialect` renders; there is no predicate in the source to read. Its one textual sub-claim — no hand-written `sql` fragment naming the soft-delete column — is expressible, but splitting one rule across two mechanisms would leave it with no single home. |
| `cascade-relationship-index` | **Runtime.** `references(() => other.id, { onDelete: 'cascade' })` resolves through a thunk, and the check is a *join*: this table's foreign-key column against the leading column of an index declared in a separate argument. A rule matches one node with constraints on its neighbourhood; it cannot bind a value in one subtree and test it in an unrelated one. |
| `destroy-only-children` | **Runtime.** The question is about the *parent* — whether the table on the other end of the foreign key is soft-deletable — which is in another file. |
| `guard-outside-its-closure` | **Runtime.** Transitive reachability over the whole module's cascade graph. Not a property of any file. |
| `model-reaches-cascade-graph` | **Cross-file, and a rule file cannot see two files at once.** A dependency-cruiser reachability rule from `index.ts` would catch the common case — a model file the module definition never imports. It would *not* catch a table imported for a repository and then left out of the `models` object, which is precisely the case the cascade graph silently loses. Converting would trade the rule for a weaker one, so it stays. |
| `standard-timestamps` | **Converted.** Now `model-without-standard-timestamps` in `rules/backend/modules/`. The claim was always about the source — that a table spreads `...timestamps` — and moving it also moved its one exemption from a central `EXEMPT` map keyed by table name to an `ast-grep-ignore` at the declaration, which `--error=unused-suppression` can police. |
| `models.ts`, `metadata.ts`, `run.ts`, `types.ts` | Harness, not rules. |

Two larger checks have not been through this question yet:
`apps/backend/scripts/replay-purity.ts` (392 lines, parses the workflow handlers) and
`apps/backend/scripts/check-generic-errors.sh`. Same question, separate pass.

### Checks that read what no rule engine reads

`scripts/checks/one-version.mts` asserts that a package a workspace declares is installed at one
version. It is a script, and the reason is not that a rule would be awkward — it is that **no rule
engine here reads a lockfile**. ast-grep, Biome and dependency-cruiser all work from source, and
`.dependency-cruiser.cjs` has no vocabulary for "resolved version": its `to` clauses name modules and
paths, never the version the module resolved to.

The lockfile is also the only artefact that can answer the question. The break that produced this
check was `@tanstack/form-core` installing at both 1.33.2 and 1.33.5, which made TypeScript treat the
two copies' types as unrelated — 21 errors in `apps/admin`. The manifests were *not* wrong:
`apps/admin` and `packages/ui` both declared `^1.33.2` and agreed. `@tanstack/react-form` pinned
`form-core` exactly, and a third party's pin against our caret is what split it. Any check that
compares manifests is blind to that by construction, which is what the next section measures.

`knip.jsonc` asserts the inverse — that a package a workspace *declares* is referenced by that
workspace — and it is the one check here that is a third-party tool rather than our own code. The
reason is again not awkwardness. It is that **the claim needs a real module graph**, and all four of
the things a hand-written check would get wrong are present in this tree: `@import "tailwindcss"` in
a stylesheet is a reference, so `packages/ui` is flagged and the two apps are not; `src/providers/*`
is registered by string and imported by nothing, so its files are only reachable once declared entry
points; `drizzle-kit` is invoked inside a nested `sh -c` *and* imported by the `database.config.ts`
files nothing else reaches; and a commented-out import must not count, which is the difference
between parsing and grepping. Three of the ten findings its first run produced were exactly that
last case. A check that got any of them wrong would be a gate that lies in the expensive
direction — red on something real, so you delete a dependency the build needs.

Its first run against this tree, zero-config across all four dependency issue types, reported 18
findings in 6.6s, of which 7 were noise; scoped to `dependencies` and `catalog`, 10 findings in
3.2s and no false positives, each checked against the source by hand. `catalog` is in scope for a
reason `one-version.mts` cannot cover: that script iterates the packages manifests declare, so a
catalog entry left behind after its last declaration goes has no declaration site and is never
visited — and this gate is what creates them, since resolving its findings removes declarations.
Everything else knip reports is deliberately out, including `files` (58 findings, a real backlog and
a separate conversation) and `duplicates`, which is duplicate *exports* rather than duplicate
versions and so reads like the `versions` gate's job without being it.

`knip.jsonc` is `.jsonc` because it is where the judgment calls live: a package that is genuinely
needed but unreferenced goes in `ignoreDependencies` **with a comment saying why**, the same
discipline as `one-version.mts`'s `accepted` map, and for the same reason — an exception that cannot
be added silently is one somebody revisits. There are none today.

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

Each was run against this tree before being rejected; the evidence is in
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

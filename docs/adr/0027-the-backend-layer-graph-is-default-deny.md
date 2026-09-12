# 27. The Backend's Layer Graph Is Declared and Default-Deny

**Status:** Accepted

## Context

`apps/backend/structure/.dependency-cruiser.cjs` held twelve `forbidden` rules, and the four that
described the architecture — `no-module-internals`, `no-api-internals`, `no-link-definition-leaks`
and `business-layers-do-not-import-the-runtime` — were pairwise: each named a `from`, a `to` and a
reason. Pairwise rules are **default-allow**. They catch the edge someone thought to forbid and
nothing else, so the ruleset's coverage is the union of past arguments rather than a statement about
the architecture. Measuring the graph made the gaps concrete: `providers → workflows`,
`api → link-modules/repositories/`, `jobs → modules` and `subscribers → api` were all permitted, none
of them deliberately.

`apps/store` had already solved this. Its `FEATURE_GRAPH` (ADR-0020) is one object where the key is a
feature and the value is everything it may import; every other feature is an error. The backend's
objection to copying it had been that `src/server/` and `src/framework/` overlapped, so no honest
ordering existed — and that dissolved when `src/server/` was removed in ADR-0026.

The real adjacency, pulled from dependency-cruiser's JSON rather than assumed:

| layer | imports (non-test) |
|---|---|
| `api` | `core`, `framework`, `workflows` |
| `subscribers` | `core`, `workflows` |
| `workflows` | `core` |
| `link-modules` | `core`, `modules` |
| `modules` | `core`, `providers` |
| `providers` | `core` |
| `jobs` | `core` |
| `framework` | `core` |
| `core` | — |

## Decision

**`LAYER_GRAPH` declares what every node under `src/` may import, and one generated rule per node
forbids the rest.** It is written in the store's shape — a name, and the complete list of what it
may reach — with the paths in a second object, `COMPOSITION_ROOTS`, so that the graph itself stays a
table you can read down. A layer needs no entry there: its path is its name.

Three rules were deleted as redundant: `no-module-internals`, `no-api-internals` and
`business-layers-do-not-import-the-runtime`. The graph is stricter than all three.
`no-link-definition-leaks` stays — it guards a path *inside* a layer (`link-modules/definitions/`),
which is finer than the graph's granularity, the same way `no-cross-module-imports` is.

Two things make the graph fit a backend rather than a feature folder.

**A file that composes a layer is its own node, not a member of the folder it sits in.** `routes.ts`
imports every route, `container.ts` every module, `registry.gen.ts` every workflow. Each is an upward
edge that exists on purpose. Modelling them as nodes is what lets the folder around them stay closed:
`framework` may not name a workflow, but `framework/workflows/temporal/registry.gen.ts` may. Without
this the choice would have been between a hole in `framework`'s row and a rule with an exception list
— which is the shape the graph exists to replace. It is also what keeps the graph readable as an
ordering, since every back-edge is a named node rather than an undocumented cycle between folders.

**`env.ts` and `schema.type.ts` are outside the graph** — vocabulary every layer may name, so listing
them in every row would say nothing. This is the same carve-out the store's comment makes for
`#/lib` and `#/components`.

`__tests__/` is not blanket-exempt. `TESTS_MAY_ALSO_IMPORT` has two entries instead: `workflows` tests
may construct the in-process engine they are testing, and one `framework` test reads the route table
to check the shipped OpenAPI documents against it. Everything else a test does is held to the same
row as the code beside it, so `api/**/__tests__` still cannot reach a module service directly.

`layer-graph-undeclared` closes the last default-allow hole: a top-level folder that is not yet a node
may import nothing under `src/`. `src-holds-only-known-top-level-entries` already made *adding* a
layer deliberate; this makes declaring its edges equally so.

## Alternatives rejected

**Keeping the pairwise rules and adding the missing ones.** This is the default-allow treadmill: each
new rule is written after someone notices the edge, and the ruleset never says what the architecture
*is*. The four rules also could not express `jobs` or `providers` at all — neither had ever been the
subject of an argument, so neither had a rule.

**One rule with a `from`/`to` matrix.** dependency-cruiser evaluates rules independently, so a matrix
would have to be encoded as a single regex pair per direction. The generated-rule-per-node form gives
each violation a name that says which row was broken (`layer-graph-providers`), which a matrix cannot.

**Blanket-exempting `__tests__/`.** It was three files' worth of violations, and the exemption would
have silently restored `api/**/__tests__ → modules`, which `no-module-internals` had been forbidding.
Two declared entries in `TESTS_MAY_ALSO_IMPORT` cost less than the coverage they preserve.

**Folding `no-link-definition-leaks` in.** The graph allows `container.ts → link-modules`, and that
rule forbids `container.ts → link-modules/definitions/`. Collapsing them would have widened the
narrower rule.

## Consequences

Twenty generated rules replace three hand-written ones, and the file declares one object instead of
arguing four cases. `check:structure` reports no violations over 962 modules and 4,256 dependencies.

Each row was mutation-tested: `modules → framework`, `workflows → routes.ts`, `providers → workflows`,
`api → link-modules/repositories/`, `jobs → modules`, and an undeclared layer importing a module all
go red, and `src/` was restored byte-identically after. The middle three were *permitted* by the
ruleset this replaces, which is the case for the graph in one line.

The cost is indirection: a violation names a generated rule, so reading `layer-graph-providers`
means looking up `providers` in `LAYER_GRAPH` rather than reading a rule with its reason attached.
The rows are one line each, which is what makes that lookup cheap — and the per-rule `comment` names
the row and says what to do, so the message is still actionable without opening the file.

Adding a layer is now two edits in one file: the folder in
`src-holds-only-known-top-level-entries`, and the row in `LAYER_GRAPH`. Until the second one lands,
the layer may import nothing.

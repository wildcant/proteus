# Code-shape rules

The counterpart to the dependency rules in each app's `deps-analyzer/.dependency-cruiser.cjs`.
Those say which file may import which; these say what a file's *contents* must look like. Both are
declarative, both run in the `conventions` job of `npm run verify`, and neither is a script.

```bash
npm run check:code-shape        # scan the repo
npm run check:code-shape:test   # run the rules' own tests
```

## Where a rule goes

The tree mirrors the code it governs, so a rule has an obvious home before anyone has to ask.
`frontend/` is the shape both SPAs share — [bulletproof-react's project
structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md),
which `apps/store` and `apps/admin` both follow — minus the `src/` segment, which is the same for
every rule and so never tells two of them apart.

```
ast-grep/
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
      modules/        models, repositories, services   → docs/adding-a-module.md
      api/            route files                      → docs/middleware-and-openapi.md
                      the error contract; plus route-helper placement and the DELETE
                      response shape → apps/backend/src/api/README.md
      workflows/      steps and compensation
                      the error contract spans both, so `route-omits-workflow-errors`
                      sits at `backend/` rather than inside either one
  rule-tests/
    <same tree>/<rule-id>-test.yml
    __snapshots__/    flat — ast-grep keys these by rule id, not by path
```

A directory appears when its first rule does. Rules that span both frontends live under
`frontend/`; a rule for only one app says so in its own `files:` glob.

## Where the prose goes

Each rule directory carries a `__docs__/` holding the document that explains the shapes its rules
hold in place — not `docs/`, which is for guidance no rule backs. A convention and the check that
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
A convention is worth writing down before it has hardened into something checkable, and when it does
harden the rule lands beside the document already describing it.

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
to be one `docs/form-hooks.md` covering both the hook and the button it renders — two jobs, done at
different moments, governed by rules in two directories. It is now two documents, each in the
`__docs__/` beside its own rules, cross-linked where the argument crosses over. **A document whose
rules live in two directories has not been sliced yet**, and that is the most reliable signal you
have: rules follow the code, so if yours are scattered, so is the thing you are describing.

The backend rows above still point into `docs/` — those guides cover much that no rule enforces, and
splitting them is a separate call.

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
when a rule is added or renamed. Everything general about rules — that they run in the `conventions`
job of `npm run verify`, that each owns a test in `rule-tests/`, how a suppression works — belongs
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
ast-grep/rules/frontend/features/api/mutation-hook-missing-on-error.yml
ast-grep/rule-tests/frontend/features/api/mutation-hook-missing-on-error-test.yml
```

`check:code-shape:test` fails when a rule stops matching its own `invalid` case. That is the point
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
other rule. A misspelt id suppresses nothing. And `check:code-shape` passes
`--error=unused-suppression`, so the build fails the day an exemption outlives the code it was
written for.

**A JSX match cannot carry one.** ast-grep reads the suppression off the matched node's preceding
sibling, and between a `{/* … */}` and the element below it tree-sitter puts a `jsx_text` node
holding the newline. Gluing the comment to the element works until the formatter splits the line
back apart, which it does. So a considered exception to a JSX rule goes in that rule's `ignores`
instead, with the reason written above it — see `submit-button-not-from-form-hook`. It exempts a
whole file rather than one line, and `--error=unused-suppression` cannot tell you when it goes
stale, so keep the glob as narrow as the one file it is for.

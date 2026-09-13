# 04 — The app-level files stop being devtools trivia

**What to build:** `apps/admin/AGENTS.md` and `apps/store/AGENTS.md` stop presenting a generated
skill dump as this repo's frontend rules. The admin's two use-case sections leave `AGENTS.md` for
`__docs__/` like everything else, the `### Dependency Rules` bullets are deleted outright, and the
one sentence in `## Frontend Apps` that a *planner* needs stays in the root file, unscoped.

**Blocked by:** nothing. 01 and 03 have landed; this is the frontend half they left behind. ADR-0028
has landed too, so neither new document may show an import routed through a barrel.

**Status:** ready-for-agent

**Spec:** `.scratch/agents-md/spec.md`, P2.

---

## Why

`apps/admin/AGENTS.md` and `apps/store/AGENTS.md` are **100% generated TanStack Intent manifests** —
`<!-- intent-skills:start -->` on line 1, `:end` on the last line, 64 and 97 lines of plugin
marketplace publishing, devtools panel lifecycles and Next.js migration steps. Git says they were
last touched by `42277b5c refactor: rename apps/frontend to apps/store`; nothing has maintained them
since.

Claude Code never reads them, so for us they are inert. **Codex, Cursor, Copilot and Amp do** — as
the per-directory project instructions for `apps/store/**`. That is the defect: devtools trivia
presented to four tools as this repo's rules for the storefront.

---

## What the research says about the manifest

From [the `intent install` reference](https://tanstack.com/intent/latest/docs/cli/intent-install),
[the overview](https://tanstack.com/intent/latest/docs/overview) and
[the announcement](https://tanstack.com/blog/from-docs-to-agents):

1. **The output target is a closed list and is not configurable** — `AGENTS.md`, `CLAUDE.md`,
   `.cursorrules`, `.github/copilot-instructions.md`. It cannot be pointed at a file of our choosing,
   so "move it somewhere else" is not on the table.
2. **It finds its block by the marker comments, and content outside the block is preserved.** So
   authoring real content *above* `<!-- intent-skills:start -->` is safe across re-runs.
3. **`--map` is why these files are 161 lines between them.** Plain `install` writes short
   discover-on-demand guidance instead; `--map` dumps every skill as `id` / `run` / `for`.
4. **Nothing here regenerates them.** `@tanstack/intent` appears in no `package.json` and is not
   installed — it was run once through `npx`. Deleting the block would stick.

---

## The mechanism, and the two corrections it forces

The instinct behind this ticket was "move the app specifics into each `AGENTS.md` and let the agent
lazy-load them". Neither half survives contact with `docs/research/agent-memory-and-write-time-determinism.md`.

### Correction 1 — a nested `AGENTS.md` is invisible to Claude Code; the symlink fixes *coverage*, not *timing*

- **Claude Code does not read a nested `AGENTS.md`** — `docs/research/agents-md-standard.md` §3(c),
  verbatim from the vendor docs. Moving content there and deleting it from root would make it
  invisible.
- **Claude Code does lazy-load a nested `CLAUDE.md`.** So the arrangement is the one the repo root
  already uses: `apps/store/CLAUDE.md -> AGENTS.md`, which keeps Cursor, Copilot and Amp reading the
  same file.

An earlier draft of this ticket called that "strictly better than `.claude/rules` alone". It is
better on **which tools can see the file**. It is not better on **when the file loads** — a nested
`CLAUDE.md` is the same conditional mechanism as a `paths:`-scoped rule, and buys nothing over one.

### Correction 2 — conditional loading is a budget mechanism, and this ticket had it filed as a feature

`agent-memory-and-write-time-determinism.md` §4.1 rates the exact mechanism this ticket is built on:

> **Just-in-time / path-scoped rules** — "Vendor-framed as a context-budget mechanism, **never an
> enforcement one**. No measurement of scoped-vs-unscoped compliance exists. Has a documented failure
> mode (§6)." Applicable here? **"No — this is the trap, not the fix."**

§6.2 closes the escape hatch, quoting the vendor docs verbatim:

> **CLAUDE.md files**: every level of the CLAUDE.md hierarchy the main conversation loads… **The
> built-in Explore and Plan agents skip this.** … There is no frontmatter field or per-agent setting
> to change which agents skip them.

And §6.1's closing line is this ticket's case exactly: *"A planning agent that reads `docs/`, greps
for a symbol, and writes a plan never triggers any of them."*

So the nested files are a **tool-coverage fix and a byte cut**. They are not a place where a
constraint becomes more likely to be followed, and nothing may move here on the theory that it will
be.

### The principle this ticket writes down

The test at the heart of the correction is one line, and it has no home in the repo today —
`.claude/rules/` has seven files, no README, and no mention in `AGENTS.md` or `standards/README.md`:

> **Scope "how to build X once you're building X." Never scope "which X to build."**

A DataTable column contract is the first kind: you are already inside `components/data-table/` when
you need it, so the path match fires at the right moment. `defaultSsr` is the second: you choose a
store route's SSR side **before the file exists**, so nothing can path-match on it.

That is the same test this ticket already applies to ¶1 — *can this be violated by a decision taken
before any matching file is read?* — stated as doctrine rather than as a one-off judgement, and it is
what the ¶2 split below falls out of.

**Where it goes:** a short subsection of `standards/README.md` → "Where a document goes", which is
already the declared single copy of the routing doctrine and already carries the tie-breakers. **Not**
a `.claude/rules/README.md` — that would be a second place to keep in step, which the same file
forbids. This is the one judgement call in the ticket; raise it if the placement looks wrong.

**Codex still will not see any of it.** It walks root → cwd and never scans below, so
`apps/store/AGENTS.md` is invisible unless someone runs `codex --cd apps/store`.

---

## What moves, measured

`AGENTS.md` is 341 lines / 25,026 bytes. The whole `## Frontend Apps` section is 2,227 of them,
excluding its heading. Every figure below was re-measured against the file — the three `###`
subsection counts the earlier draft carried were low because they excluded their own headings, which
are deleted too. ¶2's three parts sum to the whole:

| Content | Bytes | Destination |
|---|---:|---|
| Lead ¶1 — the Bulletproof React feature vocabulary | 444 | **stays in root** — see below |
| ¶2a — "The admin is a plain SPA: Vite… deployed to Cloudflare Pages" | 108 | **deleted.** Deployment mechanism; it changes no decision anyone makes while writing code |
| ¶2b — `defaultSsr: false`, `__root__`/`_main` carry `ssr: true`, and why | 258 | **deleted from root.** ADR-0013 already holds it |
| ¶2c — "The store is **not** — TanStack Start on workerd with selective SSR. Adding a route means deciding which side it is on — see ADR-0013" | 144 | **stays in root, unscoped** — planner-time |
| Lead ¶3 — Orval clients and the `qs` fetcher | 222 | **stays in root** — true of both apps; duplicating it into two files is two things to keep in step |
| ¶3's last sentence — backend-as-library | −76 | **already deleted** — the removal landed; ¶3 measures 222 today. Nothing to do |
| `### Admin DataTable System` | 542 | `standards/rules/frontend/components/__docs__/data-tables.md` |
| `### Route-Driven Modals` | 245 | `standards/rules/frontend/components/__docs__/route-modals.md` |
| `### Dependency Rules (dependency-cruiser)` | 258 | **deleted** |
| *(new)* the selective-SSR breakpoint constraint | ~+180 | **added to root** — see below |

**Net: 1,411 bytes out, about 180 back in — roughly 1,231 bytes, ~440 tokens, 4.9% of the file.** The
earlier figure of 1,487 counted the backend-as-library sentence, which is already gone, and the one
before that assumed all of ¶2 could move while undercounting the three subsections. **The tokens were
never the reason to do this** — closing the defect above is, and the share shrank again because #74's
`core/framework` sections grew the file this one is trimming.

### ¶1 stays, and ¶2c stays for the same reason

The closed feature-folder vocabulary is the exact rule that `.scratch/frontend-conventions/` exists
because an agent broke, and §6.2 is explicit that a scoped or nested rule *"would not be in context
for a planner"*. A plan invents the folder, so ¶1 stays unscoped.

The earlier draft then asserted ¶2 "qualifies because it is inert until you are editing that app"
**without running the same test on it**. Run it and ¶2 fails for its own last sentence: *adding a
route means deciding which side it is on* is a decision taken before the route file exists. It stays
in root beside ¶1. ¶2a and ¶2b are mechanism and genuinely go — not to a nested file, but away.

### The breakpoint constraint is promoted to root, not to the store's nested file

`AGENTS.local.md` records that under selective SSR, client-side breakpoint detection is unsafe, so a
structural change between breakpoints is a choice between two DOM trees and one stacking layout. The
mobile-first half is a personal preference and stays put. **The SSR half is a repo fact**, and it is
hit while *deciding* the layout — the planner again. Root, unscoped, one or two sentences, adjacent
to ¶2c since they share ADR-0013.

### `### Dependency Rules` is deleted, not moved

Its three bullets restate rules that already exist and already fail the `structure` gate —
`no-store-schemas-in-admin`, `no-tanstack-table-outside-data-table`, `no-circular` and
`feature-graph-undeclared`. That is the "already enforced, somewhere that is not here" verdict in
`standards/README.md`, and it is the one place the research points the same way: §4.1's strongest row
is *compiling the rule into an executable check* (67.0% → 88.3% compliance, 3.4× lower feedback
cost). The check is the mechanism; the prose is the redundant copy.

---

## Where the two documents go, and why no new rule file is needed

Both subjects live under paths the existing pointer already covers:

- the DataTable at `apps/admin/src/components/data-table/`
- `RouteFocusModal`, `RouteDrawer` and `RouteModalForm` at `packages/ui/src/route-modals/`

`.claude/rules/frontend-components.md` is already scoped to `apps/{admin,store}/src/components/**`,
`apps/{admin,store}/src/features/*/components/**` and `packages/ui/src/**`, and it points at
`standards/rules/frontend/components/__docs__/README.md`. **So this ticket adds no `.claude/rules`
file** — the index gains two rows and the existing pointer routes to them.

Both are the *right* use of scoping under the principle above: they are "how to build X once you're
building X", and the path match fires at the moment you need them.

Both documents are admin-only in practice. That is fine: `standards/README.md` puts a rule under
`frontend/` and lets its own `files:` glob say which app it is for. Neither has a rule yet, so
`## Enforcement` says in one line that nothing checks it — and one is a partial case:
`no-tanstack-table-outside-data-table` already enforces where `@tanstack/react-table` may be imported,
so `data-tables.md` records that under "already enforced, somewhere that is not here" rather than
claiming nothing holds it.

---

## Acceptance criteria

- [ ] `data-tables.md` and `route-modals.md` exist in
      `standards/rules/frontend/components/__docs__/`, following the section order in
      `standards/README.md` → "How a doc is laid out", and the directory's `README.md` index gains a
      row for each — use-case phrasing, no rule detail, nothing explained in the index
- [ ] Both documents say what holds them: `no-tanstack-table-outside-data-table` for the table under
      "already enforced, somewhere that is not here"; nothing for route modals, said in one line
- [ ] ADR-0019 stays referenced from `route-modals.md`
- [ ] **¶2 is split three ways, not moved.** ¶2a and ¶2b are gone from root and land in no nested
      file; ¶2c stays in root, unscoped. ADR-0013 stays referenced from ¶2c. **This is a rewrite of
      the paragraph, not a line cut** — ¶2a and ¶2c share lines 222–223 (*"…deployed to Cloudflare
      Pages. The store is **not** —"*), so deleting ¶2a by line leaves ¶2c starting mid-sentence
- [ ] The selective-SSR breakpoint constraint is promoted out of `AGENTS.local.md` into **root**
      `AGENTS.md`, beside ¶2c. The mobile-first preference stays in `AGENTS.local.md`
- [ ] **The scoping principle is written down** as a subsection of `standards/README.md` →
      "Where a document goes", citing `agent-memory-and-write-time-determinism.md` §4.1 and §6.2. One
      short subsection; no `.claude/rules/README.md`
- [ ] `apps/admin/AGENTS.md` and `apps/store/AGENTS.md` no longer present the manifest as this repo's
      frontend rules. Whatever real content they carry sits **above** `<!-- intent-skills:start -->`,
      with the markers and everything between them untouched
- [ ] `apps/admin/CLAUDE.md` and `apps/store/CLAUDE.md` are symlinks to the `AGENTS.md` beside them,
      matching the root's `CLAUDE.md -> AGENTS.md`, and both are committed as symlinks — check
      `git ls-files -s` reports mode `120000`, not a copied file. **Skip this if the nested files end
      up empty** (see the next criterion): a symlink to nothing is a file to keep in step
- [ ] `pnpm dlx @tanstack/intent@latest install` **without `--map`** is run in both apps, shrinking the
      block to discover-on-demand guidance. If the result is still noise, delete the block — and if
      that leaves the file with nothing but a heading, **delete the file**. Record which was chosen
      and why
- [ ] Each surviving nested file loads when a file under its app is read — open one in a fresh
      session and confirm `/context` lists it. **This is a liveness check, not a success condition:**
      §6.2 says the Plan subagent will not load it under any configuration, so a green result proves
      the file has not quietly left the repo and nothing more
- [ ] The moved and deleted items are gone from root `AGENTS.md`, and its new size is recorded in the
      PR against 341 lines / 25,026 bytes
- [ ] No pointer anywhere names a section that no longer exists — grep `AGENTS.md`, `standards/`,
      `.claude/rules/` and `docs/` for "DataTable", "Route-Driven Modals" and "Dependency Rules"
- [ ] `pnpm run verify` green

---

## Notes

**Nothing load-bearing moves to a nested file, and applying that honestly nearly empties them.**
Codex cannot see them; Claude Code only sees them after reading a file in that subtree, and its
planner never does. Once ¶2a and ¶2b are recognised as mechanism and ¶2c as planner-time, there is
very little left that the nested files are the right home for. That is the ticket reaching its own
conclusion rather than a reversal of it — do not invent content to justify the files. If they end up
empty, delete them and the symlinks with them; the defect is closed either way.

**Do not put use-case prose in a nested `AGENTS.md`.** That would be a third home for it, against the
decision table in `standards/README.md`. The nested file says what the app *is*; how to build a thing
in it lives in a `__docs__/` document, as it now does everywhere else.

**Do not add prose and expect a result.** §4.1 rates "richer context files generally" a **measured
null** — arXiv:2607.27250, 288 runs, *"the real \[context file] never converts a near-miss to a
pass"* — and rates rule-file layout tuning the same across 1,650 sessions. Every byte this ticket
adds to root has to earn its place as a constraint a planner would otherwise violate, not as
orientation.

**¶3 has already lost its last sentence, and does not gain it back.** *"The store additionally calls
the backend as a library from server functions"* described a deprecated pattern with no live consumer,
and the spec's *Backend-as-library is removed* section has landed — `api-caller.ts`, `src/api/index.ts`
and the `./api` export are gone, and `api-holds-only-four-file-kinds` dropped its `(?!index\.ts$)`
carve-out with them. Nothing to delete here; just do not carry the sentence into either nested file.

**Two files, one symlink each, and no third copy.** If a claim is true of both apps it stays in root.
The temptation here is to write a nice complete per-app guide; the result is two files that drift
from each other and from root.

**Adjacent, deliberately out of scope.** Reading bulletproof-react against the tree turned up three
structural gaps — the admin has no cross-feature import rule at all (149 import sites, two cycles:
`products ↔ product-options` and `regions ↔ store`), `src/`'s top level has no closed vocabulary, and
filenames are kebab-case by habit with nothing checking it. Those are checks, which §4.1 rates far
above anything in this ticket — but they are a separate ticket with a separate migration, and folding
them in would turn a bounded subtraction into an open-ended extraction. A fourth gap this ticket
originally listed — `no-loose-feature-files` carrying an unused `index.ts` carve-out — **is closed**:
ADR-0028 took barrels out repo-wide, and the rule's comment now reads *"Not even an index.ts"*.

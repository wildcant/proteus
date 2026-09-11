# Authoring Structural Rules That Scale

Research findings on how to grow a frontend structural rule set — folder vocabulary, layer direction, feature graph — inside this repo's existing toolchain, shared between `apps/store` and `apps/admin`, without adopting ESLint or Nx.

**Date:** 2026-09-05
**Context:** [`agent-structural-conventions.md`](./agent-structural-conventions.md) established *that* a folder-vocabulary rule can be expressed as a dependency-cruiser `required` rule with an unsatisfiable `to` (§3.1 there), and that no other tool in the survey fits this repo's stack. This document takes the next three questions: is anyone else doing that, what *else* should be checked, and how does the rule set stay maintainable once it spans two apps and keeps growing. The framing constraint is fixed: **no ESLint, no Nx.** The toolchain is Biome + dependency-cruiser 18.1.0 + custom TypeScript-AST scripts, aggregated by `scripts/verify.sh`. Every recommendation below was run against this repo; violation counts are real.

---

## Table of Contents

1. [Prior art: is anyone else using dependency-cruiser this way?](#1-prior-art-is-anyone-else-using-dependency-cruiser-this-way)
2. [Feature-Sliced Design's failure taxonomy, and what a machine can see](#2-feature-sliced-designs-failure-taxonomy-and-what-a-machine-can-see)
3. [Steiger's rule set, mapped to dependency-cruiser](#3-steigers-rule-set-mapped-to-dependency-cruiser)
4. [What is enforced today, per app, with real numbers](#4-what-is-enforced-today-per-app-with-real-numbers)
5. [The missing layer rules](#5-the-missing-layer-rules)
6. [A shared config both apps import](#6-a-shared-config-both-apps-import)
7. [Nested-path granularity and the edge cases](#7-nested-path-granularity-and-the-edge-cases)
8. [Recommendation](#8-recommendation)
9. [Thin evidence and what I could not verify](#9-thin-evidence-and-what-i-could-not-verify)

---

## 1. Prior art: is anyone else using dependency-cruiser this way?

Short answer: **the idea of architecture linters as agent guardrails is established and named by credible people; the specific technique is not.** One repository in public GitHub uses the unsatisfiable-`to` trick, nobody has written about it, and folder-structure linting as an agent guardrail is a published blank.

### 1.1 The unsatisfiable-`to` technique: one instance worldwide, and it isn't about AI

**Found: [voxel51/fiftyone](https://github.com/voxel51/fiftyone) (~10k stars).** `app/packages/multimodal/.dependency-cruiser.cjs` carries three `required` rules with an unsatisfiable `to`, used for exactly folder-structure validation. Verified by fetching the file:

```js
required: [
  {
    // Force every root TypeScript responsibility into a named namespace so
    // only the package's deliberate public entrypoint remains flat.
    name: "no-flat-multimodal-source-files",
    severity: "error",
    module: { path: `${SRC}(?!index\\.ts$)[^/]+\\.tsx?$` },
    to: { path: "^$" },
  },
  // + no-flat-views-typescript-files, no-flat-episode-typescript-files
]
```

`to: { path: "^$" }` rather than `(?!)`, but the mechanism is identical: no module path is ever the empty string, so every module matching `module.path` fails to satisfy the requirement and is reported. It is a plain fitness function — fiftyone has no `AGENTS.md`, `CLAUDE.md` or Copilot instructions referencing it. The rule shape is also nearly identical to `feature-root-has-no-loose-files` (§7): "no flat file at this root except the entrypoint."

**How exhaustive is that search?** A sub-agent enumerated every dependency-cruiser config filename on public GitHub via the code-search API (`.dependency-cruiser.js`/`.cjs`/`.mjs`/`.json`/`.jsonc`), fetched and grepped all 43 `.cjs` hits plus the other extensions for an actual `required:[` block, and found **six configs in the world with a real `required` rule**. Five are the canonical "must depend on X" form. One — fiftyone — inverts it. Separately, searching for `(?!)` inside dependency-cruiser configs returned two hits, both using it as a never-match sentinel inside `forbidden` rules, one with the comment *"a regex that never matches … rather than `[]`, which dependency-cruiser would treat as match-anything."* So **the never-match idiom is known; the `required` inversion is not.** Searches for the other never-match spellings (`a^`, `$^`) in configs returned zero.

That is a well-scoped negative. Caveat: GitHub code search only covers public, indexed repositories, and a config named something else (`depcruise.config.cjs`) would have been missed.

**Why it works, from the source.** `src/validate/violates-required-rule.mjs` flags a module when `!lMatchesSelf && !pModule.dependencies.some(matchesToPath)`; an unsatisfiable `to` makes both false for every matching module. `src/utl/regex-util.mjs` compiles patterns with a bare `new RegExp(pattern)` and no validation, so any never-matching regex works. **`(?!)` is the safer spelling than `^$` or `a^`**: `replaceGroupPlaceholders` performs `$N` substitution on `to.path` when `module.path` contains capture groups, and `^$` contains a `$`.

**One risk worth recording.** [dependency-cruiser issue #980](https://github.com/sverweij/dependency-cruiser/issues/980) (open since January 2025) asks for a warning when a `to` pattern never matches anything — which is precisely what this technique relies on. The maintainer is sympathetic to a warning mode but noted *"there might be legitimate reasons to have something not match e.g. in the `to` parts of rules."* If that ships as a hard error rather than an opt-in warning, these rules break. Low probability, non-zero, and cheap to notice.

### 1.2 The maintainer designed this feature in 2020 and never shipped it

sverweij has never endorsed folder-structure validation, but he reserved room for it. In [issue #328](https://github.com/sverweij/dependency-cruiser/issues/328#issuecomment-653882622) he explains why `required`'s selector is called `module` and not `from`:

> the `from` attribute was renamed to `module` so in the future it's possible to use the 'from' attribute for other useful things. E.g. **to make sure each source file has an associated spec file in the unit tests folder that directly points to it**

with a `// future feature` block sketching a `spec-per-source` rule. Six years on, `RequiredRuleType` still has no `from`, and `RequiredToRestrictionType` accepts only `path` and `reachable` — **notably no `pathNot`**, which is why grandfathering in §6.7 goes on the `module` selector rather than on `to`.

On folder layout generally he consistently answers with regexes over import paths rather than structure inspection — see [#330](https://github.com/sverweij/dependency-cruiser/issues/330#issuecomment-657274056), open since 2020, where a relative-path matcher was discussed and never built. The FAQ's flat refusal of finer granularity ("Does dependency-cruiser support granularity finer than modules? **No.**") is quoted in [`agent-structural-conventions.md` §3.1](./agent-structural-conventions.md).

Negative findings from quoted-phrase searches across the repo's issues and comments: `"folder structure"` → 0, `"file naming"` → 0, `"must not exist"` → 0, `"unsatisfiable"` → 0, `"inverse rule"` → 0. GitHub Discussions are **disabled** on the repo, so that channel is moot rather than unsearched.

**dependency-cruiser itself has no AI/agent story.** Zero matches for AI/LLM/agent/copilot/claude/cursor/MCP in the README; ~50 release bodies from v16.9.0 to v18.2.0 grep clean. The only AI artifact in the repo is a `.github/copilot-instructions.md` conventions file. The maintainer rejected the one AI-generated PR ([#1075](https://github.com/sverweij/dependency-cruiser/pull/1075#issuecomment-5159845337)).

### 1.3 Architecture linters as agent guardrails: the idea is established, the recipe is not

This is where the prior art actually is, and one source is close enough to this document's thesis to be worth reading in full.

**Birgitta Böckeler, "Maintainability sensors for coding agents"** (martinfowler.com, 2026-05-27, <https://martinfowler.com/articles/sensors-for-coding-agents.html>). She names the tool and the exact use case, and — this is the striking part — she hit the same folder-invention failure this repo hit:

> I worked with the agent to help me write `dependency-cruiser` rules to enforce these layers.

> I had to figure out how to catch things when AI starts creating new folders outside of this structure, with a rule that requires every new file to be somewhere in the predefined folder structure.

> Dependency parsers like `dependency-cruiser` can be effective live sensors to enforce some basic folder structures and dependency directions, **but they can only go so far.** Cross-file concerns like modularity and coupling were a different story, the raw data itself was very noisy and not that useful without semantic interpretation of an LLM, i.e. an inferential sensor.

**She does not publish the rule.** I fetched the article twice specifically looking for it; there is no config snippet and no rule name. So the closest thing to prior art for this document's central technique states the problem, states that a rule solved it, and omits the rule. On delivery she is candid that the easy path is unreliable:

> Via a guide - A skill, or a section in AGENTS.md that asks the agent to check the sensors regularly. This is the easiest way, and this is what I mostly did. But, it is also quite unreliable.

Her companion piece, ["Harness engineering for coding agent users"](https://martinfowler.com/articles/harness-engineering.html) (2026-04-02), has an explicit "architecture fitness harness" section with dep-cruiser in the feedback-sensor diagram.

The rest of the field is Java-shaped or vendor-shaped:

- **Codesai, ["Our Architectural Guardrails for AI-Generated Code"](https://codesai.com/posts/2026/04/minimal-architecture-constrainsts-in-agentic-world)** (2026-04) — ArchUnit as *deterministic* versus docs as *probabilistic*. Same argument, Java.
- **Podlesniuk, "From Prompts to Invariants"** (dev.to, 2026-01) — the agent-feedback-loop write-up: *"When the stop condition is defined by ArchUnit tests, the loop becomes deterministic."* Also Java.
- **Factory.ai, "Using Linters to Direct Agents"** (2025-09) — names the pattern "Agent-Native Development" ([HN thread](https://news.ycombinator.com/item?id=45185681)).
- **Thoughtworks Technology Radar Vol. 34** (2026-04) — theme "putting coding agents on a leash", recommending architectural fitness functions.
- Products exist: **Archgate** (ships Claude Code / Cursor / Copilot plugins), **ArchRAD** (MCP tools for agents).

**Real-world wiring, measured.** 335 public `CLAUDE.md` files and 336 `AGENTS.md` files mention dependency-cruiser; Miragon's `AGENTS.md` files it under a literal `## Guardrail tooling` heading. But of 12 repos with `depcruise` in `.claude/settings.json`, **11 are just `permissions.allow` entries**. Exactly one wires it as a real hook: [Flexksx/ponte](https://github.com/Flexksx/ponte/blob/HEAD/.claude/hooks/depcruise-after-edit.sh), a `PostToolUse` hook on `Edit|Write` returning violations through `hookSpecificOutput.additionalContext`, commented *"Violations come back as additionalContext, so Claude sees them and fixes them."* Its config uses only `forbidden` rules — so it cannot see an unimported file, the failure mode §7 is about.

**Credible negatives.** `eslint-plugin-project-structure`'s README mentions AI or agents **zero** times — it is not marketed as an agent tool, contrary to what the framing of this research assumed. Same for `eslint-plugin-boundaries`, `ts-arch` and `import-linter`. HN Algolia: `dependency-cruiser` → 3 stories ever, 0 comments; `ArchUnit` → 15 stories, none AI-related. **There is no named term for this pattern.** The O'Reilly Radar flagship on the topic ("Architectural Guardrails for AI-Generated Code", 2026-08) names zero tools.

### 1.4 So: off the map, or not?

**Both, in different places.**

| Claim | Verdict |
|---|---|
| Using an architecture linter as a deterministic guardrail for AI agents | **Established.** Böckeler, Codesai, Thoughtworks Radar, Factory.ai. Not novel. |
| Using *dependency-cruiser* specifically for that, including folder structure | **Published once**, by Böckeler, in prose, without the rule. |
| The `required`-with-unsatisfiable-`to` technique | **Effectively undocumented.** One repo (fiftyone), not framed as an agent guardrail, and nobody has written it up. |
| A worked TypeScript recipe — rules + shared config + agent rule file + hook | **Nobody has published it.** |

The practical consequence for this repo is small but real: nobody is maintaining this technique, so it must be verified by running it (which [`agent-structural-conventions.md` §3.1](./agent-structural-conventions.md) and §7 below both do), and issue #980 is worth watching. The consequence for confidence is the opposite of what "off the map" usually implies — the *idea* has independent support from people who reached it separately, and fiftyone is proof that the *mechanism* survives contact with a large real codebase.

---

## 2. Feature-Sliced Design's failure taxonomy, and what a machine can see

Feature-Sliced Design maintains three "issue" pages — the whole taxonomy, confirmed from the sidebar at <https://fsd.how/docs/guides/issues/desegmented/>; there is no fourth. (Useful trick: appending `.md` to any fsd.how docs URL returns the verbatim source, and <https://fsd.how/llms-full.txt> is the whole corpus.) They are worth reading closely because they name the smells this repo is trying to prevent, and because two of the three turn out to be only *partly* mechanical.

### 2.1 Desegmentation

<https://fsd.how/docs/guides/issues/desegmented/>

> Desegmentation (also known as horizontal slicing or packaging by layer) is a code organization pattern where files are grouped by their technical roles rather than by the business domains they serve.

**What it is.** Three distinct manifestations, and FSD is explicit that the smell is *recursive* — it can happen at the app level, inside a slice, and inside a single file:

1. **Whole-app horizontal slicing** — `app/components/`, `app/actions/`, `app/utils/`, `app/stores/` as the top-level shape.
2. **Generic folders inside a slice** — the page marks `features/delivery/ui/components ⚠️` and `entities/recommendations/utils ⚠️` as bad.
3. **Generic *files*** — `model/types.ts ⚠️`, `model/utils.ts ⚠️`, `api/endpoints.ts ⚠️`. The worked example is a `types.ts` holding both `DeliveryOption` and `UserInfo`, annotated `// ❌ Bad: Mixed business domains in generic file`.

> Files can also be a source of desegmentation. Files like `types.ts` can aggregate multiple domains, complicating navigation and future refactoring

**Why it happens.** Not ignorance — framework gravity plus a low startup cost:

> This approach is popular in meta-frameworks like Next and Nuxt due to its simplicity, as it's easy to get started and enables features like auto-imports and file-based routing … While this structure is easy to start with, it can lead to scalability issues in larger projects

**Consequences**, verbatim: low cohesion ("modifying a single feature often requires editing files in multiple large folders"), tight coupling ("unexpected dependencies, leading to complex and tangled dependency chains"), difficult refactoring.

**What FSD prescribes.**

> Group all code that relates to a specific domain in one place.
>
> Avoid generic folder names such as `types`, `components`, `utils`, as well as generic file names like `types.ts`, `utils.ts`, or `helpers.ts`. Instead, use names that directly reflect the domain they represent.

**Note the collision.** FSD's prescription and Bulletproof React's are *opposed at the segment level*. Bulletproof React's closed vocabulary is `api|assets|components|hooks|stores|types|utils` — a list FSD would call desegmented, and which Steiger's `segments-by-purpose` blocklists by name (§3). This repo follows Bulletproof React, so manifestation (2) is out of scope by construction: `features/checkout/components/` is *the* sanctioned shape here. What transfers is manifestation (3) — the generic *file* — and it transfers cleanly, because a `features/orders/types/index.ts` holding six unrelated domains is a smell under either methodology.

**Detectability.**

| Manifestation | Mechanically detectable? | How |
|---|---|---|
| (1) whole-app horizontal slicing | **Yes, trivially** | A path-shape assertion on `src/*`. This repo already has the right shape and the layer rules in §5 pin it. |
| (2) generic folders inside a slice | **Yes** — but this repo wants the opposite | The §7 vocabulary rule is exactly this check, inverted: it *requires* the generic names. Not applicable. |
| (3) generic files — a `types.ts` mixing domains | **No.** This is the hard one. | Path shape cannot see it: `features/orders/types/index.ts` is a legal path. Deciding that `DeliveryOption` and `UserInfo` are different domains needs semantics, not syntax. |

The honest partial answer on (3) is a **size proxy**, and it is a proxy, not the rule. A TS-AST script can count exported symbols per file, or exported type declarations per `types/` file, and warn past a threshold. That is what Steiger does for the adjacent problem — `excessive-slicing` fires at 20 slices, `shared-lib-grouping` at 15 modules, and both thresholds are documented in the rule's own README as "set arbitrarily". A threshold catches the pathological case and misses the ordinary one. Do not pretend otherwise, and do not gate on it: if this is ever added here, `severity: 'warn'` is the honest setting, and `npm run verify` fails on warnings, so it would need its own non-gating script.

### 2.2 Cross-imports

<https://fsd.how/docs/guides/issues/cross-imports/>

**What it is**, precisely:

> A **cross-import** is an import **between different slices within the same layer**.
> For example: importing `features/product` from `features/cart`; importing `widgets/sidebar` from `widgets/header`
> **Note:** The `shared` and `app` layers do not have the concept of a slice, so imports *within* those layers are **not** considered cross-imports.

That definition maps 1:1 onto this repo: a slice is a folder under `src/features/`, and a cross-import is an edge between two of them. `src/components/` and `src/routes/` are sliceless layers, so intra-layer edges there are not cross-imports.

**FSD's framing is deliberately non-absolute**, and this is the part most summaries drop:

> Cross-imports are a code smell: a warning sign that slices are becoming coupled. In some situations they may be hard to avoid, but they should always be deliberate and either documented or shared within the team/project.

> In the `features` and `widgets` layers, it's usually more realistic to say there are **multiple strategies** for handling cross-imports, rather than declaring them **always forbidden**.

**Why it happens / why it hurts.** Four numbered reasons: unclear ownership ("it becomes unclear which slice 'owns' the shared logic"), reduced isolation and testability ("testing `cart` now requires setting up `product` as well"), increased cognitive load, and — the one that matters most for a graph rule — **path to circular dependencies**:

> Cross-imports often start as one-way dependencies but can evolve into bidirectional ones (A imports B, B imports A).

**What FSD prescribes.** Four named strategies, only one of which is "forbid it":

- **A — Slice merge.** "If two slices are not truly independent and they are always changed together, merge them into a single larger slice."
- **B — Push the shared domain flow down a layer.** `entities` holds "domain types and domain logic only"; the UI stays up in `features`. This repo's equivalent is "move it down to `src/lib` or `src/components`", which is exactly the wording already in `apps/store/deps-analyzer/.dependency-cruiser.cjs`: *"When two features need the same thing, the thing was never feature-specific — move it down to a shared layer instead of adding an edge."*
- **C — Compose from an upper layer.** "rather than slices knowing about each other, an upper layer assembles and connects them" — render props, slots, dependency injection. The upper layer here is `src/routes/`.
- **D — Accept it, but only through the public API.** "Avoid directly accessing another slice's `store`/`model` or internal implementation details."

The page also lists **warning signs** that upgrade a tolerated cross-import to a defect: deep imports into another slice's internals, and **bidirectional dependencies**.

**Detectability.** This one is almost entirely mechanical, and this repo already does the hard part.

| Aspect | Detectable? | How |
|---|---|---|
| A cross-import exists at all | **Yes** | `from: ^src/features/X/` → `to: ^src/features/` with `pathNot` for X. Already in `FEATURE_GRAPH`. |
| The edge is *undeclared* | **Yes** | The existing `feature-graph-undeclared` rule. |
| Bidirectional / cyclic feature edges | **Yes** — and this is the gap | dependency-cruiser's `no-circular` works on *modules*, not on features. A feature-level cycle with no module-level cycle passes today. `apps/admin` has exactly one (§4.2). A declared acyclic `FEATURE_GRAPH` makes the cycle unrepresentable, which is why ADR 0020's shape is the right one. |
| Deep import bypassing a public API | **Yes**, if you adopt one | `to: { path: '^src/features/[^/]+/.+' }` with an exception for `index.ts`. This repo has no per-feature `index.ts` barrel, so the rule has nothing to enforce today. Adding barrels is a real cost (bundle-level, and TanStack's code-splitting); see §8. |
| Whether the edge is *deliberate* (strategy A vs D) | **No** | This is the judgement half. The tool can force the edge to be written down; it cannot decide whether merging the slices would have been better. |

The mapping to keep is: **FSD's "documented or shared within the team" is exactly what a declared `FEATURE_GRAPH` is.** The graph does not prevent cross-imports; it makes each one an explicit, reviewed line in a config file with an ADR behind it. That is FSD's strategy D implemented as a lint rule.

### 2.3 Excessive entities

<https://fsd.how/docs/guides/issues/excessive-entities/> — included for completeness. It is about over-populating FSD's `entities` layer, a layer this repo does not have. Its transferable content is one line:

> In contrast to previous versions, FSD 2.1 encourages deferred decomposition of slices instead of preemptive … At first, you can place all your code in the `model` segment of your page (widget, feature), and then consider refactoring it later, when business requirements are stable.

**Detectability: partial and threshold-based.** Steiger's `excessive-slicing` counts slices per layer and fires past 20. That is expressible here — a `required` rule cannot count, but a ~15-line TS-AST/`fs` script can, and it would join `scripts/verify.sh`'s `job_conventions`. With seven features in the store and eight in the admin, it would report nothing for years. **Not worth building now.**

### 2.4 The three smells, ranked by detectability

1. **Cross-imports between features** — fully mechanical, and already enforced in `apps/store` (not in `apps/admin`, §4.2).
2. **Whole-app horizontal slicing / layer-direction violations** — fully mechanical, and **not enforced in either app** (§4, §5). This is the largest live gap.
3. **Loose files and unsanctioned folders inside a feature** — fully mechanical via the `required`-rule technique (§7), enforced in neither app.

Everything else in FSD's taxonomy — the generic `types.ts`, whether a cross-import should have been a merge, whether a slice is preemptive — needs a human. Say so in the rule file rather than shipping a threshold that pretends to decide it.

---

## 3. Steiger's rule set, mapped to dependency-cruiser

Steiger (<https://github.com/feature-sliced/steiger>) is the closest existing thing to what this repo wants: a structural linter that traverses the filesystem rather than an AST. This is **pattern extraction, not adoption** — Steiger is FSD-specific and this repo is Bulletproof React. What is worth stealing is the taxonomy.

The full rule set is 21 directories under `packages/steiger-plugin-fsd/src/`, of which **20 are registered** (`no-file-segments` exists with tests and a README but is never imported by `src/index.ts` — dead code). The README's table lists 20 and omits it. Latest: `steiger@0.6.0` and `@feature-sliced/steiger-plugin@0.7.0`, both 2026-07-14.

The single most useful structural fact: **15 of the 21 rules never parse an import.** They are pure filesystem-shape assertions. Only six do module resolution (tsconfig aliases + tree-sitter parsing), and those are the expensive, framework-coupled ones. That split is the design lesson for this repo — the cheap rules are the tree rules, and dependency-cruiser can express a tree rule only through the `required`-with-unsatisfiable-`to` trick.

| Steiger rule | What it checks | Tree / imports | dependency-cruiser equivalent? |
|---|---|---|---|
| `forbidden-imports` | Higher-layer imports **and** same-layer cross-imports | imports | **Yes, directly.** This is `forbidden` with `from`/`to` path pairs — §5's layer rules plus the existing `FEATURE_GRAPH` rules together *are* this rule. |
| `no-higher-level-imports` | Only the layer half | imports | **Yes.** §5 exactly. |
| `no-cross-imports` | Only the same-layer half | imports | **Yes.** `feature-graph-*` in the store's config. |
| `no-public-api-sidestep` | Importing a slice's internal module instead of its index | both | **Yes**, mechanically: `to: '^src/features/[^/]+/.+'` with an `index` exception. Requires per-feature barrels, which this repo does not have. |
| `import-locality` | Intra-slice imports relative, inter-slice absolute | imports | **Partly.** dependency-cruiser resolves specifiers before matching, so the *raw* specifier is not a first-class criterion. There is a `dependencyTypes` for `aliased`/`local`, but distinguishing `./x` from `#/features/cart/x` reliably is a grep or a TS-AST script, not a depcruise rule. |
| `insignificant-slice` | Slices with 0 or 1 inbound reference (delete or merge) | both | **Partly.** `orphan: true` covers the zero case. "Exactly one reference" needs a count, which dependency-cruiser cannot express — but it can emit JSON (`--output-type json`) for a 20-line script to count. |
| `public-api` | Every slice/segment has an index file | tree | **No.** `required` proves a module *must not* exist; it cannot prove one *must*. This needs an `fs` script. |
| `no-layer-public-api` | No index file at layer level | tree | **Yes.** `module: { path: '^src/features/index\\.tsx?$' }`, `to: '(?!)'`. |
| `no-segmentless-slices` | A slice contains at least one segment folder | tree | **No** — same "must exist" problem. `fs` script. |
| `no-segments-on-sliced-layers` | Segment names appearing directly under a layer | tree | **Yes.** `module: { path: '^src/features/(?:api\|components\|hooks\|...)/' }`, `to: '(?!)'`. |
| `no-file-segments` | Segments must be folders, not files (`features/cart/ui.tsx`) | tree | **Yes** — and this repo gets it free: §7's `feature-root-has-no-loose-files` catches `features/cart/utils.ts` because `utils.ts` does not match `utils/`. Verified. |
| `no-reserved-folder-names` | Segment names reused one level deeper (`shared/ui/lib`) | tree | **Yes.** `module: { path: '^src/features/[^/]+/(?:seg)/(?:seg)/' }`, `to: '(?!)'`. |
| `segments-by-purpose` | Blocklist of ~50 essence-based names (`components`, `utils`, `types`, `hooks`, `stores`…) | tree | **Yes** mechanically — but it would blocklist exactly the names this repo mandates. **Directly opposed. Do not port.** |
| `ambiguous-slice-names` | A slice name colliding with a `shared` segment name | tree | **Yes.** Generated regex from the two name lists. Cheap, and a real hazard here: a feature named `components` would be legal today. |
| `no-reserved-folder-names`, `no-ui-in-app`, `no-processes` | FSD-specific folder prohibitions | tree | **Yes**, same shape. Nothing to port — no FSD layers here. |
| `excessive-slicing` | > 20 slices on a layer, or per group | tree | **No** (counting). `fs` script. |
| `shared-lib-grouping` | > 15 ungrouped modules in `shared/lib` | tree | **No** (counting). `fs` script. Adjacent to a real question here: `apps/store/src/lib` and `apps/admin/src/lib` are ungrouped. |
| `repetitive-naming` | Suffix repeated across every slice (`pages/homePage`, `pages/aboutPage`) | tree | **No** (cross-name comparison). `fs` script; ~15 lines. |
| `inconsistent-naming` | Mixed pluralization across sibling slices | tree | **No.** And note this repo already has it: `apps/admin/src/features/` holds `products` and `product-options` next to `auth` and `uploads`. Steiger's own README flags the rule as "in early development". |
| `typo-in-layer-name` | Levenshtein distance against known layer names | tree | **No** (fuzzy matching). Would be an `fs` script — and it is a genuinely good idea for a closed vocabulary: `feautres/` or `util/` would today be silently invisible to every rule, because every regex is anchored on the correct spelling. |

**Three things to take from this table.**

**(a) The layer + cross-import rules are the high-value half, and dependency-cruiser expresses them natively.** No trick needed. That is §5.

**(b) The `required`-with-unsatisfiable-`to` trick covers every "this must not exist" tree rule and none of the "this must exist" ones.** It is a prohibition primitive. `public-api` and `no-segmentless-slices` — both "must exist" — are the shape that forces a script. Worth knowing before designing a rule: if you can phrase it as "no file may be at path P", dependency-cruiser has it; if you must phrase it as "some file must be at path P", it does not.

**(c) A typo in a folder name defeats every regex-anchored rule silently.** `src/feautres/checkout/widgets/x.ts` matches nothing and passes. This is the single cheapest script to add and the one most likely to actually fire, because a fat-fingered directory name is exactly the failure a human review misses. Steiger built `typo-in-layer-name` for precisely this.

### 3.1 Steiger declined the folder allowlist — does the reasoning apply here?

[Issue #50, "Implement `conventional-segments`"](https://github.com/feature-sliced/steiger/issues/50), was opened by the maintainer (illright / Lev Chelyadinov) on 2024-07-03 and closed by him on 2024-08-04 as `not_planned`. The entire recorded rationale is one comment:

> Actually, I don't think this should be checked for

That is all the discussion there is — no argument was written down. What Steiger shipped instead is `segments-by-purpose`, a **blocklist** of ~50 essence-based names rather than an allowlist of good ones: invent any segment name you like, provided it names a *purpose* and not a *technical essence*.

The pressure since has been toward *more* permissiveness. [Issue #218](https://github.com/feature-sliced/steiger/issues/218) (opened 2025-09-22, still open) is a team asking for a configurable extra segment. Their reason is worth quoting because it is the strongest real-world case against a closed vocabulary:

> We generally don't go beyond the conventional categories, but in our case we use an additional `bridge` segment due to legacy migration needs. We are gradually migrating a legacy project into a new repository, and because of this, every feature still needs to communicate with the legacy project. For that reason, we are **intentionally** placing the bridge functionality in a separate folder rather than inside the `model` or `lib` folders of a feature.

The maintainer was receptive ("This is a good point"), and the underlying `isSlice` helper already takes an `additionalSegmentNames` option; Steiger just does not plumb it through.

**Does it apply to this repo? Partly, and the answer changes the design rather than the decision.**

Where it *does* apply: `features/checkout/payment/` was exactly the `bridge` case — 17 files with a coherent purpose and an ADR (0010) behind it, not sloppiness. A vocabulary rule that calls that an error looks wrong about it. (It has since been moved to `checkout/utils/payment/` rather than exempted, §4.1 — which is a real answer to the objection, but only because the sub-feature happened to fit under one existing segment. It will not always.)

Where it *does not*: Steiger is a general-purpose linter shipped to strangers, and a maintainer refusing to hard-code one project's taste is a different decision from a single repo choosing its own. FSD's reference explicitly says "You can also create custom segments"; **Bulletproof React's does not** — it states seven names as a closed list. This repo follows Bulletproof React. And the failure this rule set exists to catch is not "`payment-methods/` is a bad name" — it is "an agent invented structure unilaterally inside a PR". A blocklist cannot catch an invented name, by definition.

The synthesis, which is what §6 implements: **keep the allowlist, but make extending it a first-class, one-line operation with a written reason.** `FEATURE_SEGMENTS` in one file, `grandfathered` as an explicit array per app with an ADR reference in the comment. That is `additionalSegmentNames`, which is what issue #218 is asking for and what Steiger has not yet shipped.

### 3.2 Steiger is now extensible — the README is stale

Worth correcting, because [`agent-structural-conventions.md` §3.6](./agent-structural-conventions.md) records the opposite. The README on `master` and the published npm README both still say:

> Currently, Steiger is not extendable with more rules, though that will change in the near future.

That is out of date and the maintainer knows — [issue #172](https://github.com/feature-sliced/steiger/issues/172) is "Update the README to say that custom rules can be written now", opened by him and still open. Custom rules have worked since **0.5.0 (2024-11-11)**: issue #35 was closed with *"And this is also possible now with Steiger 0.5.0!"*, `@steiger/toolkit` (0.2.3) is published as "Toolkit for writing rules for Steiger" and exports `createPlugin` / `createConfigs`, and the FSD ruleset itself is just a plugin built with that API.

This does **not** change the recommendation. Adopting Steiger would mean adopting FSD's layer model wholesale (its `Folder` traversal and every default rule assume `app`/`pages`/`widgets`/`features`/`entities`/`shared`), plus a second structural linter alongside dependency-cruiser for rules dependency-cruiser already expresses. But the §3.6 sentence should not be repeated as current.

---

## 4. What is enforced today, per app, with real numbers

All figures below come from running dependency-cruiser 18.1.0 against the working tree on 2026-09-05. Baseline: both apps pass their committed configs.

```
apps/store:  ✔ no dependency violations found (440 modules, 1237 dependencies cruised)
apps/admin:  ✔ no dependency violations found (594 modules, 1607 dependencies cruised)
```

### 4.1 `apps/store` — `deps-analyzer/.dependency-cruiser.cjs`

| Concern | Rule | Status |
|---|---|---|
| Cross-feature import graph | `feature-graph-*` (7 rules, generated from `FEATURE_GRAPH`) + `feature-graph-undeclared` | **Enforced.** ADR 0020. |
| Module-level cycles | `no-circular` | **Enforced.** |
| Gateway leakage | `stripe-stays-in-its-adapter` | **Enforced.** ADR 0010. |
| Wrong app's schemas | `no-admin-schemas-in-store` | **Enforced.** |
| **Layer direction (`shared → features → routes`)** | — | **Not enforced.** |
| **Feature folder vocabulary** | — | **Not enforced.** |
| **Loose files at a feature root** | — | **Not enforced.** |

Measured, by adding only the missing rules:

- **`shared/` importing `features/`: 8 violations across 4 files.**
  ```
  src/components/header/search-results.tsx      → features/products/components/product-grid.tsx
  src/components/header/search-results.tsx      → features/products/api/products.ts
  src/components/header/search-best-sellers.tsx → features/products/components/product-grid.tsx
  src/components/header/search-best-sellers.tsx → features/products/api/products.ts
  src/components/header/header.tsx              → features/cart/components/cart-trigger.tsx
  src/components/header/header.tsx              → features/cart/components/cart-drawer.tsx
  src/components/cart-mismatch-banner.tsx       → features/cart/api/cart.ts
  src/components/cart-mismatch-banner.tsx       → features/account/api/customer.ts
  ```
- **`features/` importing `routes/`: 0.** **`shared/` importing `routes/`: 0.** Those two rules can be turned on today at zero cost.
- **Feature folder vocabulary: 0 violations. Loose files at a feature root: 0.**

That last line changed *during* this research and the sequence is worth recording, because it is the strongest evidence in this document that the rule is describing something real. The first run, early in the session, reported **17 violations, all in `features/checkout/payment/`** — 12 files at that folder's root plus 5 under `adapters/stripe/`. Partway through, the working tree moved that whole subtree to `features/checkout/utils/payment/` and split `payment/types.ts` into `checkout/types/payment.ts`; `STRIPE_ADAPTER_PATH` in the committed config was updated to match. The store's features are now exactly `api`, `components`, `hooks`, `types`, `utils`, and both vocabulary rules report clean.

So the store now needs **no grandfathering at all**, and the design question §3.1 raises — whether to widen the vocabulary for `payment/` or move it — was answered by moving it. §6.4 keeps the `grandfathered` parameter because the admin and future features will need it, and because it is the mechanism, not the instance, that matters.

The four loose feature-root files `agent-structural-conventions.md` §1(c) listed (`address/form-values.ts`, `checkout/checkout-address.ts`, `orders/fulfillment-labels.ts`, `orders/order-progress.ts`) had already been moved into `utils/` before this session started. **Both documents' counts are correct for the tree each was run against; neither is correct now.** Re-measure before acting on any number here.

For context on the allowed directions: **140** `features → shared` edges and **47** `routes → features` edges. The layer model already describes how the code is actually written; the 8 violations are the exception, not a rewrite.

### 4.2 `apps/admin` — `deps-analyzer/.dependency-cruiser.cjs`

The admin config is 3 rules and shares **none** of the store's structural rules.

| Concern | Rule | Status |
|---|---|---|
| Module-level cycles | `no-circular` | **Enforced.** |
| Table library containment | `no-tanstack-table-outside-data-table` | **Enforced.** |
| Wrong app's schemas | `no-store-schemas-in-admin` | **Enforced.** |
| **Cross-feature import graph** | — | **Not enforced.** No `FEATURE_GRAPH` exists. |
| **Layer direction** | — | **Not enforced.** |
| **Feature folder vocabulary** | — | **Not enforced.** |
| **Loose files at a feature root** | — | **Not enforced.** |

Measured:

- **`shared/` importing `features/`: 2 violations, 2 files.**
  ```
  src/components/layout/user-menu.tsx → features/auth/api/auth.ts
  src/components/layout/shell.tsx     → features/notifications/components/notification-bell.tsx
  ```
- **`features/` importing `routes/`: 0.** **`shared/` importing `routes/`: 0.**
- **Loose files at a feature root: 5 violations.**
  ```
  src/features/products/media.ts
  src/features/products/constants.ts
  src/features/product-options/option-change-consequences.ts
  src/features/product-options/option-change-consequences.test.ts
  src/features/orders/constants.ts
  ```
- **Unsanctioned folders under a feature: 0.** The admin's feature folders are all `api`/`components`/`hooks`.
- Allowed directions for context: **166** `features → shared`, **56** `routes → features`.

**And the finding that matters most for the admin: there is a feature-level cycle.** The actual cross-feature edge list, extracted from `#/features/…` specifiers:

```
auth            -> (none)
customers       -> (none)
notifications   -> auth
orders          -> (none)
product-options -> products      ← cycle
products        -> product-options, uploads  ← cycle
uploads         -> (none)
users           -> (none)
```

`no-circular` passes because no *module* cycle exists — `products/hooks/use-variant-table.tsx` imports from `product-options/`, and `product-options/api/product-options.ts` imports from `products/`, but the two files never close a loop. ADR 0020's acyclic feature graph would make this unrepresentable, which is precisely the FSD "path to circular dependencies" warning sign (§2.2) firing early. The four files on the `products → product-options` side and two on the reverse:

```
products/components/create-product-form/product-create-variants-section.tsx
products/components/create-product-form/variant-rows.ts
products/components/create-product-form/product-create-variants-form.tsx
products/hooks/use-variant-table.tsx
product-options/hooks/use-option-products-table.tsx
product-options/api/product-options.ts
```

So the admin cannot adopt a DAG `FEATURE_GRAPH` today without either breaking that cycle or merging the two features (FSD's strategy A, §2.2 — and `product-options` and `products` are plausibly one slice).

### 4.3 Summary of the gap

| | store | admin |
|---|---|---|
| Layer direction | **not enforced** — 8 violations if turned on | **not enforced** — 2 violations |
| Feature vocabulary | **not enforced** — 0 violations (was 17 before the `checkout/utils/payment/` move) | **not enforced** — 0 violations |
| Loose files at feature root | **not enforced** — 0 violations | **not enforced** — 5 violations |
| Feature graph | enforced (ADR 0020) | **not enforced**, and a cycle exists |
| Module cycles | enforced | enforced |

Total cost of turning on everything, as of the current tree: **8 violations in the store, 7 in the admin** — all of them one rule in the store and two rules in the admin. In both apps the `features → routes` and `shared → routes` directions are already clean, and **both vocabulary rules are clean in the store**. This is about as cheap as this rule set will ever be to adopt.

---

## 5. The missing layer rules

Bulletproof React prescribes two things. The [project-structure doc](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) states the seven-folder vocabulary, and separately gives an enforcement recipe for the *import direction* — the `import/no-restricted-paths` zones quoted in [`agent-structural-conventions.md` §3.7](./agent-structural-conventions.md). This repo implements a **feature graph** (a strictly stronger constraint than BR asks for, per ADR 0020) but never implemented the **layer direction** BR actually ships a recipe for. That is the gap §4 measures.

The model, three layers, outermost first:

| Layer | Directories | May import |
|---|---|---|
| `routes` (BR calls it `app`) | `src/routes/` | features, shared |
| `features` | `src/features/` | shared, and other features per `FEATURE_GRAPH` |
| `shared` | `src/{api,assets,components,hooks,lib,stores,styles,types,utils}/` | shared only |

Generated as one rule per (lower layer, higher layer) pair, so each message names both ends:

```js
const LAYERS = [
  { name: 'routes', dirs: ['routes'] },
  { name: 'features', dirs: ['features'] },
  { name: 'shared', dirs: ['api', 'assets', 'components', 'hooks', 'lib', 'stores', 'styles', 'types', 'utils'] },
]

function layerRules({ root = '^src/' } = {}) {
  const rules = []
  for (let i = LAYERS.length - 1; i >= 0; i -= 1) {
    const lower = LAYERS[i]
    for (const higher of LAYERS.slice(0, i)) {
      rules.push({
        name: `layer-${lower.name}-imports-${higher.name}`,
        severity: 'error',
        comment:
          `${lower.name}/ sits below ${higher.name}/ and must not import it. ` +
          `Move the shared thing down into a lower layer, or move the importer up into ${higher.name}/.`,
        from: { path: `${root}(?:${lower.dirs.join('|')})/` },
        to: { path: `${root}(?:${higher.dirs.join('|')})/` },
      })
    }
  }
  return rules
}
```

Three rules result: `layer-shared-imports-routes`, `layer-shared-imports-features`, `layer-features-imports-routes`. Run against both apps, the counts are the ones in §4 — 8 and 2, all of them `layer-shared-imports-features`.

Two design notes worth recording:

**Why generate rather than hand-write three objects.** Adding a fourth layer, or moving a directory between layers, is then a one-line edit to `LAYERS` rather than a re-derivation of the pair matrix. With three layers the matrix is 3 rules; with four it is 6. This is the maintainability property §6 is about, in miniature.

**`no-circular` does not subsume these.** A one-way `components → features` edge is not a cycle and passes `no-circular` forever. The eight store violations are all one-way.

### 5.1 What the eight store violations actually are

Worth looking at before writing the rule off as bureaucracy, because they are all the same shape and all legitimate-looking:

- `components/header/header.tsx` renders the cart trigger and drawer.
- `components/header/search-*.tsx` render a product grid and call the products API.
- `components/cart-mismatch-banner.tsx` reads cart and customer state.

These are **app-shell composition**, and FSD's strategy C names the fix exactly (§2.2): composition belongs in the layer *above* the slices, not below them. `src/components/header/` is a shared-layer folder doing a routes-layer job. The mechanical fix is to move the composing components up — a `src/routes/-components/` or a widgets layer between `routes` and `features` — or to invert with children/slots so the shared shell takes the cart trigger as a prop and the route supplies it.

The admin's two are the same shape (`components/layout/shell.tsx` renders the notification bell; `user-menu.tsx` calls the auth API).

That is a real refactor, not a config change, which is the honest reason this rule is not free. See §8 for the sequencing.

---

## 6. A shared config both apps import

The requirement: one frontend structural standard, app-specific extensions on top, one place where the folder vocabulary is stated, and it has to survive being edited every few months. Prototyped in a scratch directory and **run against both apps**; results at the end of this section.

### 6.1 Where it lives

**A workspace package: `packages/frontend-conventions/`.** The root `package.json` already globs `packages/*`, so `npm install` symlinks it into the root `node_modules` and both apps resolve `require('@proteus/frontend-conventions')` with no path juggling. Verified from all four relevant working directories:

```
cwd=apps/store                 -> …/frontend-conventions/index.cjs
cwd=apps/admin                 -> …/frontend-conventions/index.cjs
cwd=apps/store/deps-analyzer   -> …/frontend-conventions/index.cjs
cwd=apps/admin/deps-analyzer   -> …/frontend-conventions/index.cjs
```

CommonJS resolution walks up from the *requiring file*, not from the process cwd, so a config at `apps/store/deps-analyzer/.dependency-cruiser.cjs` reaches the root `node_modules` the same way `apps/admin`'s does. That is the property that makes this work; a root-level `.cjs` file required by relative path (`require('../../../deps-rules.cjs')`) works identically and needs no install, but a workspace package is the shape the repo already uses for `packages/utils` and `packages/testing`, so it is the one to pick.

One detail: **do not add an `exports` field.** Without one, deep subpath requires (`@proteus/frontend-conventions/vocabulary.cjs`) work, which is what lets a doc generator import the vocabulary without pulling in the rule builders. With an `exports` map you would have to enumerate every subpath.

### 6.2 Keeping the path regexes correct when cwd differs

This is less of a problem than it looks, and the reason is worth writing down so nobody re-solves it.

dependency-cruiser matches rule paths against **module paths relative to the process cwd**. Both apps run `depcruise src/ --config deps-analyzer/.dependency-cruiser.cjs` via `npm run --workspace=<app> check:deps`, and npm sets cwd to the workspace root. So `^src/features/` means the same thing in both apps. The regexes are already portable; nothing needs to change.

What makes it *robust* rather than merely lucky is threading a `root` parameter through every builder, defaulting to `'^src/'`. Verified by cruising from the repo root instead:

```
$ npx depcruise apps/store/src --config <config with root: '^apps/store/src/'>
… 8 dependency violations (8 errors, 0 warnings). 312 modules, 734 dependencies cruised.
```

Same eight violations, different prefix. So the shared package is not coupled to a particular invocation site — which matters the day someone wants one cruise over the whole monorepo for a graph render.

### 6.3 One source of truth for the vocabulary

`packages/frontend-conventions/vocabulary.cjs` holds **data only**, no rule objects:

```js
/**
 * The frontend structural vocabulary. Stated ONCE, here.
 *
 * Every dependency-cruiser rule, every generated doc and every agent rule file reads this file.
 * Nothing else may hard-code a folder name. Adding a name here is the whole change.
 */

/** The only folders allowed directly under `src/features/<feature>/` (Bulletproof React). */
const FEATURE_SEGMENTS = ['api', 'assets', 'components', 'hooks', 'stores', 'types', 'utils']

/** The only files allowed directly at a feature root. */
const FEATURE_ROOT_FILES = ['index.ts', 'index.tsx']

/**
 * The layers, outermost first. A layer may import from any layer below it and never from one
 * above. `routes` is the app layer (Bulletproof React calls it `app`); `shared` is everything a
 * feature is allowed to reach for.
 */
const LAYERS = [
  { name: 'routes', dirs: ['routes'] },
  { name: 'features', dirs: ['features'] },
  { name: 'shared', dirs: ['api', 'assets', 'components', 'hooks', 'lib', 'stores', 'styles', 'types', 'utils'] },
]

module.exports = { FEATURE_SEGMENTS, FEATURE_ROOT_FILES, LAYERS }
```

`index.cjs` builds rules from it and exports one composed entry point plus the individual builders:

```js
const { FEATURE_SEGMENTS, FEATURE_ROOT_FILES, LAYERS } = require('./vocabulary.cjs')

const group = (names) => `(?:${names.join('|')})`
const escapeDot = (name) => name.replace(/\./g, '\\.')

// layerRules() — as given in §5

/**
 * Feature vocabulary: only the sanctioned segments at the first level under a feature,
 * and no loose files at a feature root. Nesting *inside* a segment is unconstrained.
 *
 * These are `required` rules with an unsatisfiable `to`, because only `required` rules are
 * evaluated per module rather than per import edge — a file that imports nothing still has to
 * satisfy one. See docs/research/agent-structural-conventions.md §3.1.
 */
function vocabularyRules({ root = '^src/', grandfathered = [] } = {}) {
  const segments = group(FEATURE_SEGMENTS)
  const rootFiles = group(FEATURE_ROOT_FILES.map(escapeDot))
  const exempt = grandfathered.length ? { pathNot: `(?:${grandfathered.join('|')})` } : {}
  return [
    {
      name: 'feature-folder-vocabulary',
      severity: 'error',
      comment:
        `A feature holds only ${FEATURE_SEGMENTS.join(', ')} at its first level. ` +
        'Move the file into one of those, or extend FEATURE_SEGMENTS in ' +
        '@proteus/frontend-conventions/vocabulary.cjs and say why in an ADR.',
      module: { path: `${root}features/[^/]+/(?!${segments}/)[^/]+/`, ...exempt },
      to: { path: '(?!)' },
    },
    {
      name: 'feature-root-has-no-loose-files',
      severity: 'error',
      comment: `A feature root holds folders and ${FEATURE_ROOT_FILES.join(' / ')} only.`,
      module: { path: `${root}features/[^/]+/(?!${segments}/|${rootFiles}$)[^/]+\\.[^/]+$`, ...exempt },
      to: { path: '(?!)' },
    },
  ]
}

// featureGraphRules(featureGraph, { root }) — lifted verbatim from the store's current config

function frontendConventions({ featureGraph, grandfathered = [], root = '^src/' } = {}) {
  return {
    forbidden: [
      { name: 'no-circular', severity: 'error', comment: 'No circular dependencies allowed.',
        from: {}, to: { circular: true } },
      ...layerRules({ root }),
      ...(featureGraph ? featureGraphRules(featureGraph, { root }) : []),
    ],
    required: vocabularyRules({ root, grandfathered }),
  }
}

module.exports = { frontendConventions, layerRules, vocabularyRules, featureGraphRules, FEATURE_SEGMENTS, LAYERS }
```

The **error message names the vocabulary and names the file to edit**. That is deliberate: FeedbackEval ranks raw compiler-style output last among feedback channels because it localises without explaining ([`agent-structural-conventions.md` §5.3](./agent-structural-conventions.md)), and the whole point of these rules is that an agent reads the failure and fixes it.

### 6.4 What an app's config becomes

`apps/store/deps-analyzer/.dependency-cruiser.cjs` — the shared standard, then the store's own rules:

```js
const { frontendConventions } = require('@proteus/frontend-conventions')

const FEATURE_GRAPH = {
  cart: [], orders: [], address: [],
  auth: ['cart'], account: ['auth', 'orders'],
  checkout: ['cart', 'auth', 'address', 'account'],
  products: ['cart'],
}

/**
 * Subtrees that predate the vocabulary rule. Each entry needs an ADR reference and a reason.
 * Empty today — `checkout/payment/` was moved into `checkout/utils/payment/` rather than exempted.
 * Not precedent: do not add an entry to avoid a `git mv`.
 */
const GRANDFATHERED = []

const STRIPE_ADAPTER_PATH = '^src/features/checkout/utils/payment/adapters/stripe/'

const shared = frontendConventions({ featureGraph: FEATURE_GRAPH, grandfathered: GRANDFATHERED })

module.exports = {
  forbidden: [
    ...shared.forbidden,
    { name: 'no-admin-schemas-in-store', severity: 'error',
      comment: 'Store app must not import admin schemas.',
      from: { path: '^src/' }, to: { path: 'packages/http-schemas/src/admin/' } },
    { name: 'stripe-stays-in-its-adapter', severity: 'error',
      comment: 'Every Stripe symbol belongs under the adapter. See ADR 0010.',
      from: { pathNot: STRIPE_ADAPTER_PATH }, to: { path: '(^|/)node_modules/@stripe/' } },
  ],
  required: shared.required,
  options: { /* unchanged */ },
}
```

`apps/admin/deps-analyzer/.dependency-cruiser.cjs` is the same three lines with no `featureGraph` (until the cycle in §4.2 is resolved) and its own two rules.

### 6.5 Did it run?

**Yes.** The package was built in the scratch directory, symlinked into the repo's root `node_modules` as `@proteus/frontend-conventions`, and both configs above were placed in each app's `deps-analyzer/` and cruised. Output, verbatim:

```
======== store (shared config via bare specifier) ========
  error layer-shared-imports-features: src/components/header/search-results.tsx → src/features/products/components/product-grid.tsx
  error layer-shared-imports-features: src/components/header/search-results.tsx → src/features/products/api/products.ts
  error layer-shared-imports-features: src/components/header/search-best-sellers.tsx → src/features/products/components/product-grid.tsx
  error layer-shared-imports-features: src/components/header/search-best-sellers.tsx → src/features/products/api/products.ts
  error layer-shared-imports-features: src/components/header/header.tsx → src/features/cart/components/cart-trigger.tsx
  error layer-shared-imports-features: src/components/header/header.tsx → src/features/cart/components/cart-drawer.tsx
  error layer-shared-imports-features: src/components/cart-mismatch-banner.tsx → src/features/cart/api/cart.ts
  error layer-shared-imports-features: src/components/cart-mismatch-banner.tsx → src/features/account/api/customer.ts
x 8 dependency violations (8 errors, 0 warnings). 440 modules, 1237 dependencies cruised.

======== admin (shared config via bare specifier) ========
  error layer-shared-imports-features: src/components/layout/user-menu.tsx → src/features/auth/api/auth.ts
  error layer-shared-imports-features: src/components/layout/shell.tsx → src/features/notifications/components/notification-bell.tsx
  error feature-root-has-no-loose-files: src/features/products/media.ts
  error feature-root-has-no-loose-files: src/features/products/constants.ts
  error feature-root-has-no-loose-files: src/features/product-options/option-change-consequences.ts
  error feature-root-has-no-loose-files: src/features/product-options/option-change-consequences.test.ts
  error feature-root-has-no-loose-files: src/features/orders/constants.ts
x 7 dependency violations (7 errors, 0 warnings). 594 modules, 1607 dependencies cruised.
```

Both apps resolved the shared package by bare specifier and applied the same rules; the store's own `stripe-stays-in-its-adapter`, `no-admin-schemas-in-store` and seven `feature-graph-*` rules kept passing alongside them, as did the admin's two. The scratch files and the `node_modules` symlink were removed afterwards; nothing under `apps/` was left changed.

The `grandfathered` parameter was exercised separately, on the earlier tree where `checkout/payment/` still existed: with `GRANDFATHERED = ['^src/features/checkout/payment/']` the store reported 8 violations, and removing it reported 25. The exemption is applied via `module.pathNot`, because `RequiredToRestrictionType` has no `pathNot` (§1.2).

### 6.6 The vocabulary drives the prose too

The reason to hold the vocabulary as data rather than as a regex string is that a second consumer can read it. Prototyped and run: a generator that renders `.claude/rules/frontend-structure.md` from `vocabulary.cjs`, with a `--check` mode that fails when the committed file has drifted — the same shape as the existing `apps/backend/scripts/generate-workflow-registry.ts --check`, which `scripts/verify.sh` already runs.

```js
const { FEATURE_SEGMENTS, FEATURE_ROOT_FILES, LAYERS } = require('@proteus/frontend-conventions/vocabulary.cjs')

const list = (xs) => xs.map((x) => `\`${x}\``).join(', ')

const body = `---
paths:
  - "apps/*/src/**"
---

# Frontend structure

<!-- GENERATED from packages/frontend-conventions/vocabulary.cjs — do not edit by hand. -->

Do not create any folder under \`apps/*/src/features/<feature>/\` other than
${list(FEATURE_SEGMENTS)}.
Do not put a loose file at a feature root; the only files allowed there are ${list(FEATURE_ROOT_FILES)}.
Nesting *inside* one of those folders is unconstrained.

Do not import upwards across layers:

${LAYERS.map((l, i) => `${i + 1}. \`${l.name}\` (${list(l.dirs)})${i === 0 ? ' — the app layer' : ''}`).join('\n')}

A layer may import from the layers below it and never from one above.
Grandfathered exceptions are listed in each app's \`deps-analyzer/.dependency-cruiser.cjs\`.
They are not precedent — do not copy them.
`
```

Verified end to end: generating produced the file, `--check` passed, adding `'machines'` to `FEATURE_SEGMENTS` made `--check` exit 1 with `… is stale. Run: npm run generate:structure-rule`, and reverting made it pass again. The prose is phrased as prohibitions, per the "Guardrails Beat Guidance" finding in [`agent-structural-conventions.md` §2.3](./agent-structural-conventions.md).

That closes the loop the previous document left open: the vocabulary is stated once, the gate enforces it, and the agent-facing rule file cannot drift from the gate because CI regenerates and diffs it.

### 6.7 Grandfathering: two mechanisms, and when to use which

**Mechanism A — a `grandfathered` array in the app's config**, as shown in §6.4. It reads as a decision, sits next to an ADR reference, and covers a whole subtree in one line. Use it when the exception is *intentional and permanent* — the case `checkout/payment/` would have been, had it not been moved instead.

**Mechanism B — dependency-cruiser's own baseline.** Verified working with `required` module rules, which is not obvious and is not documented. (Run against the earlier tree, when the store still had 25 violations.)

```
$ npx depcruise-baseline src/ --config <config without grandfathering> --output-to known-violations.json
   baseline entries: 25
$ npx depcruise src/ --config <same> --ignore-known known-violations.json
   ✔ no dependency violations found (440 modules, 1237 dependencies cruised)
   ‼ 25 known violations ignored. Run with --no-ignore-known to see them.
```

The baseline records one entry *per file*, not per folder, so it never silently absorbs a new file added to a grandfathered folder — that shows up as a fresh violation and fails the gate. Use it when the exception is *temporary debt you intend to pay down*: turn every rule on at `error` today, baseline the 32 existing violations, and every new one fails. The file shrinks as the debt is paid, and the diff on it is reviewable.

The right combination here: **B for the layer violations** (6 files across both apps that need a real refactor, §5.1), and **A held in reserve** — the store needs no exemption today, and the admin's five loose files are a `git mv`, not debt. Keep the parameter and the empty array in the config anyway, with the comment: it is the documented answer for the next `bridge`-shaped folder (§3.1), and an empty array with a rule beside it is a better prompt than nothing.

---

## 7. Nested-path granularity and the edge cases

The rule must be strict at the first level under a feature and free below it. Both regexes were checked against a table of paths and then against planted files in the real `apps/store` tree.

```js
const SEGMENTS = 'api|assets|components|hooks|stores|types|utils'

// V1 — unsanctioned folder at the first level under a feature
`^src/features/[^/]+/(?!(?:${SEGMENTS})/)[^/]+/`

// V2 — loose file at a feature root
`^src/features/[^/]+/(?!(?:${SEGMENTS})/|index\\.tsx?$)[^/]+\\.[^/]+$`
```

Regex behaviour, checked exhaustively:

| Path | V1 | V2 | Correct? |
|---|---|---|---|
| `features/cart/utils/x.ts` | — | — | ✔ sanctioned |
| `features/cart/components/a/b/c.tsx` | — | — | ✔ **nesting inside a segment is free** |
| `features/cart/widgets/x.ts` | **V1** | — | ✔ unsanctioned folder |
| `features/cart/index.ts` / `index.tsx` | — | — | ✔ allowed |
| `features/cart/x.test.ts` | — | **V2** | ✔ loose file |
| `features/cart/utils/x.test.ts` | — | — | ✔ co-located test inside a segment |
| `features/cart/utils.ts` | — | **V2** | ✔ a *file* named like a segment — Steiger's `no-file-segments`, free |
| `features/cart/components.tsx` | — | **V2** | ✔ same |
| `features/cart/Utils/x.ts` | **V1** | — | ✔ regexes are case-sensitive; the convention is kebab-case |
| `features/cart/utilsX/x.ts` | **V1** | — | ✔ the trailing `/` in the lookahead blocks prefix leakage |
| `features/cart/api/index.ts` | — | — | ✔ |
| `features/checkout/payment/adapters/stripe/x.ts` | **V1** | — | ✔ deep files under an unsanctioned folder all report (one violation per file) |
| `features/checkout/utils/payment/adapters/stripe/x.ts` | — | — | ✔ the same tree after the move — arbitrarily deep under `utils/` is free |

Then, planted in the real tree and cruised (default options, no `extraExtensionsToScan`):

```
error feature-root-has-no-loose-files: src/features/cart/x.test.ts
error feature-folder-vocabulary:       src/features/cart/widgets/loose.ts
```

`widgets/loose.ts` **imports nothing and is imported by nothing** and is still caught — that is the whole reason `required` is used instead of `forbidden`. `components/payment/deep/nested.tsx`, `index.ts` and `hooks/x.test.ts` correctly produced nothing.

### 7.1 The four real edge cases

**(a) Co-located tests.** Inside a segment: passes. At a feature root: caught. That is correct and it *fires on real code today* — `apps/admin/src/features/product-options/option-change-consequences.test.ts` is one of the five admin violations. Worth knowing before turning the rule on, because "the test file lives next to the thing it tests" is a reasonable instinct that this rule redirects to `utils/`.

**(b) `index.ts` at a feature root.** Explicitly exempted, and `index.tsx` too. Note that no feature in either app currently has one — the exemption is for a barrel convention this repo has not adopted (§3, `no-public-api-sidestep`).

**(c) Non-TS files are invisible by default.** Planted and confirmed: `features/cart/onlycss/style.css`, `features/cart/widgets/notes.md` and `features/cart/README.md` all produced **zero** violations, because dependency-cruiser only builds modules for extensions it parses. Adding `extraExtensionsToScan: ['.css', '.md', '.svg', '.json']` closes it — re-run with it, the same tree produced:

```
error feature-root-has-no-loose-files: src/features/cart/README.md
error feature-folder-vocabulary:       src/features/cart/widgets/notes.md
error feature-folder-vocabulary:       src/features/cart/onlycss/style.css
```

So the gap is closable, at the cost of deciding whether a `README.md` at a feature root is allowed — if yes, add it to `FEATURE_ROOT_FILES` and both the rule and the generated prose pick it up. **Recommendation: turn `extraExtensionsToScan` on and allow `README.md`.** A folder containing only assets is exactly the kind of quiet structural drift this rule exists to catch, and it cost 5 extra modules on a 440-module cruise.

**(d) A genuinely empty directory can never be detected.** No module, nothing to validate. Unfixable with this tool and not worth fixing — git does not track empty directories either, so one cannot arrive through a PR.

### 7.2 Two gaps the regexes do not cover

**Files directly under `src/features/`.** `src/features/index.ts` or `src/features/helpers.ts` match neither rule — both are anchored at `^src/features/[^/]+/`. Steiger has this as `no-layer-public-api`. A third one-line rule closes it:

```js
{ name: 'no-files-at-features-root', severity: 'error',
  module: { path: `${root}features/[^/]+\\.[^/]+$` }, to: { path: '(?!)' } }
```

**A typo in a path segment defeats every rule silently.** `src/feautres/checkout/widgets/x.ts` matches no `from`, no `to`, no `module`, and passes. Same for `src/features/cart/utisl/x.ts` — which V1 catches (good), but `src/routs/` or `src/componets/` would simply fall outside the layer model and be unconstrained. This is the failure mode Steiger built `typo-in-layer-name` for, and dependency-cruiser cannot express it (§3, note (c)). It is the strongest argument in this document for one small `fs` script alongside the depcruise rules: read `src/` and `src/features/*/`, and fail on any first-level directory name that is neither in the vocabulary nor within Levenshtein distance 0 of it. ~30 lines, no dependencies, and it joins `job_conventions` in `scripts/verify.sh`.

---

## 8. Recommendation

Ordered by value-per-unit-of-disruption. Nothing here needs a new dependency.

**1. Extract `packages/frontend-conventions/` and point both apps at it.** Zero behaviour change on day one if you pass the current rule set through it: lift `no-circular` and `featureGraphRules` out of the store's config, leave the layer and vocabulary rules commented out, and confirm both apps still report clean. The value is that the next rule is written once instead of twice, and that `vocabulary.cjs` becomes the single place a folder name is stated. §6.1–6.4; prototype ran against both apps.

**2. Turn on `layer-features-imports-routes` and `layer-shared-imports-routes` immediately.** Both are at **0 violations in both apps** (§4). They cost nothing and they close the direction Bulletproof React actually ships a recipe for.

**3. Turn on `layer-shared-imports-features` with a baseline, then pay it down.** 8 violations in the store, 2 in the admin, all of them app-shell composition that belongs one layer up (§5.1). Baseline them (§6.7 mechanism B) so the count can only go down, and fix them as the header and shell are next touched. Do **not** widen the `shared` layer definition to make them legal — that is the move that turns a layer model into decoration.

**4. Turn on the two vocabulary rules now, while they are free.** The store is at **0 violations** since `checkout/payment/` moved to `checkout/utils/payment/`; the admin is at 5, all loose files, all a `git mv` into `utils/` or `types/`. This is the cheapest this will ever be, and the cost only grows. Add `extraExtensionsToScan` and `README.md` at the same time (§7.1c), and the `no-files-at-features-root` rule from §7.2 while you are there.

The Steiger-#50 objection (§3.1) is real, and `checkout/payment/` was its best local example — a coherent named sub-feature with an ADR behind it, not sloppiness. Note how it was actually resolved: **moved, not exempted.** That is a data point in the allowlist's favour, not against it. Keep `grandfathered` as an empty array with its comment for the next case; the answer to Steiger's objection is not to drop the allowlist but to make widening it a deliberate, one-line, ADR-backed act — which is exactly what issue #218 is asking Steiger for.

**5. Generate `.claude/rules/frontend-structure.md` from `vocabulary.cjs`, and `--check` it in `job_conventions`.** §6.6, verified end to end. This is what stops the prose and the gate from drifting, and it is the only mechanism here that puts the vocabulary in front of the agent *before* it picks a path.

**6. Write the folder-name typo script.** ~30 lines, no dependencies, and it is the one gap dependency-cruiser structurally cannot cover (§7.2). Every rule in this document is anchored on correctly-spelled directory names; a single transposition makes all of them vacuous.

**7. Decide the admin's `products` / `product-options` cycle before giving the admin a `FEATURE_GRAPH`.** Six files close the loop (§4.2). FSD's strategy A — merge the two slices — is the likely answer, since `product-options` exists to serve product editing. Whatever the answer, it is an ADR, and until it is made the admin cannot have the store's strongest rule.

**Explicitly not recommended.** Porting `segments-by-purpose` (it blocklists the names this repo mandates). Adopting Steiger (FSD layer model, second linter, overlapping coverage) — though note §3.2: it *is* extensible now, contrary to the earlier document. Counting-based rules (`excessive-slicing`, `shared-lib-grouping`) — seven and eight features, nothing to find. And any threshold-based proxy for FSD's "generic file" smell (§2.1): it cannot decide the thing it claims to decide, and a rule that fires on the wrong cases teaches an agent to route around the gate.

---

## 9. Thin evidence and what I could not verify

**Everything in §4–§7 was executed; everything in §2–§3 was read.** That is the main line to hold. The violation counts, the shared-package resolution, the baseline behaviour with `required` rules, the `extraExtensionsToScan` behaviour and every regex row in §7 come from runs against this tree on 2026-09-05. The FSD and Steiger material is documentation and source reading, not experiment.

**The prototype ran in a scratch directory with a `node_modules` symlink, not from a real `npm install`.** Bare-specifier resolution was verified from all four relevant working directories, and the configs were run from inside each app — but an actual `packages/frontend-conventions/` added to `workspaces` and installed has not been tried. The remaining risk is npm's own linking behaviour, not Node's resolution, and it is low.

**The store's violation counts moved *during* this research and will move again.** The tree has ~25 uncommitted modifications and was being edited while these numbers were taken. `agent-structural-conventions.md` §1(c) reported five locations / 21 violations; the first run in this session reported 17, all in `checkout/payment/`; the last run reported 0, because that subtree became `checkout/utils/payment/` mid-session. **All three are correct for the tree each was run against and none is correct now.** Every number in §4 and §6.5 carries this caveat. Re-measure before acting; the *shape* of the findings (which rules are unenforced, which directions are already clean, where the admin's cycle is) is what should be relied on.

**§5.1's prescription is an inference, not a measurement.** "These eight violations are app-shell composition and belong in the routes layer" is a reading of four files, and moving them is a real refactor with real risk to `src/components/header/`. Nobody has tried it. The number is solid; the fix is a proposal.

**The feature-level cycle in the admin was found by grepping `#/features/…` specifiers, not by dependency-cruiser.** dependency-cruiser has no notion of a feature, so it cannot report this directly; the edge list in §4.2 came from a small script over the source text. Dynamic imports or re-exports through a barrel could in principle add edges that grep missed. The two directions of the `products` ↔ `product-options` cycle were each confirmed by naming the specific files, so the cycle itself is real.

**Steiger's issue #50 has no recorded reasoning.** The entire closing rationale is *"Actually, I don't think this should be checked for"* — seven words, no argument. §3.1's reconstruction of *why* (blocklist over allowlist, purpose over essence, teams want custom segments) is assembled from what Steiger shipped instead and from issue #218, not from anything the maintainer wrote about #50. Treat it as a reasonable reading, not as the maintainer's stated position.

**FSD's "generic file" smell (§2.1, manifestation 3) has no mechanical detector anywhere.** Not in Steiger, not in any tool surveyed here or in the previous document. The size-proxy suggestion is mine and is untested. If someone claims to have automated it, that claim deserves scrutiny.

**Two things in §3's table were not run.** `import-locality` and `insignificant-slice` were mapped to dependency-cruiser by reading the `dependencyTypes` and `orphan` documentation, not by building the rule and watching it fire. Both are marked "partly" for that reason, and neither is recommended.

**The prior-art sweep in §1 has two known holes.** GitHub code search only indexes public repositories and only matched configs named `.dependency-cruiser.{js,cjs,mjs,json,jsonc}` — a config under any other filename was invisible. And **Reddit could not be searched at all** (blocked to the sub-agent's user agent, and no reddit.com URL surfaced in the general index), so "nobody has written this up" excludes Reddit. Treat that channel as unverified rather than confirmed-absent. Everything else in §1 — the fiftyone config, the Böckeler quotes, the #328 comment — I fetched and read directly.

**§1's GitHub-scale counts are the sub-agent's, not mine.** "335 `CLAUDE.md` files", "6 configs in the world with a real `required` rule", "11 of 12 are `permissions.allow` entries" come from code-search queries I did not re-run. I independently verified the two load-bearing artifacts (fiftyone's config and Böckeler's article) by fetching them. The counts are plausible and directionally consistent; do not quote them as precise.

**Not investigated at all:** whether a per-feature `index.ts` barrel is viable here. §3 notes that `no-public-api-sidestep` is expressible but has nothing to enforce without barrels, and barrels interact with TanStack Router's automatic code-splitting and with tree-shaking in ways this document did not look into. That is a separate question with its own answer.

# Making AI Coding Agents Comply with Project Structure Conventions

Research findings on the mechanisms teams use in 2025–2026 to get AI coding agents to respect folder layout, allowed feature subfolders and module boundaries — and on what the evidence actually supports.

**Date:** 2026-09-05
**Context:** The storefront (`apps/store`) follows [Bulletproof React](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) feature-folder conventions. That convention is stated in `README.md` but not in `CLAUDE.md`, the auto-loaded agent context file. An agent building a PR created `apps/store/src/features/account/payment-methods/` — a folder name outside Bulletproof React's vocabulary — where `features/account/utils/` was intended. The repo already deviates in five other places (§1c — one more than assumed when this was commissioned), so an agent pattern-matching on the codebase reproduces the deviation. This document asks what would have stopped it.

---

## Table of Contents

1. [The failure, precisely](#1-the-failure-precisely)
2. [Instruction and context files](#2-instruction-and-context-files)
3. [Deterministic enforcement: what can actually forbid a folder name](#3-deterministic-enforcement-what-can-actually-forbid-a-folder-name)
4. [Scaffolding and generators as prevention](#4-scaffolding-and-generators-as-prevention)
5. [Agent-loop feedback: Claude Code hooks](#5-agent-loop-feedback-claude-code-hooks)
6. [Emerging agent-oriented convention formats](#6-emerging-agent-oriented-convention-formats)
7. [Comparison table](#7-comparison-table)
8. [Recommendation for this repo](#8-recommendation-for-this-repo)
9. [Where the evidence is thin](#9-where-the-evidence-is-thin)

---

## 1. The failure, precisely

Bulletproof React's `docs/project-structure.md` states a **closed vocabulary** of seven folders inside a feature:

> The allowed folders inside a feature folder are: `api`, `assets`, `components`, `hooks`, `stores`, `types`, `utils`
> — <https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md>

Three things made the violation likely, and they are worth separating because they call for different fixes.

**(a) The rule was never stated as a closed set anywhere the agent could read it.** `README.md` line 178 says a feature "co-locates its API layer, components, hooks, and types" — a description of four folders, phrased as illustration rather than enumeration. It never says *only these seven*, and it never says *no loose files at a feature root*. Anthropic's own guidance names this failure mode directly:

> **Specificity**: write instructions that are concrete enough to verify. For example: … "API handlers live in `src/api/handlers/`" instead of "Keep files organized."
> — <https://code.claude.com/docs/en/memory>

**(b) The rule was not in the auto-loaded file.** `CLAUDE.md` has a substantial "Admin App Architecture" section and no store architecture section at all. Note also that `CLAUDE.md` is currently **207 lines**, just past the threshold Anthropic documents:

> **Size**: target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence.
> — <https://code.claude.com/docs/en/memory>

So "just add it to CLAUDE.md" is not free — it pushes an already-oversized file further past the point where the vendor says adherence degrades. Section 8 proposes a path-scoped rule instead.

**(c) The codebase itself contradicted the rule.** Running a folder-vocabulary check against `apps/store/src/features` (see §3) reported exactly six violations, five of which predate the incident:

```
src/features/account/payment-methods/     (the new one)
src/features/checkout/payment/
src/features/address/form-values.ts
src/features/checkout/checkout-address.ts
src/features/orders/fulfillment-labels.ts
src/features/orders/order-progress.ts
```

(Timing note: `account/payment-methods/` was moved to `account/utils/` in the working tree *during* this research. The five pre-existing deviations are still there. Every number below that says "six" refers to the tree as it stood when the check was first run; re-running it now gives five locations / 21 file-level violations.)

`checkout/payment/` is not a small deviation — 17 files across the folder and its `adapters/stripe/` subtree — and it is referenced by name in `apps/store/deps-analyzer/.dependency-cruiser.cjs` and in ADR 0010. An agent reading the codebase for the local idiom finds a well-established, load-bearing precedent for exactly the shape it then produced. The research on whether precedent beats prose is **contested and not about repositories** — one 2026 study finds a universal transition from instruction-following to pattern-following, another finds instructions beating examples for code style specifically (§2.3, §9). What the vendors say is narrower and still relevant:

> **Consistency**: if two rules contradict each other, Claude may pick one arbitrarily.
> — <https://code.claude.com/docs/en/memory>

That is about two written rules, not about written rule vs. observed code. Treat the "precedent beats prose" reading as a plausible inference from this incident, not as an established finding.

---

## 2. Instruction and context files

### 2.1 What the de-facto standard is

**AGENTS.md is the cross-vendor format.** It is "a simple, open format for guiding coding agents… a README for agents", is "now stewarded by the Agentic AI Foundation under the Linux Foundation", claims use by "over 60k open-source projects", and originated with OpenAI Codex, Amp, Jules (Google), Cursor and Factory (<https://agents.md/>). Its conflict rule: "The closest AGENTS.md to the edited file wins; explicit user chat prompts override everything."

**Claude Code does not read it.** This matters for this repo:

> Claude Code reads `CLAUDE.md`, not `AGENTS.md`. If your repository already uses `AGENTS.md` for other coding agents, create a `CLAUDE.md` that imports it… `@AGENTS.md`
> — <https://code.claude.com/docs/en/memory>

**GitHub Copilot reads both**, with three layers: `.github/copilot-instructions.md` (repository-wide), `.github/instructions/NAME.instructions.md` with an `applyTo` glob in frontmatter (path-specific), and `AGENTS.md` anywhere in the tree where "the nearest `AGENTS.md` file in the directory tree will take precedence" (<https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions>).

**Cursor** uses `.cursor/rules/*.mdc` with `alwaysApply` / `globs` / `description` frontmatter; "Plain `.md` files are ignored unless they are `AGENTS.md`". `.cursorrules` is explicitly legacy: "`.cursorrules` file in your project root is legacy and will be deprecated" (<https://cursor.com/docs/rules>, <https://cursor.com/help/customization/rules>). Neither page carries a date.

**OpenAI Codex** concatenates AGENTS.md from the repo root down, "Files closer to your current directory override earlier guidance because they appear later in the combined prompt", and — a detail worth knowing — silently truncates: "Codex… stops adding files once the combined size reaches the limit defined by `project_doc_max_bytes` (32 KiB by default)" (<https://learn.chatgpt.com/docs/agent-configuration/agents-md>).

### 2.2 What the vendors say about the limits

This is the most useful part of the first-party material, and it is unusually blunt on Anthropic's side.

> Both are loaded at the start of every conversation. **Claude treats them as context, not enforced configuration.** To block an action regardless of what Claude decides, use a PreToolUse hook instead.
> — <https://code.claude.com/docs/en/memory>

> **CLAUDE.md content is delivered as a user message after the system prompt, not as part of the system prompt itself. Claude reads it and tries to follow it, but there's no guarantee of strict compliance**, especially for vague or conflicting instructions.
> — ibid., "Claude isn't following my CLAUDE.md"

> Settings rules are enforced by the client regardless of what Claude decides to do. **CLAUDE.md instructions shape Claude's behavior but are not a hard enforcement layer.**
> — ibid.

The best-practices page adds an explicit failure mode and remedy:

> **If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost.** … Treat CLAUDE.md like code: review it when things go wrong, prune it regularly, and test changes by observing whether Claude's behavior actually shifts.
> … **If Claude keeps skipping one instruction, add emphasis such as "IMPORTANT" to that line alone. If you emphasize many lines, none of them stands out.**
> … Unlike CLAUDE.md instructions which are **advisory**, hooks are deterministic and guarantee the action happens.
> — <https://code.claude.com/docs/en/best-practices> (the April-2025 Anthropic engineering post "Claude Code: Best practices for agentic coding" now 308-redirects here)

GitHub says the same once, on the *concepts* page rather than the how-to page:

> Due to the non-deterministic nature of AI, Copilot may not always follow your custom instructions in exactly the same way every time they are used.
> — <https://docs.github.com/en/copilot/concepts/response-customization>

Cursor's *rules* pages carry no caveat, but its enterprise documentation does, and it reaches the same conclusion as Anthropic:

> The LLM sees all applicable rules when generating responses. **It will attempt to follow them, but rules are suggestions, not guarantees.** … **Combine rules with enforcement hooks for requirements that must be followed.**
> — <https://cursor.com/docs/enterprise/llm-safety-and-controls>

OpenAI's Codex documentation carries no reliability caveat at all; its nearest statement is operational — reserve formatting and lint checks for CI. None of these vendors publishes a number behind the claim. **A note on a figure you will encounter: "Claude follows CLAUDE.md about 80% of the time" is not an Anthropic statement.** It appears only in third-party blog posts and has no first-party source. Do not cite it.

### 2.4 What has actually been measured

Contrary to what you would guess from the vendor docs, there is now real measurement here — most of it from 2026, and most of it unrefereed preprints. Taken together it is more informative than any single paper.

**Per-rule compliance is high; all-rules-at-once compliance is not.** OctoBench (Ding et al., arXiv:2601.10343, 2026-01-15, <https://arxiv.org/abs/2601.10343>) evaluated 34 environments, 217 tasks, 3 scaffolds and 8 models against 7,098 checklist items. Per-check compliance lands at **79.75–85.64%**, but instance success — strict, all-or-nothing, every check passing — collapses to **9.66–28.11%** (best: Claude Opus 4.5 at 28.11%). Compliance also correlates negatively with interaction length for most models. For a rule like "seven allowed folder names", 80–85% per-decision is exactly the regime where a violation appears every few PRs.

**Compliance decays within a session, and the obvious file-level fixes do not measurably help.** McMillan (arXiv:2605.10039, 2026-05-11, <https://arxiv.org/abs/2605.10039>) instrumented 1,650 Claude Code sessions / 16,050 function-level observations. **None** of four structural variables — file size, instruction position, file architecture, cross-file contradictions — produced a detectable effect after correction. The one real effect was within-session decay: **~5.6% lower odds of compliance per additional function generated** (OR = 0.944). Single-author preprint, one trivial annotation convention, so treat the magnitude loosely; but it is a direct caution against believing that reorganising `CLAUDE.md` will fix a compliance problem.

**Architectural constraints specifically degrade as they stack.** "Constraint Decay: The Fragility of LLM Agents in Backend Code Generation" (Dente, Satriani, Papotti, arXiv:2605.06445, 2026-05-07, <https://arxiv.org/abs/2605.06445>) tested layering, schema and ORM constraints across 8 frameworks. Capable configurations **lose roughly 30 points of assertion pass rate** from baseline to fully-specified tasks; weaker ones approach zero. Agents do notably worse "in convention-heavy environments". MultiCodeIF (Duan et al., arXiv:2507.00699, 2025-07-01) shows the same shape on code constraints generally: **single-level constraints 54.5% → multi-level 18.8%**, with four rounds of feedback lifting 63.0% → 83.4%.

**Compiling the prose into executable checks recovers most of the gap.** This is the single most relevant result to this document. ContextCov (Sharma, arXiv:2603.00822, 2026-02-28, <https://arxiv.org/abs/2603.00822>) compiles AGENTS.md prose into AST queries, shell shims and architectural validators. On SWE-bench Lite (12 repos, 300 tasks): **88.3% constraint compliance, versus 67.0% prompt-only and 50.3% LLM-reflection**, at 3.4x lower feedback cost, with functional correctness maintained. Its stated diagnosis matches this incident — agents "frequently violate documented constraints due to context window saturation or conflicting local context". Caveat: single-author preprint, not peer-reviewed. It is the only number anywhere behind the "deterministic beats instructions" claim.

**Two results that complicate the picture, and should not be skipped.**

*Context files may not be doing what you think.* "Evaluating AGENTS.md" (Gloaguen, Mündler, Müller, Raychev, Vechev — ETH SRI, arXiv:2602.11988, 2026-02-12, <https://arxiv.org/abs/2602.11988>), 438 tasks across 4 agents: context files "do not generally improve task success rates, while increasing inference cost by over 20% on average". But the instruction-following finding is the opposite and is measured by telemetry: **"instructions in the context files are well followed"** — a mentioned tool was used 1.6x per instance versus <0.01 when unmentioned. Repository *overviews* were useless; files were effective only for "non-standard coding practices". A closed folder vocabulary is exactly a non-standard coding practice, which is the case for writing it down; a directory-layout description is exactly the useless kind, which is the case for not.

*Prohibitions work; "follow the code style" specifically does not.* "Guardrails Beat Guidance" (Zhang et al., arXiv:2604.11088, 2026-04-13, <https://arxiv.org/abs/2604.11088>) is the largest study in this set: 679 rule files (25,532 rules) and **over 5,000 Claude Code runs with Opus 4.6 on SWE-bench Verified**. Random, shuffled and mismatched-domain rule files performed identically to expert-curated ones (**both +13.8pp**), which the authors attribute to "a context priming mechanism" rather than to content. Every rule that was individually beneficial was a **negative constraint** ("do not refactor unrelated code"); every individually *harmful* rule was a positive directive — **their worked example is literally "follow code style."** Their conclusion: "constrain what agents must not do, rather than prescribing what they should." Important caveat I want stated plainly: **the outcome measured is SWE-bench pass rate, not style or convention compliance**, so this is evidence about rule *phrasing* transferred across outcomes, not a direct measurement of convention adherence. It still changed how §8 phrases the rule file.

**On the precedent-versus-prose question from §1(c), the evidence is contested and does not settle it.** "Do as I Say, Not as I Do" (Camassa & Shiller, arXiv:2605.20382, 2026-05-19) finds that models transition from instruction-following to pattern-following, "universal but highly model-dependent", with instruction-following rates spanning **1% to 99% across models** and largely uncorrelated with capability benchmarks — but on toy tasks with hardcoded turns, not code and not surrounding repository files. Pointing the other way, the one experiment that pitted instructions against examples *for code style* found the opposite: "Show and Tell" (Bohr, arXiv:2511.13972, 2025-11-17, N=160) reports "Instructions showed large initial effects and moderate expansion discipline. Examples showed modest initial effects with no expansion discipline." Small study. Net: the folklore that examples override instructions is not established for code style, and the §1(c) reading of this incident remains an inference.

One useful piece of vocabulary from this literature: "Learning to Commit" (Li et al., arXiv:2603.26664, 2026-03-27) names the failure mode **"alien code" — "syntactically valid, often functionally correct, but stylistically foreign"** — and is the only paper found that scores style consistency and internal API reuse as first-class metrics.

### 2.3 Path-scoped rules

Every vendor that supports glob scoping frames it as a *context-budget* mechanism, not an enforcement one — but for a rule that only applies to one directory, it is the right shape. Claude Code's `.claude/rules/` takes `paths` frontmatter:

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API Development Rules

- All API endpoints must include input validation
- Use the standard error response format
```

> Rules can be scoped to specific files using YAML frontmatter with the `paths` field. These conditional rules only apply when Claude is working with files matching the specified patterns. … Rules without a `paths` field are loaded unconditionally.
> — <https://code.claude.com/docs/en/memory>

One caveat that matters for long sessions: "Project-root CLAUDE.md survives compaction… Nested CLAUDE.md files in subdirectories and rules with `paths:` frontmatter reload as Claude reads files they apply to" (ibid.). A path-scoped rule is therefore *not* in context until the agent touches a matching file — which for a create-a-new-file task may be after it has already chosen the path.

---

## 3. Deterministic enforcement: what can actually forbid a folder name

The question separates cleanly into two: can the tool *see* a file that nothing imports, and can it assert on the *path* rather than on an import edge. Most architecture linters fail the second test.

### 3.1 dependency-cruiser — yes, with a `required` rule (verified)

This is the finding that most changes the picture, because this repo already has dependency-cruiser wired into `npm run verify` for all three apps.

The obvious approach does **not** work. A `forbidden` rule with `to: {}` is evaluated per dependency edge, so a file in an unsanctioned folder that imports nothing is never flagged. dependency-cruiser's source (`src/validate/rule-classifiers.mjs`) treats only three shapes as module-level:

```js
export function isModuleOnlyRule(pRule) {
  return (
    Object.hasOwn(pRule?.from ?? {}, "orphan") ||
    Object.hasOwn(pRule?.to ?? {}, "reachable") ||
    Object.hasOwn(pRule, "module")
  );
}
```

The `required` rule type *is* module-scoped:

> 'Required' rules have slightly different semantics from the `forbidden` and `allowed` types. There's a mandatory `module` attribute that specifies which modules the rule applies to and the `to` describes what dependencies that module should exactly have.
> — <https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md>

Give it a `to.path` that can never match and it degrades into "no module may exist at this path". Paths are matched with real JavaScript `RegExp` — "I chose regular expressions for matching paths over the more traditional glob" (ibid.) — so negative lookahead works. **I ran this against the real tree** and it reported exactly the six known deviations (24 violations, one per file):

```js
const SEGMENTS = 'api|assets|components|hooks|stores|types|utils'

required: [
  {
    name: 'feature-folder-vocabulary',
    severity: 'error',
    comment:
      'A feature holds only api/, assets/, components/, hooks/, stores/, types/ and utils/ ' +
      '(Bulletproof React). Move the file into one of those.',
    module: { path: `^src/features/[^/]+/(?!(?:${SEGMENTS})/)[^/]+/` },
    to: { path: '^\\0$' }, // unsatisfiable: turns "required" into "must not exist"
  },
  {
    name: 'feature-root-has-no-loose-files',
    severity: 'error',
    comment: 'A feature root holds folders and index.ts only.',
    module: { path: `^src/features/[^/]+/(?!(?:${SEGMENTS})/|index\\.ts$)[^/]+\\.[^/]+$` },
    to: { path: '^\\0$' },
  },
]
```

`to: { path: '(?!)' }` works identically and reads more clearly as "matches nothing" — I ran both. Nesting *inside* a sanctioned segment is unconstrained by this rule, so `checkout/components/payment/` passes; only the first level under a feature is checked.

Three caveats, all verified:

- **The cruise must target directories, not an entry file.** "dependency-cruiser will typically not find orphans when you give it only one module to start with… Specify one or more folder, several files or a glob" (<https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md#orphans>). The store's `check:deps` already cruises `src`.
- **Only parsable extensions are scanned.** A folder containing only `.md` or `.css` is invisible unless you add `extraExtensionsToScan` (<https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md#extraextensionstoscan>).
- **A genuinely empty directory can never be detected** — there is no module to validate.

The docs do not address folder-layout validation at all; the FAQ's only adjacent statement is a refusal of finer granularity: "Does dependency-cruiser support granularity finer than modules? **No. It's unlikely to grow that in the future either.**" (<https://github.com/sverweij/dependency-cruiser/blob/main/doc/faq.md>). So this is a documented-primitive used in an undocumented way, verified empirically rather than blessed by the maintainer. Latest release v18.2.0, 2026-08-10; this repo has 18.1.0.

### 3.2 eslint-plugin-project-structure — the purpose-built fit (verified)

`project-structure/folder-structure` is the only tool surveyed whose *stated purpose* is this rule. The wiki is explicit: "**Any files/folders outside the structure will be considered an error**" (<https://github.com/Igorkowalski94/eslint-plugin-project-structure/wiki/project%E2%80%91structure-%E2%80%8Bfolder%E2%80%91structure>). v3.14.4, released 2026-09-02 — actively maintained.

The `name` key is a regex with `^$` wrapped around it and `*` rewritten to `([^/]*)`, plus placeholders (`{camelCase}`, `{PascalCase}`, `{kebab-case}`, `{folderName}`…). `children` makes a node a folder; `ruleId` references a reusable rule; `folderRecursionLimit` bounds recursion; `enforceExistence` requires sibling files to exist; `ignorePatterns` (micromatch) grandfathers exceptions; `projectRoot`/`structureRoot` handle monorepos.

I installed it and ran it against a copy of `apps/store/src/features`. It found the same violation set as the dependency-cruiser rule, but grouped **per folder** rather than per file — 6 diagnostics where dependency-cruiser gives 24:

```js
import { createFolderStructure } from 'eslint-plugin-project-structure'

const SEGMENTS = '(api|assets|components|hooks|stores|types|utils)'

export default createFolderStructure({
  projectRoot: 'apps/store',
  structureRoot: 'src/features',
  structure: [{ ruleId: 'feature_folder' }],
  rules: {
    feature_folder: {
      name: '{kebab-case}',
      children: [
        { name: SEGMENTS, children: [{ ruleId: 'free_folder' }, { name: '*' }] },
        { name: 'index.ts' },
      ],
    },
    // Inside a sanctioned segment, organise however you like.
    free_folder: { name: '*', folderRecursionLimit: 8, children: [{ ruleId: 'free_folder' }, { name: '*' }] },
  },
})
```

Its error text is the best agent feedback of anything surveyed, because it names the vocabulary:

```
🔥 Folder 'payment-methods' is invalid. 🔥
Allowed names  = (api|assets|components|hooks|stores|types|utils)
Error location = ./src/features/account/payment-methods
```

Two practical notes. The rule works off `context.getFilename()` (confirmed in `dist/index.js` — the only `fs` calls are `existsSync`, for `enforceExistence`), so like dependency-cruiser it cannot see a folder with no linted files. And it needs ESLint: a bare ESLint 9 + this plugin installs **90 packages / 45 MB** into a repo that currently has no ESLint at all. The plugin ships a no-op parser (`eslint-plugin-project-structure/parser.js`) so you do not additionally need typescript-eslint; the run takes ~0.5s.

### 3.3 eslint-plugin-boundaries — import rules, plus one relevant escape hatch

Primarily a dependency-policy plugin: you classify files into elements via `boundaries/elements` (`type` + `pattern`, with `mode: file | folder | full` and `capture`), then write `boundaries/dependencies` policies. That is an import constraint, not a layout one. (Note for anyone reading older material: as of v7.2.0 the plugin's own source marks `element-types`, `entry-point` and `external` as **deprecated** in favour of the canonical `boundaries/dependencies`.)

The one rule that bears on this question is **`boundaries/no-unknown-files`**, whose implementation reports on any file where `entity.file.isUnknown && entity.element.isUnknown`, with the message *"File does not match any file pattern and does not belong to any known element"* (`dist/Rules/NoUnknownFiles.js`, v7.2.0). Its schema is `[]` — no options — and it is **disabled in the recommended config**, deliberately: the config comment says the unknown-* rules are off "so it allows to have parts of the project non-compliant with defined rules, allowing to refactor the code progressively."

With an elements list that only recognises the seven sanctioned segments, this would flag a file in `payment-methods/` — but as "unknown", not as "wrong folder", and with no way to tell the author what the allowed names are. Source: <https://github.com/javierbrea/eslint-plugin-boundaries>.

### 3.4 Nx `@nx/enforce-module-boundaries` — no, and structurally so

`@nx/enforce-module-boundaries` constrains *imports* between **tagged Nx projects**. The rule's own `Options` type ([`packages/eslint-plugin/src/rules/enforce-module-boundaries.ts`](https://github.com/nrwl/nx/blob/master/packages/eslint-plugin/src/rules/enforce-module-boundaries.ts)) contains `depConstraints`, `sourceTag`, `onlyDependOnLibsWithTags`, `allowedExternalImports`, `bannedExternalImports`, `banTransitiveDependencies` — and **no field referencing a directory, path shape, or file name**. Every message id is triggered by an import statement it can attach a diagnostic span to; there is no rule that fires on the absence of an expectation. A stray `src/features/checkout/widgets/` is not an Nx project, has no tags, and is invisible.

Worth noting for completeness: **Nx Conformance** custom rules *can* do it — the implementation context provides a `ReadOnlyConformanceTree` with `tree.children('libs/my-lib/src')`, and the docs show raw `existsSync`/`readFileSync` (<https://nx.dev/docs/reference/conformance/create-conformance-rule>). But: "In order to use `@nx/conformance`, you need to have an active Nx Enterprise license" (<https://nx.dev/docs/reference/conformance/overview>). Not available here, and not applicable to a non-Nx workspace anyway. `nx` 23.2.0, 2026-09-02.

### 3.5 Biome plugins (GritQL) — no, and not on the roadmap

Biome 2.5.12 (2026-09-03) supports GritQL plugins that "match specific code patterns, report customized diagnostics, and suggest fixable rewrites" (<https://biomejs.dev/linter/plugins/>). Three independent blockers, each fatal on its own:

1. **`span` must be a syntax node.** The one Biome-specific plugin function is `register_diagnostic()`, whose required `span` argument is "The syntax node to attach the diagnostic to". A folder is not a node.
2. **Plugins only run on files Biome parses** — JS/TS, CSS, JSON. A rogue folder with only `.md`, only assets, or nothing at all produces zero invocations.
3. **No cross-file reasoning.** The GritQL tracking issue [biomejs/biome#2582](https://github.com/biomejs/biome/issues/2582) lists `multifile` pattern handling as 🚫 "Not in progress". Without it, a plugin cannot compare observed folder names against an allowlist or detect an absence.

An undocumented `file(name = $n, body = $b)` pattern does exist in the source ([`pattern_compiler/call_compiler.rs`](https://github.com/biomejs/biome/blob/main/crates/biome_grit_patterns/src/pattern_compiler/call_compiler.rs)) and would bind the current file's path — so a plugin could in principle regex a bad path. It still cannot express an allowlist or see anything Biome does not parse. The [2026 roadmap](https://biomejs.dev/blog/roadmap-2026/) mentions project-level rules and cross-*language* rules; **path- or folder-structure linting appears nowhere in it**. Biome stays the right tool for lint/format here and the wrong one for this rule.

### 3.6 Steiger — right mechanism, deliberately refuses the rule

The most interesting negative result. Steiger describes itself as a "Universal file structure and project architecture linter" (<https://github.com/feature-sliced/steiger>) and is genuinely path-native: it traverses directories rather than ASTs and its diagnostics attach to `location: { path }`, not to syntax nodes. Mechanically it is the right shape for this problem, and Feature-Sliced Design has a segment vocabulary (`ui`, `api`, `lib`, `model`, `config`) exactly analogous to Bulletproof React's.

But **no Steiger rule validates segment names against that vocabulary as an allowlist.** `fsd/segments-by-purpose` is a *blocklist* of ~70 essence-based names (`components`, `utils`, `hooks`, `types`, `stores`, …) — a segment named `widgets`, `bridge` or `payment-methods` passes silently. `fsd/typo-in-layer-name` is fuzzy Levenshtein matching on *layers*, not segments. `fsd/no-reserved-folder-names` and `fsd/no-segments-on-sliced-layers` restrict where *known* names may appear, not which unknown names are allowed.

This was decided, not overlooked. [Issue #50, "Implement `conventional-segments`"](https://github.com/feature-sliced/steiger/issues/50) was opened 2024-07-03 and closed 2024-08-04 as `not_planned`, with the maintainer commenting: "**Actually, I don't think this should be checked for**". It follows the methodology — FSD's own reference says "You can also create custom segments" (<https://feature-sliced.design/docs/reference/slices-segments>), constraining segments semantically (name by purpose, not by technical essence) rather than by enumeration. The open pressure is toward *more* permissiveness, not less ([issue #218](https://github.com/feature-sliced/steiger/issues/218), 2025-09-22, a team wanting their `bridge` folder recognised).

Status: v0.6.0 (2026-07-14), actively developed, README banner says "The project is in beta and in active development", and — decisive here — "Currently, Steiger is not extendable with more rules". You could not add the allowlist yourself.

This is a genuine data point against the whole framing, worth sitting with: the one tool built specifically to lint feature-folder structure looked at the closed-vocabulary rule and declined it on principle.

### 3.7 What Bulletproof React itself recommends — and why it does not cover this

Worth noting because it is the source of the convention. Bulletproof React's enforcement recipe is `import/no-restricted-paths` zones:

```js
'import/no-restricted-paths': ['error', { zones: [
  { target: './src/features', from: './src/app' },
  { target: ['./src/components', './src/hooks', './src/lib', './src/types', './src/utils'],
    from: ['./src/features', './src/app'] },
]}],
```

That enforces the *unidirectional import flow* and says nothing about which folders may exist inside a feature. **The document that states the seven-folder vocabulary ships no mechanism for enforcing it.** This repo's `deps-analyzer/.dependency-cruiser.cjs` already covers the import half (and goes further, with a declared feature DAG per ADR 0020). The layout half has never been enforced anywhere.

---

## 4. Scaffolding and generators as prevention

The argument is intuitive: if a generator produces the sanctioned structure, and the agent can run the generator as a tool, the sanctioned structure becomes the path of least resistance. What is notable is *who* is making that argument.

**Nx's own published answer to this exact question is a generator, not a linter.** Nx's AI docs frame the problem as agents that "lack workspace context (seeing files, not architecture), generate inconsistent code, and have a hard time to interact with CI", and prescribe a three-step agent workflow: find the generator, run it with the correct options, make small adjustments (<https://nx.dev/docs/features/generate-code>, <https://nx.dev/docs/features/enhance-ai>). Two dated posts carry the reasoning:

> Generators produce consistent results every time [versus AI-generated code that] might vary with each prompt.
> — Juri Strumpflohner, "Nx Generators and AI Integration", 2025-05-13, <https://nx.dev/blog/nx-generators-ai-integration>

> **LLMs are great at understanding context and making decisions, but they struggle with consistency. Generators are the opposite: they produce identical, predictable output every time but lack the intelligence to know when and how to use them.**
> — "Nx AI Agent Skills", 2026-02-12, <https://nx.dev/blog/nx-ai-agent-skills>

That February 2026 post ships an `nx-generate` agent skill that has the agent explore existing libraries to learn conventions, select the generator, run it, and verify the output. It is the clearest articulation anywhere of the "move the determinism into the write, not the check" position.

**But there is no evidence behind it, and this is the clearest negative result in this document.** No paper, no vendor benchmark, no engineering blog with a before/after. Specifically:

- **plop** (<https://plopjs.com>) — "Consistency Made Simple", a "micro-generator framework". Zero mentions of AI, agents or LLMs; zero data. Its argument is entirely about human context-switching. Actively maintained.
- **hygen** — zero AI mentions, zero data, and worth knowing before adopting it: `hygen.io` did not resolve on repeated attempts, and **the last commit to the repository was 2023-03-15**. Effectively unmaintained.
- **Nx** is the only vendor asserting generators help LLMs, and the assertions carry no numbers. The one post with data, "Why we deleted (most of) our MCP tools" (2026-02-17), publishes figures only inside chart images: generator *usage* rose from 71%→93% (Sonnet) and 71%→98% (Haiku) when Skills were added. Three reasons that does not support the claim: it measures whether the agent *invoked* a generator, never whether the output was structurally compliant; there is **no un-scaffolded baseline arm** (both arms have generators); and the intervention that moved the needle was prose instructions in a Skill — the inverse of "generators over instructions". Vendor-run, LLM-judged, no sample sizes.

Beware a terminology trap when searching this: most "scaffolding + agent + measured" results concern the *agent harness* (control loop, tool definitions), a different sense of the word. Citing that literature for plop-style generators is equivocation.

Two further things to keep straight. A generator prevents nothing on its own: an agent that hand-writes `features/account/payment-methods/expiry.ts` never invokes it. Generators reduce the *frequency* of the decision; only a check makes the wrong decision fail.

For this repo specifically, a generator is a weak fit. There are seven features and the vocabulary is seven folder names — there is very little to scaffold, and the incident was a file placed inside an existing feature, not a new feature created wrongly. A generator would not have fired.

---

## 5. Agent-loop feedback: Claude Code hooks

This is the only mechanism any vendor describes as deterministic, and the docs are specific enough to build on.

> Hooks are user-defined shell commands. Claude Code runs them at specific points in its lifecycle, which gives you **deterministic control: certain actions always happen rather than relying on the LLM to choose to run them.**
> — <https://code.claude.com/docs/en/hooks-guide>

### 5.1 Which events can block

From the reference (<https://code.claude.com/docs/en/hooks>), the events relevant to a file-layout rule:

| Event | Can block? | Exit code 2 effect |
|---|---|---|
| `PreToolUse` | **Yes** | Blocks the tool call; stderr goes to Claude as feedback |
| `PostToolUse` | No | Tool already ran; stderr is shown to Claude |
| `PostToolBatch` | **Yes** | Stops the agentic loop before the next model call |
| `Stop` | Yes | Prevents Claude from stopping; continues the conversation |
| `SessionStart`, `Notification`, `PreCompact` … | No | Ignored |

The output contract: exit 0 + JSON on stdout for structured control (`hookSpecificOutput.systemMessage`, `additionalContext`, and for `PreToolUse` `permissionDecision` / `permissionDecisionReason` / `updatedInput`), or exit 2 + stderr to block. For `PostToolUse` specifically: plain-text stdout on exit 0 goes to the debug log only and **Claude never sees it** — you need JSON `systemMessage`, or exit 2, for the model to read it.

Two blocking behaviours worth knowing:

> A blocking hook also takes precedence over allow rules. A hook that exits with code 2 stops the tool call before permission rules are evaluated… To run all Bash commands without prompts except for a few you want blocked, add `"Bash"` to your allow list and register a PreToolUse hook that rejects those specific commands.
> — <https://code.claude.com/docs/en/permissions>

> Hook decisions don't bypass permission rules. Claude Code evaluates deny and ask rules regardless of what a PreToolUse hook returns.
> — ibid.

### 5.2 Why `permissions.deny` cannot do this job

Tempting, and it does not work. `Read`/`Edit` permission rules use gitignore pattern syntax, and gitignore has no negative lookahead — you cannot write "any folder under `features/*/` except these seven". Worse, precedence forbids the workaround of denying broadly and allowing narrowly:

> A broad deny rule like `Bash(aws *)` blocks every matching call, including calls that also match a narrower allow rule like `Bash(aws s3 ls)`, so **a deny rule can't carry allowlist exceptions.**
> — <https://code.claude.com/docs/en/permissions>

A `PreToolUse` hook is the documented answer for exactly this shape.

### 5.3 Piping a linter's output back into the loop

The "run the check after every edit and let the agent self-correct" pattern is directly supported, with two details that are easy to get wrong:

- **A `PostToolUse` hook's plain stdout does not reach the model.** Exit 0 with plain text goes to the debug log only. To feed a linter's output to Claude you need either exit 2 with the message on **stderr**, or exit 0 with JSON carrying `hookSpecificOutput.systemMessage`.
- **A blocking `PostToolUse` ends the turn by default.** "`PostToolUse`: by default the turn ends and the `reason` appears in the chat as a warning line. **Set `continueOnBlock: true` to feed the `reason` back to Claude and continue the turn instead**" (<https://code.claude.com/docs/en/hooks-guide>). Without that flag, a failing structural check stops the agent rather than prompting it to fix the path.

Also available, and relevant where a rule needs judgment rather than a regex: `type: "prompt"` hooks send the hook's input to a Claude model (Haiku by default) to make the decision, and `type: "agent"` hooks run a full subagent with up to 50 tool-use turns. Both return `{"ok": ..., "reason": ...}`. For a closed folder vocabulary these are the wrong tool — the rule is a regex and should be one — but they are the documented route for the class of convention that genuinely cannot be expressed deterministically.

**What the evidence says about this loop.** The general result — external execution feedback beats self-critique — is well-refereed. Chen et al.'s "Teaching Large Language Models to Self-Debug" (arXiv:2304.05128, ICLR 2024) makes the contrast sharply: on Spider, where *no unit tests exist*, gains are 2–3%; on TransCoder/MBPP *with* tests, up to 12%, matching baselines that generate 10x more candidates. CRITIC (Gou et al., arXiv:2305.11738, ICLR 2024) ablates the tool away and self-critique contributes **−0.03 to +2.33 F1**, i.e. nothing. And Huang et al., "LLMs Cannot Self-Correct Reasoning Yet" (arXiv:2310.01798, ICLR 2024) found intrinsic self-correction actively *degrades* performance. Together these argue for an external checker in the loop and against asking the model to review its own structure. The standing caution is Olausson et al., "Is Self-Repair a Silver Bullet?" (arXiv:2306.09896, ICLR 2024): budget-matched against plain resampling, repair gains "are often modest, vary a lot… and are sometimes not present at all", and **the bottleneck is feedback quality, not the repair step** — better feedback raised the repaired-and-passing fraction 1.58x.

State the inference plainly, because it is easy to lose: none of these papers tested a **linter** as the feedback source. Chen et al. used unit tests, CRITIC used search and interpreters, and Olausson et al.'s "better feedback" came from a stronger model and from humans. "A structural rule's error message is a good instance of external execution feedback" is a reasonable reading of that literature, not a result it reports.

**Lint-specifically, the evidence is thinner but points the right way.** Blyth, Licorish, Treude & Wagner (arXiv:2508.14419, 2025-08-20) fed Bandit and Pylint output back to GPT-4o for 10 iterations over 470 prompts: **readability and convention violations fell from over 80% to 11%**, security from >40% to 13%. Not peer-reviewed. ByteDance's BitsAI-Fix (arXiv:2508.03487, ASE 2025) is the best production datapoint: lint re-scan as verifier, >5,000 engineers, >12,000 static-analysis issues resolved, ~85% remediation accuracy.

Two findings that should shape how you write the error message. FeedbackEval (Dai et al., arXiv:2504.06939) ranks feedback channels and puts **raw compiler output last at 49.2%**, below test feedback (57.9%) and LLM-expert feedback (62.9%) — compiler output localises but does not explain — with marginal benefit diminishing after two or three iterations. And Skopin & Kotelnikov (arXiv:2605.30478) found that **lint-only reward gets gamed**: "using only static-analysis penalties may bias the policy toward shorter completions that reduce lint errors without reliably improving functional correctness." The practical read: a violation message that names the allowed vocabulary (as eslint-plugin-project-structure's does, §3.2) is worth more than one that only says the path is wrong — and a structural check should never be the only signal in the loop.


### 5.3 A working guard for this repo

The docs' own "Block edits to protected files" example is the template: a script reads the tool input JSON on stdin, checks `.tool_input.file_path`, and exits 2 with a stderr message that Claude receives as feedback (<https://code.claude.com/docs/en/hooks-guide#block-edits-to-protected-files>). Adapted to the feature vocabulary and **tested against real paths from this repo**:

```bash
#!/bin/bash
# .claude/hooks/store-feature-structure.sh
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE_PATH" ]] && exit 0

REL="${FILE_PATH#*/apps/store/src/features/}"
[[ "$REL" == "$FILE_PATH" ]] && exit 0        # not under the store's features/
SEGMENT="${REL#*/}"
[[ "$SEGMENT" == "$REL" ]] && exit 0          # a file directly in features/, not in a feature
SEGMENT="${SEGMENT%%/*}"

case "$SEGMENT" in
  api|assets|components|hooks|stores|types|utils) exit 0 ;;
  # Grandfathered: see docs/research/agent-structural-conventions.md
  payment) [[ "$REL" == checkout/* ]] && exit 0 ;;
esac

if [[ "$SEGMENT" == *.* ]]; then
  echo "Blocked: apps/store/src/features/<feature>/ takes no loose files. Put '$SEGMENT' under api/, components/, hooks/, stores/, types/, utils/ or assets/." >&2
else
  echo "Blocked: '$SEGMENT' is not a sanctioned folder under apps/store/src/features/<feature>/. Allowed: api, assets, components, hooks, stores, types, utils." >&2
fi
exit 2
```

Registered as:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/store-feature-structure.sh" }]
      }
    ]
  }
}
```

Verified behaviour by feeding it the real paths involved: it blocks `features/account/payment-methods/expiry.ts` (the incident) and `features/orders/order-progress.ts`, and passes `features/account/utils/expiry.ts` (the intended destination), `src/components/ui/button.tsx` and everything in `apps/backend/`.

The limitation is scope: this is Claude Code only, it is per-developer configuration rather than a repo invariant enforceable in CI, and an agent that writes the file via `bash cat > …` rather than `Write` sidesteps the `Edit|Write` matcher. The docs' answer to that last gap — "To reformat a specific file however it changes, including when a `Bash` command rewrites it, use a `FileChanged` hook instead" — does not close it, because `FileChanged` cannot block. So: a fast local guard, not the gate.

---

## 6. Emerging agent-oriented convention formats

**AGENTS.md** (§2.1) is the only format with real cross-vendor adoption. It is a *location* standard, not a *content* standard: "Are there required fields? No. AGENTS.md is just standard Markdown… the agent simply parses the text you provide" (<https://agents.md/>). It changes nothing about compliance for a structural rule; it changes which file the rule goes in.

**GitHub spec-kit** (<https://github.com/github/spec-kit>) is the most-cited "constitution" approach — created 2025-08-21, v1.0.0 on 2026-08-21, v1.0.4 on 2026-09-02. `/speckit.constitution` writes `.specify/memory/constitution.md`, described as "project governing principles and development guidelines that will guide all subsequent development". Its plan template contains a literal gate:

> ## Constitution Check
> *GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

and a "Complexity Tracking" table for justifying violations. But **that gate is a prompt instruction executed by the same model that writes the code** — there is no checker. The plan template's "Project Structure" section ends "Structure Decision: [Document the selected structure and reference the real directories captured above]", i.e. structure is a recorded decision the agent re-reads, not a checked constraint. spec-kit makes no claim that architectural compliance is verified. Treat constitution files as a better-organised instruction file, in the same reliability class as §2.

**Architecture manifests** as a distinct artefact category: I found no format with meaningful adoption or any tooling that reads one to check a repo. Nothing to report.

---

## 7. Comparison table

| Mechanism | Can it forbid an unsanctioned folder under `src/features/*/`? | Deterministic? | Feedback latency | Evidence quality |
|---|---|---|---|---|
| `CLAUDE.md` / `AGENTS.md` / Cursor rules / Copilot instructions | States it; cannot enforce it | **No** — vendor-documented as advisory | Author-time, probabilistic | Strong primary sources for the limitation; **measured**: ~80–85% per rule, 10–28% all-rules-at-once (OctoBench), ~5.6% decay per function (McMillan) |
| `.claude/rules/` with `paths:` frontmatter | Same, scoped to the directory | No | Author-time, and only once a matching file is read | First-party docs; scoping itself unmeasured |
| Phrasing the rule as a prohibition rather than a directive | Improves the odds; enforces nothing | No | Author-time | **Measured** but on a proxy outcome: 25,532 rules, >5,000 runs; positive directives were the harmful ones (Guardrails Beat Guidance) |
| Compiling the prose rule into an executable check | **Yes** — that is what it means | **Yes** | Gate / agent-loop | **Measured**: 67.0% → 88.3% constraint compliance (ContextCov) — one single-author preprint |
| Claude Code `PreToolUse` hook | **Yes** — blocks the write, feeds the reason back | **Yes**, within Claude Code | Agent-loop (pre-write) | First-party contract; verified locally in this repo |
| Claude Code `permissions.deny` | **No** — gitignore globs, no negation, deny beats allow | Yes | Pre-write | First-party docs, explicit |
| **dependency-cruiser `required` rule** | **Yes** — run against this tree; found every known deviation, no false positives | **Yes** | Commit-time / verify gate | Verified empirically; undocumented use of a documented primitive |
| dependency-cruiser `forbidden` rule | No — evaluated per import edge; misses import-free files | Yes | Commit-time | Verified: it missed 2 of 3 planted files |
| **eslint-plugin-project-structure** `folder-structure` | **Yes** — this is its stated purpose; verified | **Yes** | Author-time (editor) + gate | Plugin docs + verified locally; needs ESLint (90 pkgs / 45 MB) |
| eslint-plugin-boundaries `no-unknown-files` | Partially — flags "unknown", not "wrong folder"; no options; off by default | Yes | Author-time + gate | Plugin source read (v7.2.0); not run here |
| eslint-plugin-boundaries `dependencies` | No — import policy only | Yes | Author-time | Plugin source + README |
| Nx `@nx/enforce-module-boundaries` | **No** — its `Options` type has no path/folder field at all | Yes | Author-time + gate | Nx rule source + docs |
| Nx Conformance (custom rule) | **Yes** — `tree.children()`, `readFileSync` | Yes | Gate | Nx docs; **Enterprise licence required** |
| Biome plugins (GritQL) | **No** — `span` must be a syntax node; JS/CSS/JSON only; `multifile` not in progress | Yes | Author-time | Biome docs + source + tracking issue |
| Steiger (FSD) | **No, by design** — blocklist not allowlist; allowlist closed `not_planned`; not yet extensible | Yes | CLI / watch / LSP | Steiger source + closed issue #50 |
| Generators (Nx / plop / hygen) | Prevents rather than detects; nothing stops hand-writing the folder | Partly | Author-time | **None.** No paper, no benchmark, no before/after anywhere. hygen unmaintained since 2023-03-15 |
| Linter output piped back into the agent loop | Detects; the agent may or may not act on it | Detection yes, correction no | Agent-loop | **Measured on generic rulesets**: convention violations >80% → 11% over 10 iterations (Blyth, unrefereed); ~85% remediation in production (BitsAI-Fix, ASE 2025) |
| spec-kit constitution / "Constitution Check" | No — a prompt gate the model self-evaluates | No | Author-time | Repo docs; no compliance claim |
| Bulletproof React's own recipe (`import/no-restricted-paths`) | **No** — enforces import direction, not layout | Yes | Author-time | Bulletproof React docs |

---

## 8. Recommendation for this repo

The repo already has the right gate. It does not need a new tool.

**1. Add two `required` rules to `apps/store/deps-analyzer/.dependency-cruiser.cjs`.** Zero new dependencies, and it joins the existing `job_deps` suite in `scripts/verify.sh`, which already runs `npm run --workspace=store check:deps`. Config as given in §3.1. Verified by merging it into the real config and cruising the real `src`: the existing `forbidden` rules keep passing (`✔ no dependency violations found` on the unmodified config), and the two new rules report exactly the known deviations and nothing else — currently 21 file-level violations across five locations. Downsides, stated honestly: it is one violation per *file* rather than per folder (21 lines of output for 5 problems, 17 of them from `checkout/payment/` alone), it uses a `required` rule in a way the docs never describe, and it cannot see an empty folder or one containing only non-parsable files.

**2. Fix or grandfather the five remaining deviations, deliberately, before turning the rule on.** This is the step that matters most and the one a tool cannot do for you. `checkout/payment/` in particular is 17 files including `adapters/stripe/`, is named in `.dependency-cruiser.cjs` (`STRIPE_ADAPTER_PATH`) and in ADR 0010. Two honest options:

   - **Move it.** `checkout/payment/` is split across `checkout/{api,components,hooks,types}/`. Costs a 17-file diff, an update to `STRIPE_ADAPTER_PATH` in `.dependency-cruiser.cjs`, and an ADR 0010 amendment.
   - **Widen the vocabulary and say so.** If a feature genuinely warrants a named sub-feature folder, that is a divergence from Bulletproof React and belongs in an ADR, with the vocabulary extended to `(api|assets|components|hooks|stores|types|utils|<named sub-features>)` in one place. What must not persist is the current state: an unstated rule with unexplained exceptions, which is precisely the input that produced the incident.

   Whichever you pick, the four loose feature-root files (`address/form-values.ts`, `checkout/checkout-address.ts`, `orders/fulfillment-labels.ts`, `orders/order-progress.ts`) are small and should just move into `utils/` or `types/`.

**3. State the closed vocabulary in a path-scoped rule, not in `CLAUDE.md`.** `CLAUDE.md` is at 207 lines against a documented 200-line adherence threshold, and this rule applies to one directory. Put it at `.claude/rules/store-feature-structure.md`:

Phrase it as a **prohibition**, not as guidance. "Guardrails Beat Guidance" (§2.4) found that every individually beneficial rule in a 25,532-rule corpus was a negative constraint, and that positive directives — with "follow code style" as the worked example — were the individually harmful ones. So:

```markdown
---
paths:
  - "apps/store/src/features/**"
---

# Store feature folders

Do not create any folder under `apps/store/src/features/<feature>/` other than
`api`, `assets`, `components`, `hooks`, `stores`, `types`, `utils`.
Do not put a loose file at a feature root; the only file allowed there is `index.ts`.

Nesting *inside* one of those folders is unconstrained.

`features/checkout/payment/` and the loose files under `address/` and `orders/` predate this
rule and are grandfathered in `apps/store/deps-analyzer/.dependency-cruiser.cjs`.
They are not precedent — do not copy them.
```

That last sentence is doing real work: it pre-empts exactly the codebase-precedent reading described in §1(c). Note the compaction caveat from §2.3 — a path-scoped rule loads when Claude reads a matching file, which may be after it has picked a path. That is why the deterministic rule in step 1 is the primary mechanism and this is the explanation layer.

The supporting evidence for this ordering — check first, prose second — is ContextCov's 67.0% → 88.3% (§2.4), which is one single-author preprint. That is thinner than the confidence with which the vendors assert the same thing, and worth knowing.

**4. Optionally, add the `PreToolUse` hook from §5.3.** It moves the feedback from gate-time to pre-write, and it is the only mechanism that stops the wrong folder from being created at all. It is Claude Code-specific and per-developer, so treat it as ergonomics on top of the gate, never as the gate.

**One dissenting consideration, before any of the above.** Steiger's maintainer looked at exactly this rule for Feature-Sliced Design and declined it — "I don't think this should be checked for" (§3.6) — on the grounds that segment names should be constrained *semantically* (name by purpose) rather than by enumeration, and that teams legitimately want their own named segments. `checkout/payment/` is a decent example of that argument in this repo: it is a coherent sub-feature, not sloppiness. If you find that persuasive, the alternative shape is to enforce only the cheap, unambiguous half — **no loose files at a feature root** — and leave folder names free. That would still have caught nothing in the original incident, which is the honest reason to prefer the closed vocabulary here: the value is not that `payment-methods/` is *wrong*, it is that an agent should not get to invent structure unilaterally in a PR.

**Do not adopt** eslint-plugin-project-structure here, despite it being the best-fit tool in isolation. It is well-maintained (v3.14.4, 2026-09-02), its config is more readable than the regex approach, and its error message names the allowed vocabulary — but it costs 90 packages and 45 MB to introduce ESLint into a Biome repo, for one rule that dependency-cruiser can already express with none. Revisit if a second or third structural rule appears; at that point the config-readability argument starts to win.

---

## 9. Where the evidence is thin

**No benchmark scores repo-convention compliance as a first-class metric.** SWE-bench and its descendants gate on tests passing. The measurements in §2.4 are purpose-built studies, not a standing benchmark anyone competes on, which means there is no trend line and no cross-model leaderboard for this property. The one paper that treats style consistency and internal API reuse as scored metrics is "Learning to Commit", and its judge-scored win rates are modest (54–58%).

**Most of the strongest-sounding results are recent, unrefereed preprints — several single-author.** ContextCov, McMillan and the Blyth lint study are all in that category, and ContextCov is the *only* number anywhere behind the central "compile the rule into a check" recommendation. The well-refereed work (ICLR, NeurIPS, ASE) is about correctness under execution feedback, not about conventions. If one of these preprints does not survive review, §8 loses its empirical support and falls back to an argument from determinism.

**There is no evidence at all that generators or scaffolding improve agent structural compliance.** Not a paper, not a vendor benchmark, not a blog post with a before/after (§4). The obvious experiment — arm A writes freehand under `CLAUDE.md`, arm B invokes a generator, both scored by an AST or lint conformance checker — appears not to have been run by anyone. Widely circulated lines like "structure beats instructions every time" have nothing behind them. This repo, with its existing dependency-cruiser rules and a scored conformance check now available, is unusually well placed to actually run it.

**Nobody has measured project-specific rules fed back to an agent improving compliance with *those* rules.** All the lint-loop evidence in §5.3 uses generic off-the-shelf rulesets (Pylint, Bandit) on standalone-function benchmarks. Extending "a linter in the loop reduced convention violations from 80% to 11%" to "a bespoke dependency-cruiser rule will make an agent choose `utils/`" is an extrapolation across both the ruleset and the task shape.

**The codebase-precedent-versus-stated-rule conflict is contested and unresolved.** §2.4 has one paper on each side, neither about repositories: pattern-following overrides instruction-following in Camassa & Shiller's toy-task setting, and instructions beat examples for code style in Bohr's N=160 study. Anthropic documents that two contradictory *written* rules are resolved arbitrarily, which is adjacent but not the same thing. The §1(c) reading of this incident is an inference from one occurrence and should carry that label wherever it is repeated.

**"Deterministic beats instructions" is, from the vendors, an assertion and never a measurement.** Anthropic, Cursor and GitHub all say some version of it (§2.2) and none publishes data. The claim happens to be well-founded for a different reason — a check either fires or it does not, which is not a probabilistic property — but do not mistake vendor confidence for vendor evidence.

**Two claims in this document are load-bearing and were not verified by running them.** The eslint-plugin-boundaries `no-unknown-files` behaviour is read from the plugin's compiled source, not observed in a run. And the Nx and Biome negatives rest on reading option schemas and tracking issues rather than attempting the rule and watching it fail — acceptable for a negative claim about an absent capability, but not the standard of §3.1 and §3.2.

**One thing I could not resolve at all**: whether the compliance rate for a *structural* rule differs from the 79.75–85.64% per-check figure OctoBench reports across mixed checklist items. Folder placement may be easier than average (it is a single discrete choice) or harder (it is decided early, before any feedback). No study separates them.

**What *is* solid** is narrow and worth restating: instruction files are followed at high per-rule rates but rarely all at once and with measurable within-session decay; the tools in §3 either can or cannot express a folder-vocabulary rule, which I established by running them; and negative constraints outperform positive directives in the largest rule-file study to date. §8 rests on those three things.

# The AGENTS.md Standard: Governance, Semantics, and Authoring Patterns

**Date:** 2026-09-05
**Context:** This repo currently carries one hand-written `CLAUDE.md` at the root and two machine-generated `AGENTS.md` files (`apps/store/AGENTS.md`, `apps/admin/AGENTS.md`, both wholly enclosed in `<!-- intent-skills:start -->` / `<!-- intent-skills:end -->` markers written by `@tanstack/intent`). A prior agent created `apps/store/src/features/account/payment-methods/` when the feature's folder vocabulary is `api/ components/ utils/`. The question is whether AGENTS.md is a real standard we can build a shared structural convention on, what it actually guarantees, and what file layout would let `apps/store` and `apps/admin` share one structural standard readable by both Claude Code and Codex. Companion doc: `docs/research/agent-structural-conventions.md` (prior pass, not edited here).

---

## Table of Contents

1. [Governance: is AGENTS.md a Linux Foundation project?](#1-governance-is-agentsmd-a-linux-foundation-project)
2. [What the spec actually mandates](#2-what-the-spec-actually-mandates)
3. [Tool support matrix](#3-tool-support-matrix)
4. [Cross-tool path scoping](#4-cross-tool-path-scoping)
5. [Bulletproof React's AGENTS.md, read closely](#5-bulletproof-reacts-agentsmd-read-closely)
6. [Codex's AGENTS.md: 15 months of git history](#6-codexs-agentsmd-15-months-of-git-history)
7. [The agents.md examples: common skeleton and divergence](#7-the-agentsmd-examples-common-skeleton-and-divergence)
8. [mattpocock/skills as a distribution pattern](#8-mattpocockskills-as-a-distribution-pattern)
9. [Recommendation: file layout for this monorepo](#9-recommendation-file-layout-for-this-monorepo)
10. [Unverified / thin evidence](#10-unverified--thin-evidence)

---

## 1. Governance: is AGENTS.md a Linux Foundation project?

**Yes — verified, but with an important qualification.** AGENTS.md is governed by the Linux Foundation, but *indirectly*: it is a project hosted by the **Agentic AI Foundation (AAIF)**, which is itself a Linux Foundation entity. It is not a standalone LF project and it does not have its own published charter, TSC roster, or governance document.

### The evidence

The Linux Foundation announced AAIF on **9 December 2025**:

> "Linux Foundation Announces the Formation of the Agentic AI Foundation (AAIF), Anchored by New Project Contributions Including Model Context Protocol (MCP), goose and AGENTS.md"
> — [linuxfoundation.org press release, 2025-12-09](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)

The same release describes AGENTS.md and its provenance:

> "AGENTS.md is a simple, universal standard that gives AI coding agents a consistent source of project-specific guidance needed to operate reliably across different repositories and toolchains. AGENTS.md has already been adopted by more than 60,000 open source projects and agent frameworks."

OpenAI released the format in **August 2025** (the `agentsmd/agents.md` GitHub repository was created `2025-08-19T17:22:54Z`, per `gh api repos/agentsmd/agents.md`), and contributed it to AAIF at the December 2025 launch.

The agents.md site itself confirms the stewardship in its About section and, more tellingly, in its footer:

> "AGENTS.md is now stewarded by the Agentic AI Foundation under the Linux Foundation."
> — [agents.md](https://agents.md/), About section

> "Copyright © AGENTS.md a Series of LF Projects, LLC. For web site terms of use, trademark policy and other project policies please see https://lfprojects.org."
> — [agents.md](https://agents.md/), footer

The "Series of LF Projects, LLC" copyright line is the legal fingerprint of a Linux Foundation–hosted project, so this is not merely marketing language. AAIF lists AGENTS.md as one of its five hosted projects, alongside Model Context Protocol, goose, agentgateway, and Agent2Agent (A2A) ([aaif.io/projects](https://aaif.io/projects/)).

### The qualification: governance is asserted, not documented

The LF press release describes the general AAIF model (neutral stewardship, TSC oversight per project), but **no AGENTS.md-specific governance artefact exists at the source**. Checking the spec repository directly:

```
$ gh api "repos/agentsmd/agents.md/git/trees/main?recursive=1" \
    --jq '.tree[]|select(.path|test("(?i)(govern|contribut|charter|spec|code_of)"))|.path'
(no results)
```

There is no `GOVERNANCE.md`, no `CONTRIBUTING.md`, no `CHARTER.md`, no `CODE_OF_CONDUCT.md`, and no versioned specification document in the repository. The repo is a Next.js marketing website (`components/`, `pages/`, `public/`, `styles/`, `next.config.ts`) plus a `README.md`, `LICENSE` (MIT), and — recursively — its own `AGENTS.md`, which is about running the website's dev server, not about the format ([github.com/agentsmd/agents.md](https://github.com/agentsmd/agents.md)).

Post-AAIF commit activity is almost entirely vendor-list and logo maintenance:

| Date | Commit |
|---|---|
| 2026-08-25 | Update Codex logo (#234) |
| 2026-03-10 | docs: update Gemini CLI instructions (#137) |
| 2026-03-10 | Add Augment Code CLI as a compatible agent (#156) |
| 2026-03-10 | Add Junie agent to the agents list (#145) |
| 2025-12-11 | Add note on AAIF in the About section |
| 2025-12-10 | Update the footer with a link to AAIF |

Source: `gh api "repos/agentsmd/agents.md/commits?per_page=25"`.

**Practical reading:** the *name* AGENTS.md is now under neutral governance and is safe to standardise on. The *semantics* are not being specified by anyone. Between the AAIF handover (Dec 2025) and today (Sep 2026) there has been no substantive change to what the format means. Do not expect the foundation to resolve the ambiguities described in §2 for you.

---

## 2. What the spec actually mandates

**Almost nothing is normative.** There is no conformance language anywhere — no RFC 2119 keywords, no MUST/SHOULD/MAY, no schema, no version number. The "spec" is the prose and FAQ on [agents.md](https://agents.md/).

### Explicitly non-normative: everything about content

> **"Are there required fields?"**
> "No. AGENTS.md is just standard Markdown. Use any headings you like; the agent simply parses the text you provide."
> — [agents.md FAQ](https://agents.md/)

That is the whole of the content specification. The site offers *popular choices* for sections — "Project overview, Build and test commands, Code style guidelines, Testing instructions, Security considerations" — framed as suggestion, not requirement.

The only genuinely normative element in the entire format is **the filename**. Everything else is convention.

### Nesting: described, but not specified

Nesting *is* part of the documented behaviour, but only as a how-to step, not as a defined algorithm:

> **"4. Large monorepo? Use nested AGENTS.md files for subprojects"**
> "Place another AGENTS.md inside each package. Agents automatically read the nearest file in the directory tree, so the closest one takes precedence and every subproject can ship tailored instructions. For example, at time of writing the main OpenAI repo has 88 AGENTS.md files."
> — [agents.md](https://agents.md/), "How to use AGENTS.md?"

### Precedence: one sentence, and it is ambiguous

> **"What if instructions conflict?"**
> "The closest AGENTS.md to the edited file wins; explicit user chat prompts override everything."
> — [agents.md FAQ](https://agents.md/)

This sentence is doing far more work than it can bear. Read carefully, it specifies **conflict resolution** ("the closest ... wins") but says nothing about **loading**. The two plausible readings are materially different:

- **Nearest-only:** load only the closest AGENTS.md; ancestors are ignored entirely.
- **Merge-with-override:** load root and all ancestors *and* the nearest file, concatenated; on contradiction the nearest sentence governs.

The site never disambiguates, and there is no test suite or reference implementation to settle it. In practice tools implement the second (see §3), but **that is convergent behaviour, not a specified guarantee.** Anything you write that depends on a root file still being in context while an agent edits a deeply nested file is relying on tool behaviour, not on the format.

### Path/glob scoping: absent

**The spec says nothing about scoping rules to file paths.** There is no frontmatter, no `applyTo`, no `globs`, no metadata block of any kind. The only scoping primitive the format has is *directory placement* — an AGENTS.md applies to its own directory and everything beneath it. If you want "this rule applies to `**/*.test.ts`", AGENTS.md cannot express it; you must either put the rule in a directory that happens to contain only those files, or write it as prose the model has to interpret ("when editing test files, ...").

This is the single largest gap between AGENTS.md and the per-tool rule systems in §4.

### One verifiable factual error on the site

The site claims "the main OpenAI repo has 88 AGENTS.md files." Checking `openai/codex` — the repo the site links as its first example — there are **two**:

```
$ gh api "repos/openai/codex/git/trees/main?recursive=1" \
    --jq '.tree[]|select(.path|test("AGENTS\\.md$"))|.path'
AGENTS.md
codex-rs/tui/src/bottom_pane/AGENTS.md
```

"The main OpenAI repo" may refer to an internal monorepo not publicly visible, in which case the claim is simply unverifiable. Either way, **do not use "88 files" as evidence that heavy nesting is the norm.** The public example repositories nest far more modestly:

| Repo | AGENTS.md files | Verified via |
|---|---|---|
| `openai/codex` | 2 | `gh api repos/openai/codex/git/trees/main?recursive=1` |
| `apache/airflow` | 14 | `gh api repos/apache/airflow/git/trees/main?recursive=1` |
| `PlutoLang/Pluto` | 0 (no root AGENTS.md on `main`) | `gh api repos/PlutoLang/Pluto/contents/AGENTS.md` → 404 |
| `alan2207/bulletproof-react` | 1 | `gh api repos/alan2207/bulletproof-react/git/trees/master?recursive=1` |

(The `+598` / `+4584` badges on the agents.md example cards are contributor counts, not file counts.)

---

## 3. Tool support matrix

Verified 2026-09-05 against **vendor documentation only**, not against agents.md's claims. Three doc sites moved and older citations are stale: OpenAI Codex `developers.openai.com/codex/*` → `learn.chatgpt.com/docs/*` (308), Cursor `docs.cursor.com/context/rules` → `cursor.com/docs/rules` (308), and **`docs.windsurf.com` is gone** — everything 308s to `docs.devin.ai`, where Windsurf is now "Devin Desktop".

| Tool | Native AGENTS.md | Nested + semantics | Path/glob scoping | Source |
|---|---|---|---|---|
| **OpenAI Codex** | Yes, zero config | Yes, but **root→cwd chain only**; never scans below cwd. Concatenated root-first, later (nearer) files override. One file per dir; 32 KiB cap (`project_doc_max_bytes`) | **None** | [learn.chatgpt.com/docs/agent-configuration/agents-md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) |
| **Cursor** | Yes, zero config (also reads `CLAUDE.md`) | Yes, any subdirectory, attached by *file being worked on*. "Combined with parent directories, with more specific instructions taking precedence" | Yes — `globs:` in `.cursor/rules/*.mdc`. **Not available via AGENTS.md** | [cursor.com/docs/rules](https://cursor.com/docs/rules) |
| **Claude Code** | **No** — "reads `CLAUDE.md`, not `AGENTS.md`". Needs `@AGENTS.md` import or a symlink | Yes for CLAUDE.md: ancestors concatenated at launch, **subdirectory files loaded on demand** when Claude reads a file there. No conflict winner stated | Yes — `paths:` in `.claude/rules/*.md` and in `SKILL.md` frontmatter | [docs.claude.com/en/docs/claude-code/memory](https://docs.claude.com/en/docs/claude-code/memory) |
| **GitHub Copilot** | Yes, but **surface-dependent** (not github.com Chat, Visual Studio, JetBrains/Eclipse/Xcode) | Yes — "the nearest `AGENTS.md` file in the directory tree will take precedence". **VS Code nesting is off by default** (`chat.useNestedAgentsMdFiles`, experimental) | Yes — `applyTo:` in `.github/instructions/**/*.instructions.md` | [docs.github.com — repository instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions) |
| **Gemini CLI** | **No** — default is `GEMINI.md`; requires `context.fileName` in `settings.json` | Yes for its context file; global + workspace + **scans *below* cwd** (≤200 dirs); all concatenated | None (`@file.md` imports are static) | [gemini-md.md](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md) |
| **Jules** | Yes, zero config, **root only** | **UNVERIFIED** — no vendor statement either way | None documented | [jules.google/docs](https://jules.google/docs/) |
| **Zed** | Yes, but **7th in a first-match-wins list of 9** — shadowed by `.rules`, `.cursorrules`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`, `AGENT.md` | **UNVERIFIED** — no subdirectory traversal documented. Only stated rule: project overrides personal | None documented | [zed.dev/docs/ai/instructions](https://zed.dev/docs/ai/instructions) |
| **Aider** | **No — none at all.** Zero occurrences in vendor docs or repo | Not supported | None | [aider.chat/docs/usage/conventions.html](https://aider.chat/docs/usage/conventions.html) |
| **Amp** | Yes, automatic; falls back to `AGENT.md`/`CLAUDE.md` per directory | Yes — cwd + parents to `$HOME` always; **subtree files load when the agent reads a file in that subtree**. Merged; conflict winner unstated | Yes — `globs:` frontmatter on @-mentioned files, implicit `**/` prefix | [ampcode.com/docs/customize/agents-md](https://ampcode.com/docs/customize/agents-md) |
| **opencode** | Yes (+ `~/.config/opencode/AGENTS.md`) | V1: upward walk, **first-match-wins**, per-subdir loading undocumented. V2 beta: combine-all + lazy nested | `instructions` globs *select files to load*, they do not *scope rules* | [opencode.ai/docs/rules](https://opencode.ai/docs/rules/) |
| **Windsurf** (→ Devin Desktop) | Yes, **with automatic location-based scoping** | Yes — workspace + subdirs + up to git root; merged, nearest-wins unstated | Yes — `trigger: glob` + `globs:`, **plus implicit `<dir>/**` desugared from AGENTS.md placement** | [docs.devin.ai/desktop/cascade/agents-md](https://docs.devin.ai/desktop/cascade/agents-md) |
| **Devin** (cloud) | Yes | **UNVERIFIED** | No — natural-language trigger descriptions, not patterns | [docs.devin.ai/onboard-devin/agents-md](https://docs.devin.ai/onboard-devin/agents-md) |
| **Devin CLI** | Yes (+ global, `.local`, and a documented off switch) | Yes — lazy on file access; merged ("both are loaded") | `.devin/rules/` frontmatter only; **AGENTS.md is always always-on** | [docs.devin.ai/cli/extensibility/rules](https://docs.devin.ai/cli/extensibility/rules) |

### Three corrections to the registry's claims

**(a) agents.md's blanket nesting sentence is a per-tool-false generalisation.** The site says "Agents automatically read the nearest file in the directory tree, so the closest one takes precedence." Of the twelve tools above, only **GitHub Copilot** states nearest-wins in those words. Codex and Claude Code **concatenate with no declared override winner**. Zed uses first-match-wins *across filenames*. opencode V1 documents no per-subdirectory loading at all.

**(b) Two tools listed on agents.md do not read AGENTS.md natively.** **Aider** has zero occurrences of `AGENTS.md` in its docs *or* its repository; it needs a hand-written `read: AGENTS.md` in `.aider.conf.yml`. **Gemini CLI** defaults to `GEMINI.md` — its own source has `export const DEFAULT_CONTEXT_FILENAME = 'GEMINI.md'` — and AGENTS.md appears only as an example value for the opt-in `context.fileName` setting. (Note the key was renamed: it is `context.fileName`, not the older `contextFileName`.) agents.md's own FAQ concedes both, giving config snippets for each.

**(c) Claude Code — the one that matters most here — does not read AGENTS.md either.** Verbatim:

> "Claude Code reads `CLAUDE.md`, not `AGENTS.md`. If your repository already uses `AGENTS.md` for other coding agents, create a `CLAUDE.md` that imports it so both tools read the same instructions without duplicating them."
> — [docs.claude.com/en/docs/claude-code/memory](https://docs.claude.com/en/docs/claude-code/memory)

There is no settings key for it. `/init` and `/import` can read an AGENTS.md, but both are **one-time copy operations at setup**, not ongoing reads. The supported paths are `@AGENTS.md` as an import line, or `ln -s AGENTS.md CLAUDE.md`.

### The constraint that shapes everything: Codex stops at cwd

The most consequential asymmetry in the table, and the one most likely to bite a monorepo:

> "Codex stops searching once it reaches your current directory, so place overrides as close to specialized work as possible."
> — [learn.chatgpt.com](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

Codex walks **project root down to cwd** and concatenates. It **never scans below cwd**. So if you launch `codex` at the monorepo root and it then edits `apps/store/src/features/account/...`, it will have read `/AGENTS.md` and **nothing else** — `apps/store/AGENTS.md` is invisible. Getting it requires `codex --cd apps/store`. The chain is also built **once per run**: "Codex rebuilds the instruction chain on every run (and at the start of each TUI session), so there is no cache to clear manually." There is no lazy load path.

Claude Code is the mirror image — it *does* pick up subdirectory files lazily: "Claude also discovers `CLAUDE.md` and `CLAUDE.local.md` files in subdirectories under your current working directory. Instead of loading them at launch, they are included when Claude reads files in those subdirectories."

**Consequence for §9: any rule that must always hold has to live in the root file.** Nested files are a reliable *enhancement* for Claude Code and an *unreliable* one for Codex.

---

## 4. Cross-tool path scoping

**There is no converged standard. Every tool is bespoke — they do not agree on the field name, the YAML type, or even whether the field alone is sufficient.**

| Tool | File | Field | Value shape | Also required |
|---|---|---|---|---|
| Cursor | `.cursor/rules/*.mdc` | `globs` | unquoted scalar, comma-separated | `alwaysApply: false` |
| GitHub Copilot | `.github/instructions/*.instructions.md` | `applyTo` | **quoted** string, comma-separated | — (`excludeAgent` optional) |
| Claude Code | `.claude/rules/*.md`, `SKILL.md` | `paths` | YAML list **or** comma-separated string; brace expansion | — |
| Windsurf / Devin | `.devin/rules/*.md` | `globs` | unquoted scalar | **`trigger: glob`** |
| Amp | any @-mentioned file | `globs` | YAML list; implicit `**/` prefix | — |
| **OpenAI Codex** | — | — | — | **mechanism does not exist** |

Worked examples, each verbatim from its vendor's docs:

```markdown
---
globs: src/components/**/*.tsx      # Cursor (.mdc) — also needs alwaysApply: false
alwaysApply: false
---
```
```markdown
---
applyTo: "**/*.ts,**/*.tsx"          # GitHub Copilot (.instructions.md)
---
```
```markdown
---
paths:                               # Claude Code (.claude/rules/*.md)
  - "src/**/*.{ts,tsx}"
  - "tests/**/*.test.ts"
---
```
```markdown
---
trigger: glob                        # Windsurf — globs alone does nothing
globs: **/*.test.ts
---
```

The same file cannot be shared across two of these without rewriting the frontmatter: `globs:` in a Windsurf rule is inert without `trigger: glob`; the same `globs:` in a Cursor `.mdc` is ignored if `alwaysApply` is true; neither key means anything to Copilot, which wants `applyTo` quoted; and none of them mean anything to Codex, which would silently concatenate the file's body — frontmatter and all — if the filename happened to be on its fallback list.

Two details worth knowing about Claude Code's `paths:`, since it is the only glob mechanism available to us alongside Codex:

> "Rules can be scoped to specific files using YAML frontmatter with the `paths` field. These conditional rules only apply when Claude is working with files matching the specified patterns. … Rules without a `paths` field are loaded unconditionally and apply to all files. **Path-scoped rules trigger when Claude reads files matching the pattern, not on every tool use.**"

Brace expansion is supported, budgeted at "1,000 expanded patterns and 4 MiB" per rule. `.claude/rules/` is discovered recursively and supports symlinks.

### What *has* converged: directory nesting

`AGENTS.md` is genuinely the cross-tool primitive — Cursor, Copilot, Codex, Amp, Windsurf, opencode and Devin all read it, and Claude Code documents the import path. But **it converged on directory nesting, not globs**, and even there the semantics fork three ways:

- **Combine, child wins on conflict** — Cursor: "combined with parent directories, with more specific instructions taking precedence." Windsurf: the same, achieved by desugaring.
- **Nearest file wins outright** — GitHub Copilot: "the nearest `AGENTS.md` file in the directory tree will take precedence."
- **Concatenate along the cwd ancestry only, once per run** — Codex.

Windsurf is the single place where the two paradigms are unified *by design* rather than by accident. It feeds AGENTS.md into the same rules engine as `.devin/rules/`, "just with the activation mode inferred from the file's location instead of frontmatter" — root file → `always_on`, and "**Subdirectories**: Treated as a **glob** rule with an auto-generated pattern of `<directory>/**`." That is a useful mental model even for tools that do not implement it: *a nested AGENTS.md is a glob rule whose pattern is its own directory.*

### The least-bad way to author once

Ranked by how much they actually buy you:

1. **Write the rule so directory placement is sufficient.** If a rule can be expressed as "everything under `apps/store/src/features/`", a nested `AGENTS.md` covers all seven AGENTS.md-reading tools with zero per-tool files. This is the only genuinely write-once option. It cannot express cross-cutting patterns like `**/*.test.ts`.
2. **Root AGENTS.md + a `CLAUDE.md` symlink (or `@AGENTS.md` import) per directory.** One source of truth, one-line adapters, no build step. Verified in the wild: `apache/airflow` ships `CLAUDE.md` and `registry/CLAUDE.md` as git symlinks (mode `120000`) whose blob contents are the nine bytes `AGENTS.md`.
3. **Add per-tool glob rules only where directory placement genuinely cannot express the rule**, and treat them as *restatements* of the AGENTS.md rule rather than as the source of truth. Accept the duplication; it is small and the alternative is a codegen step to maintain.
4. **Do not build a frontmatter transpiler.** Nothing in the ecosystem does this, including the projects most invested in cross-tool distribution (§8). The field-name divergence is only the surface problem; the trigger semantics differ too.

**Codex is the binding constraint.** Claude Code, Cursor, Copilot, Windsurf and Amp all have globs. Codex has nothing but directory nesting — so anything Codex must honour has to be expressible as a directory, or live in the root file.



---

## 5. Bulletproof React's AGENTS.md, read closely

Source: [github.com/alan2207/bulletproof-react/blob/master/AGENTS.md](https://github.com/alan2207/bulletproof-react/blob/master/AGENTS.md) (raw fetched 2026-09-05, 289 lines).

### Provenance: written once, never revised

```
$ gh api "repos/alan2207/bulletproof-react/commits?path=AGENTS.md"
2026-04-18  dde5a4ad6  docs: Add comprehensive AGENTS.md for AI coding agents (#245)
```

**One commit.** This is a single-shot document that has never been corrected in response to an agent getting something wrong — the opposite of Codex's file (§6, 75 commits). That matters when judging it: it has no feedback loop behind it, so its phrasing has not been pressure-tested.

### Structure

Twenty `##` sections, in this order: Project Overview (with `### Application Domain`), Setup Commands, Project Structure (with `### Feature Structure`), Code Standards, Component Guidelines, State Management Strategy, API Layer, Testing Strategy, Security Considerations, Performance Optimization, Error Handling, Build and Deployment, File Naming Conventions, Development Workflow, Key Libraries, Common Patterns.

The dominant unit is a bolded-term bullet: `- **Term** - explanation`. Almost every rule in the file takes that shape.

### How it expresses folder vocabulary

Two ASCII trees with trailing comments, and nothing else. The repo-level tree:

```
src/
├── app/              # Application layer (routes, providers, router)
├── components/       # Shared UI components
├── config/          # Global configurations and env variables
├── features/        # Feature-based modules (auth, discussions, comments, etc.)
├── hooks/           # Shared React hooks
├── lib/             # Preconfigured libraries (react-query, auth, etc.)
├── testing/         # Test utilities and mocks
├── types/           # Shared TypeScript types
└── utils/           # Shared utility functions
```

And the feature-level tree, introduced by one sentence:

> "### Feature Structure
> Each feature should be self-contained:
>
> ```
> src/features/awesome-feature/
> ├── api/         # API calls and hooks for this feature
> ├── components/  # Feature-specific components
> ├── hooks/       # Feature-specific hooks
> ├── stores/      # Feature-specific state
> ├── types/       # Feature-specific types
> └── utils/       # Feature-specific utilities
> ```"

### Prohibitions vs positive directives

Overwhelmingly **positive directives**. The file is a catalogue of preferences ("Prefer", "Use", "Keep", "Start with"). It contains only a handful of prohibition-shaped rules, and they are notably the sharpest lines in the document:

- `- **No cross-feature imports** - Features should not import from each other`
- `- **Unidirectional flow** - Code flows: shared → features → app`
- `- Avoid premature globalization`
- `- Avoid excessive splitting (balance requests vs. bundle size)`
- `- Test behavior, not implementation details`

Note the asymmetry: the two rules with real teeth (`No cross-feature imports`, `Unidirectional flow`) are exactly the two that are *also mechanically enforced* by ESLint in that repo. The folder vocabulary — which is not mechanically enforced — gets no equivalent prohibition.

### Would it have prevented `src/features/account/payment-methods/`?

**No. Not as written.** Walk the three rules that could conceivably have bitten:

1. **The feature tree.** It is introduced by *"Each feature should be self-contained"* — a statement about *coupling*, not about *closure*. `payment-methods/` inside `account/` is perfectly self-contained; it imports nothing from another feature. The rule, read literally, is satisfied. And a Markdown code fence listing six directories is an **illustration**, not an enumeration. Nothing in the file says "these are the only directories permitted directly under a feature," or "every file under `src/features/<name>/` must live in one of `api`, `components`, `hooks`, `stores`, `types`, `utils`."

2. **File naming conventions.** `- **Folders**: kebab-case throughout`. `payment-methods` *is* kebab-case. This rule actively **validates** the mistake rather than catching it.

3. **Colocation.** `- **Colocation** - Keep related code as close as possible to where it's used`. This is the worst offender — read on its own it is an *argument in favour* of creating `payment-methods/` next to the code that uses it.

So the document is not merely silent on the failure mode; two of its rules can be read as endorsing it. What is missing is a **closure statement** plus a **placement rule**. Something like:

> `src/features/<name>/` contains exactly these directories and no others: `api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`. Do not create any other directory directly under a feature. A sub-domain of a feature is not a folder — it is a filename prefix inside the existing folders (`utils/payment-methods.ts`, `components/payment-method-list.tsx`).

That phrasing does three things the original does not: it declares the list **closed** ("exactly these ... and no others"), it states the **prohibition** explicitly ("Do not create any other directory"), and — most importantly — it supplies the **alternative**. An agent that has been told only "don't" still has to invent a "do"; an agent given the alternative has nowhere to wander.

### Nested files and the docs/ relationship

There are **no nested AGENTS.md files** in bulletproof-react — one root file only, and no `CLAUDE.md`, no `.cursor/rules`, no `.github/instructions`.

The `docs/` relationship is the most instructive part, and it is a **cautionary** example. The repo has a full prose documentation set:

```
docs/project-structure.md      docs/components-and-styling.md   docs/state-management.md
docs/api-layer.md              docs/testing.md                  docs/security.md
docs/error-handling.md         docs/performance.md              docs/deployment.md
docs/project-standards.md      docs/application-overview.md     docs/additional-resources.md
```

The AGENTS.md section list is a near one-to-one mirror of that file list — and **AGENTS.md never once references `docs/`**:

```
$ grep -n "docs/" AGENTS.md
(no matches)
```

So the AGENTS.md is a **duplicated summary** of the documentation, not a pointer into it. Two consequences: the docs and the summary can drift silently (and with one commit in five months, they almost certainly have), and the agent gets the lossy summary rather than the authoritative source. Compare Airflow, which does the opposite — its nested UI file opens by *delegating*: "For setup, pnpm commands, project structure, styling, state management, testing guidance, and general best practices, see the contributing docs: `contributing-docs/15_node_environment_setup.rst`. Additional commands and conventions not covered there are listed below." ([airflow-core/src/airflow/ui/AGENTS.md](https://github.com/apache/airflow/blob/main/airflow-core/src/airflow/ui/AGENTS.md))

---

## 6. Codex's AGENTS.md: 15 months of git history

Sources: [openai/codex/blob/main/AGENTS.md](https://github.com/openai/codex/blob/main/AGENTS.md) and the full commit history via `gh api "repos/openai/codex/commits?path=AGENTS.md&per_page=100" --paginate`.

**75 commits touching AGENTS.md** between 2025-05-11 and 2026-07-08. This is the single best available corpus on how an agent-instruction file actually evolves under pressure, because every commit is a reaction to something that went wrong.

### Growth curve

| Date | Commit | Lines |
|---|---|---|
| 2025-05-11 | `2b122da08` — feat: add support for AGENTS.md in Rust CLI (#885) | 5 |
| 2025-07-17 | `6949329a7` — chore: auto format code on save and add more details | 9 |
| 2025-08-15 | `8bdb4521c` — more strongly suggests running targeted tests first | 13 |
| 2025-09-17 | `208089e58` — Add instruction to install missing commands | 67 |
| 2025-12-13 | `596fcd040` — docs: remove blanket ban on unsigned integers | 104 |
| 2026-01-22 | `e520592bc` — chore: tweak AGENTS.md | 113 |
| 2026-02-12 | `75e79cf09` — docs: require insta snapshot coverage for UI changes | 169 |
| 2026-03-26 | `609019c6e` — discourage adding code to codex-core | 211 |
| 2026-06-02 | `c955f7307` — Move code review rules into AGENTS | 286 |
| 2026-07-08 | `f73a07224` — test: remove TestAppServer constructors | 322 |

Roughly 64× growth in 14 months, with the steepest jumps at content *migrations* (§ "Code Review Rules" landing wholesale in June 2026) rather than gradual accretion.

The file it grew from is worth quoting in full, because it is the seed of the entire document:

```markdown
# Rust/codex-rs

In the codex-rs folder where the rust code lives:

- Never add or modify any code related to `CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR`. You operate
  in a sandbox where `CODEX_SANDBOX_NETWORK_DISABLED=1` will be set whenever you use the `shell`
  tool. ...
```

Note what the very first rule is: a **prohibition with its rationale attached**, aimed at a specific failure the authors had already seen. Not an overview, not a build command — the thing the agent kept getting wrong.

### Pattern 1: rules get *narrower* over time, and blanket bans get deleted

The most valuable signal in the history is the removals. The clearest is `596fcd040` (2025-12-13, "docs: remove blanket ban on unsigned integers"):

```diff
 - Use method references over closures when possible per https://rust-lang.github.io/rust-clippy/...
-- Do not use unsigned integer even if the number cannot be negative.
 - When writing tests, prefer comparing the equality of entire objects over fields one by one.
```

A one-line absolute prohibition, ~5 months old, deleted outright. It was too broad to be right in every case, so rather than qualify it, they removed it. **A rule that needs an exception list is usually a rule that should not be in AGENTS.md.**

The same narrowing shows in the `docs/` guidance (`0a0d09ad2`, 2026-05-08, "Clarify docs folder guidance"), where a vague positive directive was replaced by a sharp prohibition plus a named exception:

```diff
-- When making a change that adds or changes an API, ensure that the documentation in the `docs/` folder is up to date if applicable.
+- Do not add general product or user-facing documentation to the `docs/` folder. The official Codex
+  documentation lives elsewhere. The exception is app-server API documentation, which is covered by
+  the app-server guidance below.
```

Read that diff carefully — it is the archetype. The old rule was *positive, conditional, and vague* ("ensure ... is up to date **if applicable**"). The agent has to decide what "applicable" means, and it decided wrong often enough to be worth a commit. The new rule is *negative, absolute, and carves out its exception by name*. "if applicable" is the tell for a rule that will not be followed.

### Pattern 2: approval/permission language churns hardest, and trends toward less asking

Four separate commits rewrote a single sentence about when to ask the user before running commands. The arc:

- `8192cf147` (2025-08-26, *"Tweak AGENTS.md so agent doesn't always have to test"*) **adds**: `When running interactively, ask the user before running these commands to finalize.`
- `97000c6e6` (2025-09-03) **narrows** it: `ask the user before running just fix and tests to finalize; just fmt does not require approval.`
- `1c04e1314` (2025-09-04, *"clarify test approvals"*) **narrows again**: `ask the user before running just fix to finalize. just fmt does not require approval. project-specific or individual tests can be run without asking the user, but do ask the user before running the complete test suite.`
- `ebc88f29f` (2026-01-21, *"don't ask for approval for `just fix`"*) **deletes the asking clause entirely**, keeping only the test-suite carve-out.

Five months to converge from "ask before finalizing" to "don't ask, except for the full suite." Every step made the rule *more specific about which command and which situation*. The generic version was useless because the agent could not tell which commands "these" meant.

### Pattern 3: prose gets restructured into numbered procedures

`8bdb4521c` (2025-08-15) is the moment the file stops being a bullet list and starts being a runbook:

```diff
-Before creating a pull request with changes to `codex-rs`, run `just fmt` ... to format the code and `just fix` ... to fix any linter issues in the code, ensure the test suite passes by running `cargo test --all-features` in the `codex-rs` directory.
-
-When making individual changes prefer running tests on individual files or projects first.
+Before finalizing a change to `codex-rs`, run `just fmt` ... Additionally, run the tests:
+1. Run the test for the specific project that was changed. For example, if changes were made in `codex-rs/tui`, run `cargo test -p codex-tui`.
+2. Once those pass, if any changes were made in common, core, or protocol, run the complete test suite with `cargo test --all-features`.
```

One long comma-spliced sentence plus a floating preference becomes an **ordered list with a worked example inline** (`if changes were made in codex-rs/tui, run cargo test -p codex-tui`). The commit title says it out loud: "more strongly suggests running targeted tests first." Ordering was the mechanism; nothing was added.

Later, `d53e68954` (2026-05-22, "Prefer `just test` over `cargo test` in docs") shows the endgame of that same procedure — a **negative step promoted to step 1**:

```diff
-1. Run the test for the specific project that was changed. ... run `cargo test -p codex-tui`.
+1. Do not run `cargo test` directly. Use `just test` so test execution follows the repo defaults.
+2. Run the test for the specific project that was changed. ... run `just test -p codex-tui`.
```

They did not trust "prefer `just test`" as guidance; they made "do not run `cargo test` directly" the *first* thing in the numbered list. Prohibition first, then procedure.

### Pattern 4: the strongest rules name the file, name the alternative, and explain why

The `codex-core` section (`609019c6e`, 2026-03-26) is the best-written passage in the file and worth studying as a template:

> "Over time, the `codex-core` crate (defined in `codex-rs/core/`) has become bloated because it is the largest crate, so it is often easier to add something new to `codex-core` rather than refactor out the library code you need...
>
> To that end: **resist adding code to codex-core**!
>
> Particularly when introducing a new concept/feature/API, before adding to `codex-core`, consider whether:
>
> - There is an existing crate other than `codex-core` that is an appropriate place for your new code to live.
> - It is time to introduce a new crate to the Cargo workspace for your new functionality. Refactor existing code as necessary to make this happen.
>
> Likewise, when reviewing code, do not hesitate to push back on PRs that would unnecessarily add code to `codex-core`."

Structure: **why the temptation exists** → **the bolded imperative** → **the two acceptable alternatives** → **the review-time restatement**. It anticipates the pull toward the wrong answer instead of just forbidding the wrong answer. This is exactly the shape bulletproof-react's folder vocabulary is missing (§5).

The same "name the file" discipline appears in the large-module rule, which does not say "avoid large files" — it names the offenders:

> "This rule applies especially to high-touch files that already attract unrelated changes, such as `codex-rs/tui/src/app.rs`, `codex-rs/tui/src/bottom_pane/chat_composer.rs`, ... and similarly central orchestration modules."

...and it supplies a **number**: "Target Rust modules under 500 LoC, excluding tests. If a file exceeds roughly 800 LoC, add new functionality in a new module."

### Pattern 5: operational quirks earn permanent lines

`a5824e37d` (2026-03-26, *"chore: ask agents md not to play with PIDs"*) adds:

> "When running Rust commands (e.g. `just fix` or `just test`) be patient with the command and never try to kill them using the PID. Rust lock can make the execution slow, this is expected."

This is not a coding convention. It is a behavioural correction for a specific observed misbehaviour, and it includes the *reason the agent misbehaved* ("Rust lock can make the execution slow, **this is expected**") — pre-empting the inference that led to the kill. Several lines in the file are of this type (`Do not create small helper methods that are referenced only once`, `Do not add negative tests for logic that was removed`, `Do not add tests for values that are statically defined`). They read as scar tissue, and that is fine.

### Section ordering, as it settled

Root-level bullets (repo-wide invariants and prohibitions) → build/test/format procedure → `## The codex-core crate` → `## Code Review Rules` → `## TUI style conventions` → `## TUI code conventions` → `## Tests` → `## App-server API Development Best Practices` → `## Python Development Best Practices` → `## Platform Support`.

The ordering principle is **frequency of applicability, descending**: things true of every change first, then things true within one subsystem, then language- and platform-specific notes last. The document is scanned top-down and the most-load-bearing rules are the ones an agent hits before its attention degrades.

### The nesting decision Codex actually made

Only **one** nested file exists, and it is 12 lines — `codex-rs/tui/src/bottom_pane/AGENTS.md`:

```markdown
# TUI bottom pane (state machines)

When changing the paste-burst or chat-composer state machines in this folder, keep the docs in sync:

- Update the relevant module docs (`chat_composer.rs` and/or `paste_burst.rs`) so they remain a
  readable, top-down explanation of the current behavior.
- Keep implementations/docstrings aligned unless a divergence is intentional and documented.

Practical check:

- After edits, sanity-check that docs mention only APIs/behavior that exist in code (especially the
  Enter/newline paths and `disable_paste_burst` semantics).
```

The test that earned this file its own directory: the rule is **triggered by touching a specific pair of files** and is meaningless anywhere else. Everything less local than that stayed in the 322-line root file. This is a strong argument against speculative nesting.

### Codex also uses skills, and AGENTS.md refers to them by name

`openai/codex` carries `.codex/skills/` — `code-review/`, `code-review-breaking-changes/`, `code-review-change-size/`, `code-review-context/`, `code-review-testing/`, `path-types/`, `remote-tests/`, `test-tui/`, `babysit-pr/`, `codex-pr-body/`, `update-v8-version/` — each a `SKILL.md` with YAML frontmatter:

```yaml
---
name: path-types
description: Choose Rust types for operating system paths across the Codex repository. Use when defining new path-bearing types or explicitly migrating existing ones.
---
```

AGENTS.md then **cross-references skills inline** — "See `$remote-tests` for details about integration testing these configurations" appears twice. So the working split at OpenAI is: AGENTS.md holds always-on invariants; skills hold deep, conditionally-loaded procedures; AGENTS.md names the skill at the point where it becomes relevant. (`description` carries the "Use when..." trigger, which is what makes conditional loading work.)

---

## 7. The agents.md examples: common skeleton and divergence

The [Examples section](https://agents.md/#examples) offers one synthetic sample plus four repository cards: `openai/codex` (Rust), `apache/airflow` (Python), `temporalio/sdk-java` (Java), `PlutoLang/Pluto` (C++).

### The site's own sample

```markdown
# Sample AGENTS.md file

## Dev environment tips
- Use `pnpm dlx turbo run where <project_name>` to jump to a package instead of scanning with `ls`.
- Run `pnpm install --filter <project_name>` to add the package to your workspace so Vite, ESLint,
  and TypeScript can see it.
- ...

## Testing instructions
- Find the CI plan in the .github/workflows folder.
- Run `pnpm turbo run test --filter <project_name>` to run every check defined for that package.
- ...
- Add or update tests for the code you change, even if nobody asked.

## PR instructions
- Title format: [<project_name>] <Title>
- Always run `pnpm lint` and `pnpm test` before committing.
```

Three sections: environment, testing, PR. Note the level: **every bullet is a runnable command**. Zero architectural content. This is the naive floor.

### The common skeleton

Across the real examples, the recurring spine is:

1. **Orientation** — one paragraph on what the repo is and how it is laid out.
2. **Environment/setup** — how to get a working toolchain.
3. **Commands** — the exact invocations, usually with the *wrong* alternative named (`Never run pytest ... directly on the host — always use breeze`; `Do not run cargo test directly. Use just test`).
4. **Repository structure** — a path-annotated tree or list.
5. **Coding standards** — bulleted rules.
6. **Testing standards** — separate from general standards.
7. **Domain-specific sections** — whatever the repo's real hazards are.

### Where the good ones diverge from the naive one

The synthetic sample and bulletproof-react's file are both *descriptions of the project*. Airflow's and Codex's are *corrections of predictable agent mistakes*. Three concrete things the good ones do:

**(a) They open with the thing agents get wrong most, not with an overview.** Airflow's very first section is not setup — it is **Naming**:

> "Write **Dag** (title case) in all prose. Keep the all-caps or lowercase spelling only when reproducing a literal code token — never rewrite these, even inside fenced code blocks: ... Don't spell out **Directed Acyclic Graph** except for historical context."

A house style rule about capitalisation, promoted above build commands, because it is the single most frequent thing an agent gets wrong in that repo. ([apache/airflow AGENTS.md](https://github.com/apache/airflow/blob/main/AGENTS.md))

**(b) They state the negative alongside the positive.** Airflow: "**Never run pytest, python, or airflow commands directly on the host** — always use `breeze`." Both halves in one sentence. Compare the naive sample's "Run `pnpm test`", which leaves every other invocation implicitly permitted.

**(c) They delegate to authoritative docs rather than duplicating them.** Airflow's nested UI file: "For setup, pnpm commands, project structure, styling, state management, testing guidance, and general best practices, see the contributing docs: [`contributing-docs/15_node_environment_setup.rst`]. **Additional commands and conventions not covered there are listed below.**" That sentence is the whole trick — it declares the file's scope as *the delta*, which is what keeps a nested file short and non-conflicting.

Airflow also machine-generates its command list inside markers, keeping it from going stale:

```
<!-- START generated-commands, please keep comment here to allow auto update -->
...
<!-- END generated-commands, please keep comment here to allow auto update -->
```

**(d) They give rules mechanical backup and say so.** Airflow: "**Never add new direct `raise AirflowException(...)` usages** — the community is actively reducing them, not adding more, and the `check-no-new-airflow-exceptions` prek hook enforces this." Naming the enforcing check both justifies the rule and tells the agent it will be caught.

### Divergence

- **Length:** Codex 322 lines, Airflow 522, bulletproof-react 289, the agents.md repo's own file ~45. There is no convergent length.
- **Nesting:** Airflow 14 files with a clear per-package split; Codex 2; bulletproof-react 1; Pluto 0.
- **Voice:** Airflow and Codex are second-person imperative throughout. bulletproof-react is largely nominal (`- **Composition over props** - Use children/slots...`), which reads like a style guide rather than an instruction.
- **Architecture content:** Airflow devotes whole sections to *Architecture Boundaries* and a *Security Model* (with a three-way taxonomy for how to classify a security finding). Codex has the `codex-core` and change-size sections. The naive examples have none.

---

## 8. mattpocock/skills as a distribution pattern

Source: [github.com/mattpocock/skills](https://github.com/mattpocock/skills). Created 2026-02-03, last pushed 2026-09-04, MIT, homepage [aihero.dev/skills](https://aihero.dev/skills). Described as "Skills for Real Engineers. Straight from my .agents directory."

### Structure

Skills live in bucket folders under `skills/`, and the buckets encode lifecycle. From the repo's own `AGENTS.md`:

> - `engineering/`: daily code work
> - `productivity/`: daily non-code workflow tools
> - `misc/`: kept around but rarely used, not promoted
> - `in-progress/`: beta: public on purpose, feedback wanted, not shipped in the plugin
> - `deprecated/`: no longer used

37 `SKILL.md` files; 25 are "promoted" (18 engineering + 7 productivity) and ship in the plugin. A skill directory holds `SKILL.md`, an `agents/openai.yaml` sidecar, optional on-demand reference files (`tdd/tests.md`, `tdd/mocking.md`, `codebase-design/DEEPENING.md`), and optional scripts.

Note in passing: **the repo's own `AGENTS.md` is a git symlink to its own `CLAUDE.md`** (`mode=120000`, size 9 bytes) — the same interop trick as Airflow, applied in the opposite direction.

### Distribution: two routes, deliberately exclusive

> "Two ways in, two philosophies. **The Claude Code plugin** installs the whole set as a managed, read-only bundle that updates when I ship, so you subscribe rather than fork. **skills.sh** copies editable skill files into your project, so you can hack on them and make them your own. Pick one: installing both leaves you with every skill twice."

1. **Claude Code plugin** — `claude plugins install mattpocock-skills`, listed in the official marketplace, so there is no marketplace to add first. `.claude-plugin/plugin.json` enumerates the 25 promoted skill directories one by one.
2. **`npx skills@latest add mattpocock/skills`** — vendoring. "It writes the skills into your repo as ordinary files you own and can edit. Nothing updates behind your back." Single-skill form takes `--skill=<name>`; `npx skills update` refreshes.
3. `scripts/link-skills.sh` symlinks into `~/.claude/skills` and `~/.agents/skills`, but its header is explicit that it is "a dev-only script … not a supported installer."

### Is it cross-tool? Barely, and only for metadata

It targets **Claude Code and Codex** via a hand-maintained per-skill sidecar. Every skill carries `agents/openai.yaml`, e.g. in full:

```yaml
interface:
  display_name: "Wait What"
  short_description: "Re-pitch that: simpler, with the context I'm missing"
policy:
  allow_implicit_invocation: false
```

> "It holds Codex UI metadata: `interface.display_name` and `interface.short_description` for the skill picker, and, for user-invoked skills, the `policy.allow_implicit_invocation: false` that pairs with `disable-model-invocation`. Keep the two in sync: a skill is user-invoked in both harnesses or neither."
> — `.agents/invocation.md`

That is the *entire* adapter surface: one duplicated two-field invocation flag, maintained by hand. **There is no build step, no codegen, no per-tool emitted output.** The tree contains zero paths matching `cursor`, `windsurf`, or `copilot`. `scripts/` holds only `link-skills.sh`, `list-skills.sh`, and a version-sync script.

The broader cross-tool story is delegated to the installer — `npx skills` is [vercel-labs/skills](https://github.com/vercel-labs/skills), which maps each supported agent to a directory (Claude Code → `.claude/skills/`; Codex, Cursor, Copilot and Gemini CLI all → `.agents/skills/`). So even that "adapter" is a copy-or-symlink into a per-agent path. **It does not transform content into `.cursor/rules` or `applyTo` frontmatter.**

### Is there a rules pattern worth copying? No — and the absence is the finding

**There is no build step producing `.cursor/rules`, no AGENTS.md generator, no rules artifact of any kind.** Where the repo touches always-on instruction files it does so *as subject matter*, not as output: `skills/productivity/writing-for-agents/` is a skill *about* "writing documents for agents: skills, AGENTS.md/CLAUDE.md, and any doc an agent reaches by a pointer."

**The repo is a bet that skills replace rules.** Everything is model- or user-invoked on demand; nothing is designed to sit permanently in the context window and nothing is path-scoped — no skill uses the `paths:` frontmatter field that Claude Code supports. Given §4, that is a coherent position: skills are the only primitive that ports across tools without rewriting frontmatter.

For *rules* specifically, the transferable ideas are thin but real:

- **Bucket by lifecycle, not by topic** (`in-progress/`, `deprecated/`), so retiring a rule is a move rather than a deletion argument.
- **Name the dependency mechanism explicitly rather than relying on inference.** From `.agents/invocation.md`: "Dependencies are expressed as an explicit instruction to **call the Skill tool** with the named skill (`Call the Skill tool with "grilling"`), not deep `../other-skill/FILE.md` cross-references, and not a bare `/skill`-style mention left for the model to interpret. Naming the tool is what gets it fired… Dropping the leading `/` also keeps this harness-neutral."
- **Push reference material into sibling files** rather than growing the entry file. Median `SKILL.md` is 3.3 KB (~40–120 lines); the longest is 11.9 KB, and long skills delegate.
- **Frontmatter minimalism.** Only `name`, `description`, and occasionally `disable-model-invocation: true` — close to the portable Agent Skills subset, which is presumably deliberate.

### The most useful artefact in the repo for our purposes

`.agents/adr/0002-ship-as-a-claude-code-plugin.md` is a first-hand account of a cross-tool packaging failure:

> - **Claude Code**: `.claude-plugin/plugin.json` accepts `skills` as an **array of explicit skill-directory paths**…
> - **Codex**: `.codex-plugin/plugin.json` accepts `skills` only as a **single path string** (arrays are rejected with `missing or invalid plugin.json`), and Codex discovers `SKILL.md` files recursively under it. There is no way to name two bucket folders, or to curate a subset, from one path.

Both workarounds failed — pointing at `./skills/` would ship the unpromoted buckets, and "A curated flat directory of **symlinks** into the buckets does not survive install: Codex copies the plugin tree into its cache and **drops symlinks**, so the skills arrive empty." The Codex plugin is deferred indefinitely.

**That last sentence is directly load-bearing for §9.** Symlinks are fine *in a git checkout* (Airflow relies on this), but they do not survive being copied by tooling. Do not build anything that depends on a symlink surviving a package install.

---

## 9. Recommendation: file layout for this monorepo

### The two constraints that determine the answer

1. **Codex reads root→cwd and never below.** Launch it at the repo root and `apps/store/AGENTS.md` is never read. So the standard cannot live only in per-app files.
2. **Claude Code does not read `AGENTS.md` at all.** It needs `CLAUDE.md`, either as a symlink or containing an `@AGENTS.md` import.

Everything else follows. Since `apps/store` and `apps/admin` share the *same* feature vocabulary (`api/`, `components/`, `hooks/`, `utils/`), the structural standard is genuinely repo-wide and belongs in one root file — which is also the only file Codex is guaranteed to read.

### Proposed layout

```
AGENTS.md                    ← the single source of truth (git mv from CLAUDE.md)
CLAUDE.md                    → symlink to AGENTS.md
apps/store/AGENTS.md         ← store-only delta, ABOVE the intent-skills markers
apps/store/CLAUDE.md         → symlink to apps/store/AGENTS.md
apps/admin/AGENTS.md         ← admin-only delta, ABOVE the intent-skills markers
apps/admin/CLAUDE.md         → symlink to apps/admin/AGENTS.md
apps/backend/AGENTS.md       ← backend-only delta (optional)
apps/backend/CLAUDE.md       → symlink to apps/backend/AGENTS.md
.claude/rules/feature-folders.md   ← optional, Claude-Code-only glob restatement
```

Concretely:

```bash
git mv CLAUDE.md AGENTS.md
ln -s AGENTS.md CLAUDE.md && git add CLAUDE.md
cd apps/store && ln -s AGENTS.md CLAUDE.md && git add CLAUDE.md
cd ../admin  && ln -s AGENTS.md CLAUDE.md && git add CLAUDE.md
```

This is exactly the migration the agents.md FAQ prescribes ("Rename existing files to AGENTS.md and create symbolic links for backward compatibility") and exactly what `apache/airflow` ships in production — `CLAUDE.md` and `registry/CLAUDE.md` are both mode-`120000` blobs containing the string `AGENTS.md`.

If you would rather keep room for Claude-only content, use the vendor-documented import instead of a symlink — a two-line `CLAUDE.md`:

```markdown
@AGENTS.md
```

Symlink is simpler and has an in-the-wild precedent; the import is what Anthropic's docs prescribe and leaves the file extensible. Either works. **Do not maintain two copies of the content.**

### What goes in the root file

The **closed folder vocabulary** must be here, not in the app files, because it is the rule that failed and Codex will only reliably see the root. Both apps share it, so stating it once is correct rather than a compromise. Phrase it with the four properties §5 and §6 showed to be load-bearing — *closed*, *prohibitive*, *with the alternative named*, *with the reason attached*:

> ### Feature folders
>
> `apps/*/src/features/<name>/` contains exactly these directories and no others: `api/`, `components/`, `hooks/`, `utils/`. **Do not create any other directory directly under a feature**, including one named after a sub-domain.
>
> A sub-domain of a feature is not a folder — it is a filename prefix inside the existing folders. Payment methods inside `account` are `api/payment-methods.ts`, `components/payment-method-list.tsx`, `utils/payment-methods.ts`. Never `account/payment-methods/`.
>
> The vocabulary is closed so that a file's kind is readable from its path alone. A per-sub-domain folder makes `account/` a second feature index and the kind unreadable.

Note the explicit worked example with the *wrong* answer named (`Never account/payment-methods/`). Codex's history (§6) shows the strongest rules all name the offending path — `Do not run cargo test directly`, `resist adding code to codex-core`, the list of high-touch TUI files.

Also worth carrying into the root file from the same evidence:

- **Keep the repo-wide invariants first**, before app-specific sections. Codex's settled ordering is frequency-of-applicability descending (§6).
- **Delete rules that need exception lists** rather than qualifying them, per `596fcd040`.
- **Name the enforcing check where one exists** ("`npm run verify` fails on this"), per Airflow's `check-no-new-airflow-exceptions` pattern. This repo has dependency-cruiser rules and Biome's `useNamingConvention` — say so next to the rules they enforce.

### What goes in the per-app files

Only the **delta**, and say so in the first line, following Airflow's nested UI file: "For X, Y and Z see the root `AGENTS.md`. Additional conventions specific to the store app are listed below." That framing is what keeps a nested file short and stops it contradicting the root.

**Important constraint specific to this repo:** `apps/store/AGENTS.md` and `apps/admin/AGENTS.md` are currently 100% machine-generated by `@tanstack/intent`, wrapped in `<!-- intent-skills:start -->` / `<!-- intent-skills:end -->`. Put hand-written content **above the start marker**, on the assumption that the generator only rewrites between its own markers — the same convention Airflow uses for its generated command list. **Verify this by running the generator once and checking the hand-written block survives** before relying on it. If it does not survive, fall back to putting the app deltas in the root file under `## apps/store` / `## apps/admin` headings, which costs nothing given both apps share most conventions anyway.

### The optional Claude-Code-only layer

Because Claude Code has `paths:` and Codex has nothing, you can add a belt-and-braces restatement that fires exactly when the failure would occur:

```markdown
---
paths:
  - "apps/*/src/features/**"
---

Feature folders are closed: `api/`, `components/`, `hooks/`, `utils/` only.
A sub-domain is a filename prefix, never a new directory.
```

Treat this as a **restatement, not the source of truth** — the root AGENTS.md rule is what Codex, Cursor and Copilot will act on. Accept the small duplication; per §4 and §8, nobody in the ecosystem has a working transpiler and building one is not worth it for two rules.

### What not to do

- **Do not nest deeply.** `openai/codex` has 2 AGENTS.md files across a large Rust workspace and `apache/airflow` has 14 across a far larger monorepo. The bar Codex used for its single nested file is instructive: the rule is triggered by touching one specific pair of files and is meaningless elsewhere. Everything less local stayed in the 322-line root.
- **Do not duplicate `docs/` into AGENTS.md.** That is bulletproof-react's mistake (§5) — a summary that mirrors twelve doc files, never links to them, and has been touched once in five months. Link into `docs/` and state the delta.
- **Do not add `.cursor/rules`, `.github/instructions`, or `GEMINI.md` speculatively.** Add a per-tool file when someone actually uses that tool on this repo. Note especially that Zed would *silently ignore* `AGENTS.md` if a `.rules` or `.cursorrules` file existed, since it is 7th in a first-match-wins list of 9.
- **Do not rely on symlinks surviving anything but a git checkout.** They are fine in-tree; they are dropped by tooling that copies trees (§8).

---

## 10. Unverified / thin evidence

Flagged explicitly, in rough order of how much weight the rest of the document puts on them.

**Claims I could not verify at the source:**

- **"The main OpenAI repo has 88 AGENTS.md files"** (agents.md). `openai/codex` — the repo the site links first — has **2**. The claim may refer to a non-public internal monorepo, in which case it is unverifiable in principle. Do not cite it.
- **AGENTS.md governance specifics.** LF/AAIF stewardship is solidly evidenced (press release, "Series of LF Projects, LLC" copyright, aaif.io project listing). But there is **no AGENTS.md TSC roster, charter, governance document, or contributing guide anywhere** — I checked the spec repo's full tree. The LF press release describes the *general* AAIF governance model; no AGENTS.md-specific instance of it is published. Treat "LF-governed" as true of the trademark and the neutral home, and as **unevidenced** for any claim about how the format will evolve.
- **`@tanstack/intent` marker semantics.** I assumed the generator only rewrites between `<!-- intent-skills:start -->` and `<!-- intent-skills:end -->`. **Not verified** — I did not run the tool or read its source. §9 depends on this; test it before relying on it.
- **Jules:** nested AGENTS.md, precedence, and glob support. No vendor statement exists either way across 17 doc pages, the CLI/API references, and 40 changelog entries. The only locational phrase in the entire doc set is "in the root of your repository."
- **Zed:** subdirectory instruction files and glob scoping. Grepping the vendor docs for `glob`, `subdirector`, `nested` returns zero hits. Zed's docs *do* describe worktree semantics — but for **Skills**, not instructions; do not transfer them.
- **Cursor:** whether a `.cursor/rules` directory in a project *subdirectory* is discovered. Subfolders *inside* `.cursor/rules/` are documented (organisational only); nested `.cursor/rules` directories are not mentioned in current docs. Community forum reports conflict.
- **opencode V1:** per-subdirectory AGENTS.md loading. V1 and V2-beta docs are both live and give **opposite** answers on merge semantics (first-match-wins vs combine-all).
- **Conflict resolution between overlapping files** for Amp, Windsurf/Devin Desktop, Devin CLI, and **Claude Code**. All four document *load order*; none states a winner. Claude Code's docs say outright that "if two rules contradict each other, Claude may pick one arbitrarily."
- **OpenAI Codex `experimental_instructions_file`** — appears in no current OpenAI doc.
- **VS Code + `GEMINI.md`** — not found on the customization page either way.

**Negative results established by absence of documentation, not by vendor denial:** Zed, Aider, Jules, and opencode V1 nesting/globs. Undocumented behaviour could exist in the code. The Aider negative is the strongest of these — a controlled GitHub code search returned 0 hits for `AGENTS.md` in `Aider-AI/aider` while the control term `CONVENTIONS.md` returned 4.

**Reported but implausible:** `gh api repos/mattpocock/skills` returns 252,525 stars / 21,313 forks for a seven-month-old repo. Reported as-is from the API; treat as suspect. It does not affect any conclusion here.

**Anecdotal / not primary, and not relied on:** the blog and aggregator coverage of the AAIF launch (WorkOS, PureAI, EdTech Innovation Hub, Windows Forum) surfaced in search. Every governance claim in §1 is cited to linuxfoundation.org, agents.md, aaif.io, or `gh api` output instead.

**Volatility warning.** Three vendor doc sites moved during this research (Codex → learn.chatgpt.com, Cursor → cursor.com/docs, Windsurf → docs.devin.ai, where the product is now "Devin Desktop"). Zed restructured its AI docs in v1.4.0 and `/docs/ai/rules` now 404s. Anything in §3 and §4 should be re-checked before being quoted more than a few months from **2026-09-05**.

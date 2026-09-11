# Agent Memory and Write-Time Determinism

Research findings on whether "agent memory" is a standardised thing, whether it transfers to a web-application repository, and what — if anything — reliably shapes an agent's *first* write rather than correcting it afterwards.

**Date:** 2026-09-05
**Context:** A companion to [`agent-structural-conventions.md`](agent-structural-conventions.md), which asked what would have stopped an agent creating `apps/store/src/features/account/payment-methods/`. That document's answer was a deterministic check at gate time. This one tests the opposite framing, in the user's words: *"determinism into the write"* rather than determinism at check time. The reasoning is economic — if compute is scarce and token cost is rising, a write→check→fix→re-check loop gets less affordable, so the agent should produce correct structure on the first attempt and the deterministic check should be a backstop rather than the primary mechanism. Code generators and scaffolding are out of scope: the prior pass found no evidence they improve agent structural compliance, and this project is too small to carry Nx or plop.

---

## Table of Contents

1. [Is there an agent-memory standard? No.](#1-is-there-an-agent-memory-standard-no)
2. [Karpathy's LLM Wiki, represented faithfully](#2-karpathys-llm-wiki-represented-faithfully)
3. [Does the memory literature transfer to a web-app repo?](#3-does-the-memory-literature-transfer-to-a-web-app-repo)
4. [What actually moves compliance at write time](#4-what-actually-moves-compliance-at-write-time)
5. [Codebase precedent versus stated rules](#5-codebase-precedent-versus-stated-rules)
6. [The planner-agent gap](#6-the-planner-agent-gap)
7. [Context economics](#7-context-economics)
8. [Recommendation](#8-recommendation)
9. [Where the evidence is thin](#9-where-the-evidence-is-thin)

---

## 1. Is there an agent-memory standard? No.

**There is no standard for agent memory.** Not an RFC, not a W3C or IETF work item, not an ECMA or ISO activity, not a ratified specification of any kind. What exists is a set of *product features* with overlapping vocabulary, one *file-location convention*, and a large volume of blog posts and preprints. Nothing in this space has the property that makes something a standard: two independent implementations agreeing on a wire format or a file contract because a specification told them to.

The closest thing to convergence is negative — every vendor has independently landed on "markdown files in the repo," and none of them agree on the filename, the frontmatter, or the loading semantics.

### 1.1 The blunt inventory, ranked by how standard-like each thing actually is

| Thing | What it actually is | Standard? |
|---|---|---|
| **AGENTS.md** | A filename convention with no schema. "Are there required fields? **No.** AGENTS.md is just standard Markdown… the agent simply parses the text you provide" (<https://agents.md/>). Stewarded by the Agentic AI Foundation under the Linux Foundation; claims 60k+ repos | **Closest thing.** A *location* convention, not a content or memory spec |
| **MCP** | A JSON-RPC 2.0 protocol with a versioned spec. Defines exactly three server primitives — **Tools, Resources, Prompts** — plus one client primitive, **Elicitation** (Sampling and Logging deprecated as of `2026-07-28`) (<https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture>) | **A real spec — with no memory primitive.** The `memory` knowledge-graph server in `modelcontextprotocol/servers` is a *reference server*, i.e. an ordinary Tools implementation, not a protocol concept |
| **Claude Code auto memory** | Vendor feature. `~/.claude/projects/<project>/memory/` holding "a `MEMORY.md` index and one topic file per memory"; first 200 lines or 25KB loaded per session; "**Auto memory is machine-local**… Files are not shared across machines or cloud environments" (<https://code.claude.com/docs/en/memory>) | No |
| **Cursor Memories** | Vendor feature; the dedicated docs page (`docs.cursor.com/en/context/memories`) now 308-redirects to `cursor.com/docs/rules` (verified 2026-09-05). Cursor's own framing is that *rules are the memory*: "Large language models don't retain memory between completions. **Rules provide persistent, reusable context at the prompt level.**" (<https://cursor.com/docs/rules>) | No |
| **Windsurf/Cascade Memories** | Vendor feature, auto-generated, stored at `~/.codeium/windsurf/memories/`, workspace-scoped. Their own docs deprecate it for this use case — see §3.2 (<https://docs.devin.ai/desktop/cascade/memories>) | No |
| **Letta / MemGPT** | A framework and a paper (arXiv:2310.08560). Core/recall/archival memory tiers, memory blocks | No — a product architecture |
| **LangGraph / LlamaIndex memory** | Framework abstractions (checkpointer for thread-scoped state, store for long-term). The semantic/episodic/procedural taxonomy they use is borrowed from CoALA, "Cognitive Architectures for Language Agents" (arXiv:2309.02427), a survey paper — not a specification | No |
| **Karpathy's LLM Wiki** | A gist. Explicitly "an idea file", "intentionally abstract", "describes the idea, not a specific implementation" (<https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>) | **No, and it does not claim to be** |

Treat any post that presents the CoALA taxonomy, MemGPT's tiers, or the LLM-wiki pattern as "the agent memory architecture" as a category error. They are, respectively, a survey's vocabulary, one product's design, and one person's Saturday-afternoon idea file.

### 1.2 What the absence of a standard actually costs you here

Very little, and this is worth saying plainly. A standard would matter if you needed two vendors' agents to read the same memory store. You do not — this repo is driven by Claude Code. The practical question is not "what is the standard" but "which surface in *this* harness is loaded at the moment the decision is made," which §4 and §6 answer.

---

## 2. Karpathy's LLM Wiki, represented faithfully

The gist is `llm-wiki.md` (<https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>). It should be weighted as what it says it is:

> This is an idea file, it is designed to be copy pasted to your own LLM Agent (e.g. OpenAI Codex, Claude Code, OpenCode / Pi, or etc.). Its goal is to communicate the high level idea, but your agent will build out the specifics in collaboration with you.

**The proposal.** It is a pattern for **personal knowledge bases**, positioned against RAG:

> Instead of just retrieving from raw documents at query time, the LLM **incrementally builds and maintains a persistent wiki** — a structured, interlinked collection of markdown files that sits between you and the raw sources. … This is the key difference: **the wiki is a persistent, compounding artifact.**

Three layers:

> **Raw sources** — your curated collection of source documents. … These are immutable — the LLM reads from them but never modifies them.
> **The wiki** — a directory of LLM-generated markdown files. … The LLM owns this layer entirely. … You read it; the LLM writes it.
> **The schema** — a document (e.g. CLAUDE.md for Claude Code or AGENTS.md for Codex) that tells the LLM how the wiki is structured, what the conventions are, and what workflows to follow…

Three operations — **Ingest**, **Query**, **Lint** — plus two navigation files: `index.md` ("content-oriented… a catalog of everything in the wiki") and `log.md` ("chronological… an append-only record"). Notably, the index is proposed *in place of* embeddings: it "works surprisingly well at moderate scale (~100 sources, ~hundreds of pages) and **avoids the need for embedding-based RAG infrastructure**."

The stated worked examples are personal goal-tracking, research reading, reading a book, business/team wikis fed by Slack and meeting transcripts, and "competitive analysis, due diligence, trip planning, course notes, hobby deep-dives."

**What it is not.** The word "code" appears only as a metaphor ("Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase"). There is no claim about coding agents, no claim about structural conventions, no claim about compliance, and no evaluation of any kind. The rationale offered is about *maintenance cost*, not about model behaviour:

> The tedious part of maintaining a knowledge base is not the reading or the thinking — it's the bookkeeping. … Humans abandon wikis because the maintenance burden grows faster than the value. LLMs don't get bored, don't forget to update a cross-reference…

Angie Jones's write-up (<https://aaif.io/blog/karpathys-llm-wiki-as-agent-memory>, 2026-06-08) is the piece that reframes it as *agent memory*, mapping the wiki onto semantic/entity/episodic/procedural/summary memory types. That mapping is her contribution, not Karpathy's, and she is careful about the gap: she notes she has "not seen them implement conversational or working memory within the wiki." Her evidence is her own practice — "the wiki pattern has been the most practical approach" — which is testimony, not measurement.

---

## 3. Does the memory literature transfer to a web-app repo?

Mostly no, and the sharpest way to see it is that **this repository already runs a Karpathy-shaped LLM wiki, and it did not prevent the incident.**

### 3.1 You already have one

Claude Code's auto memory for this project lives at `~/.claude/projects/-Users-willo-learn-medusa-proteus/memory/`. It contains a 116-line `MEMORY.md` index and **30 interlinked topic files** — `variant-option-values-are-ids.md`, `verify-is-the-only-check-aggregator.md`, `url-state-is-the-default.md`, and so on. That is precisely the gist's architecture: an index plus one page per concept, LLM-written and LLM-maintained. Anthropic's docs describe the same shape:

> The directory contains a `MEMORY.md` index and one topic file per memory… **`MEMORY.md` acts as an index of the memory directory.** Claude reads and writes files in this directory throughout your session, using `MEMORY.md` to keep track of what's stored where.
> — <https://code.claude.com/docs/en/memory>

**None of the 30 notes concerns the store's feature-folder vocabulary.** The mechanism was live, well-populated, and simply never captured the rule that got broken — because nobody ever corrected Claude about it in a session, which is the only way an entry gets written: auto memory holds "**Learnings and patterns**… Your preferences, corrections you give Claude" (ibid.). Memory records what was *corrected*; it does not discover what was never stated. The incident's root cause in the prior document — the rule was never written down as a closed set anywhere — is exactly the class of thing this mechanism structurally cannot fix.

Two further limits, both first-party:

- **It is not a repo artefact.** "**Auto memory is machine-local.** All worktrees and subdirectories within the same git repository share one auto memory directory. **Files are not shared across machines or cloud environments.**" It is invisible to teammates, to CI, and to a cloud agent session. A convention that must hold across agents and across people cannot live there.
- **It is capped.** "The first 200 lines of `MEMORY.md`, or the first 25KB, whichever comes first, are loaded at the start of every conversation. Content beyond that threshold is not loaded at session start." At 116 lines it is over half full.

### 3.2 The vendors themselves say memory is the wrong tool for conventions

This is the most useful transfer finding, and it comes from the two vendors that ship auto-memory:

> Auto-generated memories live only on your machine. … **For knowledge you want Cascade to reliably reuse, write it as a Rule or add it to `AGENTS.md` in your repo rather than relying on auto-generated Memories.**
> — <https://docs.devin.ai/desktop/cascade/memories>

> Large language models don't retain memory between completions. **Rules provide persistent, reusable context at the prompt level.**
> — <https://cursor.com/docs/rules>

Windsurf's docs draw the line explicitly: Memories are "what I learned", Rules are "what I require", and durable requirements belong in the repo. Cursor collapses the distinction entirely — its memories documentation page now redirects to its rules page.

### 3.3 Repo conventions are a different problem wearing the same word

The agent-memory literature — MemGPT's tiers, CoALA's taxonomy, LangGraph's store, the whole survey genre — is about a *retrieval and forgetting* problem: an agent has accumulated more experience than fits in a context window and must decide what to carry forward. Repo conventions have none of the defining properties of that problem:

| Agent memory assumes | Repo conventions actually are |
|---|---|
| Knowledge is **accumulated** from experience | Knowledge is **authored** once, deliberately, by a human |
| Volume exceeds the context window | The whole rule is one sentence |
| The hard part is **recall** — finding it again | The hard part is **presence at the moment of decision** and **outranking contradictory evidence** |
| Staleness is managed by decay/summarisation | Staleness is managed by `git` and code review |
| Per-agent, per-session, private | Must hold across agents, across people, in CI |

The one genuinely transferable idea from the wiki pattern is **Lint** — periodically asking the agent to health-check its own notes for contradictions and staleness. Applied to a repo, that is the observation that a convention document and the code it describes drift apart, which is the mechanism behind §5. It is a good idea. It is also not memory; it is a consistency check.

**Verdict: the memory literature does not transfer.** The word is doing double duty. What a repo needs is not a memory architecture but a *context-placement* decision — which surface, loaded when.

---

## 4. What actually moves compliance at write time

The honest headline first: **the evidence for write-time mechanisms is substantially thinner than for check-time mechanisms, and the two strongest recent studies both found that better context files do not measurably improve outcomes.** What survives scrutiny is narrower than the "context engineering" discourse suggests.

### 4.1 The table

| Mechanism | What it is | Evidence quality | Applicable here? |
|---|---|---|---|
| **Fixing the codebase precedent** | Removing the in-repo examples that contradict the rule, so retrieved context and stated rule agree | **Mechanism strong, application inferred.** Many-shot in-context learning provably overrides stated/trained behaviour with power-law scaling (Anthropic, 2024-04-02); repo-retrieved code demonstrably steers generation (RepoCoder, EMNLP 2023); GitClear measures duplication rising 81% and legacy-code updating falling 74% across 623M changes. No study manipulates repo precedent as an IV | **Yes — highest leverage.** §5 |
| **Unconditional placement of the rule** (project-root CLAUDE.md, or an unscoped `.claude/rules/` file) | The rule is in context on turn one regardless of what the agent reads | **Measured, mixed.** Harness-IF (arXiv:2608.11727): "system prompts, project files, and user instructions ahead of tool and skill descriptions" in a conflict pilot. Vendor-documented that scoped rules load *only* on a matching read | **Yes** — and it is the fix for §6 |
| **Pointing at a canonical file to imitate** | "`HotDogWidget.php` is a good example. follow the pattern" | **Vendor-prescribed, unmeasured for conventions.** It is Anthropic's own worked example (<https://code.claude.com/docs/en/best-practices>) and appears in Cursor's own rule sample. Nearest measurement is RepoCoder's >10% completion gain from retrieved in-repo code — correctness, not conventions. "Show and Tell" (arXiv:2511.13972, N=160) found examples *weaker* than instructions for style: "Examples showed modest initial effects with no expansion discipline" | **Yes**, cheap, but as a supplement to a stated rule, not a substitute |
| **Just-in-time / path-scoped rules** | Rule loads when a matching file is read | **Vendor-framed as a context-budget mechanism, never an enforcement one.** No measurement of scoped-vs-unscoped compliance exists. Has a documented failure mode (§6) | **No** — this is the trap, not the fix |
| **Retrieval over a rules corpus** | The agent searches for the applicable rule | **Measured, negative.** RepoComplianceBench (arXiv:2607.26819, 106 issues / 49 repos): "today's agents **almost never proactively retrieve** the contribution rules" | **No.** Do not build a rules index and hope it gets queried |
| **Plan-then-write** | Force an explicit plan before code | **Measured for correctness, not for structure.** RigorBench (arXiv:2606.22678, 30 tasks): structured process discipline "improves process quality scores by an average of 41% … and raises downstream outcome correctness by 17%." Self-planning (arXiv:2303.06689, ASE 2024) is peer-reviewed for correctness. Nothing scores structural compliance | **Partially** — the repo already plans (`to-spec`, `wayfinder`, `to-tickets`); the gap is *what the plan carries*, §6 |
| **Richer context files generally** | Longer/better CLAUDE.md, AGENTS.md | **Measured, null.** arXiv:2607.27250 (Claude Code + Codex, 17 tasks, 288 runs): "Context strategy does not measurably move correctness on either agent (bounded to ≤10-15pp via equivalence testing)" and "the real \[context file] never converts a near-miss to a pass." ETH SRI (arXiv:2602.11988, 438 tasks): no success-rate gain, >20% more inference cost | **No** — do not add prose and expect a result |
| **Rule-file layout tuning** | File size, ordering, splitting, contradiction removal | **Measured, null.** arXiv:2605.10039, 1,650 Claude Code sessions: "**None** of the four structural variables or three two-way interactions produces a detectable contrast after multiple-testing correction" | **No** |
| **Phrasing rules as prohibitions** | "Do not create X" over "organise files well" | **Measured on a proxy outcome.** "Guardrails Beat Guidance" (arXiv:2604.11088): 25,532 rules, >5,000 Claude Code runs; every individually beneficial rule was a negative constraint, every harmful one a positive directive, worked example "follow code style" | **Yes**, free to apply |
| **Compiling the rule into an executable check** | AST/lint/dependency-cruiser rule in the gate | **The strongest single number in the space.** ContextCov (arXiv:2603.00822): 67.0% prompt-only → **88.3%** constraint compliance, 3.4x lower feedback cost. Single-author preprint | **Yes — already the repo's practice** (`job_conventions`) |
| **`PreToolUse` hook** | Blocks the write before it lands | **Vendor-documented deterministic.** "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens" | **Yes** — the only true "determinism in the write" |
| **Generators / scaffolding** | Out of scope by request | **No evidence exists** (prior pass, §4) | No |

### 4.2 The two mechanisms with real support

Only two things on that table have both a plausible mechanism and evidence that is not null:

**(a) Making the codebase agree with the rule.** This is the subject of §5. It is the only mechanism whose evidence base is about *why models produce what they produce* rather than about whether a document helped.

**(b) Putting the rule where it is unconditionally present.** Not "more rules", not "better-organised rules" — both of those are measured nulls. Just: the rule that must hold is in context before the first decision, every time, with no trigger condition. The evidence here is mostly the *absence* of the alternative: scoped loading has a documented gap (§6), retrieval demonstrably does not happen (RepoComplianceBench), and skill/tool descriptions lose conflict precedence to project files (Harness-IF).

Everything else in the write-time toolkit is either unmeasured, measured null, or a check-time mechanism wearing write-time clothes.

### 4.3 What the vendors add that the papers do not

Anthropic's guidance is unusually concrete on the exemplar mechanism, and it is worth quoting because it is the operational form of §5:

> **Reference existing patterns.** Point Claude to patterns in your codebase.
> *Before:* "add a calendar widget"
> *After:* "look at how existing widgets are implemented on the home page to understand the patterns. **`HotDogWidget.php` is a good example. follow the pattern** to implement a new calendar widget…"
> — <https://code.claude.com/docs/en/best-practices>

And on where a rule should live:

> CLAUDE.md is loaded every session, so only include things that apply broadly. For domain knowledge or workflows that are only relevant sometimes, use skills instead. Claude loads them on demand without bloating every conversation.
> … **If Claude already does something correctly without the instruction, delete it or convert it to a hook.**
> — ibid.

Skills are the harness's JIT mechanism, and the loading contract is documented precisely:

> Unlike CLAUDE.md content, a skill's body loads only when it's used, so long reference material costs almost nothing until you need it. … Claude Code loads a listing of skill names and descriptions into context so Claude knows what's available… **The budget scales at 1% of the model's context window.** … If you have many skills, Claude Code shortens descriptions to fit the listing's character budget, **which can strip the keywords Claude needs to match your request**.
> — <https://code.claude.com/docs/en/skills>

That last clause matters for this repo specifically: it currently ships **26 skills**, so the description listing is competing for a fixed budget. A structural rule parked in a 27th skill description is not reliably present.

---

## 5. Codebase precedent versus stated rules

This is the repo's actual failure mode, so it gets its own treatment. The prior document called the precedent reading "a plausible inference from this incident, not an established finding" and left the literature contested. That was right about the *repository* evidence and, I now think, too cautious about the *mechanism*.

### 5.1 The mechanism is not contested

**In-context demonstrations override stated and trained behaviour, and the effect scales with the number of demonstrations.** The cleanest measurement of this is Anthropic's own many-shot jailbreaking work (<https://www.anthropic.com/research/many-shot-jailbreaking>, 2024-04-02): including a large number of faux dialogues — "in our research, we tested up to 256" — flips a model's behaviour, and "as the number of shots increases beyond a certain number, so does the percentage of harmful responses," following the same power law as ordinary in-context learning. Their own explanation:

> The effectiveness of many-shot jailbreaking relates to the process of "in-context learning"… if in-context learning is what underlies many-shot jailbreaking, it would be a good explanation for this empirical result.

State the transfer honestly: **that is a result about safety refusals, not about folder names.** But the mechanism it identifies — enough consistent in-context examples beat a stated instruction, with the strength of the effect governed by *how many* — is domain-general in-context learning, not a safety-specific artefact. Seventeen files under `checkout/payment/` are seventeen demonstrations. One line of prose is one instruction.

The general instruction-versus-pattern result points the same way: "Do as I Say, Not as I Do" (Camassa & Shiller, arXiv:2605.20382, 2026-05-19; Sci-FM workshop poster at COLM 2026) evaluated 13 models × 16 instructions × up to 50 turns and found a transition from instruction-following to pattern-following that is "universal but highly model-dependent," with instruction-following spanning **1% to 99%** across models and largely uncorrelated with capability benchmarks. Models also "systematically underestimate their own resistance to induction pressure" (83.5% self-prediction accuracy). Caveat unchanged from the prior pass: hardcoded assistant turns, not repository files.

### 5.2 In-repo code demonstrably steers generation

That retrieved repository code shapes output is the founding result of repo-level code generation. RepoCoder (Zhang et al., EMNLP 2023, arXiv:2303.12570, <https://aclanthology.org/2023.emnlp-main.151/>) improves an in-file completion baseline "by over 10% in all settings" by retrieving similar code from elsewhere in the repository — with API-invocation completion as an explicit evaluation category. The whole retrieval-augmented code generation literature rests on this: what the model sees from the repo is what it writes.

### 5.3 And the population-level effect is now measured

Two independent 2026 datasets show agents extending existing patterns rather than replacing them:

- **GitClear, "The Maintainability Gap"** (January 2026, 623 million analysed changes 2023–2026, <https://www.gitclear.com/the_ai_code_quality_maintainability_gap>): "Block duplication climbed from 40.3 in 2023 to 73.0 year-to-date in 2026 — an 81% increase"; moved (i.e. refactored) code "dropped to 3.8%" while copy/paste "climbed… to 15.7%"; and most tellingly for this section, **"Long-term update percent… has fallen 74%, from 1.7% in 2023 to 0.46% year-to-date in 2026."** Code older than twelve months is being *extended* rather than *revised*. This is a vendor-published analysis of their own telemetry, with the usual caveats: no control for the AI/non-AI split, and GitClear sells maintainability tooling.
- **"An Exploratory Study on LLM-Generated Code and Comments in Code Repositories"** (Ji et al., arXiv:2607.01867, 2026-07-02): using detector-based proxies over company- and community-maintained repos 2021–2025, "code detected as likely to be generated by LLMs shows **substantial intra-repository code clones**." Proxy-detector methodology, no effect size stated in the abstract.

Neither establishes causation for *conventions*. Together they establish that the population-level signature of agentic coding is "produce more of what is already here."

### 5.4 The one result that cuts the other way

"Show and Tell" (Bohr, arXiv:2511.13972, 2025-11-17, N = 160 paired programs, one Python task): "Instructions showed large initial effects and moderate expansion discipline. **Examples showed modest initial effects with no expansion discipline.**" Combined prompts were best. So for *deliberately supplied* few-shot exemplars in a system prompt, instructions won.

That is not the same experiment as "17 files in the repo versus one line in a rules file." A handful of exemplars deliberately placed in a prompt is a small-N intervention; the surrounding codebase is a many-shot regime the agent walks into. But it is the only direct instructions-versus-examples measurement for code style, it went the other way, and it should keep the confidence here below certainty.

### 5.5 Does fixing the precedent measurably help?

**No study answers this.** Nobody has run: repo with contradictory precedent + rule, versus repo with precedent cleaned + same rule, scored by a conformance checker. That experiment is missing from the literature and would be cheap to run in this repo.

What *has* changed since the prior pass is that the precedent here has largely been cleaned already. Re-checking `apps/store/src/features/` today:

```
account/     api components utils
address/     api components hooks utils
auth/        api components hooks
cart/        api components hooks
checkout/    api components hooks payment utils
orders/      api components utils
products/    api components
```

Zero loose files at any feature root — the four the prior document listed (`address/form-values.ts`, `checkout/checkout-address.ts`, `orders/fulfillment-labels.ts`, `orders/order-progress.ts`) are gone. **One deviation remains: `checkout/payment/`, 17 files.** That is now the entire contradictory precedent in the tree, and it is exactly the shape the incident reproduced.

---

## 6. The planner-agent gap

The concern is real, it is vendor-documented in pieces, and nobody has named it or measured it end-to-end.

### 6.1 Path-scoped rules load only on a matching read — four vendors, unambiguous

> Rules without a `paths` field are loaded unconditionally and apply to all files. **Path-scoped rules trigger when Claude reads files matching the pattern, not on every tool use.**
> — <https://code.claude.com/docs/en/memory>

> Project-root CLAUDE.md survives compaction… Nested CLAUDE.md files in subdirectories and **rules with `paths:` frontmatter reload as Claude reads files they apply to.**
> — ibid. If a rule must persist across compaction, the docs' own instruction is to drop the `paths:` frontmatter.

Cursor's table says the same thing in one line — a rule with `globs` and no `alwaysApply` is "**Auto-attached when a matching file is in context**", whereas one with a `description` and no globs is pulled in when "Agent reads the description and… decides it's relevant" (<https://cursor.com/docs/rules>). GitHub Copilot's `applyTo` fires "if the path you specify matches a file that Copilot is working on" (<https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions>). Windsurf's glob mode: "Rule is applied when Cascade reads or edits a file matching the `globs` pattern" (<https://docs.devin.ai/desktop/cascade/memories>). Kiro's `inclusion: fileMatch`: "Files are automatically included only when working with files that match the specified pattern" (<https://kiro.dev/docs/steering/>).

**A planning agent that reads `docs/`, greps for a symbol, and writes a plan never triggers any of them.**

### 6.2 Claude Code's built-in planner skips project instructions entirely

This is the strongest finding in this section, and it is worse than the glob problem:

> **Explore and Plan skip your CLAUDE.md files** and the parent session's git status to keep research fast and inexpensive. Every other built-in and custom subagent loads both.
> — <https://code.claude.com/docs/en/sub-agents> (verified verbatim against the live page, 2026-09-05)

The same page's "what loads at startup" section spells out the scope and closes the door on configuring it:

> **CLAUDE.md files**: every level of the CLAUDE.md hierarchy the main conversation loads, including `~/.claude/CLAUDE.md`, **project rules**, `CLAUDE.local.md`, and managed policy files. **The built-in Explore and Plan agents skip this.**
> **Explore and Plan are the only subagents that omit CLAUDE.md and git status. There is no frontmatter field or per-agent setting to change which agents skip them.**

So the gap is not merely that a *scoped* rule fails to load for a planner — it is that Claude Code's built-in research and planning subagents load **no project rules at all**, by design, for cost reasons. Anthropic states the mitigation directly, and it is manual:

> The main conversation reads Explore and Plan results with full CLAUDE.md context, so most rules don't need to reach the subagent itself. **If a rule must, such as "ignore the `vendor/` directory," restate it in the prompt you give Claude when delegating.**

Plan *mode* (as opposed to the Plan *subagent*) is documented purely as a tool-permission posture — "Claude reads files, runs shell commands to explore, and writes a plan, but does not edit your source" (<https://code.claude.com/docs/en/permission-modes>) — with no statement either way about rule loading. One adjacent hazard from the same page: the optional `showClearContextOnPlanAccept` setting adds an approve-and-**clear-the-planning-context** option, which discards any scoped rule that did load during planning.

Cursor's Plan Mode page (<https://cursor.com/docs/agent/planning>) never mentions rules. Kiro's Plan page (<https://kiro.dev/docs/specs/plan/>) never mentions steering; it says only that the planner "adapts the plan to your existing conventions" — i.e. it infers conventions from the codebase, which is §5's failure mode with the volume turned up. Kiro also carves out an exception that mirrors Anthropic's: "**When using custom agents, steering files are not automatically included.** You must explicitly add them to the agent's `resources` configuration."

### 6.3 How spec-driven tools handle the handoff

**GitHub spec-kit** solves it by refusing to scope the constraints at all. `/speckit.constitution` writes `.specify/memory/constitution.md`, and the plan command loads it unconditionally — "**Read FEATURE_SPEC and `/memory/constitution.md`**" — then the plan template carries a literal gate:

> ## Constitution Check
> *GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

with a "Complexity Tracking" table to be filled "ONLY if Constitution Check has violations that must be justified" (<https://github.com/github/spec-kit>, `templates/plan-template.md`). Propagation is by re-reading, not by copying: "**Dependent templates and commands read the constitution at runtime and are not modified here.**" At implementation time the constitution is re-read, but note the asymmetry in `templates/commands/implement.md`: `plan.md` and `tasks.md` are **REQUIRED**, while "Read `/memory/constitution.md` for governance constraints" is **IF EXISTS**. And, as the prior document established, the gate is a prompt instruction evaluated by the same model that writes the code — there is no checker.

**BMAD-METHOD** takes the other route: it *materialises* the constraints into the handoff artefact. Its `compile-epic-context` step produces an `epic-<N>-context.md` with mandatory "Requirements & Constraints" and "Technical Decisions" sections, and instructs:

> **Describe by purpose, not by source.** Write "API responses must include pagination metadata" not "Per PRD section 3.2.1, pagination is required." Planning doc internals will change; the constraint won't.
> **This file loads into build's context alongside other material.**
> — <https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmad-build/compile-epic-context.md>

**Anthropic's documented answer is the same move, stated for humans:** when handing a spec to a fresh session, "The most useful specs are self-contained: **they name the files and interfaces involved, state what is out of scope**, and end with an end-to-end verification step that proves the feature works" (<https://code.claude.com/docs/en/best-practices>).

That is the pattern, such as it is: **make the artefact that crosses the boundary carry the constraint, rather than relying on ambient conditional loading to re-supply it on the other side.**

### 6.4 Is there a named pattern? No.

"Constitution" (spec-kit), "steering" (Kiro), "Constitution Check gate" (spec-kit) are product feature names, not community patterns. "Plan-time guardrails" and "design review gates for agents" appear only in marketing and tutorial content with no canonical definition. The single academic coinage is "Constitutional Spec-Driven Development" (arXiv:2602.02584, 2026-01-31), whose headline — "constitutional constraints reduce security defects by 73%" — is a **single self-reported case study on one banking application with no baseline replication**, and should not be cited as an effect size.

### 6.5 Research: one adjacent result, nothing direct

**No paper studies "rule present at plan time" versus "rule absent at plan time" as an independent variable.** The nearest thing is "Understanding and Bridging the Planner-Coder Gap" (arXiv:2510.10460, 2025-10-12, rev. 2026-01-30, preprint, not peer reviewed):

> Our findings reveal substantial robustness flaws: semantically equivalent inputs cause drastic performance drops, with MASs failing to solve 7.9%–83.3% of problems they initially resolved successfully. … we discover a fundamental cause underlying these robustness issues: **the planner-coder gap, which accounts for 75.3% of failures. This gap arises from information loss in the multi-stage transformation process where planning agents decompose requirements into underspecified plans, and coding agents subsequently misinterpret intricate logic during code generation.**

Right shape, wrong cause: it studies mutation-induced information loss on benchmark tasks, not rule-loading mechanics or repo conventions. SWE-RPG (arXiv:2608.09072, 2026-08-10) separates requirement clarification, planning, and code generation with ground truth for each, and finds "implicit requirement recovery as the main bottleneck, accounting for 24.5%–46.0% of agent runs" against an average resolved rate of 31.5% — again about requirements, not conventions.

The only place the exact problem is articulated is a **closed, unanswered Claude Code feature request** (<https://github.com/anthropics/claude-code/issues/30797>, opened 2026-03-04, closed by a staleness bot 2026-04-02):

> A `working-principles.md` rule file containing architectural guidelines … **is essential during planning and QA verification, where decisions are made against these principles.** … **Today there is no way to express: "Load this rule during planning but not during coding."**

One user's request is not evidence of prevalence. It is evidence that the problem has been articulated by someone other than us, and that no fix has shipped.

### 6.6 What this means for the prior document's recommendation

The prior pass recommended (§8, step 3) putting the closed folder vocabulary in `.claude/rules/store-feature-structure.md` with `paths: ["apps/store/src/features/**"]`. **That is precisely the shape with the documented gap.** It would not be in context for a planner, would not survive compaction unless a matching file were re-read, and would be skipped outright by the Explore and Plan subagents. If that rule is written, it should be written **without** `paths:` frontmatter.

---

## 7. Context economics

_PENDING_

---

## 8. Recommendation

_PENDING_

---

## 9. Where the evidence is thin

_PENDING_

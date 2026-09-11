# 07 — Every command in the prose

**What to build:** the documentation stops telling people to run a command that no longer works.

**Blocked by:** 06. There is no point rewriting a command before the thing it invokes has changed,
and doing it first leaves a window where the docs are wrong in the other direction.

**Status:** planned.

**Spec:** `.scratch/pnpm-migration/spec.md`, P4 — §5.

---

## Why this is its own ticket

Because it is the part most likely to be skipped, and the part with the longest tail. `AGENTS.md` is
loaded in full at the start of every session by every agent; its Commands section is 19% of the file
and is the first thing an agent copies. A stale `npm run --workspace=backend dev` there is not a
typo, it is an instruction that will be followed.

Keeping it out of 05 also keeps that ticket's diff reviewable: 05 is ~100 executable call sites where
a wrong edit breaks a build, and this is ~143 prose mentions where a wrong edit is merely wrong.

---

## The surface

`grep -rc "npm run\|npm exec\|npm ci\|npm install\|npx "`, measured 2026-09-11:

| File | Mentions |
| --- | ---: |
| `AGENTS.md` | 32 |
| `README.md` | 21 |
| `docs/specs/e2e-testing-infrastructure.md` | 11 |
| `docs/research/structural-rules-authoring.md` | 8 |
| `.claude/skills/e2e-test/REFERENCE.md` | 8 |
| `standards/README.md` | 6 |
| `docs/middleware-and-openapi.md` | 6 |
| `.claude/skills/e2e-test/SKILL.md` | 6 |
| `standards/rules/backend/modules/__docs__/adding-a-module.md` | 5 |
| `standards/rules/backend/api/__docs__/routes.md` | 4 |
| `docs/middleware-overhaul-plan.md` | 4 |
| `.claude/skills/backend-test/SKILL.md` | 4 |
| `docs/backend-test-infrastructure.md` | 3 |
| …and ~14 files with 1–3 each | |

## What is deliberately left alone

**`docs/adr/` — 6 mentions across four ADRs.** An ADR records what was decided and when. Rewriting
its commands to match a decision taken later falsifies the record; a reader in a year should see the
commands as they were when durable execution was split across two runtimes. If the change of package
manager is worth recording, it is worth **a new ADR**, not an edit to old ones.

**`docs/research/undeclared-dependencies.md` — 12 mentions.** Same reasoning, and it is also the
subject of its own amendment below.

---

## The work

1. Rewrite the mentions outside `docs/adr/` and `docs/research/`. Translations are in ticket 06 §7.
2. **`AGENTS.md` gets more than a find-and-replace.** Its Commands block documents the two-container
   bootstrap, the five dev processes and the Worker-collision warning. Read it as prose and check the
   surrounding sentences still parse — `npm run setup` is described as "install + pull dotenvx keys +
   generate `.env.workerd`", and the root `setup` script itself changes in 05.
3. **`README.md`** is the front door and carries the install instructions. It must say which pnpm
   version, and how to get it (corepack, or an explicit install). A contributor arriving with npm
   installed and no pnpm is the case this file exists for.
4. **Amend `docs/research/undeclared-dependencies.md`** rather than rewriting or deleting it. Two
   additions, both recorded in spec §6 and F5:
   - Its **§11 recommendation is superseded** — the `no-undeclared-dependency` dependency-cruiser
     rule should not be built, because the strict layout makes the class impossible rather than
     detected, and fails it through `typecheck`, a gate that already exists.
   - Its **§8 comparison table is missing a row and a column**. The `@types/*` class — a package
     TypeScript loads implicitly from `node_modules/@types` and that no import specifier ever names —
     cannot be seen by dependency-cruiser, Biome or knip. 171 of the trial's type errors were this,
     all in `packages/ui`. The strict layout is the only mechanism in that table that finds it.
   - Its **§7** said pnpm closing the two workspace-package rows "was not verified here". It is now;
     link to this spec's §3.
5. **Consider a new ADR.** `docs/architecture-decisions.md` indexes 0001–0024. "The package manager
   is pnpm, because a workspace must not be able to import what it did not declare" is a decision
   with a rationale and alternatives that were rejected — which is what `AGENTS.md` says an ADR is
   for. The measured install timings belong in it, including the one case where npm is faster, so
   nobody re-opens this on a performance argument that was never the reason.

---

## Acceptance criteria

- [ ] `grep -rn "npm run --workspace" . --exclude-dir=node_modules --exclude-dir=.git` returns hits
      only in `docs/adr/` and `docs/research/`
- [ ] Every command block in `AGENTS.md` and `README.md` has been **run**, not just read. These are
      the two files whose commands get copied verbatim
- [ ] `README.md` states the required pnpm version and how to install it
- [ ] `docs/research/undeclared-dependencies.md` carries the three amendments, and its §11 says
      plainly that the rule was not built and why
- [ ] The `.claude/skills/` files are updated — an agent reading `e2e-test/REFERENCE.md` gets a
      command that works
- [ ] A decision has been taken on the ADR, either way, and recorded in the PR

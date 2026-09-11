# 04 — `deps-analyzer/` becomes `structure/`

**What to build:** The per-app dependency-cruiser directory is renamed to `structure/`, so the local
end of the structural rules carries the same word as the shared end. No rule changes and no
behaviour change — each app must report exactly what it reports today.

**Blocked by:** 02. The word `structure` has to already mean something before a directory is named
for it. 01 and 03 need not be finished, but in practice all three land first.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `apps/{backend,store,admin}/deps-analyzer/` → `apps/{backend,store,admin}/structure/` via
      `git mv`, so history follows. Two tracked binaries move with their directories —
      `apps/backend/.../dependency-graph.svg` and `apps/store/.../unidirectional-codebase.png`
- [ ] The three `check:deps` scripts point at the new path — `apps/{backend,store,admin}/package.json`.
      `apps/backend/package.json`'s `check:deps:graph` carries the path **twice** on one line: the
      `--config` argument and the `-o` output target
- [ ] `biome.json`'s ignore entry for `dependency-graph.svg` follows the file
- [ ] `README.md`'s two image links resolve — lines 169 and 175. Broken images render as alt text
      and nothing fails, so open the file and look rather than trusting grep
- [ ] Every prose reference is updated: `AGENTS.md` (2), `standards/README.md` (3, including the
      structure row of the four-kinds table added by ticket 01), `sgconfig.yml` (1),
      `apps/backend/src/api/README.md` (1), `apps/backend/src/modules/README.md` (3),
      `docs/adding-a-module.md` (1), and the source comment at
      `apps/store/src/features/checkout/utils/payment/adapters/stripe/adapter.tsx:14`
- [ ] **The four ADRs are updated — paths only.** Five lines: `0010` line 76, `0020` lines 8 and
      130, `0022` line 101, `0023` line 207. Change the path and nothing else — not the surrounding
      reasoning, not the `**Status:**` line, not the dates. Each ADR records a decision that has not
      changed; only where its enforcement lives has
- [ ] `docs/research/agent-structural-conventions.md` and
      `docs/research/structural-rules-authoring.md` are **not** touched — 15 references between
      them. Same rule as ticket 02 applied to the same two files: they are records of what was
      surveyed and prototyped, and editing them would make them describe a repository that did not
      exist at the time
- [ ] `.scratch/` is not touched
- [ ] `pnpm run verify` green, `job_structure` included — and proved non-vacuous per app: add a
      forbidden import in each of backend, store and admin, confirm `check:deps` fails there and
      names the rule, then remove all three. Say in the PR description that you ran it
- [ ] `git grep deps-analyzer` returns only the two research documents

## Notes

The rename is a pure path change. dependency-cruiser resolves `--config` relative to the process
cwd, and npm sets cwd to the workspace root, so the argument moves with the directory and nothing
else about resolution changes. The bare `require('@proteus/frontend-structure')` at the top of the
store's and admin's configs resolves by walking up from the requiring file — the new directory sits
at the same depth as the old one, so that is unaffected too.

This ticket was deferred in the first draft of `spec.md` and then promoted. The reason for the
original hesitation was the four ADRs, and the reason it is safe is the decision recorded there:
path-only edits. Worth keeping the ADR changes in their own commit, so the mechanical edit is
reviewable apart from the renames it follows.

The directory name was the last thing in the repo still calling this half "analysis". Nothing in it
analyses anything — it holds a config declaring which import is allowed, plus, in two of the three
apps, a committed diagram generated from it.

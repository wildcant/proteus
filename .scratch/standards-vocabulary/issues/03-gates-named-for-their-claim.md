# 03 — Gates named for what they check

**What to build:** `scripts/verify.sh` stops describing one of its jobs with a list. The gate that
runs the repo's standards is called `standards`, the one that runs the import rules is called
`structure`, and the two checks that are not standards at all move into a gate of their own.

**Blocked by:** 01 for the definitions. Prefer 02 landed first so `structure` already means
something, but the two do not touch the same files.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `job_conventions` → `job_standards`, and `job_deps` → `job_structure`. The `JOBS` string and
      the `label_of` cases are updated in the same edit — the file's own comment warns that a name
      without a function behind it fails the run with an empty label
- [ ] A new `job_generated` holds `check:workflow-registry` and `check:subscriber-registry`, moved
      out of the standards gate with their existing comments. `JOBS` gains `generated`
- [ ] Each of the three labels is a noun phrase, not an enumeration. The current
      `"Env usage, error, schema & standards conventions"` is the thing being removed; if the
      replacement still needs an `&` to be accurate, the job is still holding two things
- [ ] The standards gate keeps all seven remaining checks — env usage, errors, datetime, schema,
      workflow purity, `check:standards`, `check:standards:test` — and keeps running every one even
      after a failure, so a single run still reports every violation at once
- [ ] `AGENTS.md`'s `pnpm run verify` block says **ten** suites, not nine, and names the new gate.
      The current text — "convention checks, dependency rules" — is updated to match the gate names
- [ ] `AGENTS.md`'s code-generation comment is corrected. It currently reads "all three are
      committed, and `verify` fails when they have drifted" above **four** commands, and only
      **two** are gated. It must say which two, and must not imply the Orval clients or
      `routeTree.gen.ts` are checked
- [ ] `scripts/verify.sh`'s `--help` text is updated — it names "convention checks, dependency
      rules" today
- [ ] **Each renamed gate is proved able to fail, and the proof is described in the PR:**
      break a rule (e.g. drop `...options` out of a mutation hook) → `standards` goes red;
      add a forbidden import → `structure` goes red; edit `src/subscribers/` without regenerating
      → `generated` goes red. Restore all three
- [ ] `pnpm run verify` green, and its summary lists ten jobs

## Notes

The reason the two registry checks move is not tidiness. They answer a different question: not
*does this code meet a standard* but *was a generated file regenerated*. A developer reading
`generated ✗` knows to run a generator; the same failure under `conventions ✗` reads as a code
problem. That is the whole payoff, so do not merge the new gate back in to keep the job count down.

`job_generated` is named for its subject, like `openapi` and `schemas` are, rather than for the kind
of claim ("currency") — gates group by what a failure means for you, not one-to-one with the four
kinds in `spec.md`.

Two generated artifacts have no drift check at all — the Orval clients and the admin's
`routeTree.gen.ts`. Adding them is **out of scope**: a drift check needs its generator to be
deterministic and runnable offline inside the gate, and the OpenAPI dump currently needs
`.env.test`. This ticket only stops `AGENTS.md` claiming they are covered.

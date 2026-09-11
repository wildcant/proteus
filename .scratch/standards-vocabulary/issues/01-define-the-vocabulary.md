# 01 — Define the vocabulary

**What to build:** Five words get definitions, in the one file that is already the front door to
them. Nothing moves and nothing is renamed — this ticket is the argument the next two cite, and it
is worth landing on its own so the renames can be read against it.

**Blocked by:** None.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `standards/README.md` gains a `## The words` section, placed immediately after the opening
      lead and the bash block and **before** `## Where a rule goes` — it is the frame the rest of
      the file is written in, so it cannot sit at the bottom
- [ ] The section defines exactly five terms — **convention**, **standard**, **check**, **rule**,
      **gate** — each with what it means and what to avoid calling it, in the same shape
      `CONTEXT.md` uses for domain terms (`**Term**:` / definition / `_Avoid_:`)
- [ ] The load-bearing pair is stated as a transition, not as two labels: a convention is a practice
      nothing enforces yet; a standard is a convention with a check behind it. The section says
      plainly that this is why unchecked prose such as `data-hooks.md` belongs in `standards/` — the
      folder is named for what things become there
- [ ] **Check** and **rule** are distinguished: a check is the executable that enforces one
      standard; a rule is a check expressed declaratively as a file. The existing claim that a
      script owes a recorded reason is restated as following from that distinction, and the existing
      `## When a rule cannot express it` section is linked rather than duplicated
- [ ] **Gate** is defined as one job in `scripts/verify.sh`. Ticket 03 renames the gates; this
      ticket only names the concept, and must not describe gates that do not exist yet
- [ ] The four kinds a standard can be about — contents, structure, schema, currency — appear as a
      table naming where each lives. The structure row points at the package by its **current**
      name; ticket 02 updates it
- [ ] `AGENTS.md`'s existing sentence "A convention that can be checked is checked, and the check is
      a rule file" (in the `## Documentation` section, near the `standards/README.md` front-door
      paragraph) is rewritten to use the definitions and to point at the new section rather than
      restating it. It must get shorter, not longer — the file loads in full on every session
- [ ] Nothing is added to `CONTEXT.md`. If the temptation arises, the reason not to is that
      `CONTEXT.md` is the e-commerce glossary and this is not domain language — say so in the new
      section in one clause so the question is not reopened
- [ ] `pnpm run verify` green

## Notes

The definitions are not new vocabulary — every one of the five words is already in use in the repo.
The work is deciding which is which and writing it down, so resist inventing a sixth.

Two sentences already in `standards/README.md` do most of the argument and should be reused rather
than paraphrased: *"A convention that can be checked is checked, and the check is a rule file"* and
*"A convention is worth writing down before it has hardened into something checkable."* The second
one is the whole justification for `data-hooks.md` sitting in a folder called `standards/`.

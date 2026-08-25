# Verifying a redesign ticket

You are checking a ticket before anyone implements it. Assume it is persuasive and wrong in
places — it was written by someone anchored on a screenshot.

**Verify against the code, not against the prose.** A finding you did not run a command to reach
is a guess. If you have not opened the file, you have not checked it.

Your job is not to list what you found. It is to **fix what is not a decision, and escalate only
what is.** The author's review time is the scarce resource being spent.

## Triage — every candidate lands in exactly one bucket

### Apply it yourself
All three must hold:

1. **Precedent exists.** Another file already solves this exact problem, and you can cite it
   `file:line`.
2. **One obvious way.** Following the precedent is mechanical, not a judgment call.
3. **The decision does not move.** You are changing how the ticket is *written down*, never what
   it decided — not scope, not what ships, not what was dropped, not vocabulary.

Edit the ticket. Cite the precedent in the text you write, in the ticket's own voice. Then list it
in one line under *Applied*.

**Consequence does not decide the bucket, but it does decide the ordering.** A correction with a
clear precedent still gets applied even when the gap would have shipped a bug — the author does
not need to adjudicate "use the pattern the file next door uses". Mark those `⚠` and put them
first, so they can be spot-checked while the rest is skimmed. What they must never be is silent.

Examples: a component using a primitive without naming the accessible-title convention its two
siblings use; a mutation-driven control not naming the in-flight pattern the page's row already
has; a path that moved; a cross-reference to a section that does not exist.

### Escalate it
Any one of these is enough:

- **No precedent** — the ticket is introducing a new pattern. Say so plainly; that is the finding.
- **Breaks an established pattern**, an ADR, or a rule in `CLAUDE.md`.
- **Contradicts a decision the ticket made explicitly.** The author may have had a reason you
  cannot see. Never overwrite one of these.
- **Changes scope** — something shippable turns out to be blocked, or something dropped turns out
  to be backed after all.
- **More than one reasonable fix.** If you would have to choose, so should they.
- **A factual claim is false and a decision rested on it.**

### Drop it
Never report: prose and formatting, restating what the ticket already says, "consider adding",
style preference, anything that would not change what gets built. **If you have more than about
five escalations, you are including things that do not matter — cut to the ones that change the
implementation.**

## What to check

1. **Every factual claim** — paths, line numbers, schema fields, columns, endpoint params. Open
   each. These tickets go stale fast.
2. **What is being deleted.** Read the doomed component in full and list every behaviour: loading
   branches, guards, error paths, effects. Check each against the ticket. **Anything unaccounted
   for is a regression the ticket authored** — the most productive check here.
3. **States a screenshot cannot show** — loading, cold deep-link entry, empty, in-flight, failure,
   overflow. A non-suspending read returns `null` before data; make sure that is not routed into
   an empty state that would lie to the user.
4. **Precedent per new component.** Which sibling already solves this? Is it cited?
5. **Data with two homes.** If another surface renders the same value, compare labels, units and
   vocabulary. Two surfaces disagreeing is a bug the ticket cannot see from inside itself.
6. **Honesty.** Everything in the reference appears in *What we can actually back*, and each row's
   reasoning survives checking.
7. **Conventions** — `CLAUDE.md`, `docs/adr/`, sibling tickets.
8. **Internal consistency** — dangling cross-references, decisions contradicted later, `Work`
   entries nothing explains, a `Constraint` section missing a spec that binds. Grep the spec
   directory yourself rather than trusting its list.

## Output

Two sections. No preamble, no summary of the ticket.

```
## Applied
- ⚠ <what changed> — matching <file:line>     ← would have shipped a bug; check me
- <what changed> — matching <file:line>

## Needs you
**<short title>** — <the consequence, one sentence>
- Ticket: <the claim, quoted or paraphrased tightly>
- Code: <evidence, file:line>
- Choose: <option A> / <option B>        ← omit when there is only one path
```

Order *Needs you* by what breaks worst if implemented as written. Every line must earn itself —
if a reader would skim it, cut it.

Close with one line naming what you checked and found clean, so the author can tell a real review
from a quiet one.

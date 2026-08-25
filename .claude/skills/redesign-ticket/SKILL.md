---
name: redesign-ticket
description: "Write or update a ticket that redesigns a page or component against a visual reference, checking the reference against what the backend can actually serve before any decision is made."
disable-model-invocation: true
---

# Redesign Ticket

For work that takes a screenshot or a live site as its visual target and turns it into something
this codebase can honestly ship. Not the same job as `/to-tickets`, which slices a plan into
tracer bullets — a redesign ticket is one surface, and its hard part is deciding what to *drop*.

Tickets live at `.scratch/<feature>/issues/NN-name.md`. `.scratch/<feature>/spec.md` carries the
`Shipped` / `Next` lists and the cross-cutting decisions. Read the neighbouring tickets before
writing a new one — they set the vocabulary.

Exemplars: `04-footer.md` for the planning shape, `03-header.md` for the shipped shape.

## The rule the whole thing hangs on

**Never ship UI with nothing behind it.** The reference will show category tabs, a wishlist, a
best-sellers rail, trending searches. Most of it has no data in this codebase. Ship the subset
that is real, and say in the ticket why the rest is gone.

> A rail with one real destination is honest; three fake ones are not.

An empty gap in a cluster beats an icon that does nothing. A heading that overclaims is
acceptable **only** as a named, recorded decision with a `TODO`, never as an oversight.

## The second rule: diff what you are replacing

A redesign usually deletes something. **Read the component you are deleting, line by line, and
check every behaviour it has against what the ticket specifies.** Anything it handled that the
replacement does not name is a regression the ticket has authored.

Loading branches, guards, error paths and in-flight states are where this leaks, because none of
them are visible in a screenshot. If the ticket says a file is deleted and does not say what
happens to each branch inside it, the ticket is not finished.

## Two shapes

A ticket is written in the **planning** shape and rewritten into the **shipped** shape once the
work lands. Same file, same number — it is the working record, not an archive.

**Planning:** The reference · What we can actually back · Decisions · Work · Responsive ·
Blocked, and tracked elsewhere · Constraint

**Shipped:** The reference · Decisions · What shipped · What's left · Decisions still open ·
Out of scope · Constraint

## Sections

### Preamble
What is wrong with the surface today, in specifics — the classes it hardcodes, the pattern it
repeats. Then `Depends on NN-....md`.

### The reference
An ASCII diagram of the layout, plus **measured** values: bar heights, gutters, font sizes, hex
values, breakpoints. Extract them from the live target, do not eyeball them. Shared values belong
in `reference.md` so later tickets do not re-scrape.

Screenshots are scaled, so pixels read off them are meaningless on their own. Solve for the scale
first: find one element whose true size `reference.md` already knows (a button height, a bar
height), divide, and check the factor against a second element. Then give the numbers as a table —
`Capture | ÷ scale | We use` — mapping each to the token or utility it becomes. A reading that
does not agree with the solved scale is a misread, and the table is what shows that.

Never name the reference brand — not here, not anywhere in the repo. Write "the reference". Where
its own copy has to be quoted, use a `<Brand>` placeholder.

### What we can actually back
The section that does the work. A table, one row per slot in the reference:

| Slot | Us | Why |
|---|---|---|
| Two link columns | **Shop** and **Account** | four real routes, and that is all of them |
| "More About" tiles | dropped | no blog, no loyalty programme, no email signup |
| Locale selector | dropped | no i18n, one currency |

Fill it by reading the backend — the modules, the route definitions, the query params the store
endpoint actually exposes. Cite what you found (`StoreProductListParams exposes only q and the
find params`). Do this **before** the Decisions section; it is what makes the decisions obvious.

### Decisions
One per named decision. Bold lead sentence stating it, then the reasoning, then **the alternative
you rejected and why**. A decision with no rejected alternative is a description.

Record token-layer collisions, accessibility trade-offs and anything a future reader would
otherwise re-litigate.

### Work
File by file, with the specific change. Name new files as `(new)`. Say what a thing is *not* when
that is the interesting part ("Not FloatingLabelInput: that control is bordered, 56px, and floats
a label — none of which this wants").

### Responsive
Mobile-first, stated: base classes are the phone, `lg:` adds. Say what each breakpoint changes and
what deliberately does not change across them.

### States the reference cannot show you
A screenshot is one state. The ticket owes the rest, each as a decision or a `Work` bullet:

- **Loading**, and specifically a *cold* entry — the surface reached with nothing in the query
  cache. Non-suspending reads return `null` before they return data; say what renders in that gap
  and make sure it is not the empty state.
- **Empty**, and how it differs from loading.
- **In flight** — what a control does between click and response. Disabled? Spinner? Optimistic?
- **Failure** — a mutation that rejects, a fetch that errors.
- **Overflow** — long titles, many rows, a count past its badge width.
- **Deep entry** — if the surface is URL state, it can be linked to cold, which is what makes the
  loading state reachable in the first place.

Cite the pattern the codebase already uses for each. There is almost always one a file away.

### Blocked, and tracked elsewhere
What this ticket cannot finish, and where it now lives — another ticket, `.tasks/next-todos`, a
backend prerequisite. Never drop scope silently.

### Constraint
The existing tests this touches, by exact selector, split into:
- what **must keep working**, and
- what **legitimately breaks**, with the replacement assertion.

A redesign that changes DOM structure will break selectors. Naming them here is what stops the
next person rewriting a test to match a bug.

## When the work ships

Rewrite the ticket into the shipped shape. Move it to `Shipped` in `spec.md` with a one-line
summary naming anything still outstanding.

**Audit it against the code first.** These tickets go stale fast — paths move, components get
renamed, decisions get reversed mid-conversation. Grep every path and claim in the file. A ticket
describing files that no longer exist is worse than no ticket.

**Merge two tickets when they are recording the same decision twice.** If a follow-up ticket
restates the parent's model, fold it in, delete it, and repoint any `TODO` comments in code that
referenced it.

## Process

1. Read `spec.md` and the adjacent tickets for vocabulary and open decisions.
2. Read the reference: diagram it, measure it.
3. **Audit the backend** for every slot. This is where the ticket is won or lost.
4. Write Decisions from that audit, each against its rejected alternative.
5. Write Work file by file, then Responsive, then Blocked.
6. Grep the e2e specs for selectors on this surface; write Constraint from what you find.
7. Number it, add it to `spec.md` under `Next`.
8. **Verify it — with fresh eyes, not your own.** See below.

## Verifying a ticket

Dispatch a subagent for this. Do not run the checks in the same pass that wrote the ticket: you
are anchored on the reference and on your own audit, and the failure mode is confirming both.

```
Agent(
  subagent_type: "general-purpose",
  prompt: "Read .claude/skills/redesign-ticket/VERIFY.md and apply it to
           <path-to-ticket>. Report findings only."
)
```

The value is in the greps, not the reading. A reviewer who only reads the ticket will agree with
it — every claim is stated confidently, because the author believed it. `VERIFY.md` forces each
claim back against the code.

It returns two lists. **Applied** is already written into the ticket — corrections with a
precedent, where following it was mechanical and no decision moved. **Needs you** is only what
carries a real choice: a new pattern with nothing behind it, a broken convention, a scope change,
or a claim that turned out false with a decision resting on it. Everything else is dropped rather
than reported.

A *Needs you* item you disagree with becomes a *Decisions still open* entry, not a deletion.

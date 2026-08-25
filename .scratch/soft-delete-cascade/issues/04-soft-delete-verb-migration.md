# 04 — `deleteX` → `softDeleteX` migration

**What to build:** One verb per meaning across every module service. A developer reading a call site
can tell whether it hides a record or destroys it without opening the implementation. The
destructive verb survives only where something genuinely ceases to exist, so it keeps its warning
value.

**Blocked by:** 02 — renaming before the walker exists turns every hard delete that relies on the
database cascade into a soft delete that cascades nowhere, orphaning children across the codebase.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Every module-service deletion backed by one of our tables is named `softDeleteX` and soft-deletes
- [ ] Existing `deleteX` / `softDeleteX` synonym pairs collapse to one method; no deprecation shims or aliases are left behind
- [ ] Roughly 26 interface signatures, their implementations, and roughly 47 call sites across ~30 files are updated; typecheck is the completeness check
- [ ] **Carve-out A — three provider-facing operations keep `deleteX` and stay hard:** file storage, payment methods, and account holders. The object is destroyed at R2 or Stripe and retention there is not ours to control, so calling it soft would be a lie about what happened
- [ ] **The account-holder operation is a hybrid** — it destroys at the provider *and* soft-deletes our local record. Both halves must survive; do not normalise it into a pure passthrough
- [ ] **Carve-out B — password reset tokens keep `deleteX` and stay hard.** This is our own table, exempt for a different reason: it is a single-use bearer credential with no soft-delete column at all. A retained token hash *is* the threat model, and restoring a consumed credential has no legitimate meaning
- [ ] No other table-backed deletion keeps the destructive verb
- [ ] Full backend suite green; `npm run verify` green

## Notes

If the blast radius proves too large for one context window, split per module — the compiler
enumerates every remaining call site, so intermediate states are detectable rather than silent.

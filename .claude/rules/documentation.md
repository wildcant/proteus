---
description: Placement rules for documentation — ADRs, __docs__/, README.md, specs
paths:
  - "docs/**"
  - "standards/**"
  - "CONTEXT.md"
---

# Documentation placement

Before writing or moving any document, read `standards/README.md` — "Where a document goes".

- *How to build a thing* → `__docs__/` beside the rules, one file per use case.
- *How the machine works* → `README.md` of the code directory.
- *Why* → ADR in `docs/adr/`.
- *Vocabulary* → `CONTEXT.md`.
- *Cross-cutting guides* → `docs/`.
- *WIP* → `.scratch/<feature>/spec.md`, tickets in `.scratch/<feature>/issues/`.
- *Shipped specs* → `docs/specs/<feature>.md` marked `**Status:** shipped.`
